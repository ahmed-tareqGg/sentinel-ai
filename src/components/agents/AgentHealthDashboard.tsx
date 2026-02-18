import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle2, Clock, Cpu, Database, HardDrive, TrendingUp, Wifi, WifiOff, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/backend/client';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface AgentHealth {
  id: string;
  name: string;
  status: string;
  last_heartbeat: string | null;
  last_log_received: string | null;
  logs_received_today: number;
  logs_received_total: number;
  hostname: string | null;
  ip_address: string | null;
  os_type: string | null;
  agent_version: string | null;
}

function getHealthScore(agent: AgentHealth): { score: number; label: string; color: string } {
  if (agent.status === 'inactive' || agent.status === 'error') {
    return { score: 0, label: 'Offline', color: 'text-destructive' };
  }
  
  let score = 100;
  const now = Date.now();
  
  if (agent.last_heartbeat) {
    const secsAgo = (now - new Date(agent.last_heartbeat).getTime()) / 1000;
    if (secsAgo > 300) score -= 40;
    else if (secsAgo > 120) score -= 20;
    else if (secsAgo > 60) score -= 5;
  } else {
    score -= 30;
  }
  
  if (agent.status === 'pending') score -= 20;
  if (!agent.last_log_received) score -= 10;
  
  score = Math.max(0, Math.min(100, score));
  
  if (score >= 80) return { score, label: 'Healthy', color: 'text-green-500' };
  if (score >= 50) return { score, label: 'Degraded', color: 'text-yellow-500' };
  return { score, label: 'Critical', color: 'text-destructive' };
}

function HeartbeatPulse({ isActive }: { isActive: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {isActive && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-green-500" />
      )}
      <span className={cn(
        'relative inline-flex rounded-full h-2.5 w-2.5',
        isActive ? 'bg-green-500' : 'bg-muted-foreground'
      )} />
    </span>
  );
}

