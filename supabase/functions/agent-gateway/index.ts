import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key',
};

interface AgentRegistration {
  hostname: string;
  os_type: 'linux' | 'windows' | 'macos';
  os_version: string;
  agent_version: string;
  ip_address: string;
  log_types: string[];
  source_type?: string;
  vendor?: string;
}

interface AgentHeartbeat {
  hostname: string;
  status: 'active' | 'error' | 'paused';
  logs_sent?: number;
  error_message?: string;
  ip_address?: string;
  os?: string;
  log_types?: string[];
  agent_id?: string;
}

interface AgentControl {
  agent_id: string;
  action: 'start' | 'pause' | 'stop' | 'resume' | 'terminate';
}

interface NormalizedLog {
  log_type: string;
  timestamp: string;
  message: string;
  severity: number;
  source_ip?: string;
  destination_ip?: string;
  user?: string;
  process?: string;
  event_id?: string;
  file_hash?: string;
  raw_log: any;
  source_type?: string;
  vendor?: string;
}

interface LogBatch {
  logs: NormalizedLog[];
  batch_id?: string;
  source_type?: string;
  vendor?: string;
}

interface CorrelationRule {
  id: string;
  name: string;
  match_field: string;
  match_operator: string;
  match_value: string | null;
  event_type_filter: string[] | null;
  threshold_count: number;
  time_window_minutes: number;
  severity_override: number | null;
  incident_title_template: string | null;
  is_active: boolean;
}

// Agent command queue
const agentCommands = new Map<string, string>();

// Simulation mode data
const SIMULATED_LOGS = {
  auth: [
    { event_type: 'Failed SSH Login', severity: 4, message: 'Failed password for root from 192.168.1.100', user: 'root' },
    { event_type: 'Successful Login', severity: 2, message: 'Accepted password for admin from 10.0.0.5', user: 'admin' },
    { event_type: 'Brute Force Attempt', severity: 5, message: 'Multiple failed login attempts detected from 45.33.32.156', user: 'various' },
  ],
  system: [
    { event_type: 'Service Restart', severity: 2, message: 'systemd restarted nginx.service' },
    { event_type: 'Disk Space Warning', severity: 3, message: 'Disk /dev/sda1 is 85% full' },
    { event_type: 'Kernel Panic', severity: 5, message: 'Kernel panic - not syncing: Fatal exception' },
  ],
  security: [
    { event_type: 'Firewall Block', severity: 3, message: 'Blocked incoming connection from 185.143.172.1:4444' },
    { event_type: 'Malware Detection', severity: 5, message: 'Suspicious file detected: /tmp/payload.exe', file_hash: 'a1b2c3d4e5f6' },
    { event_type: 'Privilege Escalation', severity: 5, message: 'sudo: user attempted to run command as root' },
  ],
  firewall: [
    { event_type: 'Connection Blocked', severity: 3, message: 'Blocked inbound connection from 185.143.172.1:4444 to 10.0.0.5:22' },
    { event_type: 'Port Scan Detected', severity: 4, message: 'Port scan detected from 45.33.32.156 targeting ports 1-1024' },
    { event_type: 'Policy Violation', severity: 4, message: 'Traffic from 192.168.1.50 blocked by policy DENY-EXTERNAL' },
  ],
  edr: [
    { event_type: 'Malware Detected', severity: 5, message: 'Malicious executable detected: mimikatz.exe', file_hash: 'e6b8c9d4f5a6' },
    { event_type: 'Suspicious Process', severity: 4, message: 'PowerShell executed with encoded command from user ADMIN' },
    { event_type: 'Lateral Movement', severity: 5, message: 'PsExec detected moving laterally to 10.0.0.25' },
  ],
  ndr: [
    { event_type: 'Anomalous Traffic', severity: 4, message: 'Unusual data exfiltration pattern detected to 45.33.32.156' },
    { event_type: 'C2 Communication', severity: 5, message: 'Potential C2 beacon detected to known malicious IP' },
    { event_type: 'DNS Tunneling', severity: 4, message: 'Suspicious DNS query pattern suggesting tunneling' },
  ],
  cloud: [
    { event_type: 'IAM Policy Change', severity: 3, message: 'IAM policy AdminAccess attached to user developer' },
    { event_type: 'S3 Bucket Public', severity: 5, message: 'S3 bucket customer-data made public' },
    { event_type: 'Root Login', severity: 4, message: 'Root account login detected from unusual location' },
  ],
};

async function verifyAgentKey(req: Request, supabase: any): Promise<{ valid: boolean; dataSourceId?: string; dataSourceName?: string; error?: string }> {
  const agentKey = req.headers.get('x-agent-key');

  if (!agentKey) {
    return { valid: false, error: 'Missing X-Agent-Key header' };
  }

  const { data, error } = await supabase.rpc('verify_agent_api_key', { _api_key: agentKey });

  if (error) {
    console.error('Key verification error:', error);
    return { valid: false, error: 'Key verification failed' };
  }

  if (!data || data.length === 0 || !data[0].is_valid) {
    return { valid: false, error: 'Invalid or expired API key' };
  }

  return {
    valid: true,
    dataSourceId: data[0].data_source_id,
    dataSourceName: data[0].data_source_name
  };
}

