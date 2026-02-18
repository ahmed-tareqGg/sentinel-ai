import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Gather last 24h stats
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [incidentsRes, openRes, criticalRes] = await Promise.all([
      supabase.from('incidents').select('id,event_type,risk_level,status,mitre_technique,created_at')
        .gte('created_at', since).is('deleted_at', null),
      supabase.from('incidents').select('id', { count: 'exact' })
        .eq('status', 'Open').is('deleted_at', null),
      supabase.from('incidents').select('id', { count: 'exact' })
        .eq('risk_level', 'Critical').is('deleted_at', null),
    ]);

    const incidents = incidentsRes.data || [];
    const openCount = openRes.count || 0;
    const criticalCount = criticalRes.count || 0;
    const newToday = incidents.length;
    const byRisk = incidents.reduce<Record<string,number>>((a,i) => {
      a[i.risk_level || 'Unknown'] = (a[i.risk_level || 'Unknown'] || 0) + 1; return a;
    }, {});
    const topTypes = Object.entries(
      incidents.reduce<Record<string,number>>((a,i) => { a[i.event_type] = (a[i.event_type]||0)+1; return a; }, {})
    ).sort(([,a],[,b]) => b-a).slice(0,5);

    const statsText = `
New incidents (24h): ${newToday}
Total open: ${openCount}
Total critical (all time): ${criticalCount}
Risk breakdown today: ${JSON.stringify(byRisk)}
Top event types: ${topTypes.map(([t,c]) => `${t}(${c})`).join(', ')}
    `.trim();

    // Generate AI summary
    let summary = '';
    try {
      const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: 'You are a senior SOC analyst writing a concise daily security digest for a CISO. Be professional, clear, and highlight risks and recommended actions. Use bullet points. Max 200 words.' },
            { role: 'user', content: `Generate the daily SOC digest based on these stats:\n${statsText}` }
          ],
          max_tokens: 400,
        }),
      });
      if (aiRes.ok) {
        const data = await aiRes.json();
        summary = data.choices?.[0]?.message?.content || '';
      }
    } catch(e) {
      console.error('AI generation failed:', e);
      summary = `Daily SOC Summary:\n- ${newToday} new incidents in 24h\n- ${openCount} open incidents\n- ${criticalCount} critical incidents total`;
    }

    // Get all approved users with email digest enabled
    const { data: users } = await supabase
      .from('notification_preferences')
      .select('user_id, email_digest')
      .eq('email_digest', true);

    let sent = 0;
    if (RESEND_API_KEY && users && users.length > 0) {
      const userIds = users.map(u => u.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', userIds);

      const htmlBody = buildDigestHtml(summary, statsText, newToday, openCount, criticalCount, topTypes);

      for (const p of (profiles || [])) {
        if (!p.email) continue;
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'SOCMind Daily Digest <onboarding@resend.dev>',
              to: [p.email],
              subject: `🛡️ SOCMind Daily Digest — ${new Date().toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' })}`,
              html: htmlBody,
            }),
          });
          sent++;
        } catch (e) { console.error(`Failed to send to ${p.email}:`, e); }
      }
    }

    return new Response(JSON.stringify({ success: true, sent, summary: summary.slice(0, 200) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Daily digest error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildDigestHtml(summary: string, stats: string, newToday: number, openCount: number, criticalCount: number, topTypes: [string,number][]) {
  const summaryHtml = summary.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0f;">
<div style="max-width:600px;margin:0 auto;padding:24px;">
  <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px;padding:24px;border:1px solid #1e3a5f;">
    <h1 style="color:#f8fafc;margin:0 0 4px;font-size:22px;">🛡️ SOCMind Daily Digest</h1>
    <p style="color:#64748b;font-size:13px;margin:0;">${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
    
    <div style="display:flex;gap:12px;margin:20px 0;flex-wrap:wrap;">
      <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px 16px;flex:1;min-width:100px;">
        <p style="color:#94a3b8;font-size:11px;margin:0 0 4px;text-transform:uppercase;">New Today</p>
        <p style="color:#f1f5f9;font-size:24px;font-weight:800;margin:0;">${newToday}</p>
      </div>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px 16px;flex:1;min-width:100px;">
        <p style="color:#94a3b8;font-size:11px;margin:0 0 4px;text-transform:uppercase;">Open</p>
        <p style="color:#f59e0b;font-size:24px;font-weight:800;margin:0;">${openCount}</p>
      </div>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px 16px;flex:1;min-width:100px;">
        <p style="color:#94a3b8;font-size:11px;margin:0 0 4px;text-transform:uppercase;">Critical</p>
        <p style="color:#ef4444;font-size:24px;font-weight:800;margin:0;">${criticalCount}</p>
      </div>
    </div>

    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin-bottom:16px;">
      <h3 style="color:#60a5fa;font-size:13px;font-weight:700;margin:0 0 10px;text-transform:uppercase;letter-spacing:.05em;">🤖 AI Analysis</h3>
      <div style="color:#cbd5e1;font-size:14px;line-height:1.7;">${summaryHtml}</div>
    </div>

    ${topTypes.length > 0 ? `
    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;">
      <h3 style="color:#60a5fa;font-size:13px;font-weight:700;margin:0 0 10px;text-transform:uppercase;letter-spacing:.05em;">🔥 Top Threat Types</h3>
      ${topTypes.map(([t,c]) => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #1e293b;">
        <span style="color:#94a3b8;font-size:13px;">${t}</span>
        <span style="color:#f1f5f9;font-weight:700;font-size:13px;">${c}</span>
      </div>`).join('')}
    </div>` : ''}

    <p style="color:#475569;font-size:11px;margin-top:20px;text-align:center;">
      SOCMind Security Platform · Manage digest preferences in Settings → Notifications
    </p>
  </div>
</div>
</body></html>`;
}
