import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Comprehensive page knowledge base
const PAGE_KNOWLEDGE: Record<string, string> = {
  '/dashboard': `USER IS ON: DASHBOARD — The main SOC operations overview.
WHAT THIS PAGE SHOWS:
- Real-time incident statistics (total, open, critical, closed)
- Severity distribution charts and trend graphs
- Classification breakdown (True Positive / False Positive / Pending)
- MITRE ATT&CK heatmap showing detected tactics & techniques
- Recent incidents table with quick actions
- SLA compliance indicators (MTTD/MTTR metrics)
HOW IT WORKS:
- Data refreshes in real-time via database subscriptions
- Incidents are created when raw logs are analyzed by AI (analyze-log function)
- MTTD = time from log ingestion to incident creation (automated, <1 min)
- MTTR = time from creation to resolution (resolved_at/closed_at minus created_at)
- Charts use Recharts library with severity color coding
TIPS FOR THE USER:
- Click any incident row to drill into details
- Use the classification filter to focus on True Positives
- MITRE heatmap cells are clickable for technique details`,

  '/incidents': `USER IS ON: INCIDENTS LIST — The main incident management queue.
WHAT THIS PAGE SHOWS:
- Filterable/searchable table of all security incidents
- Columns: ID, Event Type, Severity, Risk Level, Classification, Status, Source/Dest IP, MITRE info
- Bulk actions and sorting capabilities
- Status filters: Open, In Progress, Escalated, Resolved, Closed
- Risk level and severity filters
HOW IT WORKS:
- Incidents are auto-created when the AI engine (analyze-log) classifies an ingested log as suspicious
- Each incident gets a unique INC-XXXX number
- Classification: AI assigns True Positive/False Positive/Pending with confidence %
- Status flow: Open → In Progress → Escalated → Resolved → Closed
- Only assigned owners can take actions on incidents (security enforcement)
TIPS FOR THE USER:
- Click an incident to open the full investigation workspace
- Use search to find by incident number, IP, event type, or hash
- Sort by severity to prioritize critical alerts first`,

  '/compliance': `USER IS ON: COMPLIANCE & GRC — Governance, Risk, and Compliance management.
WHAT THIS PAGE SHOWS:
- Multiple tabs: Controls, Gaps, Risk Register, Audit Trail
- Controls Tab: Full list of compliance controls (NCA-ECC, ISO 27001, etc.) with implementation status, owner, evidence, and review dates
- Gaps Tab: Identified gaps between required controls and current implementation, with remediation plans and deadlines
- Risk Register Tab: Risk assessments linked to controls, with likelihood/impact scoring, mitigation strategies
- Audit Trail Tab: Complete log of all compliance-related changes (who changed what, when)
HOW IT WORKS:
- Controls are mapped to standards (NCA-ECC, ISO 27001, NIST CSF, etc.)
- Each control tracks: implementation status, owner, applicable/not-applicable, evidence, SLA
- Gaps are auto-detected when controls are marked not-implemented
- Risk Register uses a 5x5 matrix (likelihood × impact) for inherent and residual risk scoring
- Audit trail auto-records every change via PostgreSQL triggers
- Evidence is auto-mapped from audit_logs to controls via control_mapping_rules
- GRC audit trail captures actor, action, old/new values, timestamps, IP addresses
TIPS FOR THE USER:
- Use "Applicable" filter to see only relevant controls
- Gap remediation has target dates — overdue gaps are highlighted
- Risk Register supports treatment options: Mitigate, Accept, Transfer, Avoid
- Evidence can be auto-linked or manually attached to controls`,

  '/analytics': `USER IS ON: ANALYTICS — SOC performance and trend analysis.
WHAT THIS PAGE SHOWS:
- MTTD (Mean Time To Detect) and MTTR (Mean Time To Respond) metrics
- Incident volume trends over time (daily/weekly/monthly)
- Classification accuracy metrics
- Severity distribution trends
- Top event types and attack patterns
- Analyst productivity metrics
HOW IT WORKS:
- MTTD is calculated from raw_log.received_at to incident.created_at
- MTTR uses resolved_at or closed_at minus created_at, capped at 24h to exclude outliers
- MTTR auto-converts from minutes to hours for large values
- AI accuracy = % of incidents with confidence ≥80% among confirmed (non-Pending) incidents
- Data can be filtered by date range
TIPS FOR THE USER:
- Use date range filters to compare periods
- High false positive rates indicate detection rules need tuning
- MTTR > 2 hours may indicate insufficient automation or staffing`,

  '/playbooks': `USER IS ON: PLAYBOOKS — Automated response workflows and SOAR actions.
WHAT THIS PAGE SHOWS:
- Playbook Templates: Pre-built and custom response workflows
- SOAR Actions Dashboard: Available automated actions (block IP, kill process, lock user, etc.)
- Simulation Mode: Test playbooks without affecting production
- Autonomous Mode: Configure zero-touch execution for high-confidence detections
- AI Recommendations: AI-suggested playbooks based on incident patterns
- Analyst Feedback: Track analyst approvals/rejections for learning
- Explainable AI: See why a playbook was recommended
HOW IT WORKS:
- Playbooks are triggered automatically based on event_type, severity, and MITRE technique
- Each playbook defines steps: containment → investigation → remediation → recovery
- Execution modes: Manual (requires analyst approval), Semi-auto (approval for critical), Autonomous (no approval needed)
- Auto-learning: The system adjusts confidence thresholds based on analyst feedback
- SOAR actions are executed by deployed agents on endpoints (Windows/Linux) or network devices (Cisco/FortiGate/PaloAlto)
- Agents pull actions from the approval queue and execute them with audit logging
TIPS FOR THE USER:
- Start with Simulation Mode to validate before enabling real execution
- Set Autonomous Mode threshold carefully (recommended: 85%+ confidence)
- Review Explainable AI section to understand recommendation logic`,

  '/live-logs': `USER IS ON: LIVE LOGS — Real-time log stream viewer.
WHAT THIS PAGE SHOWS:
- Live streaming of raw security logs as they're ingested
- Log details: timestamp, source, type, severity, hostname, IP, parsed message
- Filtering by log type, severity, source
- Pause/resume controls for log stream
HOW IT WORKS:
- Logs are ingested via the ingest-log edge function (API endpoint for agents)
- Each log is stored in raw_logs table and optionally analyzed by AI
- Agents send logs via REST API using their API key
- Log types include: auth, system, security, firewall, syslog, network
- Processing status: pending → analyzed → incident_created / benign
TIPS FOR THE USER:
- Pause the stream to analyze specific entries
- Click a log to see full raw payload
- High-severity logs may already have corresponding incidents`,

  '/data-sources': `USER IS ON: DATA SOURCES — Agent and log source management.
WHAT THIS PAGE SHOWS:
- List of all connected agents and log sources
- Agent status: active, inactive, pending
- Heartbeat monitoring with last-seen timestamps
- Logs received today/total counters
- Agent configuration (OS type, version, hostname, IP)
- API key management for agent authentication
HOW IT WORKS:
- Agents are deployed on endpoints using Python scripts (Windows/Linux)
- Each agent sends heartbeats to confirm it's alive
- Agents authenticate using API keys (hashed, stored in agent_api_keys)
- License management controls max allowed agents per license
- Agents can collect logs from: OS events, syslog, Cisco, FortiGate, PaloAlto, Sophos
TIPS FOR THE USER:
- Agents showing "inactive" may need restarting or network troubleshooting
- Check heartbeat timestamps — gap > 5 minutes indicates issues
- Use the download buttons to get agent scripts for new deployments`,

  '/threat-intel': `USER IS ON: THREAT INTELLIGENCE — IOC feeds and threat lookups.
WHAT THIS PAGE SHOWS:
- Threat intelligence feeds configuration
- IOC (Indicators of Compromise) database
- Threat score and confidence ratings
- Country/ISP attribution for IPs
- Whitelisting management
- Enrichment history
HOW IT WORKS:
- TI feeds fetch IOCs periodically from external providers
- IOC types: IP, domain, hash, URL, email
- Each IOC has threat_score (0-100) and confidence rating
- Enrichment: When an incident contains an IP/hash, it's auto-checked against TI database
- The threat-intel-lookup edge function queries external sources for IOC enrichment
TIPS FOR THE USER:
- High threat_score IOCs should be blocked immediately
- Whitelist trusted IPs to reduce false positives
- Check enrichment logs for lookup history`,

  '/mitre-coverage': `USER IS ON: MITRE ATT&CK COVERAGE — Detection capability mapping.
WHAT THIS PAGE SHOWS:
- MITRE ATT&CK framework matrix with coverage overlay
- Coverage status per technique: Detected, Partial, Not Covered
- Detection count per technique
- Playbook availability per technique
- Gap identification for uncovered techniques
HOW IT WORKS:
- Coverage is auto-calculated from incidents — when an incident maps to a MITRE technique, it increases coverage
- The mitre-enrichment edge function maps event types to MITRE techniques
- Playbook linkage: techniques with associated playbooks show higher readiness
- Coverage status: "detected" = seen in incidents, "partial" = rules exist but limited, "not_covered" = blind spot
TIPS FOR THE USER:
- Focus on "not_covered" techniques in critical tactics (Initial Access, Execution, Persistence)
- Create playbooks for frequently detected techniques that lack them
- Use this view for audit reporting on detection capabilities`,

  '/approvals': `USER IS ON: APPROVALS — Action approval queue.
WHAT THIS PAGE SHOWS:
- Pending approval requests for automated actions
- Action details: type, target, reason, SLA deadline
- Approval/rejection workflow with audit trail
- Metrics: approval rate, average response time, SLA compliance
HOW IT WORKS:
- When a playbook triggers an action in semi-automatic mode, it creates an approval request
- Analysts review the request and approve or reject
- SLA deadlines ensure timely response
- Escalation: if not responded within SLA, request escalates to higher tier
- All decisions are logged in compliance_audit_logs
TIPS FOR THE USER:
- Prioritize requests close to SLA deadline
- Check the incident context before approving destructive actions
- Rejected requests should include a reason for learning`,

  '/team-chat': `USER IS ON: TEAM CHAT — Collaborative SOC communication.
WHAT THIS PAGE SHOWS:
- Real-time team messaging with channels (General, Alerts, Incidents, etc.)
- Private channels with password protection
- @mentions for users, #references for incidents, $references for policies
- Message reactions, read receipts, typing indicators
- File sharing and attachments
- Priority messaging for critical alerts
HOW IT WORKS:
- Messages are stored in chat_messages with real-time subscriptions
- @mentions notify the mentioned user and are searchable
- Incident references (#INC-XXXX) create clickable links
- Private channels require password to join
- Online presence is tracked via heartbeat mechanism
TIPS FOR THE USER:
- Use @mention to get specific analyst attention
- Reference incidents with #INC-XXXX for context
- Use priority flags for urgent communications`,

  '/reports': `USER IS ON: REPORTS — SOC report generation.
WHAT THIS PAGE SHOWS:
- Executive Report: High-level summary for leadership (risk overview, key findings, strategic recommendations)
- Performance Report: SOC metrics (MTTR, resolution rates, escalation rates, AI accuracy, event distribution)
- Custom Report: Build reports with custom date ranges
- Recent reports history with PDF download
HOW IT WORKS:
- Reports are generated by the generate-report edge function
- Executive reports focus on risk posture, incident classification, and strategic recommendations
- Performance reports focus on operational metrics, analyst productivity, and SLA compliance
- PDFs include professional cover page, colored sections, tables, and signature block
- Reports are stored locally for quick re-access
TIPS FOR THE USER:
- Executive Reports are for CISO/management briefings
- Performance Reports are for SOC team reviews and improvement planning
- Custom Reports allow specific date range analysis`,

  '/settings': `USER IS ON: SETTINGS — Platform configuration.
WHAT THIS PAGE SHOWS:
- Notification preferences (in-app, email, sound)
- Theme settings (dark/light mode)
- Account settings
HOW IT WORKS:
- Notification preferences are per-user, stored in notification_preferences table
- Categories: incidents, assignments, escalations, approvals, mentions, system
- Email notifications can be enabled for critical events
TIPS FOR THE USER:
- Enable email notifications for critical incidents to stay informed off-platform
- Customize which in-app notifications you receive to reduce noise`,

  '/profile': `USER IS ON: PROFILE — User profile and statistics.
WHAT THIS PAGE SHOWS:
- Personal information (name, email, role, avatar)
- Performance statistics (assigned incidents, resolved, notes created, chat engagement)
- Activity history
HOW IT WORKS:
- Profile data from profiles table
- Role from user_roles table (soc_tier_1 through admin)
- Statistics are calculated from incidents, analyst_notes, and chat_messages
- Avatar management with secure storage
- Higher-ranked users can view lower-ranked profiles via clickable names
TIPS FOR THE USER:
- Keep your profile updated for team visibility
- Monitor your resolved incidents count as a performance metric`,

  '/integrations': `USER IS ON: INTEGRATIONS — External tool connections.
WHAT THIS PAGE SHOWS:
- Available integrations (SIEM, SOAR, ticketing, communication)
- Integration status (enabled, configured, connection health)
- Execution modes (manual, semi-auto, autonomous)
HOW IT WORKS:
- Integrations connect SOCMind to external tools (Jira, Slack, email, etc.)
- The create-jira-ticket function creates tickets from incidents
- send-notification-email sends email alerts
- Each integration can be toggled and configured independently
TIPS FOR THE USER:
- Enable Jira integration for ticket tracking
- Configure email integration for off-platform notifications`,

  '/correlation': `USER IS ON: CORRELATION RULES ENGINE — Alert correlation and deduplication.
WHAT THIS PAGE SHOWS:
- Correlation rules list with match criteria
- Rule configuration: field, operator, value, threshold, time window
- Hit counts and last trigger timestamps
- Active/inactive toggle
HOW IT WORKS:
- Correlation rules detect patterns across multiple logs/incidents
- When threshold_count events match within time_window_minutes, a correlated incident is created
- Match fields: src_ip, dst_ip, event_type, file_hash
- Rules can auto-escalate severity based on correlation
- Hits are tracked in correlation_rule_matches
TIPS FOR THE USER:
- Start with IP-based correlation to detect brute force patterns
- Set reasonable time windows (5-30 minutes for most patterns)
- Monitor hit counts to validate rule effectiveness`,

  '/threat-hunting': `USER IS ON: THREAT HUNTING — Proactive threat detection.
WHAT THIS PAGE SHOWS:
- Hypothesis-driven hunting interface
- IOC search across all data sources
- Historical log analysis
- Hunt query builder
HOW IT WORKS:
- Analysts can search across incidents, logs, and TI data for indicators
- Hunting queries can target IPs, hashes, domains, event types
- Results show related incidents and raw logs
- Findings can be converted to correlation rules or new incidents
TIPS FOR THE USER:
- Start hunts based on TI feed alerts
- Use MITRE ATT&CK techniques as hunting hypotheses
- Document findings and convert to detection rules`,

  '/cloud-admin': `USER IS ON: CLOUD ADMIN — System administration panel.
WHAT THIS PAGE SHOWS:
- Cloud Overview: System health and resource usage
- User Management: User accounts, roles, access control
- Incident Management: Bulk operations on incidents
- Database: Direct database queries and management
- Functions: Edge function monitoring
- Logs: System logs viewer
HOW IT WORKS:
- Only accessible to Admin and CISO roles
- User Management: Assign roles (soc_tier_1 to admin), approve/deny access requests
- Role hierarchy: admin > ciso > soc_manager > soc_tier_3 > soc_tier_2 > soc_tier_1 > grc_engineer
- Each role has specific permissions defined in the permissions system
TIPS FOR THE USER:
- Review pending access requests regularly
- Assign appropriate roles based on analyst experience level
- Monitor system logs for errors or performance issues`,
};

