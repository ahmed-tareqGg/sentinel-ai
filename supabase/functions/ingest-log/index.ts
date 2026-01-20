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

// Risk threshold for creating incidents (0-100)
const INCIDENT_RISK_THRESHOLD = 50;

async function verifyAuth(
  req: Request,
): Promise<{ user: any; isApiKey: boolean; error?: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1) Service-role internal calls (from backend functions)
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token === serviceRoleKey) {
      console.log('Authenticated via internal service role');
      return { user: { id: 'internal-service', type: 'service_role' }, isApiKey: true };
    }
  }

  // 2) API key authentication (for external systems like SIEM)
  const apiKey = req.headers.get('x-api-key');
  const validApiKeys =
    Deno.env.get('INGEST_API_KEYS')?.split(',').filter((k) => k.trim()) || [];

  if (apiKey && validApiKeys.includes(apiKey)) {
    console.log('Authenticated via API key');
    return { user: { id: 'api-key-user', type: 'api_key' }, isApiKey: true };
  }

  // 3) JWT authentication (browser/users)
  if (!authHeader) {
    return {
      user: null,
      isApiKey: false,
      error: 'Missing authorization. Provide JWT token or X-API-Key header.',
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, isApiKey: false, error: 'Invalid or expired token' };
  }

  // Check if user has required role (admin or soc_analyst)
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleData || !['admin', 'soc_analyst', 'soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager', 'ciso'].includes(roleData.role)) {
    return {
      user: null,
      isApiKey: false,
      error: 'Insufficient permissions. Admin or SOC Analyst role required.',
    };
  }

  return { user, isApiKey: false };
}

function normalizeLog(rawLog: RawLog) {
  return {
    eventType: rawLog.eventType || (rawLog as any).event_type || 'Unknown',
    severity: rawLog.severity || 3,
    srcIP: rawLog.srcIP || rawLog.srcip || (rawLog as any).src_ip || (rawLog as any).source_ip || 'Unknown',
    dstIP: rawLog.dstIP || rawLog.dstip || (rawLog as any).dst_ip || (rawLog as any).destination_ip || 'Unknown',
    msg: rawLog.msg || rawLog.message || '',
    fileHash: rawLog.fileHash || rawLog.filehash || (rawLog as any).file_hash || null,
    action: rawLog.action || null,
    timestamp: rawLog.time || rawLog.timestamp || new Date().toISOString(),
    rawLog,
  };
}

function severityToLabel(sev: number) {
  if (sev >= 5) return 'critical';
  if (sev >= 4) return 'high';
  if (sev >= 3) return 'medium';
  if (sev >= 2) return 'low';
  return 'info';
}

function getRequestPublicIp(req: Request) {
  const cfIP = req.headers.get('cf-connecting-ip');
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const xRealIP = req.headers.get('x-real-ip');
  return cfIP || forwardedFor || xRealIP || null;
}