async function verifyUserAuth(req: Request): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return { valid: false, error: 'Missing authorization' };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { valid: false, error: 'Invalid token' };
  }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  const allowedRoles = ['admin', 'ciso', 'soc_manager', 'soc_tier_3'];
  if (!roleData || !allowedRoles.includes(roleData.role)) {
    return { valid: false, error: 'Insufficient permissions' };
  }

  return { valid: true, userId: user.id };
}

// Extract field value from log for correlation matching
function extractFieldValue(log: any, field: string): string | null {
  const fieldMap: Record<string, string[]> = {
    'src_ip': ['source_ip', 'srcIP', 'src_ip', 'host_ip', 'ip_address'],
    'dst_ip': ['destination_ip', 'dstIP', 'dst_ip'],
    'hostname': ['hostname', 'host', 'computer_name'],
    'event_type': ['eventType', 'event_type', 'log_type', 'type'],
    'user': ['user', 'username', 'account_name', 'user_name'],
    'mitre_technique': ['mitre_technique', 'technique_id', 'mitre_id'],
  };

  const possibleFields = fieldMap[field] || [field];
  
  for (const f of possibleFields) {
    if (log[f] !== undefined && log[f] !== null) {
      return String(log[f]);
    }
  }
  return null;
}

// Check if a log matches a correlation rule's conditions
function matchesRule(log: any, rule: CorrelationRule): { matches: boolean; matchKey: string | null } {
  // Check event type filter first
  if (rule.event_type_filter && rule.event_type_filter.length > 0) {
    const logEventType = extractFieldValue(log, 'event_type')?.toLowerCase() || '';
    const matchesEventType = rule.event_type_filter.some(
      (et) => logEventType.includes(et.toLowerCase().replace('_', ' ')) || 
              logEventType.includes(et.toLowerCase())
    );
    if (!matchesEventType) {
      return { matches: false, matchKey: null };
    }
  }

  // Get the field value to match
  const fieldValue = extractFieldValue(log, rule.match_field);
  
  if (fieldValue === null && rule.match_operator !== 'any') {
    return { matches: false, matchKey: null };
  }

  let matches = false;
  
  switch (rule.match_operator) {
    case 'any':
      matches = true;
      break;
    case 'equals':
      matches = fieldValue === rule.match_value;
      break;
    case 'contains':
      matches = fieldValue?.includes(rule.match_value || '') || false;
      break;
    case 'starts_with':
      matches = fieldValue?.startsWith(rule.match_value || '') || false;
      break;
    case 'regex':
      try {
        const regex = new RegExp(rule.match_value || '');
        matches = regex.test(fieldValue || '');
      } catch {
        matches = false;
      }
      break;
    default:
      matches = false;
  }

  // The match key is used to group events (e.g., same src_ip)
  const matchKey = fieldValue || 'any';

  return { matches, matchKey };
}

// Generate incident title from template
function generateIncidentTitle(template: string | null, log: any, rule: CorrelationRule, matchCount: number): string {
  if (!template) {
    return `[Correlation] ${rule.name}: ${matchCount} events detected`;
  }

  let title = template;
  
  // Replace {{field}} placeholders with actual values
  const fieldPattern = /\{\{(\w+)\}\}/g;
  title = title.replace(fieldPattern, (_, field) => {
    return extractFieldValue(log, field) || 'N/A';
  });
  
  // Add count if not in template
  if (!title.includes(String(matchCount))) {
    title = `${title} (${matchCount} events)`;
  }

  return title;
}