// Get context for incident detail pages
function getIncidentDetailContext(route: string): string {
  if (!route.startsWith('/incidents/')) return '';
  return `USER IS ON: INCIDENT DETAIL — Full investigation workspace for a specific incident.
WHAT THIS PAGE SHOWS:
- Incident Header: Status, severity, risk level, classification, confidence, MITRE mapping
- Investigation Workspace Tabs:
  • IOC Manager: Add/manage Indicators of Compromise (IPs, hashes, domains, URLs)
  • Evidence Manager: Upload and manage evidence files (logs, screenshots, PCAPs up to 20MB)
  • Correlated Logs: View all raw logs linked to this incident + related incidents sharing same source IP
  • AI Reports: Generate comprehensive AI investigation reports with PDF export
  • Root Cause Analysis: AI-powered root cause determination
  • Analyst Notes: Add investigation notes with timestamps
- Incident Assignment: Assign/reassign to analysts
- SLA Tracking: Response and resolution SLA timers
- Timeline: Chronological event history
- Recommended Actions: AI-suggested containment and remediation
HOW IT WORKS:
- CRITICAL: User must "Assign to Me" before taking any action (security enforcement)
- IOCs are tracked per-incident and can be enriched via Threat Intel
- Evidence files are stored securely in cloud storage
- Correlated Logs tab shows raw_logs where incident_id matches, plus related incidents with same src_ip
- AI Reports use Gemini to generate detailed investigation reports from all incident data
- Root Cause Analysis uses AI to determine the likely cause chain
- Timeline auto-records all state changes (status, assignment, escalation)
TIPS FOR THE USER:
- Always assign the incident to yourself first
- Add IOCs immediately when identified
- Upload evidence before generating AI report (richer output)
- Check Correlated Logs for attack campaign patterns
- Generate AI report after completing investigation for documentation`;
}

