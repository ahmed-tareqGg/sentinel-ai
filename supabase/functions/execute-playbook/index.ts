import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaybookAction {
  type: string;
  params?: Record<string, unknown>;
}

async function verifyAuthAndRole(req: Request, isInternal: boolean): Promise<{ user: any; error?: string }> {
  // Allow internal calls from other edge functions with service role key
  if (isInternal) {
    const authHeader = req.headers.get('Authorization');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (authHeader === `Bearer ${serviceKey}`) {
      return { user: { id: 'internal', type: 'service', email: 'system' } };
    }
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Missing authorization header' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, error: 'Invalid or expired token' };
  }

  // Check if user has required role (admin or soc_analyst)
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

async function sendSlackNotification(webhookUrl: string, message: string, incident: Record<string, unknown>) {
  try {
    const payload = {
      text: message,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚨 SOCMind Alert: ${incident.incident_number}`,
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Risk Level:*\n${incident.risk_level}`
            },
            {
              type: 'mrkdwn',
              text: `*Classification:*\n${incident.classification}`
            },
            {
              type: 'mrkdwn',
              text: `*Severity:*\n${incident.severity}/5`
            },
            {
              type: 'mrkdwn',
              text: `*Event Type:*\n${incident.event_type}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Message:*\n${incident.message || 'No message'}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Source IP:* ${incident.src_ip} → *Dest IP:* ${incident.dst_ip}`
          }
        }
      ]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch (error) {
    console.error('Slack notification failed:', error);
    return false;
  }
}

