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
}

interface AgentHeartbeat {
  hostname: string;
  status: 'active' | 'error';
  logs_sent?: number;
  error_message?: string;
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
}

interface LogBatch {
  logs: NormalizedLog[];
  batch_id?: string;
}

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
};

async function verifyAgentKey(req: Request, supabase: any): Promise<{ valid: boolean; dataSourceId?: string; dataSourceName?: string; error?: string }> {
  const agentKey = req.headers.get('x-agent-key');
  
  if (!agentKey) {
    return { valid: false, error: 'Missing X-Agent-Key header' };
  }

  // Use the verify function
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

  // Check role
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
    // Actions that require user authentication (management)
    if (['register', 'generate-key', 'list', 'delete', 'simulate'].includes(action || '')) {
      const auth = await verifyUserAuth(req);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'register') {
        const body = await req.json() as AgentRegistration;
        
        // Create data source
        const { data: dataSource, error } = await supabase
          .from('data_sources')
          .insert({
            name: body.hostname,
            type: body.os_type === 'windows' ? 'windows_agent' : 'linux_agent',
            hostname: body.hostname,
            ip_address: body.ip_address,
            os_type: body.os_type,
            os_version: body.os_version,
            agent_version: body.agent_version,
            log_types: body.log_types,
            status: 'pending',
            created_by: auth.userId,
          })
          .select()
          .single();

        if (error) throw error;

        // Generate API key
        const { data: keyData, error: keyError } = await supabase.rpc('generate_agent_api_key', {
          _data_source_id: dataSource.id,
          _name: `Initial key for ${body.hostname}`,
          _expires_days: 365,
        });

        if (keyError) throw keyError;

        console.log(`✅ Registered new agent: ${body.hostname}`);

        return new Response(JSON.stringify({
          success: true,
          data_source_id: dataSource.id,
          api_key: keyData[0].api_key,
          key_id: keyData[0].key_id,
          message: 'Agent registered successfully. Store the API key securely - it will not be shown again.',
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
          message: 'API key generated. Store securely - it will not be shown again.',
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

      if (action === 'simulate') {
        const { data_source_id, log_type, count = 5 } = await req.json();
        
        // Get data source
        const { data: dataSource, error: dsError } = await supabase
          .from('data_sources')
          .select('*')
          .eq('id', data_source_id)
          .single();

        if (dsError || !dataSource) {
          throw new Error('Data source not found');
        }

        const logPool = SIMULATED_LOGS[log_type as keyof typeof SIMULATED_LOGS] || SIMULATED_LOGS.security;
        const simulatedLogs = [];
        const rawLogsToInsert = [];

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

          // Prepare raw log entry
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

        // Insert raw logs first
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

        // Send to ingest-log for analysis
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

        // Update raw logs status
        if (ingestResult.incidents?.length > 0) {
          await supabase
            .from('raw_logs')
            .update({ processing_status: 'incident_created', analyzed_at: new Date().toISOString() })
            .eq('data_source_id', data_source_id)
            .eq('processing_status', 'pending')
            .order('created_at', { ascending: false })
            .limit(rawLogsToInsert.length);
        }

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
          incidents: ingestResult.incidents,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Actions that require agent key authentication
    if (['heartbeat', 'ingest'].includes(action || '')) {
      const auth = await verifyAgentKey(req, supabase);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'heartbeat') {
        const body = await req.json() as AgentHeartbeat;

        await supabase
          .from('data_sources')
          .update({
            status: body.status,
            last_heartbeat: new Date().toISOString(),
            config: body.error_message ? { last_error: body.error_message } : undefined,
          })
          .eq('id', auth.dataSourceId);

        console.log(`💓 Heartbeat from ${auth.dataSourceName}: ${body.status}`);

        return new Response(JSON.stringify({ 
          success: true,
          message: 'Heartbeat recorded',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'ingest') {
        const body = await req.json() as LogBatch;

        // Store raw logs first
        const rawLogsToInsert = body.logs.map(log => ({
          data_source_id: auth.dataSourceId,
          timestamp: log.timestamp,
          log_type: log.log_type,
          severity: log.severity >= 4 ? 'high' : log.severity >= 3 ? 'medium' : log.severity >= 2 ? 'low' : 'info',
          hostname: auth.dataSourceName,
          ip_address: log.source_ip,
          raw_payload: log.raw_log || log,
          parsed_message: log.message,
          processing_status: 'pending' as const,
        }));

        // Insert raw logs
        let insertedLogIds: string[] = [];
        if (rawLogsToInsert.length > 0) {
          const { data: insertedLogs, error: rawError } = await supabase
            .from('raw_logs')
            .insert(rawLogsToInsert)
            .select('id');
          
          if (rawError) {
            console.error('Failed to insert raw logs:', rawError);
          } else {
            insertedLogIds = insertedLogs?.map(l => l.id) || [];
            console.log(`📝 Stored ${insertedLogIds.length} raw logs`);
          }
        }

        // Transform logs to ingest-log format
        const transformedLogs = body.logs.map(log => ({
          eventType: log.log_type,
          severity: log.severity,
          srcIP: log.source_ip || auth.dataSourceName,
          dstIP: log.destination_ip || 'Unknown',
          msg: log.message,
          fileHash: log.file_hash,
          time: log.timestamp,
          raw_log: log.raw_log,
        }));

        // Send to ingest-log
        const ingestResponse = await fetch(`${supabaseUrl}/functions/v1/ingest-log`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            logs: transformedLogs,
            source: `Agent: ${auth.dataSourceName}`,
          }),
        });

        if (!ingestResponse.ok) {
          const errorText = await ingestResponse.text();
          console.error('Ingest failed:', errorText);
          
          // Update raw logs with error status
          if (insertedLogIds.length > 0) {
            await supabase
              .from('raw_logs')
              .update({ processing_status: 'error', error_message: 'Analysis failed', analyzed_at: new Date().toISOString() })
              .in('id', insertedLogIds);
          }
          
          throw new Error('Failed to process logs');
        }

        const ingestResult = await ingestResponse.json();

        // Update raw logs status based on results
        if (insertedLogIds.length > 0) {
          const status = ingestResult.incidents?.length > 0 ? 'incident_created' : 'analyzed';
          await supabase
            .from('raw_logs')
            .update({ 
              processing_status: status, 
              analyzed_at: new Date().toISOString(),
              incident_id: ingestResult.incidents?.[0]?.id || null,
            })
            .in('id', insertedLogIds);
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

        // Update stats table
        const currentHour = new Date().getHours();
        for (const log of body.logs) {
          await supabase
            .from('log_ingestion_stats')
            .upsert({
              data_source_id: auth.dataSourceId,
              date: new Date().toISOString().split('T')[0],
              hour: currentHour,
              log_type: log.log_type,
              count: 1,
              incidents_created: ingestResult.incidents?.length > 0 ? 1 : 0,
            }, {
              onConflict: 'data_source_id,date,hour,log_type',
            });
        }

        console.log(`📥 Ingested ${body.logs.length} logs from ${auth.dataSourceName}`);

        return new Response(JSON.stringify({
          success: true,
          processed: ingestResult.processed,
          incidents: ingestResult.incidents,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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