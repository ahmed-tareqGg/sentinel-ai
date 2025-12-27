import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RawLog {
  eventType?: string;
  severity?: number;
  srcIP?: string;
  srcip?: string;
  dstIP?: string;
  dstip?: string;
  msg?: string;
  message?: string;
  fileHash?: string;
  filehash?: string;
  action?: string;
  time?: string;
  timestamp?: string;
  [key: string]: unknown;
}

function normalizeLog(rawLog: RawLog) {
  return {
    eventType: rawLog.eventType || rawLog.event_type || 'Unknown',
    severity: rawLog.severity || 3,
    srcIP: rawLog.srcIP || rawLog.srcip || rawLog.src_ip || 'Unknown',
    dstIP: rawLog.dstIP || rawLog.dstip || rawLog.dst_ip || 'Unknown',
    msg: rawLog.msg || rawLog.message || '',
    fileHash: rawLog.fileHash || rawLog.filehash || rawLog.file_hash || null,
    action: rawLog.action || null,
    timestamp: rawLog.time || rawLog.timestamp || new Date().toISOString(),
    rawLog,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { logs, source } = await req.json() as { logs: RawLog | RawLog[], source?: string };
    
    const logsArray = Array.isArray(logs) ? logs : [logs];
    console.log(`Ingesting ${logsArray.length} logs from ${source || 'unknown source'}`);

    const results = [];

    for (const rawLog of logsArray) {
      const normalizedLog = normalizeLog(rawLog);
      console.log('Normalized log:', normalizedLog);

      // Analyze the log using AI
      const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-log`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          log: {
            eventType: normalizedLog.eventType,
            severity: normalizedLog.severity,
            srcIP: normalizedLog.srcIP,
            dstIP: normalizedLog.dstIP,
            msg: normalizedLog.msg,
            fileHash: normalizedLog.fileHash,
          }
        }),
      });

      let analysis = null;
      if (analyzeResponse.ok) {
        analysis = await analyzeResponse.json();
      } else {
        console.error('Analysis failed:', await analyzeResponse.text());
      }

      // Insert incident into database
      const { data: incident, error: insertError } = await supabase
        .from('incidents')
        .insert({
          timestamp: normalizedLog.timestamp,
          src_ip: normalizedLog.srcIP,
          dst_ip: normalizedLog.dstIP,
          severity: normalizedLog.severity,
          event_type: normalizedLog.eventType,
          message: normalizedLog.msg,
          file_hash: normalizedLog.fileHash,
          raw_log: normalizedLog.rawLog,
          classification: analysis?.classification || 'Pending',
          confidence: analysis?.confidence || 0,
          risk_level: analysis?.risk_level || 'Low',
          ai_analysis: analysis?.ai_analysis || null,
          sandbox_result: analysis?.sandbox_result || null,
          mitre_technique: analysis?.mitre_technique || null,
          mitre_tactic: analysis?.mitre_tactic || null,
          evidence: analysis?.evidence || [],
          recommended_actions: analysis?.recommended_actions || [],
        })
        .select()
        .single();

      if (insertError) {
        console.error('Failed to insert incident:', insertError);
        continue;
      }

      console.log('Created incident:', incident.incident_number);

      // Add timeline entry
      await supabase.from('incident_timeline').insert({
        incident_id: incident.id,
        stage: 'Event Received',
        details: `Log ingested from ${source || 'API'}`,
      });

      await supabase.from('incident_timeline').insert({
        incident_id: incident.id,
        stage: 'AI Analyzed',
        details: `Classification: ${analysis?.classification || 'Pending'}, Confidence: ${analysis?.confidence || 0}%`,
      });

      if (analysis?.sandbox_result) {
        await supabase.from('incident_timeline').insert({
          incident_id: incident.id,
          stage: 'Hash Checked',
          details: `Sandbox: ${analysis.sandbox_result.vendor}`,
        });
      }

      // Check if we need to trigger a playbook (for critical incidents)
      if (analysis?.risk_level === 'Critical' || (analysis?.classification === 'True Positive' && normalizedLog.severity >= 4)) {
        console.log('Triggering SOAR playbook for critical incident');
        
        // Call execute-playbook function
        await fetch(`${supabaseUrl}/functions/v1/execute-playbook`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            incident_id: incident.id,
            risk_level: analysis.risk_level,
            classification: analysis.classification,
          }),
        });
      }

      results.push({
        incident_number: incident.incident_number,
        classification: analysis?.classification,
        risk_level: analysis?.risk_level,
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: results.length,
      incidents: results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ingest-log function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
