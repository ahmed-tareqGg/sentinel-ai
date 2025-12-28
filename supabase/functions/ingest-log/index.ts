import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
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

async function verifyAuth(req: Request): Promise<{ user: any; isApiKey: boolean; error?: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Check for API key authentication (for external systems like SIEM)
  const apiKey = req.headers.get('x-api-key');
  const validApiKeys = Deno.env.get('INGEST_API_KEYS')?.split(',').filter(k => k.trim()) || [];
  
  if (apiKey && validApiKeys.includes(apiKey)) {
    console.log('Authenticated via API key');
    return { user: { id: 'api-key-user', type: 'api_key' }, isApiKey: true };
  }

  // Check for JWT authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, isApiKey: false, error: 'Missing authorization. Provide JWT token or X-API-Key header.' };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, isApiKey: false, error: 'Invalid or expired token' };
  }

  // Check if user has required role (admin or soc_analyst)
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleData || !['admin', 'soc_analyst'].includes(roleData.role)) {
    return { user: null, isApiKey: false, error: 'Insufficient permissions. Admin or SOC Analyst role required.' };
  }

  return { user, isApiKey: false };
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
    // Verify authentication
    const { user, isApiKey, error: authError } = await verifyAuth(req);
    if (authError) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: authError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Authenticated: ${isApiKey ? 'API Key' : `User ${user.id}`}`);

    // Use service role for privileged operations after auth check
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

      // Analyze the log using AI (internal call with service key)
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
          },
          internal: true // Mark as internal call
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
        details: `Log ingested from ${source || 'API'} by ${isApiKey ? 'API key' : user.email || user.id}`,
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

      // 🔥 MITRE Enrichment Hook - Auto update coverage
      if (analysis?.mitre_techniques?.length > 0 || analysis?.mitre_technique) {
        console.log('🎯 Triggering MITRE enrichment...');
        try {
          await fetch(`${supabaseUrl}/functions/v1/mitre-enrichment`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'enrich_incident',
              incident_id: incident.id
            }),
          });
          console.log('MITRE enrichment completed for incident:', incident.incident_number);
        } catch (mitreError) {
          console.error('MITRE enrichment failed:', mitreError);
        }
      }

      // Auto-generate playbook suggestion for new attack types
      const existingPlaybook = await supabase
        .from('playbooks')
        .select('id')
        .or(`conditions->event_type.eq.${normalizedLog.eventType},conditions->event_type.ilike.%${normalizedLog.eventType}%`)
        .eq('is_active', true)
        .limit(1);

      if (!existingPlaybook.data?.length) {
        console.log('No playbook for event type, generating suggestion:', normalizedLog.eventType);
        
        // Auto-generate playbook for this event type
        try {
          const generateResponse = await fetch(`${supabaseUrl}/functions/v1/generate-playbook`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              autoGenerate: true,
              eventType: normalizedLog.eventType,
              riskLevel: analysis?.risk_level || 'Medium',
              severity: normalizedLog.severity,
            }),
          });

          if (generateResponse.ok) {
            const generatedPlaybook = await generateResponse.json();
            
            // Insert as suggestion (not auto-create to let analyst approve)
            await supabase.from('playbook_suggestions').insert({
              name: generatedPlaybook.name,
              description: generatedPlaybook.description || `Auto-generated for ${normalizedLog.eventType}`,
              suggested_conditions: generatedPlaybook.conditions,
              suggested_actions: generatedPlaybook.actions,
              reasoning: `Automatically suggested based on detected ${normalizedLog.eventType} incident (${incident.incident_number})`,
              confidence_score: analysis?.confidence || 70,
              pattern_source: 'auto_detection',
              sample_incident_ids: [incident.id],
              incident_count: 1,
              status: 'pending',
            });

            console.log('Created playbook suggestion for:', normalizedLog.eventType);

            await supabase.from('incident_timeline').insert({
              incident_id: incident.id,
              stage: 'Playbook Suggested',
              details: `Auto-generated playbook suggestion: ${generatedPlaybook.name}`,
            });
          }
        } catch (genError) {
          console.error('Failed to generate playbook suggestion:', genError);
        }
      }

      // Trigger Autonomous SOC Pipeline for all incidents
      console.log('🤖 Triggering Autonomous SOC Pipeline...');
      try {
        const autonomousResponse = await fetch(`${supabaseUrl}/functions/v1/autonomous-soc`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            incident_id: incident.id,
            mode: (analysis?.risk_level === 'Critical' || analysis?.classification === 'True Positive') 
              ? 'autonomous' 
              : 'supervised',
          }),
        });

        if (autonomousResponse.ok) {
          const pipelineResult = await autonomousResponse.json();
          console.log('Autonomous SOC Pipeline result:', pipelineResult.summary);
          results.push({
            incident_number: incident.incident_number,
            classification: analysis?.classification,
            risk_level: analysis?.risk_level,
            jira_ticket: pipelineResult.jira_ticket?.jira_key,
            pipeline_status: pipelineResult.summary,
          });
        } else {
          console.error('Autonomous SOC Pipeline failed:', await autonomousResponse.text());
          results.push({
            incident_number: incident.incident_number,
            classification: analysis?.classification,
            risk_level: analysis?.risk_level,
          });
        }
      } catch (pipelineError) {
        console.error('Pipeline error:', pipelineError);
        results.push({
          incident_number: incident.incident_number,
          classification: analysis?.classification,
          risk_level: analysis?.risk_level,
        });
      }
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