// Check correlation rules and create incidents if thresholds are met
async function checkCorrelationRules(
  supabase: any,
  logs: any[],
  dataSourceId: string,
  dataSourceName: string
): Promise<{ incidentsCreated: any[]; rulesTriggered: string[] }> {
  const incidentsCreated: any[] = [];
  const rulesTriggered: string[] = [];

  // Fetch active correlation rules
  const { data: rules, error: rulesError } = await supabase
    .from('correlation_rules')
    .select('*')
    .eq('is_active', true);

  if (rulesError || !rules || rules.length === 0) {
    console.log('📊 No active correlation rules found');
    return { incidentsCreated, rulesTriggered };
  }

  console.log(`📊 Checking ${logs.length} logs against ${rules.length} correlation rules`);

  for (const rule of rules as CorrelationRule[]) {
    const matchKeyGroups = new Map<string, any[]>();

    // Group matching logs by their match key
    for (const log of logs) {
      const { matches, matchKey } = matchesRule(log, rule);
      if (matches && matchKey) {
        if (!matchKeyGroups.has(matchKey)) {
          matchKeyGroups.set(matchKey, []);
        }
        matchKeyGroups.get(matchKey)!.push(log);
      }
    }

    // For each group, check historical counts within time window
    for (const [matchKey, matchingLogs] of matchKeyGroups) {
      const windowStart = new Date(Date.now() - rule.time_window_minutes * 60 * 1000).toISOString();

      // Check for existing matches in the time window
      const { data: existingMatches, error: matchError } = await supabase
        .from('correlation_rule_matches')
        .select('id, match_count, matched_logs')
        .eq('rule_id', rule.id)
        .eq('match_key', matchKey)
        .gte('triggered_at', windowStart)
        .order('triggered_at', { ascending: false })
        .limit(1);

      if (matchError) {
        console.error(`Correlation match check failed for rule ${rule.name}:`, matchError);
        continue;
      }

      // Calculate total count (existing + new)
      const existingCount = existingMatches?.[0]?.match_count || 0;
      const newCount = matchingLogs.length;
      const totalCount = existingCount + newCount;

      console.log(`📊 Rule "${rule.name}" [${matchKey}]: ${existingCount} existing + ${newCount} new = ${totalCount} (threshold: ${rule.threshold_count})`);

      // Store the match
      const matchedLogIds = matchingLogs.map(l => l.raw_log_id || l.ingest_id).filter(Boolean);
      
      if (existingMatches && existingMatches.length > 0) {
        // Update existing match record
        const existingLogIds = existingMatches[0].matched_logs || [];
        await supabase
          .from('correlation_rule_matches')
          .update({
            match_count: totalCount,
            matched_logs: [...existingLogIds, ...matchedLogIds].slice(-100), // Keep last 100
          })
          .eq('id', existingMatches[0].id);
      } else if (newCount > 0) {
        // Create new match record
        await supabase
          .from('correlation_rule_matches')
          .insert({
            rule_id: rule.id,
            match_key: matchKey,
            match_count: newCount,
            matched_logs: matchedLogIds,
          });
      }

      // Check if threshold is met
      if (totalCount >= rule.threshold_count) {
        console.log(`🚨 Correlation rule "${rule.name}" triggered! Creating incident...`);

        // Generate incident number
        const { data: maxIncident } = await supabase
          .from('incidents')
          .select('incident_number')
          .order('created_at', { ascending: false })
          .limit(1);
        
        const lastNum = maxIncident?.[0]?.incident_number 
          ? parseInt(maxIncident[0].incident_number.replace('INC-', '')) 
          : 0;
        const incidentNumber = `INC-${String(lastNum + 1).padStart(4, '0')}`;

        // Use the most recent matching log as reference
        const refLog = matchingLogs[matchingLogs.length - 1];
        const incidentTitle = generateIncidentTitle(
          rule.incident_title_template,
          refLog,
          rule,
          totalCount
        );

        // Create the incident
        const { data: incident, error: incidentError } = await supabase
          .from('incidents')
          .insert({
            incident_number: incidentNumber,
            event_type: `correlation_${rule.match_field}`,
            severity: rule.severity_override || 4,
            status: 'open',
            src_ip: extractFieldValue(refLog, 'src_ip'),
            dst_ip: extractFieldValue(refLog, 'dst_ip'),
            message: incidentTitle,
            classification: 'Pending',
            confidence: 85,
            risk_level: rule.severity_override && rule.severity_override >= 4 ? 'High' : 'Medium',
            mitre_tactic: 'Collection',
            mitre_technique: 'Automated Collection',
            recommended_actions: [
              `Review ${totalCount} correlated events from ${matchKey}`,
              `Check rule: ${rule.name}`,
              `Time window: last ${rule.time_window_minutes} minutes`,
            ],
            ai_analysis: {
              correlation_rule: rule.name,
              match_field: rule.match_field,
              match_key: matchKey,
              event_count: totalCount,
              time_window_minutes: rule.time_window_minutes,
              source: dataSourceName,
            },
          })
          .select()
          .single();

        if (incidentError) {
          console.error(`Failed to create correlation incident:`, incidentError);
          continue;
        }

        // Update the match record with incident ID
        await supabase
          .from('correlation_rule_matches')
          .update({ incident_id: incident.id })
          .eq('rule_id', rule.id)
          .eq('match_key', matchKey)
          .is('incident_id', null);

        // Update rule stats
        await supabase
          .from('correlation_rules')
          .update({
            hits_count: (rule as any).hits_count ? (rule as any).hits_count + 1 : 1,
            last_triggered_at: new Date().toISOString(),
          })
          .eq('id', rule.id);

        incidentsCreated.push(incident);
        rulesTriggered.push(rule.name);

        console.log(`✅ Created correlation incident: ${incidentNumber} for rule "${rule.name}"`);
      }
    }
  }

  return { incidentsCreated, rulesTriggered };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const action = url.pathname.split('/').pop();

  try {
    // License validation endpoint
    if (action === 'validate-license') {
      const keyCheck = await verifyAgentKey(req, supabase);
      if (!keyCheck.valid) {
        return new Response(JSON.stringify({
          is_valid: false,
          error_message: keyCheck.error || 'Invalid agent key'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await req.json();
      const payload = body.payload;
      
      let licenseData;
      try {
        if (typeof payload === 'string') {
          const decoded = atob(payload);
          licenseData = JSON.parse(decoded);
        } else {
          licenseData = body;
        }
      } catch {
        licenseData = body;
      }

      const licenseKey = licenseData.license_key || body.license_key;
      const hardwareId = licenseData.hardware_id || body.hardware_id;
      
      if (!licenseKey) {
        return new Response(JSON.stringify({ 
          is_valid: false, 
          error_message: 'Missing license key' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: licenseResult, error: licenseError } = await supabase.rpc('validate_agent_license', {
        _license_key: licenseKey,
        _hardware_id: hardwareId || null,
      });

      if (licenseError) {
        console.error('License validation error:', licenseError);
        return new Response(JSON.stringify({ 
          is_valid: false, 
          error_message: 'License validation failed' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = licenseResult?.[0] || {};
      
      console.log(`🔑 License validation: ${licenseKey.slice(0, 9)}... - ${result.is_valid ? 'VALID' : 'INVALID'}`);

      return new Response(JSON.stringify({
        is_valid: result.is_valid || false,
        license_type: result.license_type,
        organization_name: result.organization_name,
        expires_at: result.expires_at,
        days_remaining: result.days_remaining,
        max_agents: result.max_agents,
        active_agents: result.active_agents,
        error_message: result.error_message,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Actions that require user authentication
    if (['register', 'generate-key', 'list', 'delete', 'simulate', 'control'].includes(action || '')) {
      const auth = await verifyUserAuth(req);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'register') {
        const body = await req.json() as AgentRegistration;

        let agentType = body.os_type === 'windows' ? 'windows_agent' : 'linux_agent';
        if (body.source_type) {
          switch (body.source_type.toLowerCase()) {
            case 'firewall': agentType = 'firewall'; break;
            case 'edr': agentType = 'edr'; break;
            case 'ndr': agentType = 'ndr'; break;
            case 'cloud': agentType = 'cloud'; break;
            case 'syslog': agentType = 'syslog'; break;
          }
        }

        const { data: dataSource, error } = await supabase
          .from('data_sources')
          .insert({
            name: body.hostname,
            type: agentType,
            hostname: body.hostname,
            ip_address: body.ip_address,
            os_type: body.os_type,
            os_version: body.os_version,
            agent_version: body.agent_version,
            log_types: body.log_types,
            status: 'pending',
            created_by: auth.userId,
            config: body.vendor ? { vendor: body.vendor } : {},
          })
          .select()
          .single();

        if (error) throw error;

        const { data: keyData, error: keyError } = await supabase.rpc('generate_agent_api_key', {
          _data_source_id: dataSource.id,
          _name: `Initial key for ${body.hostname}`,
          _expires_days: 365,
        });

        if (keyError) throw keyError;

        console.log(`✅ Registered new agent: ${body.hostname} (${agentType})`);

        return new Response(JSON.stringify({
          success: true,
          data_source_id: dataSource.id,
          api_key: keyData[0].api_key,
          key_id: keyData[0].key_id,
          message: 'Agent registered successfully.',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'generate-key') {
        const { data_source_id, name, expires_days } = await req.json();

        const { data: keyData, error } = await supabase.rpc('generate_agent_api_key', {
          _data_source_id: data_source_id,
          _name: name || 'New API Key',
          _expires_days: expires_days || 365,
        });

        if (error) throw error;

        return new Response(JSON.stringify({
          success: true,
          api_key: keyData[0].api_key,
          key_id: keyData[0].key_id,
          message: 'API key generated.',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'list') {
        const { data: sources, error } = await supabase
          .from('data_sources')
          .select('*, agent_api_keys(id, key_prefix, name, last_used, is_active, expires_at)')
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ data_sources: sources }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'delete') {
        const { data_source_id } = await req.json();

        const { error } = await supabase
          .from('data_sources')
          .delete()
          .eq('id', data_source_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'control') {
        const body = await req.json() as AgentControl;
        
        agentCommands.set(body.agent_id, body.action);
        
        let newStatus = 'active';
        switch (body.action) {
          case 'pause': newStatus = 'paused'; break;
          case 'stop': 
          case 'terminate': newStatus = 'inactive'; break;
          case 'start':
          case 'resume': newStatus = 'active'; break;
        }

        const { error: updateError } = await supabase
          .from('data_sources')
          .update({ 
            status: newStatus,
            config: { 
              last_command: body.action, 
              command_time: new Date().toISOString() 
            }
          })
          .eq('id', body.agent_id);

        if (updateError) throw updateError;

        console.log(`🎮 Agent control: ${body.action} for ${body.agent_id}`);

        return new Response(JSON.stringify({
          success: true,
          message: `Command ${body.action} sent to agent`,
          status: newStatus,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'simulate') {
        const { data_source_id, log_type, count = 5 } = await req.json();

        const { data: dataSource, error: dsError } = await supabase
          .from('data_sources')
          .select('*')
          .eq('id', data_source_id)
          .single();

        if (dsError || !dataSource) {
          throw new Error('Data source not found');
        }

        const logPool = SIMULATED_LOGS[log_type as keyof typeof SIMULATED_LOGS] || SIMULATED_LOGS.security;
        const simulatedLogs: any[] = [];
        const rawLogsToInsert: any[] = [];

        for (let i = 0; i < Math.min(count, 10); i++) {
          const baseLog = logPool[Math.floor(Math.random() * logPool.length)];
          const timestamp = new Date().toISOString();
          const srcIP = dataSource.ip_address || '10.0.0.' + Math.floor(Math.random() * 255);

          simulatedLogs.push({
            eventType: baseLog.event_type,
            severity: baseLog.severity,
            srcIP: srcIP,
            dstIP: '192.168.1.' + Math.floor(Math.random() * 255),
            msg: baseLog.message,
            fileHash: 'file_hash' in baseLog ? baseLog.file_hash : undefined,
            time: timestamp,
          });

          rawLogsToInsert.push({
            data_source_id: data_source_id,
            timestamp: timestamp,
            log_type: log_type,
            severity: baseLog.severity >= 4 ? 'high' : baseLog.severity >= 3 ? 'medium' : 'low',
            hostname: dataSource.hostname,
            ip_address: srcIP,
            raw_payload: { ...baseLog, timestamp },
            parsed_message: baseLog.message,
            processing_status: 'pending',
          });
        }

        // Insert raw logs
        if (rawLogsToInsert.length > 0) {
          const { data: insertedLogs, error: rawError } = await supabase
            .from('raw_logs')
            .insert(rawLogsToInsert)
            .select('id');

          if (rawError) {
            console.error('Failed to insert raw logs:', rawError);
          } else {
            console.log(`📝 Stored ${insertedLogs?.length || 0} raw logs`);
          }
        }

        // Check correlation rules for simulated logs
        const { incidentsCreated: correlationIncidents, rulesTriggered } = await checkCorrelationRules(
          supabase,
          simulatedLogs.map((l, i) => ({ ...l, raw_log_id: rawLogsToInsert[i]?.id })),
          data_source_id,
          dataSource.name
        );

        // Send to ingest-log for AI analysis
        const ingestResponse = await fetch(`${supabaseUrl}/functions/v1/ingest-log`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            logs: simulatedLogs,
            source: `Simulation: ${dataSource.name}`,
          }),
        });

        if (!ingestResponse.ok) {
          throw new Error('Failed to ingest simulated logs');
        }

        const ingestResult = await ingestResponse.json();

        // Update data source stats
        await supabase
          .from('data_sources')
          .update({
            last_log_received: new Date().toISOString(),
            logs_received_today: (dataSource.logs_received_today || 0) + simulatedLogs.length,
            logs_received_total: (dataSource.logs_received_total || 0) + simulatedLogs.length,
            status: 'active',
          })
          .eq('id', data_source_id);

        console.log(`🎭 Simulated ${simulatedLogs.length} ${log_type} logs for ${dataSource.name}`);

        return new Response(JSON.stringify({
          success: true,
          logs_sent: simulatedLogs.length,
          incidents: [...(ingestResult.incidents || []), ...correlationIncidents],
          correlation_rules_triggered: rulesTriggered,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ==================== ACTION DISPATCH (User Auth) ====================
    if (action === 'dispatch-action') {
      const auth = await verifyUserAuth(req);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await req.json();
      const {
        incident_id, data_source_id, action_type, target, target_type,
        duration_seconds, parameters, reason, requires_approval, execution_mode
      } = body;

      if (!action_type || !data_source_id) {
        return new Response(JSON.stringify({ error: 'action_type and data_source_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // High-risk actions require approval
      const highRiskActions = ['block_ip', 'disable_user', 'isolate_host', 'kill_process', 'quarantine_file', 'delete_file'];
      const needsApproval = requires_approval ?? highRiskActions.includes(action_type);
      const initialStatus = needsApproval ? 'pending' : 'approved';

      const actionId = `ACT-${Date.now().toString(36).toUpperCase()}`;

      const { data: soarAction, error: insertErr } = await supabase
        .from('soar_actions')
        .insert({
          action_id: actionId,
          incident_id,
          data_source_id,
          action_type,
          target,
          target_type: target_type || 'ip',
          duration_seconds,
          parameters: parameters || {},
          reason,
          requires_approval: needsApproval,
          status: initialStatus,
          requested_by: auth.userId,
          execution_mode: execution_mode || 'real',
          dispatched_at: !needsApproval ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Log to incident timeline
      if (incident_id) {
        await supabase.from('incident_timeline').insert({
          incident_id,
          stage: `SOAR Action ${needsApproval ? 'Pending Approval' : 'Dispatched'}: ${action_type}`,
          details: `Target: ${target || 'N/A'} | Mode: ${execution_mode || 'real'} | Action ID: ${actionId}`,
        });
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: auth.userId,
        action: 'dispatch_soar_action',
        resource_type: 'soar_action',
        resource_id: soarAction.id,
        details: { action_type, target, execution_mode, requires_approval: needsApproval },
      });

      console.log(`⚡ SOAR Action dispatched: ${actionId} (${action_type}) -> Agent ${data_source_id}`);

      return new Response(JSON.stringify({
        success: true,
        action: soarAction,
        message: needsApproval 
          ? `Action ${actionId} requires approval before execution` 
          : `Action ${actionId} dispatched to agent`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== APPROVE ACTION (User Auth) ====================
    if (action === 'approve-action') {
      const auth = await verifyUserAuth(req);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { action_id, approved } = await req.json();

      const newStatus = approved ? 'approved' : 'rejected';
      const { data, error } = await supabase
        .from('soar_actions')
        .update({
          status: newStatus,
          approved_by: auth.userId,
          approved_at: new Date().toISOString(),
          dispatched_at: approved ? new Date().toISOString() : null,
        })
        .eq('id', action_id)
        .eq('status', 'pending')
        .select()
        .single();

      if (error) throw error;

      if (data?.incident_id) {
        await supabase.from('incident_timeline').insert({
          incident_id: data.incident_id,
          stage: `SOAR Action ${approved ? 'Approved' : 'Rejected'}: ${data.action_type}`,
          details: `Action ID: ${data.action_id} | Target: ${data.target || 'N/A'}`,
        });
      }

      console.log(`${approved ? '✅' : '❌'} SOAR Action ${data.action_id} ${newStatus}`);

      return new Response(JSON.stringify({ success: true, action: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== ROLLBACK ACTION (User Auth) ====================
    if (action === 'rollback-action') {
      const auth = await verifyUserAuth(req);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { action_id } = await req.json();

      // Create a rollback action
      const { data: original } = await supabase
        .from('soar_actions')
        .select('*')
        .eq('id', action_id)
        .single();

      if (!original || !original.rollback_available) {
        return new Response(JSON.stringify({ error: 'Rollback not available' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Map action to rollback
      const rollbackMap: Record<string, string> = {
        'block_ip': 'unblock_ip',
        'disable_user': 'enable_user',
        'lock_account': 'unlock_account',
        'stop_service': 'start_service',
        'isolate_host': 'unisolate_host',
      };

      const rollbackType = rollbackMap[original.action_type] || `rollback_${original.action_type}`;

      const { data: rollbackAction, error: rbErr } = await supabase
        .from('soar_actions')
        .insert({
          action_id: `RB-${Date.now().toString(36).toUpperCase()}`,
          incident_id: original.incident_id,
          data_source_id: original.data_source_id,
          action_type: rollbackType,
          target: original.target,
          target_type: original.target_type,
          parameters: { original_action_id: original.id },
          reason: `Rollback of ${original.action_id}`,
          status: 'approved',
          requested_by: auth.userId,
          execution_mode: original.execution_mode,
          dispatched_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (rbErr) throw rbErr;

      // Mark original as rolled back
      await supabase.from('soar_actions')
        .update({ status: 'rolled_back', rolled_back_at: new Date().toISOString() })
        .eq('id', action_id);

      console.log(`🔄 Rollback dispatched for ${original.action_id}`);

      return new Response(JSON.stringify({ success: true, rollback: rollbackAction }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Actions that require agent key authentication
    if (['heartbeat', 'ingest', 'poll-actions', 'report-action'].includes(action || '')) {
      const auth = await verifyAgentKey(req, supabase);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'heartbeat') {
        const body = await req.json() as any;

        const rawStatus = (body.status || 'active').toString().toLowerCase();
        const normalizedStatus = rawStatus === 'online' ? 'active' : rawStatus;

        const cfIP = req.headers.get('cf-connecting-ip');
        const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
        const xRealIP = req.headers.get('x-real-ip');
        const agentReportedIp = body.ip_address || body.ip || body.host_ip;
        const publicIP = cfIP || xRealIP || forwardedFor || agentReportedIp || 'Unknown';

        const { data: dsRow } = await supabase
          .from('data_sources')
          .select('config')
          .eq('id', auth.dataSourceId)
          .single();

        const pendingCommand = dsRow?.config?.last_command || agentCommands.get(auth.dataSourceId!);
        if (pendingCommand) {
          agentCommands.delete(auth.dataSourceId!);
        }

        const nextConfig = {
          ...(dsRow?.config ?? {}),
          last_command: null,
          ...(body.error_message ? { last_error: body.error_message } : {}),
        };

        await supabase
          .from('data_sources')
          .update({
            status: normalizedStatus || 'active',
            last_heartbeat: new Date().toISOString(),
            ip_address: publicIP,
            hostname: body.hostname || auth.dataSourceName,
            os_type: body.os || body.os_type || undefined,
            log_types: body.log_types || undefined,
            config: nextConfig,
          })
          .eq('id', auth.dataSourceId);

        console.log(`💓 Heartbeat from ${auth.dataSourceName}: ${body.status} (IP: ${publicIP})`);

        return new Response(JSON.stringify({
          success: true,
          message: 'Heartbeat recorded',
          command: pendingCommand || null,
          public_ip: publicIP,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

    // ==================== POLL ACTIONS (Agent Auth) ====================
      if (action === 'poll-actions') {
        // Agent polls for actions to execute
        // CRITICAL: Only return actions that have been MANUALLY approved by a human
        const { data: pendingActions, error: pollErr } = await supabase
          .from('soar_actions')
          .select('*')
          .eq('data_source_id', auth.dataSourceId)
          .eq('status', 'approved')
          .order('created_at', { ascending: true })
          .limit(10);

        if (pollErr) throw pollErr;

        // SECURITY: High-risk actions MUST have approved_by set (human approved)
        // This prevents auto-created actions from being executed without oversight
        const highRiskActions = ['block_ip', 'disable_user', 'isolate_host', 'kill_process', 
          'quarantine_file', 'delete_file', 'lock_account', 'reset_password', 'stop_service'];
        
        const safeActions = (pendingActions || []).filter((a: any) => {
          if (highRiskActions.includes(a.action_type)) {
            if (!a.approved_by) {
              console.log(`🚫 Blocked auto-execution of ${a.action_type} (${a.action_id}) - requires manual approval`);
              return false;
            }
          }
          return true;
        });

        // Mark approved actions as dispatched (so they aren't polled again)
        if (safeActions.length > 0) {
          const ids = safeActions.map((a: any) => a.id);
          await supabase
            .from('soar_actions')
            .update({ status: 'dispatched', dispatched_at: new Date().toISOString() })
            .in('id', ids);
        }

        // Log blocked actions count
        const blockedCount = (pendingActions?.length || 0) - safeActions.length;
        if (blockedCount > 0) {
          console.log(`⚠️ ${blockedCount} high-risk action(s) blocked - awaiting manual approval`);
        }

        console.log(`📋 Agent ${auth.dataSourceName} polled: ${safeActions.length} safe actions (${blockedCount} blocked)`);

        return new Response(JSON.stringify({
          actions: safeActions.map((a: any) => ({
            id: a.id,
            action_id: a.action_id,
            action_type: a.action_type,
            target: a.target,
            target_type: a.target_type,
            duration_seconds: a.duration_seconds,
            parameters: a.parameters,
            reason: a.reason,
            execution_mode: a.execution_mode,
            incident_id: a.incident_id,
          })),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ==================== REPORT ACTION RESULT (Agent Auth) ====================
      if (action === 'report-action') {
        const body = await req.json();
        const { action_id, status, result, error_message, rollback_available } = body;

        const newStatus = status === 'success' ? 'completed' : 'failed';

        const { data: updated, error: updateErr } = await supabase
          .from('soar_actions')
          .update({
            status: newStatus,
            executed_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            execution_result: result || {},
            error_message: error_message || null,
            rollback_available: rollback_available || false,
          })
          .eq('id', action_id)
          .select()
          .single();

        if (updateErr) throw updateErr;

        // Log to incident timeline
        if (updated?.incident_id) {
          await supabase.from('incident_timeline').insert({
            incident_id: updated.incident_id,
            stage: `SOAR Action ${newStatus === 'completed' ? 'Completed' : 'Failed'}: ${updated.action_type}`,
            details: `Target: ${updated.target || 'N/A'} | ${error_message || 'Success'}`,
          });
        }

        // Audit log
        await supabase.from('audit_logs').insert({
          action: `soar_action_${newStatus}`,
          resource_type: 'soar_action',
          resource_id: updated.id,
          details: { action_type: updated.action_type, target: updated.target, result, error_message },
        });

        console.log(`${newStatus === 'completed' ? '✅' : '❌'} Action ${updated.action_id} ${newStatus} on ${auth.dataSourceName}`);

        return new Response(JSON.stringify({ success: true, action: updated }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'ingest') {
        const body = await req.json() as LogBatch;
        
        const rawLogsToInsert: any[] = [];
        const transformedLogs: any[] = [];

        const cfIP = req.headers.get('cf-connecting-ip');
        const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
        const xRealIP = req.headers.get('x-real-ip');

        for (const log of body.logs) {
          const ingestId = crypto.randomUUID();

          const logTimestamp = (log as any).timestamp || (log as any).time || new Date().toISOString();
          const logType = (log as any).log_type || (log as any).eventType || 'unknown';
          const hostname = (log as any).hostname || (log as any).host || auth.dataSourceName;
          const parsedMessage = (log as any).message || (log as any).msg || null;

          const ipCandidate =
            forwardedFor ||
            cfIP ||
            xRealIP ||
            log.source_ip ||
            (log as any).srcIP ||
            (log as any).src_ip ||
            (log as any).host_ip ||
            (log as any).ip_address ||
            null;

          const rawOriginal = (log as any).raw_log || (log as any).raw || log;
          const rawPayload = (rawOriginal && typeof rawOriginal === 'object')
            ? { ...rawOriginal, _socmind: { ...(rawOriginal as any)?._socmind, ingest_id: ingestId } }
            : { value: rawOriginal, _socmind: { ingest_id: ingestId } };

          rawLogsToInsert.push({
            data_source_id: auth.dataSourceId,
            timestamp: logTimestamp,
            log_type: logType,
            severity: log.severity >= 4 ? 'high' : log.severity >= 3 ? 'medium' : log.severity >= 2 ? 'low' : 'info',
            hostname,
            ip_address: ipCandidate,
            raw_payload: rawPayload,
            parsed_message: parsedMessage,
            processing_status: 'pending',
          });

          transformedLogs.push({
            raw_log_id: null,
            ingest_id: ingestId,
            data_source_id: auth.dataSourceId,
            hostname,
            log_type: logType,
            eventType: (log as any).eventType || (log as any).event_type || logType || 'Unknown',
            severity: log.severity,
            srcIP: log.source_ip || (log as any).srcIP || (log as any).src_ip || hostname || auth.dataSourceName,
            dstIP: log.destination_ip || (log as any).dstIP || (log as any).dst_ip || 'Unknown',
            msg: log.message || (log as any).msg || '',
            fileHash: log.file_hash,
            time: logTimestamp,
            raw_log: rawOriginal,
            source_type: body.source_type || (log as any).source_type,
            vendor: body.vendor || (log as any).vendor,
          });
        }

        // Insert raw logs synchronously (fast - just DB write)
        let insertedIds: string[] = [];
        const idByIngestId = new Map<string, string>();

        if (rawLogsToInsert.length > 0) {
          const { data: insertedRows, error: rawError } = await supabase
            .from('raw_logs')
            .insert(rawLogsToInsert)
            .select('id, raw_payload');

          if (rawError) {
            console.error('Failed to insert raw logs:', rawError);
            throw rawError;
          }

          const rows = insertedRows || [];
          insertedIds = rows.map((r: any) => r.id);

          for (const r of rows) {
            const ingestId = (r as any)?.raw_payload?._socmind?.ingest_id;
            if (ingestId) idByIngestId.set(ingestId, r.id);
          }

          console.log(`📝 Stored ${rows.length} raw logs`);
        }

        // Attach raw_log_id to the analysis payload
        for (const t of transformedLogs) {
          t.raw_log_id = idByIngestId.get(t.ingest_id) || null;
        }

        // ✅ Return immediate response to agent (prevents timeout)
        const immediateResponse = new Response(JSON.stringify({
          success: true,
          logs_received: body.logs.length,
          logs_ingested: rawLogsToInsert.length,
          processed: rawLogsToInsert.length,
          incidents_created: 0,
          message: `Received ${body.logs.length} logs - analysis running in background`,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

        // 🔥 Run heavy analysis in background (non-blocking)
        const backgroundWork = async () => {
          try {
            // Check correlation rules
            const { incidentsCreated: correlationIncidents, rulesTriggered } = await checkCorrelationRules(
              supabase,
              transformedLogs,
              auth.dataSourceId!,
              auth.dataSourceName!
            );

            // Analyze via ingest-log (AI analysis)
            if (transformedLogs.length > 0) {
              const { data: ingestResult, error: ingestErr } = await supabase.functions.invoke('ingest-log', {
                body: {
                  logs: transformedLogs,
                  source: `Agent: ${auth.dataSourceName}`,
                },
                headers: {
                  'x-raw-logs-inserted': 'true',
                },
              });

              if (ingestErr) {
                console.error('Ingest-log failed:', ingestErr);
                if (insertedIds.length > 0) {
                  await supabase
                    .from('raw_logs')
                    .update({
                      processing_status: 'error',
                      error_message: 'Analysis failed',
                      analyzed_at: new Date().toISOString(),
                    })
                    .in('id', insertedIds);
                }
              } else {
                const incidentsCreated = (ingestResult as any)?.incidents_created ?? 0;
                const correlationCount = correlationIncidents.length;
                console.log(`✅ Background analysis complete: ${incidentsCreated + correlationCount} incidents (correlation: ${correlationCount}, rules triggered: ${rulesTriggered.join(', ') || 'none'})`);
              }
            }

            // Update data source stats
            const { data: currentSource } = await supabase
              .from('data_sources')
              .select('logs_received_today, logs_received_total')
              .eq('id', auth.dataSourceId)
              .single();

            await supabase
              .from('data_sources')
              .update({
                last_log_received: new Date().toISOString(),
                logs_received_today: (currentSource?.logs_received_today || 0) + body.logs.length,
                logs_received_total: (currentSource?.logs_received_total || 0) + body.logs.length,
                status: 'active',
              })
              .eq('id', auth.dataSourceId);

            // Update stats table (batch to avoid per-log overhead)
            const currentHour = new Date().getHours();
            const logTypeCounts = new Map<string, number>();
            for (const log of body.logs) {
              const lt = log.log_type || 'unknown';
              logTypeCounts.set(lt, (logTypeCounts.get(lt) || 0) + 1);
            }
            for (const [lt, count] of logTypeCounts) {
              await supabase
                .from('log_ingestion_stats')
                .upsert({
                  data_source_id: auth.dataSourceId,
                  date: new Date().toISOString().split('T')[0],
                  hour: currentHour,
                  log_type: lt,
                  count,
                  incidents_created: correlationIncidents.length > 0 ? correlationIncidents.length : 0,
                }, {
                  onConflict: 'data_source_id,date,hour,log_type',
                });
            }
          } catch (bgErr) {
            console.error('Background analysis error:', bgErr);
          }
        };

        // Use Deno's waitUntil to run background work after response is sent
        try {
          (globalThis as any).Deno?.serve?.waitUntil?.(backgroundWork());
        } catch {}
        // Fallback: fire and forget
        backgroundWork().catch(console.error);

        return immediateResponse;
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Agent gateway error:', error);
    return new Response(JSON.stringify({
      error: 'An error occurred processing your request',
      code: 'INTERNAL_ERROR',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
