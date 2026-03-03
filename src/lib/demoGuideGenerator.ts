import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Color System ──────────────────────────────────────────
const C = {
  brand: [0, 120, 255] as [number, number, number],
  brandDark: [0, 80, 200] as [number, number, number],
  dark: [18, 18, 28] as [number, number, number],
  darkCard: [30, 30, 45] as [number, number, number],
  accent: [0, 200, 130] as [number, number, number],
  danger: [230, 60, 60] as [number, number, number],
  warning: [240, 170, 20] as [number, number, number],
  purple: [130, 80, 220] as [number, number, number],
  cyan: [0, 190, 220] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  light: [200, 205, 220] as [number, number, number],
  muted: [130, 135, 155] as [number, number, number],
  bg: [245, 247, 252] as [number, number, number],
  bgBlue: [230, 242, 255] as [number, number, number],
};

const PW = 210; // A4 width mm
const PH = 297; // A4 height mm
const M = 18;   // margin
const CW = PW - M * 2; // content width

// ── Helpers ───────────────────────────────────────────────
function addFooter(pdf: jsPDF, pageNum: number, totalPages: number) {
  pdf.setFillColor(...C.bg);
  pdf.rect(0, PH - 14, PW, 14, 'F');
  pdf.setDrawColor(...C.light);
  pdf.line(M, PH - 14, PW - M, PH - 14);
  pdf.setFontSize(7);
  pdf.setTextColor(...C.muted);
  pdf.text('SOCMind™ — AI-Powered Security Operations Center | CONFIDENTIAL', M, PH - 7);
  pdf.text(`Page ${pageNum} / ${totalPages}`, PW - M, PH - 7, { align: 'right' });
}

