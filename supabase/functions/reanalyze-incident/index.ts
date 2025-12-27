import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifyAuthAndRole(req: Request): Promise<{ user: any; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Missing authorization header' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, error: 'Invalid or expired token' };
  }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleData || !['admin', 'soc_analyst'].includes(roleData.role)) {
    return { user: null, error: 'Insufficient permissions. Admin or SOC Analyst role required.' };
  }

  return { user };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user, error: authError } = await verifyAuthAndRole(req);
    if (authError) {
      return new Response(JSON.stringify({ error: authError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const incident_id = body?.incident_id as string | undefined;

    if (!incident_id) {
      return new Response(JSON.stringify({ error: 'incident_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: incident, error: incidentError } = await supabase
      .from('incidents')
      .select('*')
      .eq('id', incident_id)
      .single();

    if (incidentError || !incident) {
      return new Response(JSON.stringify({ error: 'Incident not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`User ${user.id} re-analyzing incident ${incident.incident_number}`);

    const analyzeResp = await fetch(`${supabaseUrl}/functions/v1/analyze-log`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        log: {
          eventType: incident.event_type,
          severity: incident.severity,
          srcIP: incident.src_ip || 'Unknown',
          dstIP: incident.dst_ip || 'Unknown',
          msg: incident.message || '',
          fileHash: incident.file_hash || undefined,
        },
        internal: true,
      }),
    });

    if (!analyzeResp.ok) {
      const t = await analyzeResp.text();
      console.error('Analyze failed:', analyzeResp.status, t);
      return new Response(JSON.stringify({ error: `Analysis failed: ${t}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const analysis = await analyzeResp.json();

    const updatePayload = {
      classification: analysis?.classification ?? 'Pending',
      confidence: analysis?.confidence ?? 0,
      risk_level: analysis?.risk_level ?? 'Low',
      ai_analysis: analysis?.ai_analysis ?? null,
      sandbox_result: analysis?.sandbox_result ?? null,
      mitre_technique: analysis?.mitre_technique ?? null,
      mitre_tactic: analysis?.mitre_tactic ?? null,
      evidence: analysis?.evidence ?? [],
      recommended_actions: analysis?.recommended_actions ?? [],
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateError } = await supabase
      .from('incidents')
      .update(updatePayload)
      .eq('id', incident.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Failed to update incident:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update incident' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('incident_timeline').insert({
      incident_id: incident.id,
      stage: 'AI Re-Analyzed',
      details: `Classification: ${updatePayload.classification}, Confidence: ${updatePayload.confidence}% (by user ${user.email || user.id})`,
    });

    if (updatePayload.sandbox_result) {
      await supabase.from('incident_timeline').insert({
        incident_id: incident.id,
        stage: 'Hash Checked',
        details: `Sandbox: ${updatePayload.sandbox_result?.vendor || 'VirusTotal'}`,
      });
    }

    // Trigger playbook when appropriate
    if (updatePayload.risk_level === 'Critical' || (updatePayload.classification === 'True Positive' && incident.severity >= 4)) {
      console.log('Triggering playbook after re-analysis');
      await fetch(`${supabaseUrl}/functions/v1/execute-playbook`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          incident_id: incident.id,
          risk_level: updatePayload.risk_level,
          classification: updatePayload.classification,
          internal: true,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true, incident: updated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in reanalyze-incident:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
