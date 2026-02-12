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
  raw_log_id?: string;
  [key: string]: unknown;
}

const INCIDENT_RISK_THRESHOLD = 50;

async function verifyAuth(
  req: Request,
): Promise<{ user: any; isApiKey: boolean; error?: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token === serviceRoleKey) {
      return { user: { id: 'internal-service', type: 'service_role' }, isApiKey: true };
    }
  }

  const apiKey = req.headers.get('x-api-key');
  const validApiKeys =
    Deno.env.get('INGEST_API_KEYS')?.split(',').filter((k) => k.trim()) || [];

  if (apiKey && validApiKeys.includes(apiKey)) {
    return { user: { id: 'api-key-user', type: 'api_key' }, isApiKey: true };
  }

  if (!authHeader) {
    return { user: null, isApiKey: false, error: 'Missing authorization.' };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, isApiKey: false, error: 'Invalid or expired token' };
  }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleData || !['admin', 'soc_analyst', 'soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager', 'ciso'].includes(roleData.role)) {
    return { user: null, isApiKey: false, error: 'Insufficient permissions.' };
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

// Map AI classification to valid DB values: True Positive | False Positive | Pending
function normalizeClassification(raw: string | undefined | null): string {
  if (!raw) return 'Pending';
  const lower = raw.toLowerCase().trim();
  if (lower === 'true positive' || lower === 'malicious' || lower === 'suspicious') return 'True Positive';
  if (lower === 'false positive' || lower === 'benign' || lower === 'informational') return 'False Positive';
  return 'Pending';
}

function getRequestPublicIp(req: Request) {
  const cfIP = req.headers.get('cf-connecting-ip');
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const xRealIP = req.headers.get('x-real-ip');
  return cfIP || forwardedFor || xRealIP || null;
}

function shouldCreateIncident(analysis: any, severity: number): { create: boolean; reason: string } {
  // High severity always creates incident
  if (severity >= 4) {
    return { create: true, reason: 'High severity event' };
  }

  // Check AI classification
  const classification = (analysis?.classification || '').toLowerCase();
  if (classification === 'benign' || classification === 'false positive' || classification === 'informational') {
    return { create: false, reason: `AI classified as ${classification}` };
  }
  if (classification === 'true positive' || classification === 'malicious' || classification === 'suspicious') {
    return { create: true, reason: 'AI classified as True Positive/Malicious' };
  }

  // Check risk level
  const riskLevel = (analysis?.risk_level || '').toLowerCase();
  if (riskLevel === 'critical' || riskLevel === 'high') {
    return { create: true, reason: `Risk level: ${riskLevel}` };
  }

  // Check confidence score
  const confidence = analysis?.confidence || 0;
  if (confidence >= INCIDENT_RISK_THRESHOLD && classification !== 'benign' && classification !== 'false positive') {
    return { create: true, reason: `Confidence ${confidence}% exceeds threshold` };
  }

  // Check for MITRE techniques
  if (analysis?.mitre_technique || analysis?.mitre_techniques?.length > 0) {
    return { create: true, reason: 'MITRE technique detected' };
  }

  return { create: false, reason: 'Low risk, no incident needed' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user, isApiKey, error: authError } = await verifyAuth(req);
    if (authError) {
      return new Response(JSON.stringify({ error: authError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { logs, source } = await req.json() as { logs: RawLog | RawLog[], source?: string };
    const logsArray = Array.isArray(logs) ? logs : [logs];
    console.log(`📥 Ingesting ${logsArray.length} logs from ${source || 'unknown'}`);

    const skipRawLogInsert = req.headers.get('x-raw-logs-inserted') === 'true';
    const publicIp = getRequestPublicIp(req);

    const results: any[] = [];
    let incidentsCreated = 0;
    let incidentsSkipped = 0;

    // ===== Process logs in parallel batches of 5 =====
    const BATCH_SIZE = 5;
    for (let i = 0; i < logsArray.length; i += BATCH_SIZE) {
      const batch = logsArray.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (rawLog) => {
          const normalizedLog = normalizeLog(rawLog);
          const providedRawLogId = (rawLog as any).raw_log_id || (rawLog as any).rawLogId || null;
          let rawLogRowId: string | null = null;

          // Step A: Store raw log
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
              console.error('Raw log insert err:', rawInsertErr.message);
            } else {
              rawLogRowId = rawRow?.id || null;
            }
          } else {
            rawLogRowId = providedRawLogId;
          }

          // Step B: Analyze with AI (with 8s timeout)
          let analysis = null;
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
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
                internal: true,
              }),
              signal: controller.signal,
            });
            clearTimeout(timeout);

            if (analyzeResponse.ok) {
              analysis = await analyzeResponse.json();
            }
          } catch (_e) {
            // Timeout or error - continue with severity-based classification
            console.warn(`⏱️ Analysis timeout for ${normalizedLog.eventType}, using severity-based fallback`);
          }

          // Update raw log to analyzed
          if (rawLogRowId) {
            await supabase
              .from('raw_logs')
              .update({
                processing_status: 'analyzed',
                analyzed_at: new Date().toISOString(),
                mitre_technique: analysis?.mitre_technique || null,
                error_message: null,
              })
              .eq('id', rawLogRowId);
          }

          // Step C: Check if incident needed
          const decision = shouldCreateIncident(analysis, normalizedLog.severity);

          if (!decision.create) {
            incidentsSkipped++;
            if (rawLogRowId) {
              supabase.from('raw_logs').update({ processing_status: 'ignored' }).eq('id', rawLogRowId).then(() => {});
            }
            return null;
          }

          // Derive severity from AI risk_level when available
          const aiRiskLevel = (analysis?.risk_level || '').toLowerCase();
          let finalSeverity = normalizedLog.severity;
          if (aiRiskLevel === 'critical') finalSeverity = Math.max(finalSeverity, 5);
          else if (aiRiskLevel === 'high') finalSeverity = Math.max(finalSeverity, 4);
          else if (aiRiskLevel === 'medium') finalSeverity = Math.max(finalSeverity, 3);
          else if (aiRiskLevel === 'low') finalSeverity = Math.max(finalSeverity, 2);

          // Create incident
          const { data: incident, error: insertError } = await supabase
            .from('incidents')
            .insert({
              timestamp: normalizedLog.timestamp,
              src_ip: normalizedLog.srcIP,
              dst_ip: normalizedLog.dstIP,
              severity: finalSeverity,
              event_type: normalizedLog.eventType,
              message: normalizedLog.msg,
              file_hash: normalizedLog.fileHash,
              raw_log: normalizedLog.rawLog,
              classification: normalizeClassification(analysis?.classification),
              confidence: analysis?.confidence || 0,
              risk_level: analysis?.risk_level || (finalSeverity >= 4 ? 'High' : finalSeverity >= 3 ? 'Medium' : 'Low'),
              ai_analysis: analysis?.ai_analysis || analysis || null,
              sandbox_result: analysis?.sandbox_result || null,
              mitre_technique: analysis?.mitre_technique || null,
              mitre_tactic: analysis?.mitre_tactic || null,
              evidence: analysis?.evidence || [],
              recommended_actions: analysis?.recommended_actions || [],
            })
            .select()
            .single();

          if (insertError) {
            console.error('Incident create err:', insertError.message);
            if (rawLogRowId) {
              supabase.from('raw_logs').update({ processing_status: 'error', error_message: insertError.message }).eq('id', rawLogRowId).then(() => {});
            }
            return null;
          }

          incidentsCreated++;
          console.log(`✅ ${incident.incident_number}`);

          // === Fire-and-forget: all post-incident tasks in parallel, non-blocking ===
          const postTasks: Promise<any>[] = [];

          // Link raw log
          if (rawLogRowId) {
            postTasks.push(
              supabase.from('raw_logs').update({ processing_status: 'incident_created', incident_id: incident.id }).eq('id', rawLogRowId)
            );
          }

          // Timeline (batch insert)
          postTasks.push(
            supabase.from('incident_timeline').insert([
              { incident_id: incident.id, stage: 'Event Received', details: `Log from ${source || 'API'}` },
              { incident_id: incident.id, stage: 'AI Analyzed', details: `${analysis?.classification || 'Pending'} (${analysis?.confidence || 0}%)` },
            ])
          );

          // MITRE enrichment (fire-and-forget)
          if (analysis?.mitre_technique) {
            postTasks.push(
              fetch(`${supabaseUrl}/functions/v1/mitre-enrichment`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'enrich_incident', incident_id: incident.id }),
              }).catch(() => {})
            );
          }

          // Autonomous SOC (fire-and-forget)
          postTasks.push(
            fetch(`${supabaseUrl}/functions/v1/autonomous-soc`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                incident_id: incident.id,
                mode: (analysis?.risk_level === 'Critical' || analysis?.classification === 'True Positive')
                  ? 'autonomous' : 'supervised',
              }),
            }).catch(() => {})
          );

          // Run all post-tasks in parallel (don't wait for them to complete the response)
          Promise.allSettled(postTasks).catch(() => {});

          return {
            id: incident.id,
            incident_number: incident.incident_number,
            classification: analysis?.classification,
            risk_level: analysis?.risk_level,
          };
        })
      );

      // Collect results
      for (const r of batchResults) {
        if (r.status === 'fulfilled' && r.value) {
          results.push(r.value);
        }
      }
    }

    console.log(`✅ Done: ${incidentsCreated} incidents, ${incidentsSkipped} skipped`);

    return new Response(JSON.stringify({
      success: true,
      processed: logsArray.length,
      incidents_created: incidentsCreated,
      incidents_skipped: incidentsSkipped,
      incidents: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ingest-log:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
