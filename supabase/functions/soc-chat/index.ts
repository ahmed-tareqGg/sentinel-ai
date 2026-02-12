import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { messages, context_type } = await req.json();

    // Gather real-time SOC context
    const [incidentsRes, recentRes, statsRes] = await Promise.all([
      supabase.from('incidents').select('id, incident_number, event_type, severity, risk_level, classification, status, src_ip, dst_ip, mitre_technique, mitre_tactic, confidence, message, created_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('incidents').select('id, incident_number, event_type, risk_level, status, created_at').eq('status', 'Open').order('created_at', { ascending: false }).limit(10),
      supabase.from('raw_logs').select('id', { count: 'exact', head: true }),
    ]);

    const incidents = incidentsRes.data || [];
    const openIncidents = recentRes.data || [];
    const totalLogs = statsRes.count || 0;

    const criticalCount = incidents.filter(i => i.risk_level === 'Critical').length;
    const tpCount = incidents.filter(i => i.classification === 'True Positive').length;
    const fpCount = incidents.filter(i => i.classification === 'False Positive').length;

    const systemPrompt = `You are SOCMind AI — an expert Security Operations Center assistant embedded in a real SOC platform.

CURRENT SOC STATUS:
- Total Incidents: ${incidents.length} (last 50)
- Open Incidents: ${openIncidents.length}
- Critical Alerts: ${criticalCount}
- True Positives: ${tpCount}, False Positives: ${fpCount}
- Total Raw Logs Ingested: ${totalLogs}

OPEN INCIDENTS:
${openIncidents.map(i => `• ${i.incident_number} — ${i.event_type} [${i.risk_level}] — ${i.status} — ${new Date(i.created_at).toLocaleString()}`).join('\n')}

RECENT INCIDENT DETAILS:
${incidents.slice(0, 15).map(i => `• ${i.incident_number}: ${i.event_type} | Severity: ${i.severity} | Risk: ${i.risk_level} | Class: ${i.classification} (${i.confidence}%) | MITRE: ${i.mitre_technique || 'N/A'} | Src: ${i.src_ip || 'N/A'} | Status: ${i.status}`).join('\n')}

CAPABILITIES:
- Answer questions about incidents, threats, MITRE ATT&CK techniques
- Provide root cause analysis and investigation recommendations
- Explain AI classifications and confidence scores
- Suggest playbook actions and containment strategies
- Analyze attack patterns and correlations

RULES:
- Be concise and actionable — you're talking to SOC analysts
- Reference specific incident numbers when relevant
- Use MITRE ATT&CK framework terminology
- Provide risk-prioritized recommendations
- If asked about a specific incident, use the data provided
- Answer in the same language the user uses (Arabic or English)`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
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
