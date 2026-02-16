import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    // Find admin user ID
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", ADMIN_EMAIL)
      .maybeSingle();

    if (adminProfile?.id) {
      // Send in-app notification with the code
      await supabase.from("notifications").insert({
        user_id: adminProfile.id,
        type: "system",
        title: `🔑 Demo Access Code: ${code}`,
        body: `Someone requested demo access. Share this code with them. Expires in 10 minutes.`,
        icon: "🔑",
        severity: "warning",
        link: "/demo-landing",
      });
    }

    // Also try sending email via notification function
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
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
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