function getPageContext(route: string): string {
  // Check exact matches first
  if (PAGE_KNOWLEDGE[route]) return PAGE_KNOWLEDGE[route];
  
  // Check incident detail
  if (route.startsWith('/incidents/')) return getIncidentDetailContext(route);
  
  // Check partial matches
  for (const [path, context] of Object.entries(PAGE_KNOWLEDGE)) {
    if (route.startsWith(path)) return context;
  }
  
  return `USER IS ON: ${route} — No specific context available for this page.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GEMINI_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!LOVABLE_API_KEY && !GEMINI_API_KEY && !OPENAI_API_KEY) throw new Error('No AI API key configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    let currentUserId: string | null = null;
    let currentUserEmail: string | null = null;
    let currentUserRole: string | null = null;
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
          // Fetch role
          const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single();
          if (roleData) currentUserRole = roleData.role;
        }
      }
    }

    const { messages, current_route } = await req.json();
    const pageContext = getPageContext(current_route || '/dashboard');

    const lastUserMsg = messages?.filter((m: any) => m.role === 'user').pop()?.content || '';
    const msgText = typeof lastUserMsg === 'string' ? lastUserMsg : JSON.stringify(lastUserMsg);

    // Extract search terms
    const hashMatch = msgText.match(/[a-fA-F0-9]{32,64}/g);
    const ipMatch = msgText.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g);
    const incidentMatch = msgText.match(/INC-\d+/gi);

    // Fetch ALL system data in parallel
    const queries: Promise<any>[] = [
      supabase.from('incidents').select('id, incident_number, event_type, severity, risk_level, classification, status, src_ip, dst_ip, mitre_technique, mitre_tactic, confidence, message, file_hash, assigned_to, evidence, recommended_actions, created_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('incidents').select('id, incident_number, event_type, risk_level, status, created_at').eq('status', 'Open').order('created_at', { ascending: false }).limit(10),
      supabase.from('raw_logs').select('id', { count: 'exact', head: true }),
      supabase.from('compliance_controls').select('id, standard, control_code, title, description, category, control_category, status, owner, applicable, justification, implemented, implementation_description, evidence_reference, risk_reference, comments, last_review').order('control_code', { ascending: true }),
      supabase.from('compliance_evidence').select('id, control_id, evidence_type, source, title, description, created_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('playbooks').select('id, name, description, is_active, created_at').limit(30),
      supabase.from('data_sources').select('id, name, type, status, hostname, ip_address, last_heartbeat, logs_received_today, agent_version').order('last_heartbeat', { ascending: false }).limit(20),
      supabase.from('correlation_rules').select('id, name, description, is_active, match_field, match_operator, match_value, threshold_count, time_window_minutes, hits_count, last_triggered_at').limit(20),
      supabase.from('mitre_coverage').select('technique_id, technique_name, tactic, coverage_status, detection_count, has_playbook').limit(50),
      supabase.from('integrations').select('id, name, display_name, type, is_enabled, is_configured, execution_mode, autonomous_mode_enabled').limit(20),
      supabase.from('approval_requests').select('id, action_type, status, incident_id, reason, requested_at, sla_deadline').eq('status', 'pending').order('requested_at', { ascending: false }).limit(10),
      supabase.from('compliance_audit_logs').select('id, action, actor_type, actor_email, resource_type, result, timestamp').order('timestamp', { ascending: false }).limit(20),
      supabase.from('control_gaps').select('id, control_id, gap_description, gap_severity, gap_status, remediation_plan, target_date').limit(20),
      supabase.from('risk_register').select('id, risk_id, risk_title, risk_category, likelihood, impact, inherent_risk_score, residual_risk_score, mitigation_status, treatment_option').limit(20),
    ];

    if (currentUserId) {
      queries.push(
        supabase.from('chat_messages')
          .select('id, sender_name, sender_email, content, channel, created_at, mentions, priority')
          .contains('mentions', [currentUserId])
          .order('created_at', { ascending: false })
          .limit(20)
      );
    }

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
    
    const [incidentsRes, openRes, statsRes, controlsRes, evidenceRes, playbooksRes, dataSourcesRes, corrRulesRes, mitreRes, integrationsRes, approvalsRes, compAuditRes, gapsRes, riskRegRes] = results;
    
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
    const riskRegister = riskRegRes.data || [];

    let extraIdx = 14;
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

    const standards = [...new Set(controls.map((c: any) => c.standard))];
    const standardsSummary = standards.map(std => {
      const stdControls = controls.filter((c: any) => c.standard === std);
      const stdApplicable = stdControls.filter((c: any) => c.applicable === 'yes' || c.applicable === null);
      const stdImpl = stdControls.filter((c: any) => c.implemented === true);
      return `${std}: ${stdImpl.length}/${stdApplicable.length} implemented (${stdApplicable.length > 0 ? Math.round((stdImpl.length / stdApplicable.length) * 100) : 0}%)`;
    }).join('\n');

    const notImplemented = controls.filter((c: any) => !c.implemented && (c.applicable === 'yes' || c.applicable === null));
    const notImplSummary = notImplemented.slice(0, 15).map((c: any) => 
      `• ${c.control_code}: ${c.title} [${c.status || 'N/A'}] ${c.owner ? `Owner: ${c.owner}` : ''}`
    ).join('\n');

    const gapsSummary = controlGaps.filter((g: any) => g.gap_status !== 'closed').slice(0, 10).map((g: any) => 
      `• ${g.gap_description?.slice(0, 80) || 'N/A'} [Severity: ${g.gap_severity || 'N/A'}] [Status: ${g.gap_status || 'open'}] ${g.target_date ? `Due: ${g.target_date}` : ''}`
    ).join('\n');

    // Risk Register summary
    const riskSummary = riskRegister.slice(0, 10).map((r: any) =>
      `• ${r.risk_id}: ${r.risk_title} [${r.risk_category || 'N/A'}] | Likelihood: ${r.likelihood || 'N/A'} | Impact: ${r.impact || 'N/A'} | Score: ${r.inherent_risk_score || 'N/A'} → Residual: ${r.residual_risk_score || 'N/A'} | Treatment: ${r.treatment_option || 'N/A'} | Status: ${r.mitigation_status || 'N/A'}`
    ).join('\n');

    let targetedContext = '';
    if (targetedResults.length > 0) {
      const unique = [...new Map(targetedResults.map((i: any) => [i.id, i])).values()];
      targetedContext = `\n\nSEARCH RESULTS (matching user query):\n${unique.map((i: any) => `• ${i.incident_number}: ${i.event_type} | Severity: ${i.severity} | Risk: ${i.risk_level} | Class: ${i.classification} | Hash: ${i.file_hash || 'N/A'} | Src: ${i.src_ip || 'N/A'} → Dst: ${i.dst_ip || 'N/A'} | MITRE: ${i.mitre_technique || 'N/A'} | Message: ${(i.message || '').slice(0, 200)} | Status: ${i.status}`).join('\n')}`;
    }

    let mentionsContext = '';
    if (mentionMessages.length > 0) {
      const cleanContent = (text: string) => text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1').replace(/#\[([^\]]+)\]\([^)]+\)/g, '#$1').replace(/\$\[([^\]]+)\]\([^)]+\)/g, '$$$1');
      mentionsContext = `\n\nTEAM CHAT MENTIONS:\n${mentionMessages.map((m: any) => `• [${m.channel}] ${m.sender_name || m.sender_email} (${new Date(m.created_at).toLocaleString()}): "${cleanContent(m.content)}" ${m.priority !== 'normal' ? `[Priority: ${m.priority}]` : ''}`).join('\n')}`;
    }

    const roleLabels: Record<string, string> = {
      soc_tier_1: 'SOC Tier 1 Analyst',
      soc_tier_2: 'SOC Tier 2 Analyst',
      soc_tier_3: 'SOC Tier 3 Senior Analyst',
      soc_manager: 'SOC Manager',
      admin: 'Administrator',
      ciso: 'CISO',
      grc_engineer: 'GRC Engineer',
    };

    const systemPrompt = `You are **SOCMind AI** — an expert Security Operations Center assistant embedded in a real SOC platform called SOCMind. You have COMPLETE knowledge of every feature, page, and capability in the system. You are the smartest AI assistant any SOC analyst could have.

===== CURRENT PAGE CONTEXT =====
${pageContext}

===== CURRENT USER =====
${currentUserId ? `Email: ${currentUserEmail || 'Unknown'}\nRole: ${roleLabels[currentUserRole || ''] || currentUserRole || 'Unknown'} (${currentUserRole})\nUser ID: ${currentUserId}` : 'Not authenticated'}

===== LIVE SOC STATUS =====
- Total Incidents (recent 50): ${incidents.length}
- Open Incidents: ${openIncidents.length}
- Critical Alerts: ${criticalCount}
- True Positives: ${tpCount} | False Positives: ${fpCount}
- Total Raw Logs Ingested: ${totalLogs}
- Active Data Sources: ${dataSources.filter((d: any) => d.status === 'active').length}/${dataSources.length}
- Active Playbooks: ${playbooks.filter((p: any) => p.is_active).length}/${playbooks.length}
- Pending Approvals: ${pendingApprovals.length}
- MITRE Techniques Covered: ${mitreCov.filter((m: any) => m.coverage_status === 'detected').length}/${mitreCov.length}

OPEN INCIDENTS:
${openIncidents.map((i: any) => `• ${i.incident_number} — ${i.event_type} [${i.risk_level}] — ${i.status} — ${new Date(i.created_at).toLocaleString()}`).join('\n') || 'None'}

RECENT INCIDENTS (top 20):
${incidents.slice(0, 20).map((i: any) => `• ${i.incident_number}: ${i.event_type} | Sev: ${i.severity} | Risk: ${i.risk_level} | Class: ${i.classification} (${i.confidence}%) | MITRE: ${i.mitre_technique || 'N/A'} (${i.mitre_tactic || 'N/A'}) | Src: ${i.src_ip || 'N/A'} → Dst: ${i.dst_ip || 'N/A'} | Status: ${i.status}`).join('\n')}

===== COMPLIANCE & GRC =====
Total Controls: ${controls.length} | Applicable: ${applicableControls.length} | Implemented: ${implementedControls.length} | Coverage: ${coveragePercent}%

BY STANDARD:
${standardsSummary}

NOT-IMPLEMENTED (top 15):
${notImplSummary || 'All applicable controls implemented ✅'}

OPEN GAPS:
${gapsSummary || 'No open gaps ✅'}

RISK REGISTER:
${riskSummary || 'No risks registered'}

RECENT EVIDENCE:
${compEvidence.slice(0, 10).map((e: any) => `• ${e.title} [${e.evidence_type}] ${e.source ? `Source: ${e.source}` : ''}`).join('\n')}

RECENT AUDIT TRAIL:
${compAuditLogs.slice(0, 10).map((l: any) => `• ${l.action} by ${l.actor_email || l.actor_type} → ${l.result} (${new Date(l.timestamp).toLocaleString()})`).join('\n')}

===== PLAYBOOKS =====
${playbooks.map((p: any) => `• ${p.name}: ${p.description || 'N/A'} | Active: ${p.is_active}`).join('\n') || 'None configured'}

===== DATA SOURCES =====
${dataSources.map((d: any) => `• ${d.name} [${d.type}] — ${d.status} | Host: ${d.hostname || 'N/A'} | IP: ${d.ip_address || 'N/A'} | Logs today: ${d.logs_received_today || 0} | Last heartbeat: ${d.last_heartbeat ? new Date(d.last_heartbeat).toLocaleString() : 'Never'}`).join('\n') || 'None'}

===== CORRELATION RULES =====
${corrRules.map((r: any) => `• ${r.name}: ${r.description || 'N/A'} | Active: ${r.is_active} | Hits: ${r.hits_count || 0}`).join('\n') || 'None configured'}

===== MITRE ATT&CK =====
${mitreCov.slice(0, 20).map((m: any) => `• ${m.technique_id} ${m.technique_name} [${m.tactic}] — ${m.coverage_status} | Detections: ${m.detection_count || 0} | Playbook: ${m.has_playbook ? '✅' : '❌'}`).join('\n') || 'No coverage data'}

===== INTEGRATIONS =====
${integrations.map((i: any) => `• ${i.display_name} [${i.type}] — Enabled: ${i.is_enabled} | Mode: ${i.execution_mode || 'manual'}`).join('\n') || 'None'}

===== PENDING APPROVALS =====
${pendingApprovals.length > 0 ? pendingApprovals.map((a: any) => `• ${a.action_type} — ${a.reason || 'No reason'} | ${a.sla_deadline ? `SLA: ${new Date(a.sla_deadline).toLocaleString()}` : ''}`).join('\n') : 'None ✅'}
${targetedContext}${mentionsContext}

===== PLATFORM ARCHITECTURE =====
SOCMind is a full AI-driven SOC platform with:
1. **Log Ingestion**: Agents deployed on endpoints (Windows/Linux) collect logs and send via REST API → ingest-log function → raw_logs table
2. **AI Analysis**: analyze-log function uses Gemini AI to classify each log → creates incidents with severity, MITRE mapping, recommendations
3. **Incident Management**: Full lifecycle from Open → In Progress → Escalated → Resolved → Closed, with assignment, SLA tracking, and ownership enforcement
4. **Investigation Workspace**: Per-incident workspace with IOCs, evidence upload, correlated logs, AI reports, root cause analysis, analyst notes
5. **SOAR**: Playbooks with automated response actions executed by agents (block IP, kill process, lock user, etc.)
6. **Compliance/GRC**: Controls mapped to standards (NCA-ECC, ISO 27001, NIST), gap analysis, risk register, auto-evidence collection
7. **Threat Intelligence**: IOC feeds, enrichment lookups, threat scoring
8. **Correlation Engine**: Pattern detection across logs (e.g., same IP hitting multiple times = brute force)
9. **MITRE ATT&CK**: Full framework coverage tracking with technique-to-playbook mapping
10. **Team Chat**: Real-time collaboration with @mentions, incident references, private channels
11. **Reports**: Executive and Performance PDF reports with professional formatting
12. **Approvals**: Action approval queue with SLA deadlines and escalation
13. **Role-Based Access**: soc_tier_1 → soc_tier_2 → soc_tier_3 → soc_manager → ciso → admin, each with specific permissions

===== RESPONSE RULES =====
1. **Be context-aware**: You KNOW which page the user is on. Tailor your answers to that page. If they ask "how does this work?", explain the CURRENT page.
2. **Be specific**: Always reference real data — incident numbers, control codes, metric values. Never give vague answers.
3. **Use structured formatting**: Use headers (##), bullet points, tables, bold, and code blocks for clarity.
4. **Provide actionable guidance**: Don't just explain — tell the user exactly what to do, step by step.
5. **Use MITRE ATT&CK terminology** when discussing threats and techniques.
6. **Answer in the user's language**: If they write in Arabic, respond in Arabic. If English, respond in English.
7. **Be proactive**: If you notice issues in the data (high false positive rate, SLA violations, uncovered MITRE techniques), mention them even if not asked.
8. **Reference the current page**: Start answers about the current page with context like "On this page, you can see..." or "Here in the Compliance tab..."
9. **Never say you don't have data** — you have LIVE data from every table in the system.
10. **Be the expert**: You are the most knowledgeable entity about this SOC platform. Give confident, authoritative answers.`;

    // Build provider fallback chain: Lovable AI → Google Gemini → OpenAI ChatGPT
    const providers: { name: string; url: string; key: string; model: string }[] = [];
    if (LOVABLE_API_KEY) providers.push({ name: 'Lovable AI', url: 'https://ai.gateway.lovable.dev/v1/chat/completions', key: LOVABLE_API_KEY, model: 'google/gemini-2.5-flash' });
    if (GEMINI_API_KEY) providers.push({ name: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: GEMINI_API_KEY, model: 'gemini-2.5-flash' });
    if (OPENAI_API_KEY) providers.push({ name: 'OpenAI ChatGPT', url: 'https://api.openai.com/v1/chat/completions', key: OPENAI_API_KEY, model: 'gpt-4o-mini' });

    const aiMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    const MAX_RETRIES = 2;

    for (const provider of providers) {
      console.log(`[soc-chat] Trying ${provider.name}...`);
      let succeeded = false;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 6000);
          console.log(`[soc-chat] ${provider.name} retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }

        try {
          const response = await fetch(provider.url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${provider.key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: provider.model, messages: aiMessages, stream: true }),
          });

          if (response.ok) {
            console.log(`[soc-chat] ✅ ${provider.name} succeeded`);
            return new Response(response.body, {
              headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
            });
          }

          if (response.status === 429) {
            console.warn(`[soc-chat] ${provider.name} 429 rate limited (attempt ${attempt + 1})`);
            await response.text();
            if (attempt < MAX_RETRIES) continue;
            // Exhausted retries for this provider, fall through to next
            console.warn(`[soc-chat] ${provider.name} exhausted retries, trying next provider...`);
            break;
          }

          if (response.status === 402) {
            console.warn(`[soc-chat] ${provider.name} 402 credits exhausted, trying next provider...`);
            await response.text();
            break; // Move to next provider
          }

          // Other error
          const errText = await response.text();
          console.error(`[soc-chat] ${provider.name} error ${response.status}:`, errText);
          break; // Move to next provider
        } catch (fetchErr) {
          console.error(`[soc-chat] ${provider.name} fetch error:`, fetchErr);
          break; // Move to next provider
        }
      }
    }

    // All providers failed
    return new Response(JSON.stringify({ error: 'All AI providers are currently unavailable. Please try again shortly.' }), {
      status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('soc-chat error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
