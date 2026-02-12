import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutonomousSOCRequest {
  incident_id: string;
  mode?: 'autonomous' | 'supervised' | 'simulation';
}

interface PipelineResult {
  step: string;
  status: 'success' | 'failed' | 'skipped';
  details: any;
  timestamp: string;
}

// SLA definitions by severity (minutes)
const SLA_LIMITS: Record<number, { response_min: number; escalation_target: string }> = {
  5: { response_min: 15, escalation_target: 'soc_tier_3' },
  4: { response_min: 30, escalation_target: 'soc_tier_2' },
  3: { response_min: 60, escalation_target: 'soc_tier_2' },
  2: { response_min: 240, escalation_target: 'soc_tier_1' },
  1: { response_min: 480, escalation_target: 'soc_tier_1' },
};

// Autonomous containment actions by threat type
const AUTO_CONTAINMENT_MAP: Record<string, string[]> = {
  'brute_force': ['block_ip', 'lock_user'],
  'malware': ['isolate_host', 'block_ip', 'kill_process'],
  'ransomware': ['isolate_host', 'block_ip', 'kill_process'],
  'c2': ['block_ip', 'isolate_host'],
  'data_exfiltration': ['block_ip', 'isolate_host'],
  'credential_dump': ['lock_user', 'isolate_host'],
  'lateral_movement': ['isolate_host', 'block_ip'],
  'privilege_escalation': ['lock_user', 'isolate_host'],
  'phishing': ['block_ip', 'notify_user'],
  'backdoor': ['isolate_host', 'kill_process', 'block_ip'],
};

function detectThreatType(incident: any): string {
  const content = `${incident.event_type || ''} ${incident.message || ''} ${incident.mitre_tactic || ''}`.toLowerCase();
  for (const threatType of Object.keys(AUTO_CONTAINMENT_MAP)) {
    if (content.includes(threatType.replace('_', ' ')) || content.includes(threatType)) {
      return threatType;
    }
  }
  if (content.includes('credential')) return 'credential_dump';
  if (content.includes('lateral')) return 'lateral_movement';
  if (content.includes('exfil')) return 'data_exfiltration';
  if (content.includes('command and control')) return 'c2';
  return 'unknown';
}

async function checkAndEscalateSLA(supabase: any, incident: any, results: PipelineResult[]): Promise<void> {
  const slaConfig = SLA_LIMITS[incident.severity] || SLA_LIMITS[3];
  const createdAt = new Date(incident.created_at).getTime();
  const elapsedMin = (Date.now() - createdAt) / 60000;

  if (incident.escalated_at) {
    results.push({ step: 'sla_check', status: 'skipped', details: { reason: 'Already escalated' }, timestamp: new Date().toISOString() });
    return;
  }

  const openStatuses = ['Open', 'New', 'open', 'new'];
  if (openStatuses.includes(incident.status) && elapsedMin > slaConfig.response_min) {
    console.log(`⏰ SLA BREACH: ${incident.incident_number} open ${Math.round(elapsedMin)}min (limit: ${slaConfig.response_min}min)`);

    await supabase.from('incidents').update({
      status: 'Escalated',
      escalated_at: new Date().toISOString(),
      escalated_to: slaConfig.escalation_target,
      escalation_reason: `SLA breach: ${Math.round(elapsedMin)}min > ${slaConfig.response_min}min response SLA`,
      severity: Math.min(5, incident.severity + 1),
    }).eq('id', incident.id);

    await supabase.from('incident_timeline').insert({
      incident_id: incident.id,
      stage: 'Auto-Escalated (SLA Breach)',
      details: `Response SLA breached (${Math.round(elapsedMin)}min > ${slaConfig.response_min}min). Escalated to ${slaConfig.escalation_target}. Severity → ${Math.min(5, incident.severity + 1)}.`,
    });

    results.push({
      step: 'sla_auto_escalation', status: 'success',
      details: { elapsed_minutes: Math.round(elapsedMin), sla_limit: slaConfig.response_min, escalated_to: slaConfig.escalation_target },
      timestamp: new Date().toISOString(),
    });
  } else {
    results.push({
      step: 'sla_check', status: 'success',
      details: { elapsed_minutes: Math.round(elapsedMin), sla_limit: slaConfig.response_min, within_sla: true },
      timestamp: new Date().toISOString(),
    });
  }
}