export function AgentHealthDashboard() {
  const { data: agents, isLoading } = useQuery({
    queryKey: ['agent-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_sources')
        .select('id, name, status, last_heartbeat, last_log_received, logs_received_today, logs_received_total, hostname, ip_address, os_type, agent_version')
        .order('status', { ascending: false })
        .order('last_heartbeat', { ascending: false });
      if (error) throw error;
      return data as AgentHealth[];
    },
    refetchInterval: 10000,
  });

  const { data: recentLogs } = useQuery({
    queryKey: ['recent-agent-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raw_logs')
        .select('id, data_source_id, log_type, severity, hostname, parsed_message, created_at, processing_status')
        .order('created_at', { ascending: false })
        .limit(15);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 8000,
  });

  const { data: ingestionStats } = useQuery({
    queryKey: ['ingestion-trend'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('log_ingestion_stats')
        .select('date, hour, count, log_type, data_source_id')
        .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
        .order('date', { ascending: false })
        .order('hour', { ascending: false })
        .limit(48);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse h-40" />
        ))}
      </div>
    );
  }

  const activeAgents = agents?.filter(a => a.status === 'active') || [];
  const offlineAgents = agents?.filter(a => a.status !== 'active') || [];
  const totalLogsToday = agents?.reduce((sum, a) => sum + (a.logs_received_today || 0), 0) || 0;
  const totalLogsAll = agents?.reduce((sum, a) => sum + (a.logs_received_total || 0), 0) || 0;

  const severityConfig: Record<string, { cls: string; label: string }> = {
    critical: { cls: 'bg-destructive/20 text-destructive border-destructive/30', label: 'CRIT' },
    high: { cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30', label: 'HIGH' },
    warning: { cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'WARN' },
    info: { cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'INFO' },
    low: { cls: 'bg-muted/50 text-muted-foreground border-border', label: 'LOW' },
  };

  return (
    <div className="space-y-4 mt-6">
      {/* Section Header */}
      <div className="flex items-center gap-2 pb-1 border-b border-border">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm text-foreground">Agent Health & Telemetry</h3>
        <Badge variant="outline" className="text-xs ml-auto">
          Live · auto-refresh 10s
        </Badge>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
      { icon: Wifi, label: 'Online Agents', value: activeAgents.length, color: 'text-green-500', bg: 'bg-green-500/10' },
          { icon: WifiOff, label: 'Offline Agents', value: offlineAgents.length, color: 'text-destructive', bg: 'bg-destructive/10' },
          { icon: Database, label: 'Logs Today', value: totalLogsToday.toLocaleString(), color: 'text-primary', bg: 'bg-primary/10' },
          { icon: HardDrive, label: 'Total Logs', value: totalLogsAll.toLocaleString(), color: 'text-accent-foreground', bg: 'bg-accent/20' },
        ].map((item) => (
          <Card key={item.label} className="border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', item.bg)}>
                <item.icon className={cn('h-4 w-4', item.color)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className={cn('text-lg font-bold leading-none mt-0.5', item.color)}>{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Agent Health List */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              Agent Health Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!agents?.length ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No agents registered</div>
            ) : (
              <div className="divide-y divide-border max-h-72 overflow-y-auto">
                {agents.map((agent) => {
                  const health = getHealthScore(agent);
                  const isActive = agent.status === 'active';
                  const lastSeen = agent.last_heartbeat
                    ? formatDistanceToNow(new Date(agent.last_heartbeat), { addSuffix: true })
                    : 'Never';
                  const secsAgo = agent.last_heartbeat
                    ? (Date.now() - new Date(agent.last_heartbeat).getTime()) / 1000
                    : Infinity;

                  return (
                    <div key={agent.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <HeartbeatPulse isActive={isActive && secsAgo < 120} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{agent.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {agent.hostname || agent.ip_address || 'Unknown host'} · {agent.os_type || 'Unknown OS'}
                            </p>
                          </div>
                        </div>
                        <span className={cn('text-xs font-semibold', health.color)}>{health.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={health.score} className="h-1 flex-1" />
                        <span className="text-xs text-muted-foreground w-8 text-right">{health.score}%</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">
                          <Clock className="h-2.5 w-2.5 inline mr-1" />
                          {lastSeen}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {(agent.logs_received_today || 0).toLocaleString()} logs today
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Log Feed */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Live Log Feed
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground font-normal">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Streaming
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!recentLogs?.length ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No recent logs</div>
            ) : (
              <div className="divide-y divide-border max-h-72 overflow-y-auto font-mono">
                {recentLogs.map((log: any) => {
                  const sev = severityConfig[log.severity] || severityConfig.info;
                  return (
                    <div key={log.id} className="px-3 py-1.5 hover:bg-muted/30 transition-colors flex items-start gap-2">
                      <Badge variant="outline" className={cn('text-[10px] px-1 py-0 shrink-0 mt-0.5', sev.cls)}>
                        {sev.label}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs truncate text-foreground/90">
                          {log.parsed_message || `[${log.log_type}] Log received`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {log.hostname || 'Unknown'} · {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {log.processing_status === 'failed' && (
                        <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                      )}
                      {log.processing_status === 'completed' && (
                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ingestion Trend (last 24h by hour) */}
      {ingestionStats && ingestionStats.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Ingestion Activity (last 48 hours)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-end gap-1 h-16">
              {(() => {
                // Group by hour slots and get counts
                const hourlyMap: Record<string, number> = {};
                ingestionStats.forEach((s: any) => {
                  const key = `${s.date}-${String(s.hour || 0).padStart(2, '0')}`;
                  hourlyMap[key] = (hourlyMap[key] || 0) + (s.count || 0);
                });
                const values = Object.values(hourlyMap).slice(0, 24);
                const max = Math.max(...values, 1);
                return values.map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary/30 hover:bg-primary/60 transition-colors rounded-sm min-h-[2px]"
                    style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
                    title={`${v} logs`}
                  />
                ));
              })()}
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {ingestionStats.reduce((s: number, r: any) => s + (r.count || 0), 0).toLocaleString()} total in period
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
