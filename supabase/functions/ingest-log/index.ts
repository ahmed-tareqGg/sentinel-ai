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

// ========== SMART CORRELATION: Dedup & merge similar incidents ==========
const CORRELATION_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

interface CorrelationKey {
  src_ip: string;
  event_type: string;
  dst_ip?: string;
  file_hash?: string;
}

function buildCorrelationKey(log: ReturnType<typeof normalizeLog>, analysis: any): CorrelationKey {
  return {
    src_ip: log.srcIP || 'unknown',
    event_type: log.eventType || 'unknown',
    dst_ip: log.dstIP || undefined,
    file_hash: log.fileHash || undefined,
  };
}

// Check if a similar incident already exists within the correlation window
async function findExistingIncident(
  supabase: any,
  key: CorrelationKey,
  severity: number,
): Promise<any | null> {
  const windowStart = new Date(Date.now() - CORRELATION_WINDOW_MS).toISOString();

  // Match by: same src_ip + same event_type + within time window + not closed
  let query = supabase
    .from('incidents')
    .select('id, incident_number, severity, confidence, message, evidence, recommended_actions, ai_analysis, created_at')
    .eq('src_ip', key.src_ip)
    .eq('event_type', key.event_type)
    .gte('created_at', windowStart)
    .in('status', ['Open', 'New', 'Assigned', 'In Progress', 'open', 'new'])
    .order('created_at', { ascending: false })
    .limit(1);

  // Also match by file_hash if present
  if (key.file_hash) {
    query = supabase
      .from('incidents')
      .select('id, incident_number, severity, confidence, message, evidence, recommended_actions, ai_analysis, created_at')
      .eq('file_hash', key.file_hash)
      .gte('created_at', windowStart)
      .in('status', ['Open', 'New', 'Assigned', 'In Progress', 'open', 'new'])
      .order('created_at', { ascending: false })
      .limit(1);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) return null;
  return data[0];
}