async function executeAction(action: PlaybookAction, incident: Record<string, unknown>, supabase: any) {
  console.log(`Executing action: ${action.type}`, action.params);
  
  const results: Record<string, unknown> = { action: action.type, status: 'completed' };

  switch (action.type) {
    case 'notify_slack':
      const slackWebhook = Deno.env.get('SLACK_WEBHOOK_URL');
      if (slackWebhook) {
        const message = action.params?.message as string || `Critical incident detected: ${incident.incident_number}`;
        const sent = await sendSlackNotification(slackWebhook, message, incident);
        results.slack_sent = sent;
      } else {
        results.status = 'skipped';
        results.reason = 'No Slack webhook configured';
      }
      break;

    case 'block_ip':
      results.ip = incident.src_ip || action.params?.ip;
      results.note = 'IP block request logged - integrate with firewall API for production';
      console.log(`Would block IP: ${results.ip}`);
      break;

    case 'isolate_host':
      results.host = incident.src_ip || action.params?.host;
      results.note = 'Host isolation request logged - integrate with EDR API for production';
      console.log(`Would isolate host: ${results.host}`);
      break;

    case 'disable_user':
      results.user = action.params?.user;
      results.note = 'User disable request logged - integrate with IAM API for production';
      console.log(`Would disable user: ${results.user}`);
      break;

    case 'create_ticket':
      results.ticket = `TKT-${Date.now()}`;
      results.note = 'Ticket creation simulated - integrate with ticketing system for production';
      console.log(`Would create ticket for incident: ${incident.incident_number}`);
      break;

    case 'escalate':
      results.escalated_to = action.params?.team || 'SOC Leadership';
      results.note = 'Escalation logged';
      console.log(`Escalating incident ${incident.incident_number} to ${results.escalated_to}`);
      break;

    default:
      results.status = 'unknown_action';
      console.log(`Unknown action type: ${action.type}`);
  }

  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { incident_id, risk_level, classification, playbook_id, internal } = body;

    // Verify authentication and authorization
    const { user, error: authError } = await verifyAuthAndRole(req, internal === true);
    if (authError) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: authError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`${user.type === 'service' ? 'Internal call' : `User ${user.id}`} executing playbook`);

    // Use service role for privileged operations after auth check
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Executing playbook for incident ${incident_id}, risk: ${risk_level}, classification: ${classification}`);

    // Get the incident
    const { data: incident, error: incidentError } = await supabase
      .from('incidents')
      .select('*')
      .eq('id', incident_id)
      .single();

    if (incidentError || !incident) {
      throw new Error(`Incident not found: ${incident_id}`);
    }

    // Find matching playbooks
    let playbooksQuery = supabase
      .from('playbooks')
      .select('*')
      .eq('is_active', true);

    if (playbook_id) {
      playbooksQuery = playbooksQuery.eq('id', playbook_id);
    }

    const { data: playbooks, error: playbooksError } = await playbooksQuery;

    if (playbooksError) {
      throw new Error(`Failed to fetch playbooks: ${playbooksError.message}`);
    }

    // If no playbooks exist, use default actions based on risk level
    let actionsToExecute: PlaybookAction[] = [];
    let matchedPlaybook = null;
    let bestMatchScore = 0;

    if (playbooks && playbooks.length > 0) {
      // Find best matching playbook based on conditions with scoring
      for (const playbook of playbooks) {
        const conditions = playbook.conditions || {};
        let matchScore = 0;
        let isDisqualified = false;

        // Check each condition - build a score for partial matches
        if (conditions.risk_level) {
          if (conditions.risk_level === risk_level) {
            matchScore += 3;
          } else if (conditions.risk_level === 'Critical' && risk_level === 'High') {
            // High can match Critical playbooks with lower score
            matchScore += 1;
          } else if (conditions.risk_level === 'High' && risk_level === 'Critical') {
            matchScore += 2;
          }
        }

        if (conditions.classification) {
          if (conditions.classification === classification) {
            matchScore += 3;
          }
        }

        if (conditions.min_severity) {
          if (incident.severity >= conditions.min_severity) {
            matchScore += 2;
          }
          // Don't disqualify based on severity alone - it's a soft match
        }

        if (conditions.event_type) {
          const eventTypeCondition = conditions.event_type.toLowerCase();
          const incidentEventType = incident.event_type.toLowerCase();
          
          if (incidentEventType.includes(eventTypeCondition) || eventTypeCondition.includes(incidentEventType)) {
            matchScore += 4;
          } else {
            // Check for related event types
            const relatedTypes: Record<string, string[]> = {
              'network_activity': ['lateral', 'movement', 'network', 'remote', 'connection'],
              'malware': ['malicious', 'virus', 'trojan', 'ransomware'],
              'authentication': ['login', 'brute', 'password', 'credential'],
              'exfiltration': ['data', 'transfer', 'upload', 'leak'],
            };
            
            const relatedTerms = relatedTypes[incidentEventType] || [];
            if (relatedTerms.some(term => eventTypeCondition.includes(term))) {
              matchScore += 2;
            }
          }
        }

        console.log(`Playbook ${playbook.name} score: ${matchScore}`);

        if (!isDisqualified && matchScore > bestMatchScore) {
          bestMatchScore = matchScore;
          matchedPlaybook = playbook;
          actionsToExecute = playbook.actions || [];
        }
      }
    }

    // If no playbook matched well enough (score < 3), use intelligent default actions
    if (bestMatchScore < 3 || actionsToExecute.length === 0) {
      console.log(`No well-matching playbook found (best score: ${bestMatchScore}), using intelligent defaults`);
      
      if (risk_level === 'Critical') {
        actionsToExecute = [
          { type: 'notify_slack', params: { message: `🚨 CRITICAL: ${incident.message}` } },
          { type: 'block_ip', params: { ip: incident.src_ip } },
          { type: 'isolate_host', params: { host: incident.src_ip } },
          { type: 'escalate', params: { team: 'SOC Leadership' } },
          { type: 'create_ticket' },
        ];
        matchedPlaybook = { name: 'Critical Auto-Response' };
      } else if (risk_level === 'High' || classification === 'True Positive') {
        actionsToExecute = [
          { type: 'notify_slack', params: { message: `⚠️ HIGH RISK: ${incident.message || incident.event_type}` } },
          { type: 'block_ip', params: { ip: incident.src_ip } },
          { type: 'create_ticket' },
          { type: 'escalate', params: { team: 'SOC Analysts' } },
        ];
        matchedPlaybook = { name: 'High Risk Auto-Response' };
      } else if (risk_level === 'Medium') {
        actionsToExecute = [
          { type: 'create_ticket' },
          { type: 'notify_slack', params: { message: `📋 MEDIUM: ${incident.message || incident.event_type}` } },
        ];
        matchedPlaybook = { name: 'Medium Risk Auto-Response' };
      } else {
        // Low risk - just create ticket
        actionsToExecute = [
          { type: 'create_ticket' },
        ];
        matchedPlaybook = { name: 'Low Risk Auto-Response' };
      }
    }

    if (actionsToExecute.length === 0) {
      console.log('No matching playbook or actions to execute');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No matching playbook found',
        executed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create playbook execution record
    const { data: execution, error: execError } = await supabase
      .from('playbook_executions')
      .insert({
        playbook_id: matchedPlaybook?.id || null,
        incident_id: incident.id,
        status: 'running',
      })
      .select()
      .single();

    // Execute each action
    const actionResults = [];
    for (const action of actionsToExecute) {
      const result = await executeAction(action, incident, supabase);
      actionResults.push(result);
    }

    // Update execution record
    if (execution) {
      await supabase
        .from('playbook_executions')
        .update({
          status: 'completed',
          results: { actions: actionResults },
          completed_at: new Date().toISOString(),
        })
        .eq('id', execution.id);
    }

    // Add timeline entry
    await supabase.from('incident_timeline').insert({
      incident_id: incident.id,
      stage: 'Playbook Executed',
      details: `Executed ${actionsToExecute.length} actions: ${actionsToExecute.map(a => a.type).join(', ')} (by user ${user.email || user.id})`,
    });

    console.log('Playbook execution complete');

    return new Response(JSON.stringify({ 
      success: true, 
      playbook: matchedPlaybook?.name || 'Default',
      executed: actionsToExecute.length,
      results: actionResults 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in execute-playbook function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});