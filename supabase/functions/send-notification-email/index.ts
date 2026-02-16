import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  severity: string;
  link?: string;
  type: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: EmailPayload = await req.json();
    const { to, subject, body, severity, link, type } = payload;

    if (!to || !subject) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build HTML email
    const severityColor = severity === 'critical' ? '#ef4444' : severity === 'warning' ? '#f59e0b' : '#3b82f6';
    const severityLabel = severity === 'critical' ? '🚨 CRITICAL' : severity === 'warning' ? '⚠️ WARNING' : 'ℹ️ INFO';
    const typeLabel = type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0f;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px 12px 0 0;padding:24px;border-bottom:3px solid ${severityColor};">
      <h1 style="color:#f8fafc;margin:0;font-size:20px;">🛡️ SOCMind Alert</h1>
      <span style="display:inline-block;margin-top:8px;padding:4px 12px;border-radius:999px;background:${severityColor}20;color:${severityColor};font-size:12px;font-weight:600;">
        ${severityLabel}
      </span>
      <span style="display:inline-block;margin-top:8px;margin-left:8px;padding:4px 12px;border-radius:999px;background:#3b82f620;color:#60a5fa;font-size:12px;">
        ${typeLabel}
      </span>
    </div>
    
    <!-- Body -->
    <div style="background:#1e293b;padding:24px;border-radius:0 0 12px 12px;">
      <h2 style="color:#f1f5f9;margin:0 0 12px;font-size:16px;">${subject}</h2>
      <p style="color:#94a3b8;margin:0 0 20px;line-height:1.6;font-size:14px;">${body || 'A new security event requires your attention.'}</p>
      
      ${link ? `
      <a href="${supabaseUrl.replace('/rest/v1', '').replace('supabase.co', 'lovable.app')}${link}" 
         style="display:inline-block;padding:10px 24px;background:${severityColor};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
        View Details →
      </a>
      ` : ''}
      
      <hr style="border:none;border-top:1px solid #334155;margin:24px 0;">
      <p style="color:#64748b;font-size:11px;margin:0;">
        This alert was sent by SOCMind Security Platform.<br>
        You can manage your notification preferences in Settings → Notifications.
      </p>
    </div>
  </div>
</body>
</html>`;

    // Use Supabase Auth admin to send email via the built-in SMTP
    // Alternative: use Resend/SendGrid if configured
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    if (RESEND_API_KEY) {
      // Use Resend
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'SOCMind Alerts <onboarding@resend.dev>',
          to: [to],
          subject: `[SOCMind] ${subject}`,
          html: htmlBody,
        }),
      });
      
      if (!res.ok) {
        const err = await res.text();
        console.error('Resend error:', err);
        return new Response(JSON.stringify({ error: 'Failed to send email', details: err }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log(`Email sent to ${to}: ${subject}`);
    } else {
      // Log the email that would be sent (no email provider configured)
      console.log(`[EMAIL QUEUED] To: ${to} | Subject: ${subject} | Severity: ${severity}`);
      console.log('No RESEND_API_KEY configured. Email logged but not sent.');
    }

    return new Response(JSON.stringify({ success: true, to, subject }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Email notification error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
