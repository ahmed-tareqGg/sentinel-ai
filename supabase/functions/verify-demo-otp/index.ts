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
    const { code } = await req.json();
    
    if (!code || code.length !== 6) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid code format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const ADMIN_EMAIL = "tarekaboya2019@gmail.com";
    const DEMO_USER_EMAIL = "demo@socmind.com";

    // Find valid code
    const { data: otpRecord, error: fetchError } = await supabase
      .from("demo_otp_codes")
      .select("*")
      .eq("email", ADMIN_EMAIL)
      .eq("code", code)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!otpRecord) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired code" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark code as used
    await supabase.from("demo_otp_codes").update({ used: true }).eq("id", otpRecord.id);

    // Generate a magic link for the demo user to sign them in
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: DEMO_USER_EMAIL,
    });

    if (linkError) throw linkError;

    // Extract token_hash from the action link
    const actionUrl = new URL(linkData.properties.action_link);
    const token_hash = actionUrl.searchParams.get("token");

    return new Response(
      JSON.stringify({ 
        success: true,
        token_hash,
      }),
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
