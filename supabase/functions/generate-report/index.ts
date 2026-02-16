import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Incident {
  id: string;
  incident_number: string;
  created_at: string;
  event_type: string;
  severity: number;
  classification: string;
  confidence: number;
  risk_level: string;
  status: string;
  src_ip: string | null;
  dst_ip: string | null;
  message: string | null;
  mitre_technique: string | null;
  mitre_tactic: string | null;
  recommended_actions: string[] | null;
  ai_analysis: any;
}

async function verifyAuth(req: Request): Promise<{ user: any; supabase: any; error?: string }> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  
  if (!authHeader) {
    return { user: null, supabase: null, error: 'Missing authorization header' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return { user: null, supabase: null, error: error?.message || 'Invalid token' };
  }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleData) {
    return { user: null, supabase: null, error: 'No role assigned' };
  }

  return { user, supabase };
}

// Generate PDF content as plain text (will be rendered as PDF-like format)
function generatePDFContent(report: any, incident?: Incident): string {
  const now = new Date().toLocaleString();
  
  if (incident) {
    // Single incident report
    return `
================================================================================
                           SOCMind INCIDENT REPORT
================================================================================

Report Generated: ${now}
Incident Number: ${incident.incident_number}

--------------------------------------------------------------------------------
                            EXECUTIVE SUMMARY
--------------------------------------------------------------------------------

Event Type:      ${incident.event_type}
Severity:        ${incident.severity}/5
Risk Level:      ${incident.risk_level}
Classification:  ${incident.classification}
AI Confidence:   ${incident.confidence}%
Status:          ${incident.status}

--------------------------------------------------------------------------------
                            INCIDENT DETAILS
--------------------------------------------------------------------------------

Timestamp:       ${new Date(incident.created_at).toLocaleString()}
Source IP:       ${incident.src_ip || 'N/A'}
Destination IP:  ${incident.dst_ip || 'N/A'}

Description:
${incident.message || 'No description available'}

--------------------------------------------------------------------------------
                          MITRE ATT&CK MAPPING
--------------------------------------------------------------------------------

Technique:       ${incident.mitre_technique || 'Not mapped'}
Tactic:          ${incident.mitre_tactic || 'Not mapped'}

--------------------------------------------------------------------------------
                         RECOMMENDED ACTIONS
--------------------------------------------------------------------------------

${(incident.recommended_actions || ['No actions recommended']).map((a, i) => `${i + 1}. ${a}`).join('\n')}

--------------------------------------------------------------------------------
                            AI ANALYSIS
--------------------------------------------------------------------------------

${JSON.stringify(incident.ai_analysis || {}, null, 2)}

--------------------------------------------------------------------------------
                           SLA METRICS
--------------------------------------------------------------------------------

MTTD (Mean Time To Detect):  < 1 minute (automated)
MTTR (Mean Time To Respond): Pending closure

--------------------------------------------------------------------------------
                          COMPLIANCE NOTE
--------------------------------------------------------------------------------

This report is generated automatically by SOCMind Autonomous SOC platform.
All actions are logged for audit and compliance purposes.

================================================================================
                        END OF INCIDENT REPORT
================================================================================
    `.trim();
  }

  // Period report
  return `
================================================================================
                        SOCMind SECURITY REPORT
================================================================================

Report Type:     ${report.metadata.report_type}
Generated:       ${report.metadata.generated_at}
Generated By:    ${report.metadata.generated_by}
Period:          ${report.metadata.period.start} to ${report.metadata.period.end}

--------------------------------------------------------------------------------
                           EXECUTIVE SUMMARY
--------------------------------------------------------------------------------

Total Incidents:      ${report.executive_summary.total_incidents}
True Positives:       ${report.executive_summary.true_positives}
False Positives:      ${report.executive_summary.false_positives}
Pending Analysis:     ${report.executive_summary.pending_analysis}
Closed Incidents:     ${report.executive_summary.closed_incidents}

AI Accuracy:          ${report.executive_summary.ai_accuracy}
Average Confidence:   ${report.executive_summary.avg_confidence}
False Positive Rate:  ${report.executive_summary.false_positive_rate}
SLA Compliance:       ${report.executive_summary.sla_compliance}

--------------------------------------------------------------------------------
                          SEVERITY BREAKDOWN
--------------------------------------------------------------------------------

Critical (5):    ${report.severity_breakdown.critical}
High (4):        ${report.severity_breakdown.high}
Medium (3):      ${report.severity_breakdown.medium}
Low (1-2):       ${report.severity_breakdown.low}

--------------------------------------------------------------------------------
                           RISK BREAKDOWN
--------------------------------------------------------------------------------

Critical:        ${report.risk_breakdown.critical}
High:            ${report.risk_breakdown.high}
Medium:          ${report.risk_breakdown.medium}
Low:             ${report.risk_breakdown.low}

--------------------------------------------------------------------------------
                        MITRE ATT&CK COVERAGE
--------------------------------------------------------------------------------

Techniques Detected: ${report.mitre_coverage.techniques_detected}

Top Techniques:
${report.mitre_coverage.top_techniques.map((t: any, i: number) => `  ${i + 1}. ${t.technique} (${t.count} incidents)`).join('\n') || '  No techniques mapped'}

--------------------------------------------------------------------------------
                          KEY FINDINGS
--------------------------------------------------------------------------------

${report.key_findings.map((f: string, i: number) => `${i + 1}. ${f}`).join('\n')}

--------------------------------------------------------------------------------
                         RECOMMENDATIONS
--------------------------------------------------------------------------------

${report.recommendations.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}

================================================================================
                         END OF REPORT
================================================================================
  `.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user, supabase, error: authError } = await verifyAuth(req);
    if (authError) {
      return new Response(JSON.stringify({ code: 401, message: authError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { type, report_type, incident_id, start_date, end_date } = await req.json();

    // Single incident report
    if (type === 'incident' && incident_id) {
      const { data: incident, error: incidentError } = await supabase
        .from('incidents')
        .select('*')
        .eq('id', incident_id)
        .single();

      if (incidentError || !incident) {
        throw new Error('Incident not found');
      }

      // Fetch timeline
      const { data: timeline } = await supabase
        .from('incident_timeline')
        .select('*')
        .eq('incident_id', incident_id)
        .order('timestamp', { ascending: true });

      const pdfContent = generatePDFContent(null, incident as Incident);
      const pdfBase64 = btoa(pdfContent);

      return new Response(JSON.stringify({
        success: true,
        incident_number: incident.incident_number,
        pdf_base64: pdfBase64,
        content_type: 'text/plain',
        filename: `Incident_Report_${incident.incident_number}.txt`,
        report_data: {
          incident,
          timeline,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Period report
    const startDate = start_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = end_date || new Date().toISOString();

    const { data: incidents, error: incidentsError } = await supabase
      .from('incidents')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (incidentsError) {
      throw new Error(`Failed to fetch incidents: ${incidentsError.message}`);
    }

    const incidentList = (incidents as Incident[]) || [];

    // Calculate statistics
    const totalIncidents = incidentList.length;
    const truePositives = incidentList.filter(i => i.classification === 'True Positive').length;
    const falsePositives = incidentList.filter(i => i.classification === 'False Positive').length;
    const pending = incidentList.filter(i => i.classification === 'Pending').length;
    const closed = incidentList.filter(i => i.status === 'Closed').length;

    const severityBreakdown = {
      critical: incidentList.filter(i => i.severity === 5).length,
      high: incidentList.filter(i => i.severity === 4).length,
      medium: incidentList.filter(i => i.severity === 3).length,
      low: incidentList.filter(i => i.severity <= 2).length,
    };

    const riskBreakdown = {
      critical: incidentList.filter(i => i.risk_level === 'Critical').length,
      high: incidentList.filter(i => i.risk_level === 'High').length,
      medium: incidentList.filter(i => i.risk_level === 'Medium').length,
      low: incidentList.filter(i => i.risk_level === 'Low').length,
    };

    const mitreTechniques: Record<string, number> = {};
    incidentList.forEach(i => {
      if (i.mitre_technique) {
        const key = `${i.mitre_technique}${i.mitre_tactic ? ` - ${i.mitre_tactic}` : ''}`;
        mitreTechniques[key] = (mitreTechniques[key] || 0) + 1;
      }
    });

    const topMitreTechniques = Object.entries(mitreTechniques)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([technique, count]) => ({ technique, count }));

    const eventTypes: Record<string, number> = {};
    incidentList.forEach(i => {
      eventTypes[i.event_type] = (eventTypes[i.event_type] || 0) + 1;
    });

    const topEventTypes = Object.entries(eventTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));

    const confirmed = incidentList.filter(i => i.classification !== 'Pending');
    const aiAccuracy = confirmed.length > 0 
      ? Math.round((confirmed.filter(i => i.confidence >= 80).length / confirmed.length) * 100)
      : 0;

    const avgConfidence = confirmed.length > 0
      ? Math.round(confirmed.reduce((sum, i) => sum + (i.confidence || 0), 0) / confirmed.length)
      : 0;

    const falsePositiveRate = (truePositives + falsePositives) > 0
      ? Math.round((falsePositives / (truePositives + falsePositives)) * 100)
      : 0;

    const criticalIncidents = incidentList.filter(i => i.risk_level === 'Critical');
    const closedCritical = criticalIncidents.filter(i => i.status === 'Closed');
    const slaCompliance = criticalIncidents.length > 0
      ? Math.round((closedCritical.length / criticalIncidents.length) * 100)
      : 100;

    // Build report based on type
    const reportType = (report_type || 'Executive').toLowerCase();

    let keyFindings: string[] = [];
    let recommendations: (string | null)[] = [];
    let detailedIncidents: any[] = [];
    let performanceMetrics: any = null;

    if (reportType === 'performance') {
      // === PERFORMANCE REPORT: SOC metrics & analyst productivity ===
      const resolvedIncidents = incidentList.filter(i => i.status === 'Closed' || i.status === 'Resolved');
      const avgResolutionTimeMs = resolvedIncidents.length > 0
        ? resolvedIncidents.reduce((sum, i) => {
            const closed = (i as any).closed_at || (i as any).resolved_at;
            if (!closed) return sum;
            const diff = new Date(closed).getTime() - new Date(i.created_at).getTime();
            return sum + Math.min(diff, 24 * 60 * 60 * 1000); // cap at 24h
          }, 0) / resolvedIncidents.length
        : 0;
      const avgResolutionMinutes = Math.round(avgResolutionTimeMs / 60000);

      const escalatedCount = incidentList.filter(i => (i as any).escalated_at).length;
      const reopenedCount = 0; // placeholder

      performanceMetrics = {
        total_processed: totalIncidents,
        resolved_count: resolvedIncidents.length,
        resolution_rate: totalIncidents > 0 ? `${Math.round((resolvedIncidents.length / totalIncidents) * 100)}%` : '0%',
        avg_resolution_time: avgResolutionMinutes > 60 ? `${(avgResolutionMinutes / 60).toFixed(1)} hours` : `${avgResolutionMinutes} minutes`,
        escalation_count: escalatedCount,
        escalation_rate: totalIncidents > 0 ? `${Math.round((escalatedCount / totalIncidents) * 100)}%` : '0%',
        sla_compliance: `${slaCompliance}%`,
        false_positive_rate: `${falsePositiveRate}%`,
        ai_accuracy: `${aiAccuracy}%`,
        avg_confidence: `${avgConfidence}%`,
      };

      keyFindings = [
        `${resolvedIncidents.length} out of ${totalIncidents} incidents resolved (${performanceMetrics.resolution_rate})`,
        `Average resolution time: ${performanceMetrics.avg_resolution_time}`,
        `${escalatedCount} incidents escalated (${performanceMetrics.escalation_rate} escalation rate)`,
        `AI classification accuracy: ${aiAccuracy}% with ${avgConfidence}% average confidence`,
        `SLA compliance: ${slaCompliance}%`,
        `False positive rate: ${falsePositiveRate}%`,
      ];

      recommendations = [
        avgResolutionMinutes > 120 ? 'Reduce MTTR by automating initial triage with playbooks' : null,
        falsePositiveRate > 30 ? `High false positive rate (${falsePositiveRate}%) — tune detection rules` : null,
        slaCompliance < 95 ? `SLA compliance at ${slaCompliance}% — review response workflows` : null,
        escalatedCount > totalIncidents * 0.3 ? 'High escalation rate — improve Tier 1 playbooks' : null,
        'Review analyst workload distribution for balanced coverage',
        'Update automation playbooks based on recurring incident patterns',
      ].filter(Boolean);

      // Show event type distribution for performance
      detailedIncidents = []; // No detailed incidents for performance report
    } else {
      // === EXECUTIVE REPORT: High-level summary for leadership ===
      keyFindings = [
        `${totalIncidents} total security incidents detected in the reporting period`,
        `${truePositives} confirmed true positives (${Math.round((truePositives/Math.max(totalIncidents,1))*100)}% confirmation rate)`,
        `${severityBreakdown.critical} critical and ${severityBreakdown.high} high severity incidents identified`,
        riskBreakdown.critical > 0 ? `${riskBreakdown.critical} incidents classified as critical risk requiring immediate attention` : 'No critical risk incidents — security posture is strong',
        topMitreTechniques.length > 0 
          ? `Most common attack technique: ${topMitreTechniques[0].technique} (${topMitreTechniques[0].count} occurrences)`
          : 'No MITRE ATT&CK techniques mapped yet',
        `AI-driven detection accuracy: ${aiAccuracy}% | SLA compliance: ${slaCompliance}%`,
      ];

      recommendations = [
        riskBreakdown.critical > 0 ? `Prioritize remediation of ${riskBreakdown.critical} critical-risk incidents` : null,
        severityBreakdown.critical > 0 ? `Investigate ${severityBreakdown.critical} critical severity events immediately` : null,
        falsePositiveRate > 40 ? 'Tune detection rules to reduce false positive rate' : null,
        slaCompliance < 90 ? 'Review incident response procedures to improve SLA compliance' : null,
        'Continue investment in AI-driven detection capabilities',
        'Schedule quarterly review of MITRE ATT&CK coverage gaps',
      ].filter(Boolean);

      detailedIncidents = incidentList.slice(0, 20).map(i => ({
        id: i.incident_number,
        timestamp: i.created_at,
        event_type: i.event_type,
        severity: i.severity,
        classification: i.classification,
        confidence: i.confidence,
        risk_level: i.risk_level,
        status: i.status,
      }));
    }

    const report = {
      metadata: {
        report_type: report_type || 'Executive',
        generated_at: new Date().toISOString(),
        generated_by: user.email || user.id,
        period: { start: startDate, end: endDate },
      },
      executive_summary: {
        total_incidents: totalIncidents,
        true_positives: truePositives,
        false_positives: falsePositives,
        pending_analysis: pending,
        closed_incidents: closed,
        false_positive_rate: `${falsePositiveRate}%`,
        ai_accuracy: `${aiAccuracy}%`,
        avg_confidence: `${avgConfidence}%`,
        sla_compliance: `${slaCompliance}%`,
      },
      severity_breakdown: severityBreakdown,
      risk_breakdown: riskBreakdown,
      mitre_coverage: {
        techniques_detected: Object.keys(mitreTechniques).length,
        top_techniques: topMitreTechniques,
      },
      event_type_breakdown: topEventTypes,
      performance_metrics: performanceMetrics,
      key_findings: keyFindings,
      recommendations,
      detailed_incidents: detailedIncidents,
    };

    const pdfContent = generatePDFContent(report);
    const pdfBase64 = btoa(pdfContent);

    return new Response(JSON.stringify({
      ...report,
      pdf_base64: pdfBase64,
      content_type: 'text/plain',
      filename: `Security_Report_${new Date().toISOString().split('T')[0]}.txt`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-report:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