// Merge new log data into existing incident
async function mergeIntoIncident(
  supabase: any,
  existing: any,
  newLog: ReturnType<typeof normalizeLog>,
  analysis: any,
): Promise<void> {
  const currentAnalysis = existing.ai_analysis || {};
  const correlatedCount = (currentAnalysis.correlated_events_count || 1) + 1;
  const correlatedSources = currentAnalysis.correlated_sources || [];
  correlatedSources.push({
    src_ip: newLog.srcIP,
    dst_ip: newLog.dstIP,
    timestamp: newLog.timestamp,
    message: (newLog.msg || '').slice(0, 200),
  });

  // Escalate severity if new event is higher
  const newSeverity = Math.max(existing.severity, newLog.severity);
  // Increase confidence when multiple correlated events confirm the same threat
  const newConfidence = Math.min(100, (existing.confidence || 50) + 5);

  const updatedAnalysis = {
    ...currentAnalysis,
    correlated_events_count: correlatedCount,
    correlated_sources: correlatedSources.slice(-20), // Keep last 20
    last_correlated_at: new Date().toISOString(),
    correlation_note: `${correlatedCount} related events detected within ${CORRELATION_WINDOW_MS / 60000} min window`,
  };

  // Merge evidence
  const mergedEvidence = [...new Set([
    ...(existing.evidence || []),
    ...(analysis?.evidence || []),
    `Correlated: ${correlatedCount} events from ${newLog.srcIP}`,
  ])];

  await supabase
    .from('incidents')
    .update({
      severity: newSeverity,
      confidence: newConfidence,
      ai_analysis: updatedAnalysis,
      evidence: mergedEvidence,
      risk_level: newSeverity >= 5 ? 'Critical' : newSeverity >= 4 ? 'High' : 'Medium',
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id);

  // Add timeline entry
  await supabase.from('incident_timeline').insert({
    incident_id: existing.id,
    stage: 'Correlated Event',
    details: `New related event merged: ${newLog.eventType} from ${newLog.srcIP} (total: ${correlatedCount})`,
  });

  console.log(`🔗 Merged into ${existing.incident_number} (${correlatedCount} correlated events)`);
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

// ========== MULTI-STAGE ATTACK CHAIN DETECTION ==========
// Detects sequences like: Recon → Credential Access → Lateral Movement → Exfiltration
const ATTACK_CHAIN_STAGES: Record<string, { order: number; label: string }> = {
  'Reconnaissance': { order: 1, label: 'Recon' },
  'Discovery': { order: 2, label: 'Discovery' },
  'Initial Access': { order: 3, label: 'Initial Access' },
  'Execution': { order: 4, label: 'Execution' },
  'Credential Access': { order: 5, label: 'Credential Access' },
  'Persistence': { order: 6, label: 'Persistence' },
  'Defense Evasion': { order: 7, label: 'Defense Evasion' },
  'Lateral Movement': { order: 8, label: 'Lateral Movement' },
  'Collection': { order: 9, label: 'Collection' },
  'Command and Control': { order: 10, label: 'C2' },
  'Exfiltration': { order: 11, label: 'Exfiltration' },
  'Impact': { order: 12, label: 'Impact' },
};

const CHAIN_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const MIN_CHAIN_STAGES = 3; // Need at least 3 distinct tactics to flag as attack chain

async function detectAttackChain(supabase: any, incident: any, analysis: any): Promise<void> {
  const srcIp = incident.src_ip;
  if (!srcIp || srcIp === 'Unknown') return;

  const tactic = analysis?.mitre_tactic || incident.mitre_tactic;
  if (!tactic || !ATTACK_CHAIN_STAGES[tactic]) return;

  const windowStart = new Date(Date.now() - CHAIN_WINDOW_MS).toISOString();

  // Find all recent incidents from the same source IP
  const { data: relatedIncidents, error } = await supabase
    .from('incidents')
    .select('id, incident_number, mitre_tactic, mitre_technique, severity, event_type, created_at')
    .eq('src_ip', srcIp)
    .gte('created_at', windowStart)
    .not('mitre_tactic', 'is', null)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error || !relatedIncidents || relatedIncidents.length < MIN_CHAIN_STAGES) return;

  // Extract unique tactics in order
  const seenTactics = new Map<string, { incident_id: string; technique: string; time: string }>();
  for (const inc of relatedIncidents) {
    if (inc.mitre_tactic && ATTACK_CHAIN_STAGES[inc.mitre_tactic] && !seenTactics.has(inc.mitre_tactic)) {
      seenTactics.set(inc.mitre_tactic, {
        incident_id: inc.id,
        technique: inc.mitre_technique || '',
        time: inc.created_at,
      });
    }
  }

  if (seenTactics.size < MIN_CHAIN_STAGES) return;

  // Sort by kill chain order
  const sortedTactics = [...seenTactics.entries()]
    .sort(([a], [b]) => (ATTACK_CHAIN_STAGES[a]?.order || 0) - (ATTACK_CHAIN_STAGES[b]?.order || 0));

  // Check for progression (at least 3 stages advancing in order)
  let progressionCount = 1;
  for (let i = 1; i < sortedTactics.length; i++) {
    const prevOrder = ATTACK_CHAIN_STAGES[sortedTactics[i - 1][0]]?.order || 0;
    const currOrder = ATTACK_CHAIN_STAGES[sortedTactics[i][0]]?.order || 0;
    if (currOrder > prevOrder) progressionCount++;
  }

  if (progressionCount < MIN_CHAIN_STAGES) return;

  const chainLabel = sortedTactics.map(([t]) => ATTACK_CHAIN_STAGES[t]?.label || t).join(' → ');
  console.log(`🔗 ATTACK CHAIN detected from ${srcIp}: ${chainLabel}`);

  // Escalate the current incident to Critical
  await supabase.from('incidents').update({
    severity: 5,
    risk_level: 'Critical',
    classification: 'True Positive',
    confidence: Math.min(100, (incident.confidence || 50) + 20),
    ai_analysis: {
      ...(incident.ai_analysis || {}),
      attack_chain: {
        detected: true,
        stages: sortedTactics.map(([tactic, data]) => ({ tactic, ...data })),
        chain_label: chainLabel,
        stage_count: seenTactics.size,
        detected_at: new Date().toISOString(),
      },
    },
    evidence: [
      ...(incident.evidence || []),
      `ATTACK CHAIN: ${seenTactics.size}-stage progression detected: ${chainLabel}`,
    ],
  }).eq('id', incident.id);

  // Add timeline entry
  await supabase.from('incident_timeline').insert({
    incident_id: incident.id,
    stage: 'Attack Chain Detected',
    details: `Multi-stage attack from ${srcIp}: ${chainLabel} (${seenTactics.size} stages in ${CHAIN_WINDOW_MS / 60000}min window)`,
  });

  // Also tag all related incidents
  const relatedIds = sortedTactics.map(([, d]) => d.incident_id);
  for (const rid of relatedIds) {
    if (rid !== incident.id) {
      await supabase.from('incident_timeline').insert({
        incident_id: rid,
        stage: 'Linked to Attack Chain',
        details: `Part of multi-stage attack from ${srcIp}: ${chainLabel}`,
      });
    }
  }
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

          // Step D: CORRELATION — Check for existing similar incident before creating new one
          const corrKey = buildCorrelationKey(normalizedLog, analysis);
          const existingIncident = await findExistingIncident(supabase, corrKey, normalizedLog.severity);

          if (existingIncident) {
            // Merge into existing incident instead of creating a new one
            await mergeIntoIncident(supabase, existingIncident, normalizedLog, analysis);
            
            // Link raw log to existing incident
            if (rawLogRowId) {
              await supabase.from('raw_logs').update({ 
                processing_status: 'correlated', 
                incident_id: existingIncident.id 
              }).eq('id', rawLogRowId);
            }
            
            incidentsSkipped++; // Count as "not a new incident"
            return {
              id: existingIncident.id,
              incident_number: existingIncident.incident_number,
              classification: analysis?.classification,
              risk_level: analysis?.risk_level,
              correlated: true,
            };
          }

          // Step E: No existing match — Create new incident
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
              ai_analysis: {
                ...(analysis?.ai_analysis || analysis || {}),
                correlated_events_count: 1,
              },
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

          // === THREAT INTEL AUTO-ENRICHMENT ===
          // Enrich src_ip with AbuseIPDB/OTX/VirusTotal
          if (normalizedLog.srcIP && normalizedLog.srcIP !== 'Unknown' && !normalizedLog.srcIP.startsWith('10.') && !normalizedLog.srcIP.startsWith('192.168.') && !normalizedLog.srcIP.startsWith('172.')) {
            postTasks.push(
              fetch(`${supabaseUrl}/functions/v1/threat-intel-lookup`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'lookup',
                  ioc_value: normalizedLog.srcIP,
                  ioc_type: 'ip',
                  incident_id: incident.id,
                  providers: ['abuseipdb', 'alienvault'],
                }),
              }).then(async (res) => {
                if (res.ok) {
                  const tiResult = await res.json();
                  // If threat score is high, boost incident confidence
                  if (tiResult.threat_score >= 50) {
                    await supabase.from('incidents').update({
                      confidence: Math.min(100, (incident.confidence || 50) + 10),
                      evidence: [...(incident.evidence || []), `TI Enrichment: ${normalizedLog.srcIP} threat score ${tiResult.threat_score}%`],
                    }).eq('id', incident.id);
                    await supabase.from('incident_timeline').insert({
                      incident_id: incident.id,
                      stage: 'Threat Intel Enriched',
                      details: `Source IP ${normalizedLog.srcIP} has threat score ${tiResult.threat_score}% (AbuseIPDB/OTX)`,
                    });
                    console.log(`🔍 TI: ${normalizedLog.srcIP} threat score ${tiResult.threat_score}%`);
                  }
                }
              }).catch(() => {})
            );
          }

          // Enrich file hash with VirusTotal
          if (normalizedLog.fileHash) {
            postTasks.push(
              fetch(`${supabaseUrl}/functions/v1/threat-intel-lookup`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'lookup',
                  ioc_value: normalizedLog.fileHash,
                  ioc_type: 'file_hash',
                  incident_id: incident.id,
                  providers: ['virustotal'],
                }),
              }).then(async (res) => {
                if (res.ok) {
                  const tiResult = await res.json();
                  if (tiResult.threat_score >= 30) {
                    await supabase.from('incidents').update({
                      confidence: Math.min(100, (incident.confidence || 50) + 15),
                      evidence: [...(incident.evidence || []), `VT: File hash ${normalizedLog.fileHash} flagged (score: ${tiResult.threat_score}%)`],
                    }).eq('id', incident.id);
                    console.log(`🔍 VT: Hash ${normalizedLog.fileHash} threat score ${tiResult.threat_score}%`);
                  }
                }
              }).catch(() => {})
            );
          }

          // === MULTI-STAGE ATTACK CHAIN DETECTION ===
          // Check if this incident is part of a broader attack chain
          if (analysis?.mitre_tactic) {
            postTasks.push(
              detectAttackChain(supabase, incident, analysis).catch(() => {})
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
