import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Fetch benign logs with medium or high severity (the ones that need incidents)
    const { data: logs, error: fetchError } = await supabase
      .from('raw_logs')
      .select('*')
      .eq('processing_status', 'benign')
      .in('severity', ['medium', 'high', 'critical'])
      .limit(50);

    if (fetchError) {
      console.error('Error fetching benign logs:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!logs || logs.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No medium/high/critical benign logs found to reprocess',
        processed: 0 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`Found ${logs.length} medium/high benign logs to reprocess`);

    let processedCount = 0;
    let incidentsCreated = 0;
    const errors: string[] = [];

    for (const log of logs) {
      try {
        const rawPayload = log.raw_payload || {};
        const severity = log.severity || 'low';
        const parsedMessage = log.parsed_message || '';

        console.log(`Processing log ${log.id} with severity ${severity}`);

        // Map text severity to numeric (incidents table uses integer)
        const incidentSeverity = severity === 'critical' ? 5 : 
                                  severity === 'high' ? 4 : 3; // medium = 3

        // Extract event info for title
        const eventType = rawPayload.event_id ? `Event ID: ${rawPayload.event_id}` : 
                          rawPayload.event_type || rawPayload.EventType || 'Security Event';
        const source = rawPayload.source || rawPayload.provider || log.log_type || 'Unknown';

        // Create incident directly using correct schema
        const { data: incident, error: incidentError } = await supabase
          .from('incidents')
          .insert({
            event_type: eventType,
            message: parsedMessage.substring(0, 500) || `Security event detected with ${severity} severity`,
            severity: incidentSeverity,
            status: 'Open',
            src_ip: log.ip_address,
            classification: 'Pending',
            confidence: 70,
            risk_level: severity === 'high' || severity === 'critical' ? 'High' : 'Medium',
            raw_log: JSON.stringify(rawPayload),
            recommended_actions: ['Review the security event', 'Check for related activity', 'Investigate if needed'],
            evidence: [parsedMessage.substring(0, 200)]
          })
          .select()
          .single();

        if (incidentError) {
          console.error(`Error creating incident for log ${log.id}:`, incidentError);
          errors.push(`Log ${log.id}: ${incidentError.message}`);
        } else {
          console.log(`Created incident ${incident.id} for log ${log.id}`);
          incidentsCreated++;

          // Update log status
          const { error: updateError } = await supabase
            .from('raw_logs')
            .update({ 
              processing_status: 'incident_created',
              incident_id: incident.id
            })
            .eq('id', log.id);

          if (updateError) {
            console.error(`Error updating log ${log.id}:`, updateError);
          }
        }

        processedCount++;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Error processing log ${log.id}:`, err);
        errors.push(`Log ${log.id}: ${errMsg}`);
      }
    }

    // Get remaining count
    const { count: remainingCount } = await supabase
      .from('raw_logs')
      .select('*', { count: 'exact', head: true })
      .eq('processing_status', 'benign')
      .in('severity', ['medium', 'high', 'critical']);

    return new Response(JSON.stringify({
      message: `Processed ${processedCount} benign logs with medium+ severity`,
      processed: processedCount,
      incidentsCreated: incidentsCreated,
      remaining: remainingCount || 0,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Reprocess error:', error);
    return new Response(JSON.stringify({ error: errorMsg }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