function sectionHeader(pdf: jsPDF, y: number, title: string, color: [number, number, number], icon?: string): number {
  if (y > PH - 50) { pdf.addPage(); y = 25; }
  pdf.setFillColor(...color);
  pdf.roundedRect(M, y, CW, 10, 2, 2, 'F');
  pdf.setFontSize(12);
  pdf.setTextColor(...C.white);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${icon ? icon + '  ' : ''}${title}`, M + 5, y + 7);
  return y + 15;
}

function subHeader(pdf: jsPDF, y: number, title: string, color: [number, number, number]): number {
  if (y > PH - 40) { pdf.addPage(); y = 25; }
  pdf.setFillColor(...C.bgBlue);
  pdf.roundedRect(M, y, CW, 8, 2, 2, 'F');
  pdf.setFillColor(...color);
  pdf.rect(M, y, 3, 8, 'F');
  pdf.setFontSize(10);
  pdf.setTextColor(...color);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, M + 7, y + 5.5);
  return y + 12;
}

function bodyText(pdf: jsPDF, y: number, text: string): number {
  pdf.setFontSize(9);
  pdf.setTextColor(...C.dark);
  pdf.setFont('helvetica', 'normal');
  const lines = pdf.splitTextToSize(text, CW - 4);
  for (const line of lines) {
    if (y > PH - 22) { pdf.addPage(); y = 25; }
    pdf.text(line, M + 2, y);
    y += 4.5;
  }
  return y + 2;
}

function bulletList(pdf: jsPDF, y: number, items: string[], color: [number, number, number] = C.brand): number {
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  for (const item of items) {
    if (y > PH - 22) { pdf.addPage(); y = 25; }
    pdf.setFillColor(...color);
    pdf.circle(M + 4, y - 1, 1, 'F');
    pdf.setTextColor(...C.dark);
    const wrapped = pdf.splitTextToSize(item, CW - 12);
    for (const wl of wrapped) {
      if (y > PH - 22) { pdf.addPage(); y = 25; }
      pdf.text(wl, M + 8, y);
      y += 4.5;
    }
  }
  return y + 2;
}

function featureTable(pdf: jsPDF, y: number, features: [string, string][], color: [number, number, number]): number {
  if (y > PH - 40) { pdf.addPage(); y = 25; }
  autoTable(pdf, {
    startY: y,
    head: [['Feature', 'Description']],
    body: features,
    theme: 'grid',
    margin: { left: M, right: M },
    headStyles: { fillColor: color, textColor: C.white, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: C.dark, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    alternateRowStyles: { fillColor: C.bg },
  });
  return (pdf as any).lastAutoTable.finalY + 6;
}

// ── MAIN GENERATOR ────────────────────────────────────────
export function generateDemoGuidePDF() {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 0;

  // ══════════════════════════════════════════════════════════
  // PAGE 1: COVER
  // ══════════════════════════════════════════════════════════
  pdf.setFillColor(...C.dark);
  pdf.rect(0, 0, PW, PH, 'F');

  // Top accent
  pdf.setFillColor(...C.brand);
  pdf.rect(0, 0, PW, 6, 'F');
  // Bottom accent
  pdf.setFillColor(...C.brand);
  pdf.rect(0, PH - 4, PW, 4, 'F');

  // Logo
  y = 45;
  pdf.setFillColor(...C.white);
  pdf.roundedRect(PW / 2 - 28, y - 6, 56, 18, 4, 4, 'F');
  pdf.setFontSize(18);
  pdf.setTextColor(...C.brand);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SOCMind', PW / 2, y + 6, { align: 'center' });

  // Tag
  y = 72;
  pdf.setFontSize(10);
  pdf.setTextColor(...C.cyan);
  pdf.setFont('helvetica', 'normal');
  pdf.text('AI-Powered Security Operations Center', PW / 2, y, { align: 'center' });

  // Main title
  y = 100;
  pdf.setFontSize(32);
  pdf.setTextColor(...C.white);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PRODUCT', PW / 2, y, { align: 'center' });
  pdf.text('DEMO GUIDE', PW / 2, y + 14, { align: 'center' });

  // Version badge
  y = 128;
  pdf.setFillColor(...C.accent);
  pdf.roundedRect(PW / 2 - 22, y - 4, 44, 12, 3, 3, 'F');
  pdf.setFontSize(9);
  pdf.setTextColor(...C.dark);
  pdf.setFont('helvetica', 'bold');
  pdf.text('v4.0 — 2025', PW / 2, y + 4, { align: 'center' });

  // Subtitle / pitch
  y = 158;
  pdf.setFontSize(11);
  pdf.setTextColor(...C.light);
  pdf.setFont('helvetica', 'normal');
  const pitchLines = pdf.splitTextToSize(
    'SOCMind is an enterprise-grade AI Security Operations platform that autonomously detects, classifies, and responds to cyber threats in real-time — reducing Mean Time to Respond (MTTR) by 98% and eliminating 92% of false positives.',
    CW - 20
  );
  pitchLines.forEach((line: string, i: number) => {
    pdf.text(line, PW / 2, y + i * 5.5, { align: 'center' });
  });

  // Key stats cards
  y = 200;
  const stats = [
    ['98%', 'MTTR Reduction'],
    ['92%', 'FP Elimination'],
    ['< 1 min', 'Detection Time'],
    ['100%', 'Audit Coverage'],
  ];
  const cardW = 36;
  const gap = 6;
  const startX = (PW - cardW * 4 - gap * 3) / 2;
  stats.forEach((s, i) => {
    const cx = startX + i * (cardW + gap);
    pdf.setFillColor(...C.darkCard);
    pdf.roundedRect(cx, y, cardW, 28, 3, 3, 'F');
    pdf.setFontSize(14);
    pdf.setTextColor(...C.cyan);
    pdf.setFont('helvetica', 'bold');
    pdf.text(s[0], cx + cardW / 2, y + 12, { align: 'center' });
    pdf.setFontSize(7);
    pdf.setTextColor(...C.light);
    pdf.setFont('helvetica', 'normal');
    pdf.text(s[1], cx + cardW / 2, y + 20, { align: 'center' });
  });

  // Confidential
  y = 250;
  pdf.setFillColor(...C.danger);
  pdf.roundedRect(PW / 2 - 28, y, 56, 12, 3, 3, 'F');
  pdf.setFontSize(9);
  pdf.setTextColor(...C.white);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CONFIDENTIAL', PW / 2, y + 7.5, { align: 'center' });

  y = 272;
  pdf.setFontSize(8);
  pdf.setTextColor(...C.muted);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, PW / 2, y, { align: 'center' });

  // ══════════════════════════════════════════════════════════
  // PAGE 2: TABLE OF CONTENTS
  // ══════════════════════════════════════════════════════════
  pdf.addPage();
  y = 25;
  y = sectionHeader(pdf, y, 'TABLE OF CONTENTS', C.brand);

  const toc = [
    '1. Platform Overview & Value Proposition',
    '2. Dashboard — Real-Time SOC Command Center',
    '3. Incidents — Detection, Triage & Response',
    '4. Live Logs — Real-Time Log Streaming',
    '5. Analytics — SOC Performance Intelligence',
    '6. Playbooks & SOAR — Automated Response',
    '7. MITRE ATT&CK — Threat Coverage Matrix',
    '8. Compliance & GRC — Governance Engine',
    '9. Threat Intel — Intelligence Enrichment',
    '10. Threat Hunting — Proactive Investigation',
    '11. Data Sources & Integrations',
    '12. Reports — Executive & Performance Reporting',
    '13. Team Chat — SOC Collaboration Hub',
    '14. Approvals — Action Governance Workflow',
    '15. AI Assistant — Context-Aware SOC Copilot',
    '16. Admin & Cloud Management',
    '17. Demo Mode & Guided Experience',
    '18. Architecture & Technical Stack',
  ];
  y = bulletList(pdf, y, toc, C.brand);

  // ══════════════════════════════════════════════════════════
  // PAGE 3: PLATFORM OVERVIEW
  // ══════════════════════════════════════════════════════════
  pdf.addPage();
  y = 25;
  y = sectionHeader(pdf, y, '1. PLATFORM OVERVIEW & VALUE PROPOSITION', C.brand);
  y = bodyText(pdf, y, 'SOCMind is a next-generation AI-native Security Operations Center (SOC) platform built to transform how organizations detect, investigate, and respond to cyber threats. Unlike traditional SIEMs that generate overwhelming alerts, SOCMind uses multi-model AI reasoning to autonomously classify, prioritize, and respond to threats — with full explainability and human oversight.');

  y = subHeader(pdf, y, 'Why SOCMind?', C.brand);
  y = bulletList(pdf, y, [
    'Autonomous Detection & Response: AI classifies threats, selects optimal playbooks, and executes containment — all in under 60 seconds.',
    'Explainable AI (XAI): Every AI decision includes reasoning, confidence scores, and alternative options considered — no black boxes.',
    'MITRE ATT&CK Native: Full technique mapping, gap analysis, and coverage tracking built into every workflow.',
    'GRC & Compliance Engine: NCA-ECC, ISO 27001, NIST, PCI-DSS compliance monitoring with automated evidence collection.',
    'Human-in-the-Loop: Configurable approval workflows ensure critical actions require human authorization.',
    'SOC-Grade Reporting: AI-generated investigation reports in professional PDF format with digital signatures.',
    'Multi-Vendor Integration: Native support for Cisco, Fortinet, Palo Alto, Sophos, and syslog-based sources.',
  ]);

  y = subHeader(pdf, y, 'Competitive Advantage', C.accent);
  y = featureTable(pdf, y, [
    ['SOCMind AI', 'Full autonomous SOC with XAI, < 1 min MTTD, 98% MTTR reduction, built-in GRC'],
    ['Splunk SOAR', 'Requires manual playbook building, no autonomous classification, high cost'],
    ['Palo Alto XSOAR', 'Strong SOAR but lacks native AI reasoning and compliance engine'],
    ['IBM QRadar', 'Legacy SIEM approach, slow detection, limited AI capabilities'],
    ['Microsoft Sentinel', 'Cloud-only, limited autonomous response, complex pricing'],
  ], C.brand);

  // ══════════════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════════════
  pdf.addPage();
  y = 25;
  y = sectionHeader(pdf, y, '2. DASHBOARD — REAL-TIME SOC COMMAND CENTER', C.brand);
  y = bodyText(pdf, y, 'The Dashboard provides a unified operational view of your entire security posture. It aggregates real-time data from all connected sources and presents actionable intelligence at a glance.');

  y = featureTable(pdf, y, [
    ['Stat Cards', 'Live counters for Total Incidents, Critical Alerts, Active Threats, and SLA Compliance with animated transitions'],
    ['Severity Trend Chart', 'Time-series visualization of incident severity distribution over configurable time ranges (24h/7d/30d)'],
    ['Classification Breakdown', 'Pie/donut chart showing True Positive, False Positive, and Unknown classifications with drill-down'],
    ['MITRE Heatmap', 'Interactive ATT&CK matrix heatmap showing detection coverage density across all tactics and techniques'],
    ['Incident Table', 'Sortable, filterable table with severity indicators, MITRE tags, AI confidence scores, and quick-action buttons'],
    ['Risk Level Distribution', 'Visual breakdown of Critical/High/Medium/Low risk incidents with trend arrows'],
    ['AI Confidence Meter', 'Average AI classification confidence across all processed incidents'],
  ], C.brand);

  // ══════════════════════════════════════════════════════════
  // INCIDENTS
  // ══════════════════════════════════════════════════════════
  pdf.addPage();
  y = 25;
  y = sectionHeader(pdf, y, '3. INCIDENTS — DETECTION, TRIAGE & RESPONSE', C.danger);
  y = bodyText(pdf, y, 'The Incidents module is the operational heart of SOCMind. Every detected threat flows through AI-powered classification, enrichment, and response workflows with full audit trails.');

  y = subHeader(pdf, y, 'Incident List View', C.danger);
  y = featureTable(pdf, y, [
    ['Smart Filters', 'Filter by severity (1-5), status (Open/Investigating/Resolved/Closed), classification, MITRE tactic, risk level, and date range'],
    ['Bulk Operations', 'Select multiple incidents for batch status updates, assignment, or export'],
    ['AI Confidence Badge', 'Each incident shows AI classification confidence with color-coded indicators'],
    ['Quick Preview', 'Hover/click to see incident summary without leaving the list view'],
    ['SLA Indicators', 'Visual SLA countdown timers showing time remaining for response/resolution targets'],
  ], C.danger);

  y = subHeader(pdf, y, 'Incident Detail View', C.danger);
  y = featureTable(pdf, y, [
    ['AI Analysis Panel', 'Full AI reasoning with classification decision, confidence breakdown, and alternative assessments'],
    ['MITRE ATT&CK Mapping', 'Automatic tactic/technique identification with links to MITRE knowledge base'],
    ['Root Cause Analysis', 'AI-generated root cause analysis with attack chain reconstruction'],
    ['Correlated Logs', 'Related log entries from the same source IP, destination, or time window'],
    ['IOC Manager', 'Track Indicators of Compromise — IPs, hashes, domains, URLs with confidence levels'],
    ['Evidence Manager', 'Attach and organize evidence files, screenshots, logs, and forensic artifacts'],
    ['Analyst Notes', 'Collaborative notes with role-based tagging (Observation, Action, Escalation)'],
    ['Assignment & Escalation', 'Assign to specific analysts by role tier, escalate with reason tracking'],
    ['AI Report Generator', 'Generate professional investigation reports in Markdown and downloadable PDF'],
    ['Incident Timeline', 'Chronological event timeline from detection through resolution'],
    ['SLA Tracker', 'Real-time SLA compliance monitoring with breach alerts'],
  ], C.danger);

  // ══════════════════════════════════════════════════════════
  // LIVE LOGS
  // ══════════════════════════════════════════════════════════
  pdf.addPage();
  y = 25;
  y = sectionHeader(pdf, y, '4. LIVE LOGS — REAL-TIME LOG STREAMING', C.cyan);
  y = bodyText(pdf, y, 'Monitor raw security logs as they arrive from all connected data sources. The Live Logs page provides a real-time streaming view with powerful filtering and search capabilities.');

  y = featureTable(pdf, y, [
    ['Real-Time Stream', 'WebSocket-powered live log feed with auto-scroll and pause/resume controls'],
    ['Multi-Source View', 'Logs from all connected agents, firewalls, and SIEM sources in a unified stream'],
    ['Processing Status', 'Each log shows its processing status: Processed, Pending, Error, or Ignored'],
    ['Smart Search', 'Full-text search across log messages, source IPs, event types, and metadata'],
    ['Status Filters', 'Filter by processing status to quickly find errors or unprocessed logs'],
    ['Log Detail Drawer', 'Click any log to see full raw payload, parsed fields, and processing result'],
    ['Ingestion Stats', 'Real-time counters showing logs/second, total ingested, and error rates'],
  ], C.cyan);

  // ══════════════════════════════════════════════════════════
  // ANALYTICS
  // ══════════════════════════════════════════════════════════
  y = sectionHeader(pdf, y, '5. ANALYTICS — SOC PERFORMANCE INTELLIGENCE', C.purple);
  y = bodyText(pdf, y, 'Comprehensive analytics dashboard providing deep insights into SOC operational efficiency, team performance, and threat landscape trends.');

  y = featureTable(pdf, y, [
    ['MTTD / MTTR Tracking', 'Mean Time to Detect and Mean Time to Respond with historical trends and benchmarks'],
    ['Severity Distribution', 'Charts showing severity breakdown over configurable time periods'],
    ['Classification Accuracy', 'AI classification accuracy tracking with True/False Positive rates over time'],
    ['SLA Compliance Rate', 'Percentage of incidents meeting SLA targets with breach analysis'],
    ['Analyst Workload', 'Per-analyst incident assignment and resolution metrics'],
    ['Trend Analysis', 'Machine learning-powered trend predictions for incident volumes and types'],
    ['Exportable Dashboards', 'Export any chart or dataset for external reporting'],
  ], C.purple);

  // ══════════════════════════════════════════════════════════
  // PLAYBOOKS
  // ══════════════════════════════════════════════════════════
  pdf.addPage();
  y = 25;
  y = sectionHeader(pdf, y, '6. PLAYBOOKS & SOAR — AUTOMATED RESPONSE', C.accent);
  y = bodyText(pdf, y, 'SOCMind\'s SOAR engine provides intelligent automated response with configurable playbooks, AI-recommended actions, and full execution auditing.');

  y = featureTable(pdf, y, [
    ['Playbook Library', 'Pre-built and custom playbooks for common threat scenarios: Brute Force, Malware, Phishing, Insider Threat'],
    ['AI Recommendations', 'Context-aware playbook suggestions based on incident type, severity, and historical success rates'],
    ['Simulation Mode', 'Test playbook execution in sandbox without affecting production systems'],
    ['Autonomous Mode', 'Configure AI to auto-execute playbooks above configurable confidence thresholds'],
    ['SOAR Actions Dashboard', 'Track all executed actions: Block IP, Kill Process, Isolate Host, Lock User, Quarantine File'],
    ['Explainable AI (XAI)', 'Every AI recommendation includes detailed reasoning and confidence breakdown'],
    ['Analyst Feedback Loop', 'Rate AI recommendations to continuously improve the decision engine'],
    ['Playbook Templates', 'YAML-based playbook templates with visual editor for custom workflow creation'],
    ['Suggested Playbooks', 'AI generates new playbook suggestions based on detected gaps in coverage'],
    ['Rollback Capability', 'Every automated action can be reversed with full audit trail'],
  ], C.accent);

  // ══════════════════════════════════════════════════════════
  // MITRE
  // ══════════════════════════════════════════════════════════
  y = sectionHeader(pdf, y, '7. MITRE ATT&CK — THREAT COVERAGE MATRIX', C.warning);
  y = bodyText(pdf, y, 'Full MITRE ATT&CK framework integration provides comprehensive visibility into your detection coverage, gaps, and threat landscape alignment.');

  y = featureTable(pdf, y, [
    ['Interactive Heatmap', 'Color-coded matrix showing detection density across all 14 tactics and hundreds of techniques'],
    ['Coverage Analysis', 'Percentage coverage per tactic with gap identification and remediation priorities'],
    ['Technique Drill-Down', 'Click any technique to see associated incidents, detection rules, and playbooks'],
    ['Gap Recommendations', 'AI-generated suggestions for improving coverage in weak areas'],
    ['Detection Count Tracking', 'Historical detection counts per technique showing trend and evolution'],
    ['Playbook Mapping', 'See which playbooks respond to which techniques for complete response coverage'],
  ], C.warning);

  // ══════════════════════════════════════════════════════════
  // COMPLIANCE
  // ══════════════════════════════════════════════════════════
  pdf.addPage();
  y = 25;
  y = sectionHeader(pdf, y, '8. COMPLIANCE & GRC — GOVERNANCE ENGINE', C.purple);
  y = bodyText(pdf, y, 'Enterprise-grade Governance, Risk, and Compliance (GRC) engine supporting multiple regulatory frameworks with automated evidence collection and continuous monitoring.');

  y = subHeader(pdf, y, 'Compliance Controls', C.purple);
  y = featureTable(pdf, y, [
    ['Multi-Framework Support', 'NCA-ECC, ISO 27001, NIST CSF, PCI-DSS with pre-loaded control libraries'],
    ['Control Status Tracking', 'Visual status for each control: Implemented, Partially Implemented, Not Implemented, Not Applicable'],
    ['Implementation Details', 'Detailed implementation descriptions, evidence references, and owner assignments'],
    ['SLA Management', 'Configurable SLA days per control with deadline tracking and breach alerts'],
    ['Auto Evidence Mapping', 'Automated linking of audit logs and incidents to relevant compliance controls'],
    ['Control Search & Filter', 'Search by control code, standard, category, status, or owner'],
  ], C.purple);

  y = subHeader(pdf, y, 'Risk Register', C.danger);
  y = featureTable(pdf, y, [
    ['Risk Entries', 'Document risks with description, likelihood, impact, inherent/residual scores, and mitigation plans'],
    ['Risk Heat Matrix', 'Visual likelihood × impact matrix for risk prioritization'],
    ['Mitigation Tracking', 'Track risk owners, treatment plans, and review dates'],
    ['Risk Trends', 'Historical risk score trends showing improvement or degradation over time'],
  ], C.danger);

  y = subHeader(pdf, y, 'Gap Analysis & Audit Trail', C.brand);
  y = featureTable(pdf, y, [
    ['Gap Identification', 'Automatic gap detection between required controls and current implementation'],
    ['Remediation Planning', 'Assign owners, set target dates, and track remediation progress'],
    ['GRC Audit Trail', 'Complete audit log of every GRC action: control updates, risk changes, evidence links'],
    ['Compliance Reports', 'Generate framework-specific compliance reports for auditors and regulators'],
  ], C.brand);

  // ══════════════════════════════════════════════════════════
  // THREAT INTEL
  // ══════════════════════════════════════════════════════════
  pdf.addPage();
  y = 25;
  y = sectionHeader(pdf, y, '9. THREAT INTEL — INTELLIGENCE ENRICHMENT', C.cyan);
  y = bodyText(pdf, y, 'Integrated threat intelligence capabilities that enrich incidents with external context from multiple sources, improving classification accuracy and response speed.');

  y = featureTable(pdf, y, [
    ['IOC Lookup', 'Search IPs, domains, file hashes, and URLs against threat intelligence databases'],
    ['VirusTotal Integration', 'Automated hash analysis with detection ratio, AV engine results, and verdict classification'],
    ['Threat Feed Correlation', 'Cross-reference indicators against multiple threat feeds for confidence scoring'],
    ['Reputation Scoring', 'Composite reputation scores combining multiple intel sources'],
    ['Auto-Enrichment', 'Automatic enrichment of new incidents with relevant threat intelligence data'],
    ['Intel History', 'Track historical lookups and enrichment results for audit purposes'],
  ], C.cyan);

  // ══════════════════════════════════════════════════════════
  // THREAT HUNTING
  // ══════════════════════════════════════════════════════════
  y = sectionHeader(pdf, y, '10. THREAT HUNTING — PROACTIVE INVESTIGATION', C.danger);
  y = bodyText(pdf, y, 'Proactive threat hunting tools for experienced analysts to search for hidden threats that may have evaded automated detection.');

  y = featureTable(pdf, y, [
    ['Hypothesis-Driven Hunts', 'Create and track hunting hypotheses with structured methodology'],
    ['Query Builder', 'Build complex search queries across all ingested log data'],
    ['IOC Sweeps', 'Bulk search for known-bad indicators across historical data'],
    ['Hunt Campaigns', 'Organize hunts into campaigns with objectives, findings, and recommendations'],
    ['MITRE-Aligned Hunting', 'Hunt templates organized by ATT&CK techniques for systematic coverage'],
    ['Findings Export', 'Export hunt results as incidents or evidence for further investigation'],
  ], C.danger);

  // ══════════════════════════════════════════════════════════
  // DATA SOURCES
  // ══════════════════════════════════════════════════════════
  pdf.addPage();
  y = 25;
  y = sectionHeader(pdf, y, '11. DATA SOURCES & INTEGRATIONS', C.accent);
  y = bodyText(pdf, y, 'SOCMind supports diverse log sources through lightweight agents and native integrations with leading security vendors.');

  y = subHeader(pdf, y, 'Agent Types', C.accent);
  y = featureTable(pdf, y, [
    ['Linux Agent', 'Lightweight Python agent for Linux endpoints — syslog, auth logs, file integrity monitoring'],
    ['Windows Agent', 'PowerShell-based agent for Windows endpoints — Event Log, Sysmon, process monitoring'],
    ['Universal Agent', 'Cross-platform Python agent supporting multiple log source types'],
    ['Vendor Plugins', 'Pre-built plugins for Cisco, Fortinet, Palo Alto, and Sophos firewalls'],
  ], C.accent);

  y = subHeader(pdf, y, 'Integration Features', C.brand);
  y = featureTable(pdf, y, [
    ['API Key Management', 'Secure API key generation and lifecycle management for agent authentication'],
    ['License Management', 'Hardware-bound license validation with max-agent enforcement'],
    ['Heartbeat Monitoring', 'Real-time agent health monitoring with last-seen timestamps and status indicators'],
    ['Data Source Dashboard', 'Overview of all connected sources with log volume, status, and configuration'],
    ['Ingestion Statistics', 'Per-source log ingestion rates, byte volumes, and incident creation metrics'],
    ['Syslog Listener', 'Native syslog receiver for direct firewall/network device integration'],
  ], C.brand);

  // ══════════════════════════════════════════════════════════
  // REPORTS
  // ══════════════════════════════════════════════════════════
  y = sectionHeader(pdf, y, '12. REPORTS — EXECUTIVE & PERFORMANCE REPORTING', C.purple);
  y = bodyText(pdf, y, 'Generate comprehensive, board-ready reports that summarize security posture, operational metrics, and incident trends in professional formats.');

  y = featureTable(pdf, y, [
    ['Executive Report', 'Strategic summary with risk levels, true positive rates, top incidents, and high-level recommendations'],
    ['Performance Report', 'Operational metrics: MTTR, resolution rates, escalation rates, SLA compliance'],
    ['PDF Export', 'Professional multi-page PDF with branded cover page, color-coded sections, and digital signatures'],
    ['Investigation Reports', 'Per-incident AI-generated analysis reports with MITRE mapping and evidence summary'],
    ['Compliance Reports', 'Framework-specific compliance status reports for auditors'],
    ['Scheduled Reports', 'Configure automated report generation and delivery on daily/weekly/monthly schedules'],
  ], C.purple);

  // ══════════════════════════════════════════════════════════
  // TEAM CHAT
  // ══════════════════════════════════════════════════════════
  pdf.addPage();
  y = 25;
  y = sectionHeader(pdf, y, '13. TEAM CHAT — SOC COLLABORATION HUB', C.brand);
  y = bodyText(pdf, y, 'Built-in real-time team communication designed specifically for SOC operations, with incident linking, role-based channels, and security-focused features.');

  y = featureTable(pdf, y, [
    ['Real-Time Messaging', 'WebSocket-powered instant messaging with typing indicators and online presence'],
    ['Incident Mentions', 'Reference incidents directly in chat using @INC-XXXX for instant context linking'],
    ['Channel System', 'Organized channels: #general, #soc-critical, #incidents, #threat-intel for focused discussions'],
    ['Message Reactions', 'Quick reaction emojis for acknowledgment without creating noise'],
    ['Read Receipts', 'See who has read critical messages for accountability tracking'],
    ['Message Pinning', 'Pin important messages for quick reference during incident response'],
    ['Thread Replies', 'Reply to specific messages to keep conversations organized'],
    ['Priority Messages', 'Flag messages as high-priority for immediate attention'],
  ], C.brand);

  // ══════════════════════════════════════════════════════════
  // APPROVALS
  // ══════════════════════════════════════════════════════════
  y = sectionHeader(pdf, y, '14. APPROVALS — ACTION GOVERNANCE WORKFLOW', C.warning);
  y = bodyText(pdf, y, 'Configurable approval workflows ensure critical automated actions receive human authorization before execution, maintaining control while enabling speed.');

  y = featureTable(pdf, y, [
    ['Approval Queue', 'Centralized view of all pending action approvals with priority sorting and SLA deadlines'],
    ['SLA-Driven Escalation', 'Automatic escalation when approvals approach SLA deadlines'],
    ['Role-Based Routing', 'Route approvals to appropriate authority based on action type and severity'],
    ['Approval Metrics', 'Track approval response times, approval/rejection rates, and bottleneck analysis'],
    ['Action Parameters', 'Full visibility into proposed action details before approval'],
    ['Audit Trail', 'Complete log of who approved/rejected what and when'],
  ], C.warning);

  // ══════════════════════════════════════════════════════════
  // AI ASSISTANT
  // ══════════════════════════════════════════════════════════
  pdf.addPage();
  y = 25;
  y = sectionHeader(pdf, y, '15. AI ASSISTANT — CONTEXT-AWARE SOC COPILOT', C.cyan);
  y = bodyText(pdf, y, 'SOCMind AI is a deeply integrated chatbot that understands the entire platform. It knows which page you\'re on, has access to live data, and provides expert guidance in both English and Arabic.');

  y = featureTable(pdf, y, [
    ['Page Awareness', 'AI automatically detects your current location and tailors responses to the active module'],
    ['Live Data Access', 'Queries real-time incident counts, severity distributions, compliance status, and MITRE coverage'],
    ['Role-Aware Responses', 'Adapts guidance based on your role: Tier 1 Analyst, SOC Manager, CISO, GRC Engineer'],
    ['Platform Knowledge Base', 'Deep understanding of every feature, workflow, and capability across the entire platform'],
    ['Bilingual Support', 'Full Arabic and English support for all interactions'],
    ['Conversation History', 'Maintains context across messages within a session for coherent multi-turn discussions'],
    ['Structured Formatting', 'Responses use headers, tables, bullet points, and code blocks for clarity'],
    ['Proactive Suggestions', 'Offers next-step recommendations and identifies potential issues based on current data'],
  ], C.cyan);

  // ══════════════════════════════════════════════════════════
  // ADMIN
  // ══════════════════════════════════════════════════════════
  y = sectionHeader(pdf, y, '16. ADMIN & CLOUD MANAGEMENT', C.dark);
  y = bodyText(pdf, y, 'Administrative tools for platform configuration, user management, and system monitoring.');

  y = featureTable(pdf, y, [
    ['User Management', 'Create, edit, and manage user accounts with role-based access control (RBAC)'],
    ['Role Hierarchy', 'SOC Tier 1/2/3, SOC Manager, CISO, GRC Engineer, Admin — each with specific permissions'],
    ['Cloud Overview', 'System health monitoring, resource utilization, and service status dashboard'],
    ['Cloud Functions', 'Monitor and manage backend functions: status, execution logs, and error tracking'],
    ['Cloud Database', 'Database table viewer, row counts, and basic schema information'],
    ['Cloud Logs', 'System-level logs for debugging and audit purposes'],
    ['Incident Management', 'Administrative incident operations: bulk cleanup, data retention policies'],
  ], C.dark);

  // ══════════════════════════════════════════════════════════
  // DEMO MODE
  // ══════════════════════════════════════════════════════════
  pdf.addPage();
  y = 25;
  y = sectionHeader(pdf, y, '17. DEMO MODE & GUIDED EXPERIENCE', C.accent);
  y = bodyText(pdf, y, 'SOCMind includes a dedicated demo environment designed for evaluators, judges, and investors to safely explore all platform capabilities without affecting production systems.');

  y = subHeader(pdf, y, 'Demo Access', C.accent);
  y = bulletList(pdf, y, [
    'Email: demo@socmind.com — Password: demo',
    'OTP-based entry for time-limited secure demo sessions',
    'Mandatory landing page with system overview before dashboard access',
  ]);

  y = subHeader(pdf, y, 'Demo Features', C.brand);
  y = featureTable(pdf, y, [
    ['Read-Only Mode', 'All features visible but no data mutations — safe exploration of the full platform'],
    ['Guided Tour', 'Multi-page interactive walkthrough (react-joyride) highlighting key features and workflows'],
    ['Live Demo Pipeline', '8-step automated demo: Ingest → AI Classify → Enrich → Playbook → Execute → Notify → Metrics → Brief'],
    ['ROI Comparison', 'Dynamic before/after metrics showing SOCMind vs. traditional SOC performance'],
    ['Competitive Analysis', 'Side-by-side comparison with Splunk, Palo Alto, IBM QRadar, Microsoft Sentinel'],
    ['AI Executive Brief', 'Auto-generated board-ready summary of the demo incident with full AI reasoning trail'],
    ['Live Activity Feed', 'Real-time display of platform operations happening during the demo session'],
    ['Demo Banner', 'Persistent notification bar reminding users they are in a safe demo environment'],
  ], C.accent);

  // ══════════════════════════════════════════════════════════
  // ARCHITECTURE
  // ══════════════════════════════════════════════════════════
  y = sectionHeader(pdf, y, '18. ARCHITECTURE & TECHNICAL STACK', C.dark);

  y = subHeader(pdf, y, 'Frontend', C.brand);
  y = bulletList(pdf, y, [
    'React 18 + TypeScript — Component-based UI with strict type safety',
    'Tailwind CSS + shadcn/ui — Design system with semantic tokens and dark mode',
    'Recharts — Interactive data visualization for dashboards and analytics',
    'Framer Motion — Smooth animations and transitions throughout the UI',
    'React Router — Client-side routing with protected routes and role-based access',
    'TanStack Query — Server state management with real-time cache invalidation',
  ]);

  y = subHeader(pdf, y, 'Backend (Lovable Cloud)', C.accent);
  y = bulletList(pdf, y, [
    'PostgreSQL — Enterprise-grade database with Row Level Security (RLS)',
    'Edge Functions (Deno) — Serverless backend logic for AI processing, log ingestion, and integrations',
    'Real-Time Subscriptions — WebSocket-powered live data updates across all connected clients',
    'Storage — Secure file storage for evidence, reports, and attachments',
    'Authentication — JWT-based auth with role-based access control and session management',
  ]);

  y = subHeader(pdf, y, 'AI Models', C.purple);
  y = bulletList(pdf, y, [
    'Google Gemini 2.5 Flash — Primary AI engine for threat classification and report generation',
    'Multi-Model Reasoning — Evaluates multiple classification hypotheses with confidence scoring',
    'Continuous Learning — Analyst feedback loop improves AI accuracy over time',
  ]);

  // ══════════════════════════════════════════════════════════
  // BACK COVER
  // ══════════════════════════════════════════════════════════
  pdf.addPage();
  pdf.setFillColor(...C.dark);
  pdf.rect(0, 0, PW, PH, 'F');
  pdf.setFillColor(...C.brand);
  pdf.rect(0, 0, PW, 6, 'F');
  pdf.rect(0, PH - 4, PW, 4, 'F');

  y = PH / 2 - 40;
  pdf.setFillColor(...C.white);
  pdf.roundedRect(PW / 2 - 28, y - 6, 56, 18, 4, 4, 'F');
  pdf.setFontSize(18);
  pdf.setTextColor(...C.brand);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SOCMind', PW / 2, y + 6, { align: 'center' });

  y += 30;
  pdf.setFontSize(20);
  pdf.setTextColor(...C.white);
  pdf.text('Thank You', PW / 2, y, { align: 'center' });

  y += 15;
  pdf.setFontSize(11);
  pdf.setTextColor(...C.light);
  pdf.setFont('helvetica', 'normal');
  pdf.text('For questions or live demo requests:', PW / 2, y, { align: 'center' });

  y += 12;
  pdf.setFontSize(12);
  pdf.setTextColor(...C.cyan);
  pdf.setFont('helvetica', 'bold');
  pdf.text('contact@socmind.io', PW / 2, y, { align: 'center' });

  y += 20;
  pdf.setFontSize(9);
  pdf.setTextColor(...C.muted);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Built with AI. Secured by Design. Powered by SOCMind.', PW / 2, y, { align: 'center' });

  // ══════════════════════════════════════════════════════════
  // ADD FOOTERS
  // ══════════════════════════════════════════════════════════
  const totalPages = pdf.getNumberOfPages();
  for (let i = 2; i <= totalPages - 1; i++) { // skip cover & back cover
    pdf.setPage(i);
    addFooter(pdf, i - 1, totalPages - 2);
  }

  pdf.save('SOCMind-Demo-Guide.pdf');
}