// Decide if an incident should be created based on analysis
function shouldCreateIncident(analysis: any, severity: number): { create: boolean; reason: string } {
  // High severity always creates incident
  if (severity >= 4) {
    return { create: true, reason: 'High severity event' };
  }
  
  // Check AI classification
  const classification = (analysis?.classification || '').toLowerCase();
  if (classification === 'true positive' || classification === 'malicious') {
    return { create: true, reason: 'AI classified as True Positive/Malicious' };
  }
  
  // Check risk level
  const riskLevel = (analysis?.risk_level || '').toLowerCase();
  if (riskLevel === 'critical' || riskLevel === 'high') {
    return { create: true, reason: `Risk level: ${riskLevel}` };
  }
  
  // Check confidence score
  const confidence = analysis?.confidence || 0;
  if (confidence >= INCIDENT_RISK_THRESHOLD && classification !== 'benign') {
    return { create: true, reason: `Confidence ${confidence}% exceeds threshold` };
  }
  
  // Check for MITRE techniques (always interesting)
  if (analysis?.mitre_technique || analysis?.mitre_techniques?.length > 0) {
    return { create: true, reason: 'MITRE technique detected' };
  }
  
  // Low severity/benign events don't create incidents
  return { create: false, reason: 'Low risk, no incident needed' };
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
    console.log(`📥 Ingesting ${logsArray.length} logs from ${source || 'unknown source'}`);

    const skipRawLogInsert = req.headers.get('x-raw-logs-inserted') === 'true';
    const publicIp = getRequestPublicIp(req);

    const results = [];
    const rawLogIds: string[] = [];

    // ===== STEP 1: STORE ALL LOGS FIRST =====
    console.log('📝 Step 1: Storing all logs in raw_logs table...');
    
    for (const rawLog of logsArray) {
      const normalizedLog = normalizeLog(rawLog);
      
      let rawLogRowId: string | null = null;

      // Always store the incoming event in raw_logs FIRST (unless upstream already did)
      if (!skipRawLogInsert) {
        const hostname = (rawLog as any).hostname || (rawLog as any).host || source || 'unknown';
        const ipAddress = publicIp || normalizedLog.srcIP || null;
        const logType = (rawLog as any).log_type || (rawLog as any).logType || normalizedLog.eventType || 'unknown';

        const { data: rawRow, error: rawInsertErr } = await supabase
          .from('raw_logs')
          .insert({
            data_source_id: null,
            timestamp: normalizedLog.timestamp,
            log_type: logType,
            severity: severityToLabel(normalizedLog.severity),
            hostname,
            ip_address: ipAddress,
            raw_payload: normalizedLog.rawLog,
            parsed_message: normalizedLog.msg,
            processing_status: 'pending',
          })
          .select('id')
          .single();

        if (rawInsertErr) {
          console.error('Failed to insert raw log:', rawInsertErr);
        } else {
          rawLogRowId = rawRow?.id || null;
          if (rawLogRowId) rawLogIds.push(rawLogRowId);
          console.log(`📝 Stored raw log: ${rawLogRowId}`);
        }
      }
    }

    console.log(`✅ Step 1 complete: Stored ${rawLogIds.length} raw logs`);

    // ===== STEP 2: ANALYZE EACH LOG =====
    console.log('🔍 Step 2: Analyzing logs with AI...');
    
    const analyzedLogs: Array<{
      normalizedLog: any;
      rawLogRowId: string | null;
      analysis: any;
      rawLog: RawLog;
    }> = [];

    for (let i = 0; i < logsArray.length; i++) {
      const rawLog = logsArray[i];
      const normalizedLog = normalizeLog(rawLog);
      const rawLogRowId = skipRawLogInsert ? null : (rawLogIds[i] || null);

      // Analyze the log using AI (internal call with service key)
      let analysis = null;
      try {
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
            internal: true
          }),
        });

        if (analyzeResponse.ok) {
          analysis = await analyzeResponse.json();
          console.log(`🔍 Analyzed: ${normalizedLog.eventType} -> ${analysis?.classification || 'Unknown'} (${analysis?.confidence || 0}%)`);
        } else {
          console.error('Analysis failed:', await analyzeResponse.text());
        }
      } catch (analysisError) {
        console.error('Analysis error:', analysisError);
      }

      // Update raw log with analysis results (mark as analyzed)
      if (rawLogRowId) {
        await supabase
          .from('raw_logs')
          .update({
            processing_status: 'analyzed',
            analyzed_at: new Date().toISOString(),
            mitre_technique: analysis?.mitre_technique || null,
          })
          .eq('id', rawLogRowId);
      }

      analyzedLogs.push({ normalizedLog, rawLogRowId, analysis, rawLog });
    }

    console.log(`✅ Step 2 complete: Analyzed ${analyzedLogs.length} logs`);

    // ===== STEP 3: CREATE INCIDENTS ONLY FOR HIGH-RISK LOGS =====
    console.log('🚨 Step 3: Creating incidents for high-risk logs...');
    
    let incidentsCreated = 0;
    let incidentsSkipped = 0;

    for (const { normalizedLog, rawLogRowId, analysis, rawLog } of analyzedLogs) {
      const decision = shouldCreateIncident(analysis, normalizedLog.severity);
      
      if (!decision.create) {
        incidentsSkipped++;
        console.log(`⏭️ Skipping incident: ${decision.reason} - ${normalizedLog.eventType}`);
        
        // Mark as ignored (analyzed but no incident)
        if (rawLogRowId) {
          await supabase
            .from('raw_logs')
            .update({ processing_status: 'ignored' })
            .eq('id', rawLogRowId);
        }
        continue;
      }

      console.log(`🚨 Creating incident: ${decision.reason} - ${normalizedLog.eventType}`);

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

        if (rawLogRowId) {
          await supabase
            .from('raw_logs')
            .update({
              processing_status: 'error',
              error_message: 'Failed to create incident',
            })
            .eq('id', rawLogRowId);
        }

        continue;
      }

      incidentsCreated++;
      console.log('✅ Created incident:', incident.incident_number);

      // Mark raw log as incident_created with reference
      if (rawLogRowId) {
        await supabase
          .from('raw_logs')
          .update({
            processing_status: 'incident_created',
            incident_id: incident.id,
          })
          .eq('id', rawLogRowId);
      }

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

      // MITRE Enrichment Hook
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
          }
        } catch (genError) {
          console.error('Failed to generate playbook suggestion:', genError);
        }
      }

      // Trigger Autonomous SOC Pipeline
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
          results.push({
            id: incident.id,
            incident_number: incident.incident_number,
            classification: analysis?.classification,
            risk_level: analysis?.risk_level,
            jira_ticket: pipelineResult.jira_ticket?.jira_key,
            pipeline_status: pipelineResult.summary,
          });
        } else {
          results.push({
            id: incident.id,
            incident_number: incident.incident_number,
            classification: analysis?.classification,
            risk_level: analysis?.risk_level,
          });
        }
      } catch (pipelineError) {
        console.error('Pipeline error:', pipelineError);
        results.push({
          id: incident.id,
          incident_number: incident.incident_number,
          classification: analysis?.classification,
          risk_level: analysis?.risk_level,
        });
      }
    }

    console.log(`✅ Step 3 complete: Created ${incidentsCreated} incidents, skipped ${incidentsSkipped}`);

    return new Response(JSON.stringify({
      success: true,
      processed: logsArray.length,
      stored_in_raw_logs: rawLogIds.length,
      incidents_created: incidentsCreated,
      incidents_skipped: incidentsSkipped,
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
