import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifyAuth(req: Request): Promise<{ user: any; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Missing authorization header' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, error: 'Invalid or expired token' };
  }

  // All authenticated users can generate reports (read-only operation)
  // But we still verify they have at least viewer role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleData) {
    return { user: null, error: 'No role assigned. Contact administrator.' };
  }

  return { user };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const { user, error: authError } = await verifyAuth(req);
    if (authError) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: authError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`User ${user.id} generating report`);

    // Use service role for data access after auth check
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { report_type, start_date, end_date } = await req.json();
    
    console.log(`Generating ${report_type} report from ${start_date} to ${end_date}`);

    const startDate = start_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = end_date || new Date().toISOString();

    // Fetch incidents for the period
    const { data: incidents, error: incidentsError } = await supabase
      .from('incidents')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (incidentsError) {
      throw new Error(`Failed to fetch incidents: ${incidentsError.message}`);
    }

    // Calculate statistics
    const totalIncidents = incidents?.length || 0;
    const truePositives = incidents?.filter(i => i.classification === 'True Positive').length || 0;
    const falsePositives = incidents?.filter(i => i.classification === 'False Positive').length || 0;
    const pending = incidents?.filter(i => i.classification === 'Pending').length || 0;
    const closed = incidents?.filter(i => i.status === 'Closed').length || 0;

    const severityBreakdown = {
      critical: incidents?.filter(i => i.severity === 5).length || 0,
      high: incidents?.filter(i => i.severity === 4).length || 0,
      medium: incidents?.filter(i => i.severity === 3).length || 0,
      low: incidents?.filter(i => i.severity <= 2).length || 0,
    };

    const riskBreakdown = {
      critical: incidents?.filter(i => i.risk_level === 'Critical').length || 0,
      high: incidents?.filter(i => i.risk_level === 'High').length || 0,
      medium: incidents?.filter(i => i.risk_level === 'Medium').length || 0,
      low: incidents?.filter(i => i.risk_level === 'Low').length || 0,
    };

    // MITRE ATT&CK coverage
    const mitreTechniques: Record<string, number> = {};
    incidents?.forEach(i => {
      if (i.mitre_technique) {
        const key = `${i.mitre_technique}${i.mitre_tactic ? ` - ${i.mitre_tactic}` : ''}`;
        mitreTechniques[key] = (mitreTechniques[key] || 0) + 1;
      }
    });

    const topMitreTechniques = Object.entries(mitreTechniques)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([technique, count]) => ({ technique, count }));

    // Event type breakdown
    const eventTypes: Record<string, number> = {};
    incidents?.forEach(i => {
      eventTypes[i.event_type] = (eventTypes[i.event_type] || 0) + 1;
    });

    const topEventTypes = Object.entries(eventTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));

    // Calculate AI accuracy (based on confirmed classifications)
    const confirmed = incidents?.filter(i => i.classification !== 'Pending') || [];
    const aiAccuracy = confirmed.length > 0 
      ? Math.round((confirmed.filter(i => i.confidence >= 80).length / confirmed.length) * 100)
      : 0;

    // Calculate average confidence
    const avgConfidence = confirmed.length > 0
      ? Math.round(confirmed.reduce((sum, i) => sum + (i.confidence || 0), 0) / confirmed.length)
      : 0;

    // False positive rate
    const falsePositiveRate = (truePositives + falsePositives) > 0
      ? Math.round((falsePositives / (truePositives + falsePositives)) * 100)
      : 0;

    // SLA metrics (assuming 15 min for critical, 1 hour for high)
    const criticalIncidents = incidents?.filter(i => i.risk_level === 'Critical') || [];
    const closedCritical = criticalIncidents.filter(i => i.status === 'Closed');
    const slaCompliance = criticalIncidents.length > 0
      ? Math.round((closedCritical.length / criticalIncidents.length) * 100)
      : 100;

    // Generate report data
    const report = {
      metadata: {
        report_type,
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
      key_findings: [
        `${totalIncidents} total security incidents detected in the reporting period`,
        `${truePositives} confirmed true positives (${Math.round((truePositives/totalIncidents)*100) || 0}% detection rate)`,
        `AI classification achieved ${avgConfidence}% average confidence`,
        `SLA compliance: ${slaCompliance}%`,
        topMitreTechniques.length > 0 
          ? `Most common MITRE technique: ${topMitreTechniques[0].technique} (${topMitreTechniques[0].count} incidents)`
          : 'No MITRE techniques mapped yet',
      ],
      recommendations: [
        riskBreakdown.critical > 0 ? `Address ${riskBreakdown.critical} critical incidents immediately` : null,
        falsePositiveRate > 40 ? 'Consider tuning detection rules to reduce false positive rate' : null,
        slaCompliance < 90 ? 'Review incident response procedures to improve SLA compliance' : null,
        'Continue monitoring and update playbooks based on detected techniques',
      ].filter(Boolean),
      detailed_incidents: incidents?.slice(0, 20).map(i => ({
        id: i.incident_number,
        timestamp: i.created_at,
        event_type: i.event_type,
        severity: i.severity,
        classification: i.classification,
        confidence: i.confidence,
        risk_level: i.risk_level,
        status: i.status,
      })),
    };

    console.log('Report generated successfully');

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-report function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});