async function executeAutonomousContainment(
  supabase: any, incident: any, results: PipelineResult[],
): Promise<void> {
  const threatType = detectThreatType(incident);
  const actions = AUTO_CONTAINMENT_MAP[threatType];

  if (!actions || actions.length === 0) {
    results.push({ step: 'autonomous_containment', status: 'skipped', details: { reason: `No containment for: ${threatType}` }, timestamp: new Date().toISOString() });
    return;
  }

  console.log(`🤖 AUTONOMOUS CONTAINMENT: ${incident.incident_number} → ${threatType} → [${actions.join(', ')}]`);
  const containmentResults: any[] = [];

  for (const action of actions) {
    try {
      const params: Record<string, string> = {};
      if (action === 'block_ip' && incident.src_ip) params.ip = incident.src_ip;
      if (action === 'isolate_host' && incident.dst_ip) params.host = incident.dst_ip;
      if (action === 'lock_user') params.user = 'auto-detected';
      if (action === 'kill_process') params.process = 'suspicious';
      if (action === 'notify_user') params.message = `Security alert: ${incident.message}`;

      await supabase.from('approval_requests').insert({
        action_type: action,
        incident_id: incident.id,
        reason: `[AUTONOMOUS] ${threatType} detected. Confidence: ${incident.confidence}%. Auto-executing ${action}.`,
        status: 'auto_approved',
        approved_at: new Date().toISOString(),
        approved_by: 'autonomous-soc',
        action_params: params,
      });

      await supabase.from('compliance_audit_logs').insert({
        action: `autonomous_${action}`,
        actor_type: 'system',
        actor_id: 'autonomous-soc',
        resource_type: 'incident',
        resource_id: incident.id,
        result: 'success',
        execution_mode: 'autonomous',
        details: { threat_type: threatType, action, params, confidence: incident.confidence, incident_number: incident.incident_number },
      });

      await supabase.from('incident_timeline').insert({
        incident_id: incident.id,
        stage: `Autonomous Action: ${action}`,
        details: `Auto-executed "${action}" for ${threatType} (confidence: ${incident.confidence}%)`,
      });

      containmentResults.push({ action, status: 'executed', params });
    } catch (e) {
      containmentResults.push({ action, status: 'failed', error: String(e) });
    }
  }

  await supabase.from('incidents').update({
    status: 'In Progress',
    ai_analysis: {
      ...(incident.ai_analysis || {}),
      autonomous_containment: {
        executed_at: new Date().toISOString(),
        threat_type: threatType,
        actions: containmentResults,
      },
    },
  }).eq('id', incident.id);

  results.push({
    step: 'autonomous_containment', status: 'success',
    details: { threat_type: threatType, actions_executed: containmentResults.filter(r => r.status === 'executed').length, details: containmentResults },
    timestamp: new Date().toISOString(),
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: PipelineResult[] = [];

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    const isInternalCall = authHeader === `Bearer ${supabaseKey}`;
    
    if (!isInternalCall) {
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader || '' } }
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: roleData } = await authClient.from('user_roles').select('role').eq('user_id', user.id).single();
      const allowedRoles = ['admin', 'soc_analyst', 'soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager', 'ciso'];
      if (!roleData || !allowedRoles.includes(roleData.role)) {
        return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { incident_id, mode = 'autonomous' } = await req.json() as AutonomousSOCRequest;

    console.log(`🤖 Autonomous SOC Pipeline: ${incident_id} [${mode}]`);

    // Fetch incident
    const { data: incident, error: incidentError } = await supabase.from('incidents').select('*').eq('id', incident_id).single();
    if (incidentError || !incident) throw new Error('Incident not found');

    results.push({ step: 'fetch_incident', status: 'success', details: { incident_number: incident.incident_number, event_type: incident.event_type }, timestamp: new Date().toISOString() });

    const { data: autonomousConfig } = await supabase.from('integrations').select('*').eq('name', 'autonomous_soc').single();
    const isAutonomous = mode === 'autonomous' || autonomousConfig?.autonomous_mode_enabled;
    const confidenceThreshold = autonomousConfig?.auto_execution_threshold || 75;

    // Step 1: AI Analysis
    if (!incident.ai_analysis || incident.classification === 'Pending') {
      console.log('📊 Running AI analysis...');
      const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-log`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ log: { eventType: incident.event_type, severity: incident.severity, srcIP: incident.src_ip, dstIP: incident.dst_ip, msg: incident.message, fileHash: incident.file_hash }, internal: true }),
      });

      if (analyzeResponse.ok) {
        const analysis = await analyzeResponse.json();
        await supabase.from('incidents').update({
          classification: analysis.classification, confidence: analysis.confidence, risk_level: analysis.risk_level,
          ai_analysis: analysis.ai_analysis, mitre_technique: analysis.mitre_technique, mitre_tactic: analysis.mitre_tactic,
          sandbox_result: analysis.sandbox_result, recommended_actions: analysis.recommended_actions,
        }).eq('id', incident_id);
        Object.assign(incident, analysis);
        results.push({ step: 'ai_analysis', status: 'success', details: { classification: analysis.classification, confidence: analysis.confidence, risk_level: analysis.risk_level }, timestamp: new Date().toISOString() });
      } else {
        results.push({ step: 'ai_analysis', status: 'failed', details: { error: 'Analysis failed' }, timestamp: new Date().toISOString() });
      }
    }

    // Step 2: SLA Check & Auto-Escalation
    await checkAndEscalateSLA(supabase, incident, results);

    // Step 3: Autonomous Containment (high-confidence TP with severity >= 4)
    const shouldAutoContain = isAutonomous && incident.classification === 'True Positive' && incident.confidence >= confidenceThreshold && incident.severity >= 4;
    if (shouldAutoContain) {
      await executeAutonomousContainment(supabase, incident, results);
    } else {
      results.push({
        step: 'autonomous_containment', status: 'skipped',
        details: { reason: !isAutonomous ? 'Not autonomous' : incident.classification !== 'True Positive' ? 'Not TP' : incident.severity < 4 ? `Sev ${incident.severity} < 4` : `Conf ${incident.confidence}% < ${confidenceThreshold}%` },
        timestamp: new Date().toISOString(),
      });
    }

    // Step 4: Report
    let reportPdf = null;
    try {
      const reportResponse = await fetch(`${supabaseUrl}/functions/v1/generate-report`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'incident', incident_id }),
      });
      if (reportResponse.ok) {
        const reportData = await reportResponse.json();
        reportPdf = reportData.pdf_base64;
        results.push({ step: 'generate_report', status: 'success', details: { report_id: reportData.report_id }, timestamp: new Date().toISOString() });
      }
    } catch (e) {
      results.push({ step: 'generate_report', status: 'failed', details: { error: String(e) }, timestamp: new Date().toISOString() });
    }

    // Step 5: Jira Ticket
    let jiraTicket = null;
    try {
      const jiraResponse = await fetch(`${supabaseUrl}/functions/v1/create-jira-ticket`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id, pdf_content: reportPdf }),
      });
      if (jiraResponse.ok) {
        jiraTicket = await jiraResponse.json();
        results.push({ step: 'create_jira_ticket', status: 'success', details: { jira_key: jiraTicket.jira_key }, timestamp: new Date().toISOString() });
      }
    } catch (e) {
      results.push({ step: 'create_jira_ticket', status: 'failed', details: { error: String(e) }, timestamp: new Date().toISOString() });
    }

    // Step 6: Playbook Execution
    const shouldExecutePlaybook = isAutonomous && incident.classification === 'True Positive' && incident.confidence >= confidenceThreshold;
    if (shouldExecutePlaybook) {
      try {
        const playbookResponse = await fetch(`${supabaseUrl}/functions/v1/smart-playbook`, {
          method: 'POST', headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ incident_id, event_type: incident.event_type, risk_level: incident.risk_level, classification: incident.classification, confidence: incident.confidence, src_ip: incident.src_ip }),
        });
        if (playbookResponse.ok) {
          const playbookResult = await playbookResponse.json();
          results.push({ step: 'execute_playbook', status: 'success', details: { playbooks_executed: playbookResult.executed_count }, timestamp: new Date().toISOString() });
        }
      } catch (e) {
        results.push({ step: 'execute_playbook', status: 'failed', details: { error: String(e) }, timestamp: new Date().toISOString() });
      }
    } else {
      results.push({ step: 'execute_playbook', status: 'skipped', details: { reason: 'Conditions not met' }, timestamp: new Date().toISOString() });
    }

    // Step 7: Escalation Check
    try {
      const escalateResponse = await fetch(`${supabaseUrl}/functions/v1/escalate-incident`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id }),
      });
      if (escalateResponse.ok) {
        results.push({ step: 'escalation_check', status: 'success', details: await escalateResponse.json(), timestamp: new Date().toISOString() });
      }
    } catch (e) {
      results.push({ step: 'escalation_check', status: 'failed', details: { error: String(e) }, timestamp: new Date().toISOString() });
    }

    // Final
    const processingTime = Date.now() - startTime;
    await supabase.from('incident_timeline').insert({
      incident_id,
      stage: 'Autonomous SOC Pipeline Complete',
      details: `${processingTime}ms. ${results.filter(r => r.status === 'success').length}/${results.length} OK.${shouldAutoContain ? ' CONTAINMENT ACTIVE.' : ''}`,
    });

    return new Response(JSON.stringify({
      success: true, incident_number: incident.incident_number, mode, processing_time_ms: processingTime,
      pipeline_results: results, jira_ticket: jiraTicket,
      summary: {
        steps_total: results.length, steps_successful: results.filter(r => r.status === 'success').length,
        steps_failed: results.filter(r => r.status === 'failed').length, steps_skipped: results.filter(r => r.status === 'skipped').length,
        autonomous_containment: shouldAutoContain, sla_breached: results.some(r => r.step === 'sla_auto_escalation'),
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error in autonomous-soc:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', pipeline_results: results }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});