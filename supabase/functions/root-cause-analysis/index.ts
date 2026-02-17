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
    const GEMINI_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GOOGLE_GEMINI_API_KEY not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { incident_id } = await req.json();
    if (!incident_id) throw new Error('incident_id required');

    // Fetch incident with full context
    const [incidentRes, timelineRes, notesRes, iocsRes] = await Promise.all([
      supabase.from('incidents').select('*').eq('id', incident_id).single(),
      supabase.from('incident_timeline').select('*').eq('incident_id', incident_id).order('timestamp', { ascending: true }),
      supabase.from('analyst_notes').select('*').eq('incident_id', incident_id).order('created_at', { ascending: true }),
      supabase.from('incident_iocs').select('*').eq('incident_id', incident_id),
    ]);

    const incident = incidentRes.data;
    if (!incident) throw new Error('Incident not found');

    const timeline = timelineRes.data || [];
    const notes = notesRes.data || [];
    const iocs = iocsRes.data || [];

    // Also get similar past incidents for pattern analysis
    const { data: similarIncidents } = await supabase
      .from('incidents')
      .select('incident_number, event_type, classification, risk_level, mitre_technique, src_ip, status, created_at')
      .eq('event_type', incident.event_type)
      .neq('id', incident_id)
      .order('created_at', { ascending: false })
      .limit(10);

    const prompt = `You are a senior SOC analyst performing Root Cause Analysis on a security incident.

INCIDENT DATA:
- ID: ${incident.incident_number}
- Event: ${incident.event_type}
- Severity: ${incident.severity}/5 | Risk: ${incident.risk_level}
- Classification: ${incident.classification} (${incident.confidence}% confidence)
- MITRE: ${incident.mitre_technique || 'N/A'} — ${incident.mitre_tactic || 'N/A'}
- Source IP: ${incident.src_ip || 'N/A'} → Dest IP: ${incident.dst_ip || 'N/A'}
- Message: ${incident.message || 'N/A'}
- Status: ${incident.status}
- Created: ${incident.created_at}

AI ANALYSIS: ${JSON.stringify(incident.ai_analysis || {})}

TIMELINE (${timeline.length} entries):
${timeline.map(t => `[${t.timestamp}] ${t.stage}: ${t.details || ''}`).join('\n')}

ANALYST NOTES (${notes.length}):
${notes.map(n => `[${n.created_at}] ${n.content}`).join('\n')}

IOCs (${iocs.length}):
${iocs.map(i => `${i.ioc_type}: ${i.value} (${i.confidence})`).join('\n')}

SIMILAR PAST INCIDENTS (${(similarIncidents || []).length}):
${(similarIncidents || []).map(i => `${i.incident_number}: ${i.event_type} [${i.risk_level}] — ${i.classification} — MITRE: ${i.mitre_technique} — From: ${i.src_ip} — ${i.status}`).join('\n')}

Provide a structured Root Cause Analysis in this format (use the same language as the incident data, default English):

## 🔍 Root Cause
[What caused this incident — be specific about the attack vector, vulnerability, or misconfiguration]

## 📊 Attack Chain
[Step-by-step reconstruction of the attack using MITRE ATT&CK framework]

## 🎯 Impact Assessment
[What was affected, potential data exposure, blast radius]

## 🔗 Pattern Analysis
[Correlation with similar incidents — is this part of a campaign?]

## 🛡️ Recommended Mitigations
[Specific, actionable steps to prevent recurrence — prioritized by impact]

## 📋 Investigation Status
[What's been done, what's remaining, recommended next steps]`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GEMINI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a senior cybersecurity analyst specializing in incident response and root cause analysis. Be thorough, specific, and actionable.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const analysis = aiResult.choices?.[0]?.message?.content || 'Analysis unavailable';

    // Save to timeline
    await supabase.from('incident_timeline').insert({
      incident_id,
      stage: 'AI Root Cause Analysis',
      details: analysis.slice(0, 2000), // Keep timeline entry reasonable
    });

    return new Response(JSON.stringify({
      success: true,
      analysis,
      similar_incidents_count: (similarIncidents || []).length,
      iocs_analyzed: iocs.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('root-cause-analysis error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
