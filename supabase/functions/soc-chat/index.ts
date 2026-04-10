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

    // Auth: require authenticated user with SOC role
    let currentUserId: string | null = null;
    let currentUserEmail: string | null = null;
    let currentUserRole: string | null = null;
    const authHeader = req.headers.get('Authorization');
    
    // Allow service role calls
    if (authHeader === `Bearer ${supabaseKey}`) {
      currentUserId = 'system';
      currentUserEmail = 'system@socmind.com';
      currentUserRole = 'admin';
    } else if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
      if (token !== anonKey) {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
        if (!claimsError && claimsData?.claims) {
          currentUserId = claimsData.claims.sub as string;
          currentUserEmail = (claimsData.claims.email as string) || null;
          const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', currentUserId).single();
          if (roleData) currentUserRole = roleData.role;
        }
      }
    }
    
    if (!currentUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { messages, current_route, chat_channel, reply_to_id } = await req.json();

    // Helper: save AI message to DB using service role (bypasses RLS)
    const saveAIMessage = async (content: string) => {
      if (!chat_channel || !content) return;
      try {
        await supabase.from('chat_messages').insert({
          sender_id: '00000000-0000-0000-0000-000000000000',
          sender_email: 'ai@socmind',
          sender_name: 'SOCMind AI',
          content,
          mentions: [],
          channel: chat_channel,
          priority: 'normal',
          reply_to_id: reply_to_id || null,
          attachments: [],
        });
      } catch (e) {
        console.error('[soc-chat] Failed to save AI message:', e);
      }
    };
    const pageContext = getPageContext(current_route || '/dashboard');

    const lastUserMsg = messages?.filter((m: any) => m.role === 'user').pop()?.content || '';
    const msgText = typeof lastUserMsg === 'string' ? lastUserMsg : JSON.stringify(lastUserMsg);

    // Extract search terms
    const hashMatch = msgText.match(/[a-fA-F0-9]{32,64}/g);
    const ipMatch = msgText.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g);
    const incidentMatch = msgText.match(/INC-\d+/gi);

    // Fetch essential data only (reduced to save tokens)
    const queries: Promise<any>[] = [
      supabase.from('incidents').select('id, incident_number, event_type, severity, risk_level, classification, status, src_ip, dst_ip, mitre_technique, confidence, message, created_at').order('created_at', { ascending: false }).limit(20),
      supabase.from('incidents').select('id, incident_number, event_type, risk_level, status, created_at').eq('status', 'Open').order('created_at', { ascending: false }).limit(10),
      supabase.from('playbooks').select('id, name, is_active').limit(30),
      supabase.from('data_sources').select('name, type, status, logs_received_today, last_heartbeat').order('last_heartbeat', { ascending: false }).limit(10),
      supabase.from('mitre_coverage').select('technique_id, technique_name, tactic, coverage_status, has_playbook').limit(30),
      supabase.from('approval_requests').select('id, action_type, status, reason').eq('status', 'pending').limit(5),
    ];

    if (currentUserId) {
      queries.push(
        supabase.from('chat_messages')
          .select('id, sender_name, content, channel, created_at')
          .contains('mentions', [currentUserId])
          .order('created_at', { ascending: false })
          .limit(5)
      );
    }

    if (ipMatch) {
      for (const ip of ipMatch.slice(0, 2)) {
        queries.push(supabase.from('incidents').select('id, incident_number, event_type, severity, risk_level, classification, status, src_ip, dst_ip, mitre_technique, message, created_at').or(`src_ip.eq.${ip},dst_ip.eq.${ip}`));
      }
    }
    if (incidentMatch) {
      for (const inc of incidentMatch.slice(0, 2)) {
        queries.push(supabase.from('incidents').select('id, incident_number, event_type, severity, risk_level, classification, status, src_ip, dst_ip, mitre_technique, message, created_at').ilike('incident_number', `%${inc}%`));
      }
    }

    const results = await Promise.all(queries);
    
    const [incidentsRes, openRes, playbooksRes, dataSourcesRes, mitreRes, approvalsRes] = results;
    
    const incidents = incidentsRes.data || [];
    const openIncidents = openRes.data || [];
    const playbooks = playbooksRes.data || [];
    const dataSources = dataSourcesRes.data || [];
    const mitreCov = mitreRes.data || [];
    const pendingApprovals = approvalsRes.data || [];

    let extraIdx = 6;
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

    let targetedContext = '';
    if (targetedResults.length > 0) {
      const unique = [...new Map(targetedResults.map((i: any) => [i.id, i])).values()];
      targetedContext = `\n\nSEARCH RESULTS:\n${unique.map((i: any) => `• ${i.incident_number}: ${i.event_type} | Sev: ${i.severity} | Risk: ${i.risk_level} | Src: ${i.src_ip || 'N/A'} | MITRE: ${i.mitre_technique || 'N/A'} | Msg: ${(i.message || '').slice(0, 150)} | Status: ${i.status}`).join('\n')}`;
    }

    let mentionsContext = '';
    if (mentionMessages.length > 0) {
      mentionsContext = `\n\nMENTIONS:\n${mentionMessages.map((m: any) => `• [${m.channel}] ${m.sender_name}: ${m.content.slice(0, 100)}`).join('\n')}`;
    }

    const roleLabels: Record<string, string> = {
      soc_tier_1: 'Tier 1', soc_tier_2: 'Tier 2', soc_tier_3: 'Tier 3',
      soc_manager: 'Manager', admin: 'Admin', ciso: 'CISO', grc_engineer: 'GRC',
    };

    const systemPrompt = `You are SOCMind AI — expert SOC assistant. Be concise, use markdown, reference real data.

PLATFORM IDENTITY:
SOCMind was created and developed by **Ahmed Tareq Abdelhady Alieldin** — a CCNA-certified SOC Analyst & Cybersecurity Professional ranked in the Top 4% on TryHackMe (3M+ users). He holds a BSc in Computer Science from Menoufia University (2025) and completed 600+ hours of SOC & Penetration Testing training at NTI Egypt (FortiSIEM, QRadar, Wireshark, Red Team). Ahmed designed and built the entire SOCMind platform from the ground up: the multi-model AI engine (GPT-5/Gemini Smart Router), SOAR automation, MITRE ATT&CK integration, GRC compliance (ISO 27001/NCA-ECC/NIST), Threat Intel pipeline, War Room, and Executive Reporting. His certifications include CCNA, eCIR (in progress), Fortinet NSE4 (in progress), CompTIA Security+, eJPT, SANS SEC450, and Red Hat RH124. His CV is downloadable at /Ahmed_Tareq_CV.pdf. When asked about the creator, founder, developer, or Ahmed Tareq — provide comprehensive details about his background, skills, and achievements.

PAGE: ${current_route || '/dashboard'}
${pageContext.slice(0, 500)}

USER: ${currentUserEmail || 'Unknown'} (${roleLabels[currentUserRole || ''] || currentUserRole || 'Unknown'})

SOC STATUS: ${incidents.length} incidents | ${openIncidents.length} open | ${criticalCount} critical | TP:${tpCount} FP:${fpCount}
Active sources: ${dataSources.filter((d: any) => d.status === 'active').length} | Active playbooks: ${playbooks.filter((p: any) => p.is_active).length} | Pending approvals: ${pendingApprovals.length}
MITRE covered: ${mitreCov.filter((m: any) => m.coverage_status === 'detected').length}/${mitreCov.length}

OPEN INCIDENTS:
${openIncidents.map((i: any) => `• ${i.incident_number} — ${i.event_type} [${i.risk_level}] ${i.status}`).join('\n') || 'None'}

RECENT (top 10):
${incidents.slice(0, 10).map((i: any) => `• ${i.incident_number}: ${i.event_type} Sev:${i.severity} ${i.risk_level} ${i.classification}(${i.confidence}%) MITRE:${i.mitre_technique || '-'} Src:${i.src_ip || '-'} ${i.status}`).join('\n')}

SOURCES: ${dataSources.map((d: any) => `${d.name}[${d.type}]:${d.status} logs:${d.logs_received_today || 0}`).join(' | ') || 'None'}

MITRE: ${mitreCov.slice(0, 10).map((m: any) => `${m.technique_id}(${m.coverage_status}${m.has_playbook ? '✅' : ''})`).join(' ')}
${targetedContext}${mentionsContext}

RULES: Answer in user's language. Be specific with data. Use ## headers, bullets, tables. Provide actionable steps. Reference MITRE techniques. Be proactive about issues.`;



    // ═══════════════════════════════════════════════════════════════
    // LAYER 1: RULE-BASED ENGINE — Works 100% without any AI provider
    // Handles common SOC questions directly from the database
    // ═══════════════════════════════════════════════════════════════
    const ruleBasedResponse = await tryRuleBasedEngine(msgText, incidents, openIncidents, dataSources, mitreCov, pendingApprovals, playbooks);
    if (ruleBasedResponse) {
      console.log('[soc-chat] ✅ Rule-Based Engine answered');
      await saveAIMessage(ruleBasedResponse);
      return streamTextResponse(ruleBasedResponse, corsHeaders);
    }

    // ═══════════════════════════════════════════════════════════════
    // LAYER 2: OFFLINE CACHE — Serve cached AI response if available
    // ═══════════════════════════════════════════════════════════════
    const cacheKey = await hashQuery(msgText.toLowerCase().trim().slice(0, 200));
    const { data: cachedEntry } = await supabase
      .from('ai_response_cache')
      .select('id, response_text, hit_count')
      .eq('query_hash', cacheKey)
      .single();

    if (cachedEntry) {
      console.log(`[soc-chat] ✅ Cache hit (${cachedEntry.hit_count + 1} times)`);
      supabase.from('ai_response_cache').update({ hit_count: cachedEntry.hit_count + 1, last_used_at: new Date().toISOString() }).eq('id', cachedEntry.id).then(() => {});
      const cachedText = cachedEntry.response_text + '\n\n*🗄️ Cached response — AI providers unavailable*';
      await saveAIMessage(cachedText);
      return streamTextResponse(cachedText, corsHeaders);
    }

    // ═══════════════════════════════════════════════════════════════
    // LAYER 3: SMART AI ROUTER — Intent Detection + Model Selection
    // Multi-Model Orchestration with Quality Guard & Fallback
    // ═══════════════════════════════════════════════════════════════
    const OLLAMA_ENDPOINT = Deno.env.get('OLLAMA_ENDPOINT');
    const OLLAMA_MODEL = Deno.env.get('OLLAMA_MODEL') || 'llama3';
    const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

    // ── Intent Detection ──
    const intent = detectIntent(msgText);
    console.log(`[soc-chat] 🧠 Intent: ${intent}`);

    // ── Build provider chains per intent (primary → fallbacks) ──
    type Provider = { name: string; url: string; key: string; model: string; isOllama?: boolean };
    const allProviders: Record<string, Provider[]> = {
      // Simple/greeting → cheapest & fastest
      simple: [],
      // SOC operational queries → balanced
      soc_query: [],
      // Compliance/GRC → balanced with good reasoning
      compliance: [],
      // Complex analysis, threat hunting, RCA → most powerful
      complex: [],
    };

    if (LOVABLE_API_KEY) {
      // Simple: ultra-fast, cheap
      allProviders.simple.push(
        { name: 'Gemini Flash Lite', url: GATEWAY_URL, key: LOVABLE_API_KEY, model: 'google/gemini-2.5-flash-lite' },
        { name: 'GPT-5 Nano', url: GATEWAY_URL, key: LOVABLE_API_KEY, model: 'openai/gpt-5-nano' },
      );
      // SOC queries: balanced speed + accuracy
      allProviders.soc_query.push(
        { name: 'Gemini 3 Flash', url: GATEWAY_URL, key: LOVABLE_API_KEY, model: 'google/gemini-3-flash-preview' },
        { name: 'Gemini Flash', url: GATEWAY_URL, key: LOVABLE_API_KEY, model: 'google/gemini-2.5-flash' },
        { name: 'GPT-5 Nano', url: GATEWAY_URL, key: LOVABLE_API_KEY, model: 'openai/gpt-5-nano' },
      );
      // Compliance: needs good reasoning
      allProviders.compliance.push(
        { name: 'Gemini Flash', url: GATEWAY_URL, key: LOVABLE_API_KEY, model: 'google/gemini-2.5-flash' },
        { name: 'GPT-5 Mini', url: GATEWAY_URL, key: LOVABLE_API_KEY, model: 'openai/gpt-5-mini' },
        { name: 'Gemini 3 Flash', url: GATEWAY_URL, key: LOVABLE_API_KEY, model: 'google/gemini-3-flash-preview' },
      );
      // Complex: most powerful models first
      allProviders.complex.push(
        { name: 'GPT-5 Mini', url: GATEWAY_URL, key: LOVABLE_API_KEY, model: 'openai/gpt-5-mini' },
        { name: 'Gemini 2.5 Pro', url: GATEWAY_URL, key: LOVABLE_API_KEY, model: 'google/gemini-2.5-pro' },
        { name: 'Gemini Flash', url: GATEWAY_URL, key: LOVABLE_API_KEY, model: 'google/gemini-2.5-flash' },
      );
    }

    // Self-Hosted Ollama fallback for all intents
    if (OLLAMA_ENDPOINT) {
      const ollamaProvider: Provider = { name: `Ollama (${OLLAMA_MODEL})`, url: `${OLLAMA_ENDPOINT}/v1/chat/completions`, key: 'ollama', model: OLLAMA_MODEL, isOllama: true };
      for (const chain of Object.values(allProviders)) chain.push(ollamaProvider);
    }
    // Direct API fallbacks for all intents
    if (GEMINI_API_KEY) {
      const gDirect: Provider = { name: 'Gemini Direct', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: GEMINI_API_KEY, model: 'gemini-2.0-flash-lite' };
      for (const chain of Object.values(allProviders)) chain.push(gDirect);
    }
    if (OPENAI_API_KEY) {
      const oDirect: Provider = { name: 'OpenAI Direct', url: 'https://api.openai.com/v1/chat/completions', key: OPENAI_API_KEY, model: 'gpt-4o-mini' };
      for (const chain of Object.values(allProviders)) chain.push(oDirect);
    }

    // Select provider chain based on intent
    const providers = allProviders[intent] || allProviders.soc_query;
    console.log(`[soc-chat] 🔀 Router: ${intent} → [${providers.map(p => p.name).join(' → ')}]`);

    const aiMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    const MAX_RETRIES = 2;

    for (const provider of providers) {
      console.log(`[soc-chat] Trying ${provider.name}...`);

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 6000);
          await new Promise(r => setTimeout(r, delay));
        }

        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (!provider.isOllama) {
            headers['Authorization'] = `Bearer ${provider.key}`;
          } else {
            headers['ngrok-skip-browser-warning'] = 'true';
          }

          const response = await fetch(provider.url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ model: provider.model, messages: aiMessages, stream: true }),
          });

          if (response.ok) {
            console.log(`[soc-chat] ✅ ${provider.name} succeeded (intent: ${intent})`);

            // ── Quality Guard (non-streaming check for simple intents) ──
            // For complex questions, if the first response is too short, escalate
            if (intent === 'complex' && provider.model.includes('flash-lite')) {
              const qualityClone = response.clone();
              const qualityText = await extractStreamText(qualityClone);
              if (qualityText.length < 80) {
                console.log(`[soc-chat] ⚠️ Quality Guard: response too short (${qualityText.length} chars), escalating...`);
                continue; // Try next (more powerful) provider
              }
            }

            // Cache + save to DB
            const responseCloneForCache = response.clone();
            const responseCloneForDB = response.clone();
            cacheAIResponse(supabase, cacheKey, msgText, responseCloneForCache, current_route).catch(() => {});
            if (chat_channel) {
              saveAIResponseToDB(supabase, responseCloneForDB, chat_channel, reply_to_id).catch(() => {});
            }
            return new Response(response.body, {
              headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
            });
          }

          if (response.status === 429) {
            await response.text();
            if (attempt < MAX_RETRIES) continue;
            console.warn(`[soc-chat] ${provider.name} rate limited, trying next...`);
            break;
          }
          if (response.status === 402) {
            console.warn(`[soc-chat] ${provider.name} credits exhausted, trying next...`);
            await response.text();
            break;
          }

          const errText = await response.text();
          console.error(`[soc-chat] ${provider.name} error ${response.status}:`, errText);
          break;
        } catch (fetchErr) {
          console.error(`[soc-chat] ${provider.name} fetch error:`, fetchErr);
          break;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // ALL LAYERS EXHAUSTED — Generate smart offline summary
    // ═══════════════════════════════════════════════════════════════
    const offlineFallback = generateOfflineSummary(incidents, openIncidents, dataSources, mitreCov, pendingApprovals);
    await saveAIMessage(offlineFallback);
    return streamTextResponse(offlineFallback, corsHeaders);

  } catch (error) {
    console.error('soc-chat error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// HELPER: Save AI streaming response to chat_messages table
// Uses service role key — bypasses RLS
// ═══════════════════════════════════════════════════════════════════════
async function saveAIResponseToDB(supabase: any, response: Response, channel: string, reply_to_id: string | null) {
  try {
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let content = '';
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nlIdx: number;
      while ((nlIdx = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, nlIdx);
        buffer = buffer.slice(nlIdx + 1);
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (json === '[DONE]') break;
        try {
          const p = JSON.parse(json);
          const delta = p.choices?.[0]?.delta?.content;
          if (delta) content += delta;
        } catch {}
      }
    }
    if (content.trim()) {
      await supabase.from('chat_messages').insert({
        sender_id: '00000000-0000-0000-0000-000000000000',
        sender_email: 'ai@socmind',
        sender_name: 'SOCMind AI',
        content: content.trim(),
        mentions: [],
        channel,
        priority: 'normal',
        reply_to_id: reply_to_id || null,
        attachments: [],
      });
      console.log('[soc-chat] ✅ AI message saved to DB via service role');
    }
  } catch (e) {
    console.error('[soc-chat] Failed to save AI response to DB:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER: Stream plain text as SSE (for rule-based + offline fallback)
// ═══════════════════════════════════════════════════════════════════════
function streamTextResponse(text: string, corsHeaders: Record<string, string>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Split into ~80 char chunks to simulate streaming
      const words = text.split(' ');
      let chunk = '';
      for (const word of words) {
        chunk += (chunk ? ' ' : '') + word;
        if (chunk.length >= 80) {
          const data = JSON.stringify({ choices: [{ delta: { content: chunk + ' ' } }] });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          chunk = '';
        }
      }
      if (chunk) {
        const data = JSON.stringify({ choices: [{ delta: { content: chunk } }] });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
  });
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER: Simple hash for cache key
// ═══════════════════════════════════════════════════════════════════════
async function hashQuery(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER: Cache AI response in background (reads stream then saves)
// ═══════════════════════════════════════════════════════════════════════
async function cacheAIResponse(supabase: any, cacheKey: string, queryText: string, response: Response, route: string) {
  try {
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let content = '';
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nlIdx: number;
      while ((nlIdx = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, nlIdx);
        buffer = buffer.slice(nlIdx + 1);
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (json === '[DONE]') break;
        try {
          const p = JSON.parse(json);
          const delta = p.choices?.[0]?.delta?.content;
          if (delta) content += delta;
        } catch {}
      }
    }
    if (content.length > 50) {
      await supabase.from('ai_response_cache').upsert({
        query_hash: cacheKey,
        query_text: queryText.slice(0, 500),
        response_text: content.slice(0, 8000),
        context_route: route || '/dashboard',
        hit_count: 0,
        last_used_at: new Date().toISOString(),
      }, { onConflict: 'query_hash' });
    }
  } catch (e) {
    // Non-critical — silently fail
  }
}

// ═══════════════════════════════════════════════════════════════════════
// RULE-BASED ENGINE: Answer common SOC questions from DB data directly
// ═══════════════════════════════════════════════════════════════════════
async function tryRuleBasedEngine(
  msg: string,
  incidents: any[],
  openIncidents: any[],
  dataSources: any[],
  mitreCov: any[],
  pendingApprovals: any[],
  playbooks: any[]
): Promise<string | null> {
  const q = msg.toLowerCase();

  // ── Creator / Platform Identity ──
  if (/who (made|built|created|developed|designed|is behind)|مين (عامل|بنى|صمم|عمل)|من (صنع|طور|بنى)|مؤسس|founder|creator|developer of (this|socmind)|ahmed.?tareq|أحمد.?طارق|about.?(the )?(creator|developer|founder|builder|owner)/i.test(msg)) {
    return `## 👨‍💻 Ahmed Tareq Abdelhady Alieldin
### SOC Analyst | Cybersecurity Professional | Top 4% TryHackMe

---

**Ahmed Tareq** هو مؤسس ومطور منصة **SOCMind** بالكامل من الصفر — مهندس أمن سيبراني معتمد (CCNA) بخبرة **600+ ساعة** تدريب عملي في Threat Detection و Incident Response و SIEM Operations.

### 🎓 التعليم
- **بكالوريوس علوم حاسب** — كلية الحاسبات والمعلومات، جامعة المنوفية (2025)

### 💼 الخبرة المهنية
- **SOC & Penetration Testing Trainee** — المعهد القومي للاتصالات (NTI) — 600 ساعة
  - مراقبة **500+ حدث أمني يومياً** عبر FortiSIEM و IBM QRadar
  - تنفيذ **15+ Red Team Exercise** على بيئات حية
  - تحليل حركة الشبكة عبر Wireshark والتحقيق في **20+ محاولة اختراق**
  - تقليل وقت الاستجابة للحوادث بنسبة **30%**
- **Frontend Developer Trainee** — معهد تكنولوجيا المعلومات (ITI)
  - تطوير **5+ تطبيقات ويب** بـ React JS مع **95%+ Lighthouse Score**

### 🚀 المشاريع
| المشروع | التقنيات | الإنجاز |
|---------|----------|---------|
| **SOCMind Platform** | React, TypeScript, AI, SOAR | معالجة **1,000+ حدث أمني** لحظياً |
| **Business Management** | React, Supabase | إدارة **200+ سجل** بدقة **99.9%** |
| **Competition System** | React, Supabase, RBAC | **2,000+ تسجيل** مع 3 أدوار إدارية |

### 🛡️ ماذا بنى في SOCMind؟
- 🤖 **محرك AI متعدد النماذج** — Smart Router بين GPT-5 و Gemini و Edge AI
- ⚡ **SOAR Engine** — أتمتة الاستجابة بـ Playbooks ذكية
- 🗺️ **MITRE ATT&CK Integration** — تغطية شاملة مع Heatmap تفاعلية
- 📋 **GRC & Compliance** — ISO 27001, NCA-ECC, NIST Framework
- 🔍 **Threat Intelligence Pipeline** — ربط مع AbuseIPDB و VirusTotal
- 💬 **War Room & Team Chat** — تعاون لحظي مع @mentions و AI Bot
- 📊 **Executive Reporting** — تقارير PDF احترافية للإدارة

### 🏆 الشهادات والتدريب
\`CCNA v7\` \`eCIR (In Progress)\` \`Fortinet NSE4 (In Progress)\` \`CompTIA Security+\` \`eJPT\` \`SANS SEC450\` \`Red Hat RH124\` \`Ethical Hacker - Cisco\`

### 🔧 المهارات التقنية
**Security:** FortiSIEM, QRadar, Wireshark, Nmap, Metasploit, Burp Suite
**Network:** TCP/IP, OSI, Firewall, VPN, IDS/IPS, Cisco
**Programming:** Python, Bash, JavaScript, React, TypeScript, SQL
**GRC:** NIST, ISO 27001, GDPR, Risk Assessment

### 📞 التواصل
- 📧 ahmed.tareq.alieldin@gmail.com
- 💼 [LinkedIn](https://www.linkedin.com/in/ah-m-ed-tareq-48069523b/)
- 🐙 [GitHub](https://github.com/Palestine-1)
- 🛡️ [TryHackMe — Top 4%](https://tryhackme.com/p/ahmedtareq)
- 📱 [WhatsApp](https://wa.me/201559181558)
- 📄 [Download CV (PDF)](/Ahmed_Tareq_CV.pdf)

> *SOCMind — Designed & Built by Ahmed Tareq* 🛡️`;
  }

  // ── Incident counts & stats ──
  if (/how many|عدد|كم|count/.test(q) && /incident|حادث/.test(q)) {
    const critical = incidents.filter(i => i.risk_level === 'Critical').length;
    const high = incidents.filter(i => i.risk_level === 'High').length;
    const open = openIncidents.length;
    const tp = incidents.filter(i => i.classification === 'True Positive').length;
    const fp = incidents.filter(i => i.classification === 'False Positive').length;
    return `## 📊 Incident Statistics

| Metric | Count |
|--------|-------|
| **Total (last 20)** | ${incidents.length} |
| **Open** | ${open} |
| **Critical** | ${critical} |
| **High** | ${high} |
| **True Positives** | ${tp} |
| **False Positives** | ${fp} |

> *Rule-Based Engine — instant response* 🤖`;
  }

  // ── Critical incidents ──
  if (/critical|حرج|خطير/.test(q) && /incident|حادث|alert/.test(q)) {
    const crits = incidents.filter(i => i.risk_level === 'Critical');
    if (crits.length === 0) return '## ✅ No Critical Incidents\n\nلا توجد حوادث حرجة حالياً.\n\n> *Rule-Based Engine* 🤖';
    const rows = crits.map(i => `| ${i.incident_number} | ${i.event_type} | ${i.status} | ${i.src_ip || 'N/A'} | ${i.mitre_technique || '-'} |`).join('\n');
    return `## 🚨 Critical Incidents (${crits.length})

| ID | Event Type | Status | Source IP | MITRE |
|----|-----------|--------|-----------|-------|
${rows}

> *Rule-Based Engine — direct DB query* 🤖`;
  }

  // ── False positives ──
  if (/false positive|إيجابي كاذب|fp/.test(q)) {
    const fps = incidents.filter(i => i.classification === 'False Positive');
    const today = incidents.filter(i => {
      const d = new Date(i.created_at);
      return i.classification === 'False Positive' && d.toDateString() === new Date().toDateString();
    });
    return `## 🔍 False Positives Analysis

- **Total (last 20 incidents):** ${fps.length}
- **Today:** ${today.length}
- **FP Rate:** ${incidents.length > 0 ? Math.round(fps.length / incidents.length * 100) : 0}%

${fps.length > 0 ? '**Recent FP incidents:**\n' + fps.slice(0, 5).map(i => `- ${i.incident_number}: ${i.event_type} (${new Date(i.created_at).toLocaleDateString()})`).join('\n') : 'No false positives in recent data.'}

> *Rule-Based Engine* 🤖`;
  }

  // ── Top IPs ──
  if (/top.*ip|ip.*most|أكثر.*ip|ip.*alert/.test(q)) {
    const ipCounts: Record<string, number> = {};
    incidents.forEach(i => { if (i.src_ip) ipCounts[i.src_ip] = (ipCounts[i.src_ip] || 0) + 1; });
    const sorted = Object.entries(ipCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (sorted.length === 0) return '## ℹ️ No IP Data\n\nلا توجد بيانات IP كافية.\n\n> *Rule-Based Engine* 🤖';
    const rows = sorted.map(([ip, count]) => `| ${ip} | ${count} |`).join('\n');
    return `## 🌐 Top Source IPs

| IP Address | Alert Count |
|-----------|-------------|
${rows}

> *Rule-Based Engine — direct DB query* 🤖`;
  }

  // ── MITRE techniques ──
  if (/mitre|technique|tactic|تقنية|تكتيك/.test(q)) {
    const detected = mitreCov.filter(m => m.coverage_status === 'detected');
    const withPlaybook = mitreCov.filter(m => m.has_playbook);
    const topTechniques = incidents
      .filter(i => i.mitre_technique)
      .reduce((acc: Record<string, number>, i) => { acc[i.mitre_technique] = (acc[i.mitre_technique] || 0) + 1; return acc; }, {});
    const sortedTech = Object.entries(topTechniques).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return `## 🎯 MITRE ATT&CK Coverage

- **Techniques Covered:** ${detected.length}/${mitreCov.length}
- **With Playbooks:** ${withPlaybook.length}

**Most Detected Techniques:**
${sortedTech.map(([t, c]) => `- \`${t}\` — ${c} detections`).join('\n') || '- No technique data yet'}

> *Rule-Based Engine* 🤖`;
  }

  // ── Open incidents list ──
  if (/open|مفتوح|pending|قائم/.test(q) && /incident|حادث/.test(q)) {
    if (openIncidents.length === 0) return '## ✅ No Open Incidents\n\nلا توجد حوادث مفتوحة حالياً.\n\n> *Rule-Based Engine* 🤖';
    const rows = openIncidents.slice(0, 10).map(i => `| ${i.incident_number} | ${i.event_type} | ${i.risk_level} | ${new Date(i.created_at).toLocaleDateString()} |`).join('\n');
    return `## 📂 Open Incidents (${openIncidents.length})

| ID | Event Type | Risk | Date |
|----|-----------|------|------|
${rows}

> *Rule-Based Engine* 🤖`;
  }

  // ── Data sources / agents ──
  if (/agent|data source|source|مصدر|وكيل/.test(q) && /status|حالة|active|نشط/.test(q)) {
    const active = dataSources.filter(d => d.status === 'active');
    const inactive = dataSources.filter(d => d.status !== 'active');
    return `## 🖥️ Data Sources Status

| Name | Type | Status | Logs Today |
|------|------|--------|-----------|
${dataSources.map(d => `| ${d.name} | ${d.type} | ${d.status === 'active' ? '✅' : '❌'} ${d.status} | ${d.logs_received_today || 0} |`).join('\n') || '| No data sources | - | - | - |'}

**Summary:** ${active.length} active, ${inactive.length} inactive

> *Rule-Based Engine* 🤖`;
  }

  // ── Pending approvals ──
  if (/approval|موافقة|pending|انتظار/.test(q)) {
    if (pendingApprovals.length === 0) return '## ✅ No Pending Approvals\n\nلا توجد موافقات معلقة.\n\n> *Rule-Based Engine* 🤖';
    return `## ⏳ Pending Approvals (${pendingApprovals.length})

${pendingApprovals.map(a => `- **${a.action_type}** — ${a.reason || 'No reason'}`).join('\n')}

> *Rule-Based Engine* 🤖`;
  }

  // ── SOC summary / dashboard ──
  if (/summary|ملخص|overview|نظرة عامة|dashboard|status/.test(q)) {
    const critical = incidents.filter(i => i.risk_level === 'Critical').length;
    const activeSources = dataSources.filter(d => d.status === 'active').length;
    const activePlaybooks = playbooks.filter(p => p.is_active).length;
    return `## 📊 SOC Status Summary

| Category | Value |
|----------|-------|
| **Open Incidents** | ${openIncidents.length} |
| **Critical Alerts** | ${critical} |
| **Active Data Sources** | ${activeSources}/${dataSources.length} |
| **Active Playbooks** | ${activePlaybooks}/${playbooks.length} |
| **Pending Approvals** | ${pendingApprovals.length} |
| **MITRE Coverage** | ${mitreCov.filter(m => m.coverage_status === 'detected').length}/${mitreCov.length} |

${critical > 0 ? `⚠️ **${critical} critical incident(s) require immediate attention!**` : '✅ No critical incidents.'}

> *Rule-Based Engine — instant response* 🤖`;
  }

  // No rule matched — let AI handle it
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// INTENT DETECTION: Classify user question to route to optimal model
// ═══════════════════════════════════════════════════════════════════════
function detectIntent(msg: string): 'simple' | 'soc_query' | 'compliance' | 'complex' {
  const q = msg.toLowerCase();
  const len = q.length;

  // Simple: greetings, short questions, basic queries
  if (len < 20 || /^(hi|hello|hey|مرحبا|اهلا|شكرا|thanks|ok|yes|no|صباح|مساء)/.test(q)) {
    return 'simple';
  }

  // Complex: analysis, investigation, RCA, threat hunting, strategy
  if (/analyz|investigat|root cause|rca|threat hunt|correlat|campaign|attack chain|forensic|تحليل|تحقيق|سبب جذري|صيد التهديد|حملة|هجوم/.test(q)) {
    return 'complex';
  }
  if (/why|لماذا|ليه|explain.*detail|شرح.*تفصيل|recommend.*strateg|how.*prevent|كيف.*منع/.test(q)) {
    return 'complex';
  }
  if (/compare|مقارنة|trend.*analys|predict|forecast|توقع|benchmark/.test(q)) {
    return 'complex';
  }

  // Compliance: GRC, ISO, NCA, audit, risk, policy
  if (/compliance|grc|iso.*27|nca|ecc|nist|audit|risk.*register|control|gap|policy|سياس|امتثال|تدقيق|مخاطر|ضوابط/.test(q)) {
    return 'compliance';
  }

  // SOC query: incidents, alerts, IPs, MITRE, playbooks, agents
  if (/incident|alert|ip|mitre|playbook|agent|siem|soar|حادث|تنبيه|وكيل/.test(q)) {
    return 'soc_query';
  }

  // Default: if longer question → soc_query, otherwise simple
  return len > 60 ? 'soc_query' : 'simple';
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER: Extract full text from an SSE stream (for Quality Guard)
// ═══════════════════════════════════════════════════════════════════════
async function extractStreamText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let content = '';
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nlIdx: number;
      while ((nlIdx = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, nlIdx);
        buffer = buffer.slice(nlIdx + 1);
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (json === '[DONE]') return content;
        try {
          const p = JSON.parse(json);
          const delta = p.choices?.[0]?.delta?.content;
          if (delta) content += delta;
        } catch {}
      }
    }
  } catch {}
  return content;
}

// ═══════════════════════════════════════════════════════════════════════
// OFFLINE FALLBACK: Smart summary when absolutely everything fails
// ═══════════════════════════════════════════════════════════════════════
function generateOfflineSummary(incidents: any[], openIncidents: any[], dataSources: any[], mitreCov: any[], pendingApprovals: any[]): string {
  const critical = incidents.filter(i => i.risk_level === 'Critical').length;
  const activeSources = dataSources.filter(d => d.status === 'active').length;
  return `## ⚠️ SOC Assistant — Offline Mode

All AI providers are currently unavailable. Here is your live SOC status from the database:

## 📊 Current Status

| Metric | Value |
|--------|-------|
| Open Incidents | **${openIncidents.length}** |
| Critical Alerts | **${critical}** |
| Active Sources | **${activeSources}/${dataSources.length}** |
| Pending Approvals | **${pendingApprovals.length}** |
| MITRE Coverage | **${mitreCov.filter(m => m.coverage_status === 'detected').length}/${mitreCov.length}** |

${openIncidents.length > 0 ? `## 🔴 Open Incidents\n${openIncidents.slice(0, 5).map(i => `- **${i.incident_number}** — ${i.event_type} [${i.risk_level}]`).join('\n')}` : '## ✅ No Open Incidents'}

---
*🤖 Rule-Based Engine Active — AI providers offline. Try asking about specific incidents, IPs, or MITRE techniques for instant answers.*`;
}
