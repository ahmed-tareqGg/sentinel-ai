import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiting (5 requests per IP per hour)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 3600000 });
    return true;
  }

  if (record.count >= 5) {
    return false;
  }

  record.count++;
  return true;
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Too many requests. Please try again later.",
      }),
      {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const ADMIN_EMAIL = "tarekaboya2019@gmail.com";

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Delete old codes
    await supabase.from("demo_otp_codes").delete().eq("email", ADMIN_EMAIL);

    // Insert new code (expires in 10 minutes)
    const { error: insertError } = await supabase.from("demo_otp_codes").insert({
      code,
      email: ADMIN_EMAIL,
    });
    if (insertError) throw insertError;

    // Send in-app notification to ALL admin users
    const { data: adminUsers } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "ciso", "soc_manager"]);

    if (adminUsers && adminUsers.length > 0) {
      const notifications = adminUsers.map((u: any) => ({
        user_id: u.user_id,
        type: "system",
        title: `🔑 Demo Access Code: ${code}`,
        body: `Someone requested demo access. Share this code with them. Expires in 10 minutes.`,
        icon: "🔑",
        severity: "warning",
        link: "/demo-landing",
      }));
      await supabase.from("notifications").insert(notifications);
    }

    // Also try sending email via notification function
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          to: ADMIN_EMAIL,
          subject: `🔑 SOCMind Demo Code: ${code}`,
          body: `Someone requested demo access.\n\nYour demo code is: <strong style="font-size:24px;letter-spacing:8px;">${code}</strong>\n\nThis code expires in 10 minutes.`,
          severity: "warning",
          type: "system",
        }),
      });
    } catch (emailErr) {
      console.log("Email send attempted:", emailErr);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
