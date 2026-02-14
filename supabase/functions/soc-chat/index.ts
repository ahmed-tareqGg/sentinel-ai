import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    let currentUserId: string | null = null;
    let currentUserEmail: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
      if (token !== anonKey) {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: { user } } = await userClient.auth.getUser(token);
        if (user) {
          currentUserId = user.id;
          currentUserEmail = user.email || null;
        }
      }
    }

    const { messages } = await req.json();

    const lastUserMsg = messages?.filter((m: any) => m.role === 'user').pop()?.content || '';
    const msgText = typeof lastUserMsg === 'string' ? lastUserMsg : JSON.stringify(lastUserMsg);

    // Extract search terms
    const hashMatch = msgText.match(/[a-fA-F0-9]{32,64}/g);
    const ipMatch = msgText.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g);
    const incidentMatch = msgText.match(/INC-\d+/gi);

    // Fetch ALL system data in parallel
    const queries: Promise<any>[] = [
      // 1. Incidents
      supabase.from('incidents').select('id, incident_number, event_type, severity, risk_level, classification, status, src_ip, dst_ip, mitre_technique, mitre_tactic, confidence, message, file_hash, assigned_to, evidence, recommended_actions, created_at').order('created_at', { ascending: false }).limit(50),
      // 2. Open incidents
      supabase.from('incidents').select('id, incident_number, event_type, risk_level, status, created_at').eq('status', 'Open').order('created_at', { ascending: false }).limit(10),
      // 3. Raw logs count
      supabase.from('raw_logs').select('id', { count: 'exact', head: true }),
      // 4. Compliance controls
      supabase.from('compliance_controls').select('id, standard, control_code, title, description, category, control_category, status, owner, applicable, justification, implemented, implementation_description, evidence_reference, risk_reference, comments, last_review').order('control_code', { ascending: true }),
      // 5. Compliance evidence
      supabase.from('compliance_evidence').select('id, control_id, evidence_type, source, title, description, created_at').order('created_at', { ascending: false }).limit(50),
      // 6. Playbooks
      supabase.from('playbooks').select('id, name, description, trigger_type, severity_filter, is_active, created_at').limit(30),
      // 7. Data sources
      supabase.from('data_sources').select('id, name, type, status, hostname, ip_address, last_heartbeat, logs_received_today, agent_version').order('last_heartbeat', { ascending: false }).limit(20),
      // 8. Correlation rules
      supabase.from('correlation_rules').select('id, name, description, is_active, match_field, match_operator, match_value, threshold_count, time_window_minutes, hits_count, last_triggered_at').limit(20),
      // 9. MITRE coverage
      supabase.from('mitre_coverage').select('technique_id, technique_name, tactic, coverage_status, detection_count, has_playbook').limit(50),
      // 10. Integrations
      supabase.from('integrations').select('id, name, display_name, type, is_enabled, is_configured, execution_mode, autonomous_mode_enabled').limit(20),
      // 11. Approval requests
      supabase.from('approval_requests').select('id, action_type, status, incident_id, reason, requested_at, sla_deadline').eq('status', 'pending').order('requested_at', { ascending: false }).limit(10),
      // 12. Compliance audit logs (recent)
      supabase.from('compliance_audit_logs').select('id, action, actor_type, actor_email, resource_type, result, timestamp').order('timestamp', { ascending: false }).limit(20),
      // 13. Control gaps
      supabase.from('control_gaps').select('id, control_id, gap_description, gap_severity, gap_status, remediation_plan, target_date').limit(20),
    ];

    // Team chat mentions
    if (currentUserId) {
      queries.push(
        supabase.from('chat_messages')
          .select('id, sender_name, sender_email, content, channel, created_at, mentions, priority')
          .contains('mentions', [currentUserId])
          .order('created_at', { ascending: false })
          .limit(20)
      );
    }

    // Targeted searches
    if (hashMatch) {
      for (const hash of hashMatch) {
        queries.push(supabase.from('incidents').select('id, incident_number, event_type, severity, risk_level, classification, status, src_ip, dst_ip, file_hash, mitre_technique, mitre_tactic, message, created_at').ilike('file_hash', `%${hash}%`));
      }
    }
    if (ipMatch) {
      for (const ip of ipMatch) {
        queries.push(supabase.from('incidents').select('id, incident_number, event_type, severity, risk_level, classification, status, src_ip, dst_ip, file_hash, mitre_technique, message, created_at').or(`src_ip.eq.${ip},dst_ip.eq.${ip}`));
      }
    }
    if (incidentMatch) {
      for (const inc of incidentMatch) {
        queries.push(supabase.from('incidents').select('*').ilike('incident_number', `%${inc}%`));
      }
    }

    const results = await Promise.all(queries);
    
    // Destructure base results
    const [incidentsRes, openRes, statsRes, controlsRes, evidenceRes, playbooksRes, dataSourcesRes, corrRulesRes, mitreRes, integrationsRes, approvalsRes, compAuditRes, gapsRes] = results;
    
    const incidents = incidentsRes.data || [];
    const openIncidents = openRes.data || [];
    const totalLogs = statsRes.count || 0;
    const controls = controlsRes.data || [];
    const compEvidence = evidenceRes.data || [];
    const playbooks = playbooksRes.data || [];
    const dataSources = dataSourcesRes.data || [];
    const corrRules = corrRulesRes.data || [];
    const mitreCov = mitreRes.data || [];
    const integrations = integrationsRes.data || [];
    const pendingApprovals = approvalsRes.data || [];
    const compAuditLogs = compAuditRes.data || [];
    const controlGaps = gapsRes.data || [];

    // Process extra results (mentions + targeted)
    let extraIdx = 13;
    let mentionMessages: any[] = [];
    if (currentUserId) {
      mentionMessages = results[extraIdx]?.data || [];
      extraIdx++;
    }
    const targetedResults: any[] = [];
    for (let i = extraIdx; i < results.length; i++) {
      if (results[i].data?.length > 0) targetedResults.push(...results[i].data);
    }

    // Stats
    const criticalCount = incidents.filter((i: any) => i.risk_level === 'Critical').length;
    const tpCount = incidents.filter((i: any) => i.classification === 'True Positive').length;
    const fpCount = incidents.filter((i: any) => i.classification === 'False Positive').length;

    // Compliance stats
    const applicableControls = controls.filter((c: any) => c.applicable === 'yes' || c.applicable === null);
    const implementedControls = controls.filter((c: any) => c.implemented === true);
    const coveragePercent = applicableControls.length > 0
      ? Math.round((implementedControls.filter((c: any) => applicableControls.some((a: any) => a.id === c.id)).length / applicableControls.length) * 100)
      : 0;

    // Standards breakdown
    const standards = [...new Set(controls.map((c: any) => c.standard))];
    const standardsSummary = standards.map(std => {
      const stdControls = controls.filter((c: any) => c.standard === std);
      const stdApplicable = stdControls.filter((c: any) => c.applicable === 'yes' || c.applicable === null);
      const stdImpl = stdControls.filter((c: any) => c.implemented === true);
      return `${std}: ${stdImpl.length}/${stdApplicable.length} implemented (${stdApplicable.length > 0 ? Math.round((stdImpl.length / stdApplicable.length) * 100) : 0}%)`;
    }).join('\n');

    // Not-implemented controls list
    const notImplemented = controls.filter((c: any) => !c.implemented && (c.applicable === 'yes' || c.applicable === null));
    const notImplSummary = notImplemented.slice(0, 15).map((c: any) => 
      `• ${c.control_code}: ${c.title} [${c.status || 'N/A'}] ${c.owner ? `Owner: ${c.owner}` : ''}`
    ).join('\n');

    // Gaps summary
    const gapsSummary = controlGaps.filter((g: any) => g.gap_status !== 'closed').slice(0, 10).map((g: any) => 
      `• ${g.gap_description?.slice(0, 80) || 'N/A'} [Severity: ${g.gap_severity || 'N/A'}] [Status: ${g.gap_status || 'open'}] ${g.target_date ? `Due: ${g.target_date}` : ''}`
    ).join('\n');

    // Targeted context
    let targetedContext = '';
    if (targetedResults.length > 0) {
      const unique = [...new Map(targetedResults.map((i: any) => [i.id, i])).values()];
      targetedContext = `\n\nSEARCH RESULTS (matching user query):\n${unique.map((i: any) => `• ${i.incident_number}: ${i.event_type} | Severity: ${i.severity} | Risk: ${i.risk_level} | Class: ${i.classification} | Hash: ${i.file_hash || 'N/A'} | Src: ${i.src_ip || 'N/A'} → Dst: ${i.dst_ip || 'N/A'} | MITRE: ${i.mitre_technique || 'N/A'} | Message: ${(i.message || '').slice(0, 200)} | Status: ${i.status}`).join('\n')}`;
    }

    // Mentions context
    let mentionsContext = '';
    if (mentionMessages.length > 0) {
      const cleanContent = (text: string) => text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1').replace(/#\[([^\]]+)\]\([^)]+\)/g, '#$1').replace(/\$\[([^\]]+)\]\([^)]+\)/g, '$$$1');
      mentionsContext = `\n\nTEAM CHAT MENTIONS:\n${mentionMessages.map((m: any) => `• [${m.channel}] ${m.sender_name || m.sender_email} (${new Date(m.created_at).toLocaleString()}): "${cleanContent(m.content)}" ${m.priority !== 'normal' ? `[Priority: ${m.priority}]` : ''}`).join('\n')}`;
    }

    const systemPrompt = `You are SOCMind AI — an expert Security Operations Center assistant embedded in a real SOC platform. You have FULL knowledge of the entire system.

CURRENT SOC STATUS:
- Total Incidents: ${incidents.length} (last 50)
- Open Incidents: ${openIncidents.length}
- Critical Alerts: ${criticalCount}
- True Positives: ${tpCount}, False Positives: ${fpCount}
- Total Raw Logs Ingested: ${totalLogs}

OPEN INCIDENTS:
${openIncidents.map((i: any) => `• ${i.incident_number} — ${i.event_type} [${i.risk_level}] — ${i.status} — ${new Date(i.created_at).toLocaleString()}`).join('\n')}

RECENT INCIDENT DETAILS:
${incidents.slice(0, 20).map((i: any) => `• ${i.incident_number}: ${i.event_type} | Severity: ${i.severity} | Risk: ${i.risk_level} | Class: ${i.classification} (${i.confidence}%) | Hash: ${i.file_hash || 'N/A'} | MITRE: ${i.mitre_technique || 'N/A'} (${i.mitre_tactic || 'N/A'}) | Src: ${i.src_ip || 'N/A'} → Dst: ${i.dst_ip || 'N/A'} | Status: ${i.status}`).join('\n')}

===== COMPLIANCE & GRC =====
Total Controls: ${controls.length}
Applicable: ${applicableControls.length}
Implemented: ${implementedControls.length}
Overall Coverage: ${coveragePercent}%

COVERAGE BY STANDARD:
${standardsSummary}

NOT-IMPLEMENTED CONTROLS (top 15):
${notImplSummary || 'All applicable controls are implemented ✅'}

OPEN GAPS:
${gapsSummary || 'No open gaps'}

RECENT COMPLIANCE EVIDENCE:
${compEvidence.slice(0, 10).map((e: any) => `• ${e.title} [${e.evidence_type}] ${e.source ? `Source: ${e.source}` : ''}`).join('\n')}

RECENT COMPLIANCE AUDIT LOGS:
${compAuditLogs.slice(0, 10).map((l: any) => `• ${l.action} by ${l.actor_email || l.actor_type} → ${l.result} (${new Date(l.timestamp).toLocaleString()})`).join('\n')}

===== PLAYBOOKS =====
${playbooks.map((p: any) => `• ${p.name}: ${p.description || 'N/A'} | Trigger: ${p.trigger_type} | Active: ${p.is_active}`).join('\n')}

===== DATA SOURCES =====
${dataSources.map((d: any) => `• ${d.name} [${d.type}] — ${d.status} | Host: ${d.hostname || 'N/A'} | IP: ${d.ip_address || 'N/A'} | Logs today: ${d.logs_received_today || 0} | Last heartbeat: ${d.last_heartbeat ? new Date(d.last_heartbeat).toLocaleString() : 'Never'}`).join('\n')}

===== CORRELATION RULES =====
${corrRules.map((r: any) => `• ${r.name}: ${r.description || 'N/A'} | Active: ${r.is_active} | Hits: ${r.hits_count || 0} | Last: ${r.last_triggered_at ? new Date(r.last_triggered_at).toLocaleString() : 'Never'}`).join('\n')}

===== MITRE ATT&CK COVERAGE =====
${mitreCov.slice(0, 20).map((m: any) => `• ${m.technique_id} ${m.technique_name} [${m.tactic}] — ${m.coverage_status} | Detections: ${m.detection_count || 0} | Playbook: ${m.has_playbook ? 'Yes' : 'No'}`).join('\n')}

===== INTEGRATIONS =====
${integrations.map((i: any) => `• ${i.display_name} [${i.type}] — Enabled: ${i.is_enabled} | Configured: ${i.is_configured} | Mode: ${i.execution_mode || 'manual'} | Autonomous: ${i.autonomous_mode_enabled || false}`).join('\n')}

===== PENDING APPROVALS =====
${pendingApprovals.length > 0 ? pendingApprovals.map((a: any) => `• ${a.action_type} — ${a.reason || 'No reason'} | Requested: ${new Date(a.requested_at).toLocaleString()} ${a.sla_deadline ? `| SLA: ${new Date(a.sla_deadline).toLocaleString()}` : ''}`).join('\n') : 'No pending approvals'}
${targetedContext}${mentionsContext}
${currentUserId ? `\nCURRENT USER: ${currentUserEmail || 'Unknown'} (ID: ${currentUserId})` : ''}

CAPABILITIES:
- Search incidents by hash, IP, incident number, event type
- Answer questions about compliance controls, coverage, gaps, evidence, and audit trail
- Explain MITRE ATT&CK techniques and coverage
- Show data source status and health
- Explain correlation rules and playbook configurations
- Show pending approvals and SLA deadlines
- Provide root cause analysis and investigation recommendations
- Access team chat mentions
- Provide compliance recommendations and gap analysis

RULES:
- Be concise and actionable — you're talking to SOC analysts
- ALWAYS reference specific incident numbers / control codes when relevant
- Use MITRE ATT&CK framework terminology
- Provide risk-prioritized recommendations
- When asked about compliance, use the COMPLIANCE & GRC data above. NEVER say you don't have compliance data.
- When asked about a control, reference its control_code, title, status, and implementation state
- Answer in the same language the user uses (Arabic or English)
- Be thorough — analysts depend on your accuracy`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again shortly.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('soc-chat error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
