import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EscalationParams {
  incident_id: string;
  reason?: string;
  force_tier?: 1 | 2 | 3;
}

interface EscalationRule {
  condition: (incident: any, metrics: any) => boolean;
  target_tier: number;
  reason: string;
}

const ESCALATION_RULES: EscalationRule[] = [
  {
    condition: (incident) => incident.risk_level === 'Critical',
    target_tier: 2,
    reason: 'Critical risk level requires Tier 2 analyst review',
  },
  {
    condition: (incident) => incident.confidence < 60,
    target_tier: 2,
    reason: 'Low AI confidence (<60%) requires manual validation',
  },
  {
    condition: (incident) => incident.event_type?.toLowerCase().includes('ransomware'),
    target_tier: 3,
    reason: 'Ransomware detected - Incident Commander required',
  },
  {
    condition: (incident) => incident.event_type?.toLowerCase().includes('data_exfiltration'),
    target_tier: 3,
    reason: 'Data exfiltration - Executive notification required',
  },
  {
    condition: (incident, metrics) => metrics.mttr_minutes > metrics.sla_minutes,
    target_tier: 3,
    reason: 'SLA breach - Escalating to SOC Manager',
  },
];

const SLA_BY_SEVERITY: Record<number, number> = {
  5: 15,  // Critical: 15 min
  4: 30,  // High: 30 min
  3: 60,  // Medium: 1 hour
  2: 240, // Low: 4 hours
  1: 480, // Info: 8 hours
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Auth: service role or authenticated user with SOC role
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${supabaseKey}`) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: roleData } = await authClient.from('user_roles').select('role').eq('user_id', user.id).single();
      const allowedRoles = ['admin', 'soc_analyst', 'soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager', 'grc_engineer', 'ciso'];
      if (!roleData || !allowedRoles.includes(roleData.role)) {
        return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { incident_id, reason, force_tier } = await req.json() as EscalationParams;

    // Fetch incident
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

    // Calculate metrics for escalation decision
    const createdAt = new Date(incident.created_at);
    const now = new Date();
    const mttr_minutes = (now.getTime() - createdAt.getTime()) / 60000;
    const sla_minutes = SLA_BY_SEVERITY[incident.severity] || 60;

    const metrics = {
      mttr_minutes,
      sla_minutes,
      sla_breached: mttr_minutes > sla_minutes,
    };

    // Determine target tier
    let target_tier = 1;
    let escalation_reason = reason || 'Manual escalation';

    if (force_tier) {
      target_tier = force_tier;
      escalation_reason = reason || `Forced escalation to Tier ${force_tier}`;
    } else {
      // Apply escalation rules
      for (const rule of ESCALATION_RULES) {
        if (rule.condition(incident, metrics)) {
          if (rule.target_tier > target_tier) {
            target_tier = rule.target_tier;
            escalation_reason = rule.reason;
          }
        }
      }
    }

    // Get current tier from incident status or default to 1
    const current_tier = incident.assigned_to?.includes('tier3') ? 3 :
                         incident.assigned_to?.includes('tier2') ? 2 : 1;

    if (target_tier <= current_tier && !force_tier) {
      return new Response(JSON.stringify({
        success: true,
        escalated: false,
        message: 'No escalation needed',
        current_tier,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Perform escalation
    const tier_assignments: Record<number, string> = {
      1: 'tier1_soc_analyst',
      2: 'tier2_senior_analyst',
      3: 'tier3_soc_manager',
    };

    const { error: updateError } = await supabase
      .from('incidents')
      .update({
        assigned_to: tier_assignments[target_tier],
        updated_at: new Date().toISOString(),
      })
      .eq('id', incident_id);

    if (updateError) {
      console.error('Failed to update incident:', updateError);
    }

    // Add timeline entry
    await supabase.from('incident_timeline').insert({
      incident_id,
      stage: `Escalated to Tier ${target_tier}`,
      details: escalation_reason,
    });

    // Send notifications based on tier
    const SLACK_WEBHOOK_URL = Deno.env.get('SLACK_WEBHOOK_URL');
    if (SLACK_WEBHOOK_URL && target_tier >= 2) {
      const emoji = target_tier === 3 ? '🚨' : '⚠️';
      const channel = target_tier === 3 ? '#soc-critical' : '#soc-escalations';
      
      try {
        await fetch(SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `${emoji} *Incident Escalated to Tier ${target_tier}*\n\n*Incident:* ${incident.incident_number}\n*Type:* ${incident.event_type}\n*Risk:* ${incident.risk_level}\n*Reason:* ${escalation_reason}`,
            channel,
          }),
        });
        console.log('Slack notification sent for escalation');
      } catch (slackError) {
        console.error('Failed to send Slack notification:', slackError);
      }
    }

    // If Tier 3 escalation, also create high-priority Jira ticket
    if (target_tier === 3) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/create-jira-ticket`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            incident_id,
            summary: `[CRITICAL ESCALATION] ${incident.incident_number} - ${incident.event_type}`,
            priority: 'Highest',
            labels: ['SOCMind', 'Critical', 'Escalated', 'Tier3'],
          }),
        });
        console.log('Created Tier 3 Jira escalation ticket');
      } catch (jiraError) {
        console.error('Failed to create Jira ticket:', jiraError);
      }
    }

    console.log(`Escalated ${incident.incident_number} from Tier ${current_tier} to Tier ${target_tier}`);

    return new Response(JSON.stringify({
      success: true,
      escalated: true,
      from_tier: current_tier,
      to_tier: target_tier,
      reason: escalation_reason,
      sla_status: metrics.sla_breached ? 'BREACHED' : 'OK',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in escalate-incident:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
