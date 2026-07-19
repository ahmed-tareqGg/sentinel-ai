import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OWNER_EMAIL = "tarekaboya2019@gmail.com";
const OTP_KEY = "agent-download:" + OWNER_EMAIL;

const rateLimit = new Map<string, { count: number; resetAt: number }>();
function allow(ip: string) {
  const now = Date.now();
  const r = rateLimit.get(ip);
  if (!r || now > r.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (r.count >= 10) return false;
  r.count++;
  return true;
}

function getIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ip = getIp(req);
  if (!allow(ip)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    const allowed = ["admin", "ciso", "soc_manager", "soc_tier_3", "soc_tier_2", "soc_tier_1"];
    if (!roleData || !allowed.includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "send") {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await admin.from("demo_otp_codes").delete().eq("email", OTP_KEY);
      const { error: insertErr } = await admin
        .from("demo_otp_codes")
        .insert({ code, email: OTP_KEY });
      if (insertErr) throw insertErr;

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0a0f;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px;padding:28px;border:1px solid #334155;">
      <h1 style="color:#f8fafc;margin:0 0 8px;font-size:20px;">🛡️ SOCMind — Agent Download Code</h1>
      <p style="color:#94a3b8;margin:0 0 20px;font-size:14px;">
        Someone (likely you) requested to download an agent binary. Use the code below to authorize the download.
      </p>
      <div style="text-align:center;background:#0b1220;border:1px dashed #38bdf8;border-radius:10px;padding:20px;margin:18px 0;">
        <div style="color:#38bdf8;font-size:34px;font-weight:700;letter-spacing:10px;font-family:monospace;">${code}</div>
      </div>
      <p style="color:#64748b;font-size:12px;margin:0;">This code expires in 10 minutes. If you did not request this, ignore this email.</p>
    </div>
  </div>
</body></html>`;
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "SOCMind <onboarding@resend.dev>",
            to: [OWNER_EMAIL],
            subject: "🔑 SOCMind Agent Download Code",
            html,
          }),
        });
        if (!r.ok) console.error("Resend error:", await r.text());
      } else {
        console.log("[OTP] No RESEND_API_KEY configured");
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      const code = String(body?.code || "").trim();
      if (code.length !== 6) {
        return new Response(JSON.stringify({ error: "Invalid code format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: otp } = await admin
        .from("demo_otp_codes")
        .select("*")
        .eq("email", OTP_KEY)
        .eq("code", code)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!otp) {
        return new Response(JSON.stringify({ error: "Invalid or expired code" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await admin.from("demo_otp_codes").update({ used: true }).eq("id", otp.id);

      return new Response(JSON.stringify({ authorized: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agent-download-otp error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
