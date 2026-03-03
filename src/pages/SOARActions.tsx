import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Shield,
  Zap,
  ArrowRight,
  Timer,
  Server,
} from 'lucide-react';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

interface SOARAction {
  id: string;
  action_id: string | null;
  action_type: string;
  target: string | null;
  target_type: string | null;
  status: string | null;
  parameters: any;
  reason: string | null;
  execution_mode: string | null;
  execution_result: any;
  error_message: string | null;
  incident_id: string | null;
  assigned_agent: string | null;
  retry_count: number | null;
  priority: number | null;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  dispatched_at: string | null;
  executed_at: string | null;
  completed_at: string | null;
  created_at: string;
  timeout_at: string | null;
  rollback_available: boolean | null;
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  pending: { color: 'bg-muted/50 text-muted-foreground border-border', icon: Clock, label: 'Pending' },
  approved: { color: 'bg-blue-500/10 text-blue-500 border-blue-500/30', icon: CheckCircle2, label: 'Approved' },
  dispatched: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30', icon: ArrowRight, label: 'Dispatched' },
  completed: { color: 'bg-green-500/10 text-green-500 border-green-500/30', icon: CheckCircle2, label: 'Completed' },
  failed: { color: 'bg-destructive/10 text-destructive border-destructive/30', icon: XCircle, label: 'Failed' },
};

const ACTION_EMOJIS: Record<string, string> = {
  block_ip: '🚫',
  unblock_ip: '✅',
  isolate_host: '🔒',
  unisolate_host: '🔓',
  kill_process: '⚡',
  disable_user: '👤',
  reset_credentials: '🔑',
  forensic_analysis: '🔬',
  geo_block: '🌍',
  create_ticket: '🎫',
  network_forensics: '🌐',
  investigate_data: '📊',
  interview_user: '💬',
  notify_user: '📢',
};

export default function SOARActions() {
  const [actions, setActions] = useState<SOARAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchActions();

    // Realtime subscription
    const channel = supabase
      .channel('soar-actions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'soar_actions' }, () => {
        fetchActions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchActions = async () => {
    try {
      const { data, error } = await supabase
        .from('soar_actions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setActions((data as SOARAction[]) || []);
    } catch (error) {
      console.error('Error fetching SOAR actions:', error);
      toast.error('Failed to load SOAR actions');
    } finally {
      setLoading(false);
    }
  };

  const filteredActions = activeTab === 'all'
    ? actions
    : actions.filter(a => a.status === activeTab);

  const stats = {
    total: actions.length,
    pending: actions.filter(a => a.status === 'pending').length,
    approved: actions.filter(a => a.status === 'approved').length,
    dispatched: actions.filter(a => a.status === 'dispatched').length,
    completed: actions.filter(a => a.status === 'completed').length,
    failed: actions.filter(a => a.status === 'failed').length,
  };

  return (
    <AppLayout title="SOAR Actions" subtitle="Real-time view of all security orchestration actions">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatMini label="Total" value={stats.total} icon={Activity} />
          <StatMini label="Pending" value={stats.pending} icon={Clock} variant="muted" />
          <StatMini label="Approved" value={stats.approved} icon={Shield} variant="blue" />
          <StatMini label="Dispatched" value={stats.dispatched} icon={ArrowRight} variant="yellow" />
          <StatMini label="Completed" value={stats.completed} icon={CheckCircle2} variant="green" />
          <StatMini label="Failed" value={stats.failed} icon={XCircle} variant="red" />
        </div>

        {/* Actions Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Action Pipeline
              </CardTitle>
              <CardDescription>All SOAR actions with live status updates</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchActions} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
                <TabsTrigger value="dispatched">Live ({stats.dispatched})</TabsTrigger>
                <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
                <TabsTrigger value="failed">Failed ({stats.failed})</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredActions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Activity className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">No actions found</p>
                    <p className="text-sm text-muted-foreground/60">
                      Actions will appear here when triggered from incidents
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredActions.map((action) => (
                      <ActionRow key={action.id} action={action} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function StatMini({ label, value, icon: Icon, variant }: {
  label: string;
  value: number;
  icon: typeof Activity;
  variant?: 'blue' | 'yellow' | 'green' | 'red' | 'muted';
}) {
  const colorMap = {
    blue: 'text-blue-500',
    yellow: 'text-yellow-500',
    green: 'text-green-500',
    red: 'text-destructive',
    muted: 'text-muted-foreground',
  };
  const iconColor = variant ? colorMap[variant] : 'text-primary';

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconColor)} />
        <div>
          <p className="text-xl font-bold leading-none">{value}</p>
          <p className="text-[11px] text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function ActionRow({ action }: { action: SOARAction }) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig = STATUS_CONFIG[action.status || 'pending'] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const emoji = ACTION_EMOJIS[action.action_type] || '⚙️';

  return (
    <div
      className="border border-border rounded-lg p-3 hover:bg-secondary/30 transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Main row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-lg shrink-0">{emoji}</span>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">
              {action.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {action.target && (
                <code className="bg-secondary/50 px-1.5 py-0.5 rounded text-[11px] font-mono">
                  {action.target}
                </code>
              )}
              <span>•</span>
              <span>{formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {action.assigned_agent && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Server className="h-3 w-3" />
              {action.assigned_agent}
            </Badge>
          )}
          {action.retry_count != null && action.retry_count > 0 && (
            <Badge variant="outline" className="text-[10px] text-yellow-500 border-yellow-500/30">
              Retry #{action.retry_count}
            </Badge>
          )}
          {action.status === 'dispatched' && action.timeout_at && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Timer className="h-3 w-3" />
              {formatDistanceToNow(new Date(action.timeout_at))}
            </Badge>
          )}
          <Badge className={cn('text-[11px]', statusConfig.color)}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Detail label="Action ID" value={action.action_id || action.id.slice(0, 8)} />
          <Detail label="Incident" value={action.incident_id?.slice(0, 8) || 'N/A'} />
          <Detail label="Mode" value={action.execution_mode || 'real'} />
          <Detail label="Priority" value={String(action.priority ?? 5)} />
          {action.reason && (
            <div className="col-span-2 md:col-span-4">
              <span className="text-muted-foreground">Reason: </span>
              <span className="text-foreground">{action.reason}</span>
            </div>
          )}
          {action.error_message && (
            <div className="col-span-2 md:col-span-4 text-destructive">
              <span className="font-medium">Error: </span>
              {action.error_message}
            </div>
          )}
          {action.execution_result && (
            <div className="col-span-2 md:col-span-4">
              <span className="text-muted-foreground">Result: </span>
              <code className="text-[11px] bg-secondary/50 px-1.5 py-0.5 rounded">
                {typeof action.execution_result === 'object'
                  ? JSON.stringify(action.execution_result, null, 0).slice(0, 200)
                  : String(action.execution_result)}
              </code>
            </div>
          )}
          <div className="col-span-2 md:col-span-4 flex gap-4 text-muted-foreground">
            {action.approved_at && <span>Approved: {format(new Date(action.approved_at), 'HH:mm:ss')}</span>}
            {action.dispatched_at && <span>Dispatched: {format(new Date(action.dispatched_at), 'HH:mm:ss')}</span>}
            {action.executed_at && <span>Executed: {format(new Date(action.executed_at), 'HH:mm:ss')}</span>}
            {action.completed_at && <span>Completed: {format(new Date(action.completed_at), 'HH:mm:ss')}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
