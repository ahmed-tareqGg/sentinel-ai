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

  // Check if user has required role (any SOC role or admin)
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  const allowedRoles = ['admin', 'soc_analyst', 'soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager', 'grc_engineer', 'ciso'];
  if (!roleData || !allowedRoles.includes(roleData.role)) {
    return { user: null, error: 'Insufficient permissions. SOC role required.' };
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

// Auto-block configuration - when enabled, actions are executed automatically for Critical incidents
const AUTO_RESPONSE_CONFIG = {
  enabled: true,
  minRiskLevel: 'Critical',  // Only auto-execute for Critical+ incidents
  requireHighConfidence: true,  // Require high AI confidence
  actions: ['block_ip', 'isolate_host', 'disable_user']
};

async function findAgentForIncident(supabase: any, incident: Record<string, unknown>): Promise<string | null> {
  // Try to find the agent/data source that originated this incident
  // 1. Check raw_logs linked to this incident
  const { data: rawLog } = await supabase
    .from('raw_logs')
    .select('data_source_id')
    .eq('incident_id', incident.id)
    .not('data_source_id', 'is', null)
    .limit(1)
    .single();
  
  if (rawLog?.data_source_id) return rawLog.data_source_id;

  // 2. Check for any active agent matching the source IP
  if (incident.src_ip) {
    const { data: ds } = await supabase
      .from('data_sources')
      .select('id')
      .eq('ip_address', incident.src_ip)
      .eq('status', 'active')
      .limit(1)
      .single();
    if (ds?.id) return ds.id;
  }

  // 3. Fallback: pick the most recently active agent
  const { data: anyAgent } = await supabase
    .from('data_sources')
    .select('id')
    .eq('status', 'active')
    .order('last_heartbeat', { ascending: false })
    .limit(1)
    .single();

  return anyAgent?.id || null;
}

async function dispatchToAgent(
  supabase: any,
  dataSourceId: string,
  incident: Record<string, unknown>,
  actionType: string,
  target: string,
  reason: string,
  durationSeconds?: number,
  executionMode: string = 'real'
) {
  const actionId = `PB-${Date.now().toString(36).toUpperCase()}`;
  
  const { data, error } = await supabase
    .from('soar_actions')
    .insert({
      action_id: actionId,
      incident_id: incident.id,
      data_source_id: dataSourceId,
      action_type: actionType,
      target,
      target_type: actionType.includes('ip') ? 'ip' : actionType.includes('user') ? 'user' : 'host',
      status: 'approved',
      approved_by: 'playbook-engine',
      approved_at: new Date().toISOString(),
      execution_mode: executionMode,
      reason,
      duration_seconds: durationSeconds || null,
      dispatched_at: new Date().toISOString(),
      requires_approval: false,
    })
    .select()
    .single();

  if (error) {
    console.error(`Failed to dispatch ${actionType}:`, error);
    return null;
  }

  console.log(`⚡ Dispatched ${actionType} -> Agent ${dataSourceId} (${actionId})`);
  return data;
}

async function executeAction(
  action: PlaybookAction, 
  incident: Record<string, unknown>, 
  supabase: any,
  mode: 'live' | 'simulated' = 'live',
  agentDataSourceId: string | null = null
) {
  console.log(`Executing action: ${action.type} (mode: ${mode})`, action.params);
  
  const results: Record<string, unknown> = { 
    action: action.type, 
    status: 'completed',
    mode,
    timestamp: new Date().toISOString()
  };

  // Simulation mode - just log and return
  if (mode === 'simulated') {
    results.simulated = true;
    results.note = `Action would be executed in live mode: ${action.type}`;
    return results;
  }

  // Actions that should be dispatched to the agent for OS-level execution
  const agentActions = ['block_ip', 'unblock_ip', 'disable_user', 'enable_user', 'lock_user', 
    'lock_account', 'isolate_host', 'unisolate_host', 'kill_process', 'quarantine_file', 
    'delete_file', 'stop_service', 'start_service'];

  if (agentActions.includes(action.type) && agentDataSourceId) {
    // Extract target based on action type
    let target = '';
    let duration: number | undefined;
    
    switch (action.type) {
      case 'block_ip':
      case 'unblock_ip':
        target = (incident.src_ip || action.params?.ip) as string || '';
        duration = action.params?.duration as number;
        break;
      case 'disable_user':
      case 'enable_user':
      case 'lock_user':
      case 'lock_account':
        // Extract username from incident message or params
        target = (action.params?.user || action.params?.target || '') as string;
        if (!target) {
          // Try to extract from incident message (e.g., "Failed password for fakeuser")
          const msg = (incident.message || '') as string;
          const userMatch = msg.match(/for (?:invalid user )?(\S+)/i) 
            || msg.match(/user[= ]+(\S+)/i)
            || msg.match(/account[= ]+(\S+)/i);
          target = userMatch?.[1] || 'unknown';
        }
        duration = action.params?.duration as number || 180; // default 3 min lock
        break;
      case 'isolate_host':
      case 'unisolate_host':
        target = (incident.src_ip || action.params?.host) as string || '';
        break;
      case 'kill_process':
        target = (action.params?.process || action.params?.target) as string || '';
        break;
      default:
        target = (action.params?.target || incident.src_ip) as string || '';
    }

    const dispatched = await dispatchToAgent(
      supabase, agentDataSourceId, incident,
      action.type, target,
      `Playbook action: ${action.type} for incident ${incident.incident_number}`,
      duration
    );

    if (dispatched) {
      results.status = 'dispatched_to_agent';
      results.action_id = dispatched.action_id;
      results.target = target;
      results.agent_data_source_id = agentDataSourceId;
      results.note = `Action dispatched to agent for OS-level execution`;
      
      // Log to incident timeline
      await supabase.from('incident_timeline').insert({
        incident_id: incident.id,
        stage: `SOAR Action Dispatched: ${action.type}`,
        details: `Target: ${target} | Agent: ${agentDataSourceId} | Action ID: ${dispatched.action_id}`,
      });
    } else {
      results.status = 'dispatch_failed';
      results.note = 'Failed to dispatch to agent';
    }

    return results;
  }

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
      // Fallback: log to soar_actions when no agent available
      const ipToBlock = (incident.src_ip || action.params?.ip) as string;
      if (ipToBlock) {
        await supabase.from('soar_actions').insert({
          incident_id: incident.id,
          action_type: 'block_ip',
          target: ipToBlock,
          status: 'executed',
          execution_mode: mode,
          details: {
            blocked_at: new Date().toISOString(),
            reason: `Auto-blocked due to ${incident.classification} - ${incident.risk_level}`,
            firewall_rule: `DENY_INBOUND_${ipToBlock.replace(/\./g, '_')}`,
            note: 'No agent available - logged only',
          }
        });
        results.ip = ipToBlock;
        results.status = 'logged';
        results.note = 'No active agent found - action logged for manual execution';
      }
      break;

    case 'disable_user':
    case 'lock_user':
      const userTarget = action.params?.user as string;
      if (userTarget) {
        await supabase.from('soar_actions').insert({
          incident_id: incident.id,
          action_type: action.type,
          target: userTarget,
          status: 'executed',
          execution_mode: mode,
          details: {
            disabled_at: new Date().toISOString(),
            reason: `User disabled due to security incident`,
            note: 'No agent available - logged only',
          }
        });
        results.user = userTarget;
        results.status = 'logged';
        results.note = 'No active agent found - action logged for manual execution';
      }
      break;

    case 'isolate_host':
      const hostToIsolate = (incident.src_ip || action.params?.host) as string;
      if (hostToIsolate) {
        await supabase.from('soar_actions').insert({
          incident_id: incident.id,
          action_type: 'isolate_host',
          target: hostToIsolate,
          status: 'executed',
          execution_mode: mode,
          details: {
            isolated_at: new Date().toISOString(),
            reason: `Host isolation due to ${incident.event_type}`,
            note: 'No agent available - logged only',
          }
        });
        results.host = hostToIsolate;
        results.status = 'logged';
      }
      break;

    case 'reset_credentials':
      const resetUser = action.params?.user as string;
      await supabase.from('soar_actions').insert({
        incident_id: incident.id,
        action_type: 'reset_credentials',
        target: resetUser || 'affected_users',
        status: 'executed',
        execution_mode: mode,
        details: { reset_at: new Date().toISOString(), type: 'password_reset' }
      });
      results.user = resetUser;
      results.status = 'reset_initiated';
      break;

    case 'create_ticket':
      const ticketId = `TKT-${Date.now()}`;
      await supabase.from('soar_actions').insert({
        incident_id: incident.id,
        action_type: 'create_ticket',
        target: ticketId,
        status: 'executed',
        execution_mode: mode,
        details: { ticket_id: ticketId, created_at: new Date().toISOString(), incident_number: incident.incident_number }
      });
      results.ticket = ticketId;
      results.note = 'Ticket created';
      console.log(`🎫 Created ticket: ${ticketId}`);
      break;

    case 'escalate':
      const team = (action.params?.team || 'SOC Leadership') as string;
      await supabase.from('soar_actions').insert({
        incident_id: incident.id,
        action_type: 'escalate',
        target: team,
        status: 'executed',
        execution_mode: mode,
        details: { escalated_to: team, escalated_at: new Date().toISOString() }
      });
      results.escalated_to = team;
      console.log(`📢 Escalated to: ${team}`);
      break;

    case 'geo_block':
      const geoIp = action.params?.ip as string;
      await supabase.from('soar_actions').insert({
        incident_id: incident.id,
        action_type: 'geo_block',
        target: geoIp,
        status: 'executed',
        execution_mode: mode,
        details: { blocked_region: 'auto-detected', blocked_at: new Date().toISOString() }
      });
      results.ip = geoIp;
      results.status = 'geo_blocked';
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
          { type: 'disable_user', params: { user: '' } },  // user extracted from incident
          { type: 'block_ip', params: { ip: incident.src_ip } },
          { type: 'isolate_host', params: { host: incident.src_ip } },
          { type: 'escalate', params: { team: 'SOC Leadership' } },
          { type: 'create_ticket' },
        ];
        matchedPlaybook = { name: 'Critical Auto-Response' };
      } else if (risk_level === 'High' || classification === 'True Positive') {
        // Check if it's a brute force / auth incident
        const isBruteForce = (incident.event_type || '').toString().toLowerCase().includes('brute') ||
          (incident.message || '').toString().toLowerCase().includes('failed password') ||
          (incident.mitre_technique || '').toString().includes('T1110');

        actionsToExecute = [
          { type: 'notify_slack', params: { message: `⚠️ HIGH RISK: ${incident.message || incident.event_type}` } },
          ...(isBruteForce ? [{ type: 'disable_user', params: { user: '' } }] : []),
          { type: 'block_ip', params: { ip: incident.src_ip } },
          { type: 'create_ticket' },
          { type: 'escalate', params: { team: 'SOC Analysts' } },
        ];
        matchedPlaybook = { name: isBruteForce ? 'Brute Force Auto-Response' : 'High Risk Auto-Response' };
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

    // Find the agent to dispatch OS-level actions to
    const agentDataSourceId = await findAgentForIncident(supabase, incident);
    console.log(`🔍 Agent for incident: ${agentDataSourceId || 'none found'}`);

    // Execute each action
    const actionResults = [];
    for (const action of actionsToExecute) {
      const result = await executeAction(action, incident, supabase, 'live', agentDataSourceId);
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