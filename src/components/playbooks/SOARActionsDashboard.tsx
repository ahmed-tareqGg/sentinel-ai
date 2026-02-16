import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Zap, Shield, Ban, Server, Users, Clock, CheckCircle2, XCircle,
  RotateCcw, Send, AlertTriangle, Target, Activity, Loader2,
  Play, Eye, RefreshCw, ChevronRight, Radio,
} from 'lucide-react';

interface SOARAction {
  id: string;
  action_id: string;
  incident_id: string | null;
  data_source_id: string | null;
  action_type: string;
  target: string | null;
  target_type: string | null;
  status: string;
  execution_mode: string;
  reason: string | null;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  dispatched_at: string | null;
  executed_at: string | null;
  completed_at: string | null;
  execution_result: any;
  error_message: string | null;
  rollback_available: boolean;
  rolled_back_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

interface DataSource {
  id: string;
  name: string;
  hostname: string | null;
  ip_address: string | null;
  status: string;
  os_type: string | null;
  last_heartbeat: string | null;
}

const ACTION_META: Record<string, { icon: typeof Shield; color: string; label: string }> = {
  block_ip: { icon: Ban, label: 'Block IP', color: 'text-destructive' },
  unblock_ip: { icon: Ban, label: 'Unblock IP', color: 'text-green-500' },
  isolate_host: { icon: Server, label: 'Isolate Host', color: 'text-orange-500' },
  unisolate_host: { icon: Server, label: 'Unisolate Host', color: 'text-green-500' },
  disable_user: { icon: Users, label: 'Disable User', color: 'text-destructive' },
  enable_user: { icon: Users, label: 'Enable User', color: 'text-green-500' },
  lock_user: { icon: Users, label: 'Lock User', color: 'text-orange-500' },
  kill_process: { icon: Zap, label: 'Kill Process', color: 'text-destructive' },
  quarantine_file: { icon: Shield, label: 'Quarantine File', color: 'text-orange-500' },
  delete_file: { icon: XCircle, label: 'Delete File', color: 'text-destructive' },
  reset_credentials: { icon: Shield, label: 'Reset Credentials', color: 'text-yellow-500' },
  notify_user: { icon: Activity, label: 'Notify User', color: 'text-blue-500' },
  create_ticket: { icon: Activity, label: 'Create Ticket', color: 'text-primary' },
  escalate: { icon: AlertTriangle, label: 'Escalate', color: 'text-yellow-500' },
};

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Clock }> = {
  pending: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30', icon: Clock },
  approved: { color: 'bg-blue-500/10 text-blue-500 border-blue-500/30', icon: CheckCircle2 },
  dispatched: { color: 'bg-purple-500/10 text-purple-500 border-purple-500/30', icon: Send },
  executing: { color: 'bg-orange-500/10 text-orange-500 border-orange-500/30', icon: Loader2 },
  success: { color: 'bg-green-500/10 text-green-500 border-green-500/30', icon: CheckCircle2 },
  executed: { color: 'bg-green-500/10 text-green-500 border-green-500/30', icon: CheckCircle2 },
  failed: { color: 'bg-destructive/10 text-destructive border-destructive/30', icon: XCircle },
  rejected: { color: 'bg-destructive/10 text-destructive border-destructive/30', icon: XCircle },
  rolled_back: { color: 'bg-muted text-muted-foreground border-border', icon: RotateCcw },
};

const DISPATCH_ACTIONS = [
  'block_ip', 'unblock_ip', 'isolate_host', 'unisolate_host',
  'disable_user', 'enable_user', 'lock_user', 'kill_process',
  'quarantine_file', 'delete_file', 'notify_user',
];

export function SOARActionsDashboard() {
  const [actions, setActions] = useState<SOARAction[]>([]);
  const [agents, setAgents] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<SOARAction | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  // Dispatch form
  const [dispatchForm, setDispatchForm] = useState({
    action_type: '',
    target: '',
    agent_id: '',
    incident_id: '',
    reason: '',
    execution_mode: 'real',
  });

  useEffect(() => {
    fetchActions();
    fetchAgents();

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
      setActions(data || []);
    } catch (err) {
      console.error('Error fetching SOAR actions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const { data } = await supabase
        .from('data_sources')
        .select('id, name, hostname, ip_address, status, os_type, last_heartbeat')
        .order('last_heartbeat', { ascending: false });
      setAgents(data || []);
    } catch (err) {
      console.error('Error fetching agents:', err);
    }
  };

  const handleDispatch = async () => {
    if (!dispatchForm.action_type || !dispatchForm.agent_id) {
      toast.error('Action type and agent are required');
      return;
    }

    setProcessing('dispatch');
    try {
      const { data, error } = await supabase.functions.invoke('agent-gateway/dispatch-action', {
        body: {
          action_type: dispatchForm.action_type,
          data_source_id: dispatchForm.agent_id,
          target: dispatchForm.target,
          target_type: dispatchForm.action_type.includes('ip') ? 'ip' : dispatchForm.action_type.includes('user') ? 'user' : 'host',
          incident_id: dispatchForm.incident_id || null,
          reason: dispatchForm.reason || `Manual dispatch: ${dispatchForm.action_type}`,
          execution_mode: dispatchForm.execution_mode,
          requires_approval: true, // Always approval
        },
      });

      if (error) throw error;
      toast.success(`Action dispatched: ${data?.action?.action_id || 'OK'}`);
      setDispatchOpen(false);
      setDispatchForm({ action_type: '', target: '', agent_id: '', incident_id: '', reason: '', execution_mode: 'real' });
      fetchActions();
    } catch (err: any) {
      toast.error(`Dispatch failed: ${err.message}`);
    } finally {
      setProcessing(null);
    }
  };

  const handleApproveReject = async (actionId: string, approved: boolean) => {
    setProcessing(actionId);
    try {
      const { error } = await supabase.functions.invoke('agent-gateway/approve-action', {
        body: { action_id: actionId, approved },
      });
      if (error) throw error;
      toast.success(`Action ${approved ? 'approved' : 'rejected'}`);
      fetchActions();
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setProcessing(null);
    }
  };

  const handleRollback = async (actionId: string) => {
    setProcessing(actionId);
    try {
      const { error } = await supabase.functions.invoke('agent-gateway/rollback-action', {
        body: { action_id: actionId },
      });
      if (error) throw error;
      toast.success('Rollback dispatched');
      fetchActions();
    } catch (err: any) {
      toast.error(`Rollback failed: ${err.message}`);
    } finally {
      setProcessing(null);
    }
  };

  const filteredActions = filter === 'all'
    ? actions
    : actions.filter(a => a.status === filter);

  const pendingCount = actions.filter(a => a.status === 'pending').length;
  const dispatchedCount = actions.filter(a => ['approved', 'dispatched'].includes(a.status)).length;
  const successCount = actions.filter(a => ['success', 'executed'].includes(a.status)).length;
  const failedCount = actions.filter(a => a.status === 'failed').length;

  const getActionMeta = (type: string) => ACTION_META[type] || { icon: Zap, label: type.replace(/_/g, ' '), color: 'text-muted-foreground' };
  const getStatusConfig = (status: string) => STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilter('all')}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{actions.length}</p>
            <p className="text-xs text-muted-foreground">Total Actions</p>
          </CardContent>
        </Card>
        <Card className={cn("cursor-pointer hover:border-yellow-500/50 transition-colors", pendingCount > 0 && "border-yellow-500/30")} onClick={() => setFilter('pending')}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-yellow-500">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending Approval</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-purple-500/50 transition-colors" onClick={() => setFilter('dispatched')}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-purple-500">{dispatchedCount}</p>
            <p className="text-xs text-muted-foreground">Dispatched</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-green-500/50 transition-colors" onClick={() => setFilter('success')}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-500">{successCount}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-destructive/50 transition-colors" onClick={() => setFilter('failed')}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{failedCount}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="rolled_back">Rolled Back</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={fetchActions}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <Button onClick={() => setDispatchOpen(true)} className="gap-2">
          <Send className="h-4 w-4" />
          Dispatch Action
        </Button>
      </div>

      {/* Connected Agents Overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="h-4 w-4 text-green-500" />
            Connected Agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {agents.filter(a => a.status === 'active').length === 0 ? (
              <p className="text-sm text-muted-foreground">No active agents</p>
            ) : (
              agents.filter(a => a.status === 'active').map(agent => (
                <Badge key={agent.id} variant="outline" className="gap-1.5 py-1">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  {agent.name || agent.hostname}
                  <span className="text-muted-foreground text-[10px]">
                    {agent.ip_address} | {agent.os_type}
                  </span>
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredActions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No SOAR actions {filter !== 'all' ? `with status "${filter}"` : 'yet'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredActions.map(action => {
            const meta = getActionMeta(action.action_type);
            const statusCfg = getStatusConfig(action.status);
            const ActionIcon = meta.icon;
            const StatusIcon = statusCfg.icon;
            const agent = agents.find(a => a.id === action.data_source_id);

            return (
              <Card
                key={action.id}
                className={cn(
                  "hover:border-primary/50 transition-all cursor-pointer",
                  action.status === 'pending' && "border-yellow-500/30",
                )}
                onClick={() => setSelectedAction(action)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("p-2 rounded-lg bg-secondary/50")}>
                        <ActionIcon className={cn("h-4 w-4", meta.color)} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{meta.label}</span>
                          <span className="text-xs text-muted-foreground font-mono">{action.action_id}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {action.target && (
                            <span className="flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {action.target}
                            </span>
                          )}
                          {agent && (
                            <span className="flex items-center gap-1">
                              <Server className="h-3 w-3" />
                              {agent.name || agent.hostname}
                            </span>
                          )}
                          <span>{formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={cn("text-xs", statusCfg.color)}>
                        <StatusIcon className={cn("h-3 w-3 mr-1", action.status === 'executing' && "animate-spin")} />
                        {action.status}
                      </Badge>

                      {action.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 px-2 text-xs"
                            disabled={processing === action.id}
                            onClick={(e) => { e.stopPropagation(); handleApproveReject(action.id, true); }}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-xs"
                            disabled={processing === action.id}
                            onClick={(e) => { e.stopPropagation(); handleApproveReject(action.id, false); }}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}

                      {action.rollback_available && ['success', 'executed'].includes(action.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={processing === action.id}
                          onClick={(e) => { e.stopPropagation(); handleRollback(action.id); }}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Rollback
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedAction} onOpenChange={(open) => { if (!open) setSelectedAction(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedAction && (() => {
            const meta = getActionMeta(selectedAction.action_type);
            const statusCfg = getStatusConfig(selectedAction.status);
            const ActionIcon = meta.icon;
            const agent = agents.find(a => a.id === selectedAction.data_source_id);

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ActionIcon className={cn("h-5 w-5", meta.color)} />
                    {meta.label}
                    <span className="text-xs font-mono text-muted-foreground">{selectedAction.action_id}</span>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-secondary/50 border">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge variant="outline" className={cn("mt-1", statusCfg.color)}>
                        {selectedAction.status}
                      </Badge>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border">
                      <p className="text-xs text-muted-foreground">Mode</p>
                      <Badge variant="outline" className="mt-1">{selectedAction.execution_mode}</Badge>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border">
                      <p className="text-xs text-muted-foreground">Target</p>
                      <p className="font-mono text-sm mt-1">{selectedAction.target || 'N/A'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border">
                      <p className="text-xs text-muted-foreground">Agent</p>
                      <p className="text-sm mt-1">{agent?.name || agent?.hostname || 'N/A'}</p>
                    </div>
                  </div>

                  {selectedAction.reason && (
                    <div className="p-3 rounded-lg bg-secondary/50 border">
                      <p className="text-xs text-muted-foreground mb-1">Reason</p>
                      <p className="text-sm">{selectedAction.reason}</p>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">TIMELINE</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between p-2 rounded bg-secondary/30">
                        <span>Created</span>
                        <span className="font-mono">{format(new Date(selectedAction.created_at), 'MMM dd, HH:mm:ss')}</span>
                      </div>
                      {selectedAction.approved_at && (
                        <div className="flex justify-between p-2 rounded bg-green-500/10">
                          <span>Approved</span>
                          <span className="font-mono">{format(new Date(selectedAction.approved_at), 'MMM dd, HH:mm:ss')}</span>
                        </div>
                      )}
                      {selectedAction.dispatched_at && (
                        <div className="flex justify-between p-2 rounded bg-blue-500/10">
                          <span>Dispatched</span>
                          <span className="font-mono">{format(new Date(selectedAction.dispatched_at), 'MMM dd, HH:mm:ss')}</span>
                        </div>
                      )}
                      {selectedAction.executed_at && (
                        <div className="flex justify-between p-2 rounded bg-purple-500/10">
                          <span>Executed</span>
                          <span className="font-mono">{format(new Date(selectedAction.executed_at), 'MMM dd, HH:mm:ss')}</span>
                        </div>
                      )}
                      {selectedAction.completed_at && (
                        <div className="flex justify-between p-2 rounded bg-green-500/10">
                          <span>Completed</span>
                          <span className="font-mono">{format(new Date(selectedAction.completed_at), 'MMM dd, HH:mm:ss')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedAction.error_message && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                      <p className="text-xs font-medium text-destructive mb-1">Error</p>
                      <p className="text-sm">{selectedAction.error_message}</p>
                    </div>
                  )}

                  {selectedAction.execution_result && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Execution Result</p>
                      <pre className="text-xs bg-secondary/50 p-3 rounded-lg overflow-auto max-h-40">
                        {JSON.stringify(selectedAction.execution_result, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    {selectedAction.status === 'pending' && (
                      <>
                        <Button className="flex-1" disabled={processing === selectedAction.id}
                          onClick={() => handleApproveReject(selectedAction.id, true)}>
                          <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                        </Button>
                        <Button variant="destructive" className="flex-1" disabled={processing === selectedAction.id}
                          onClick={() => handleApproveReject(selectedAction.id, false)}>
                          <XCircle className="h-4 w-4 mr-2" /> Reject
                        </Button>
                      </>
                    )}
                    {selectedAction.rollback_available && ['success', 'executed'].includes(selectedAction.status) && (
                      <Button variant="outline" className="flex-1" disabled={processing === selectedAction.id}
                        onClick={() => handleRollback(selectedAction.id)}>
                        <RotateCcw className="h-4 w-4 mr-2" /> Rollback Action
                      </Button>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dispatch Dialog */}
      <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Dispatch SOAR Action
            </DialogTitle>
            <DialogDescription>
              Send an action to a specific agent for execution. All actions require approval.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Action Type *</Label>
              <Select value={dispatchForm.action_type} onValueChange={(v) => setDispatchForm(f => ({ ...f, action_type: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action..." />
                </SelectTrigger>
                <SelectContent>
                  {DISPATCH_ACTIONS.map(a => {
                    const m = getActionMeta(a);
                    const Icon = m.icon;
                    return (
                      <SelectItem key={a} value={a}>
                        <span className="flex items-center gap-2">
                          <Icon className={cn("h-3.5 w-3.5", m.color)} />
                          {m.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Target Agent *</Label>
              <Select value={dispatchForm.agent_id} onValueChange={(v) => setDispatchForm(f => ({ ...f, agent_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <span className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", agent.status === 'active' ? 'bg-green-500' : 'bg-muted-foreground')} />
                        {agent.name || agent.hostname} ({agent.ip_address})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Target (IP / User / Process)</Label>
              <Input
                placeholder="e.g. 192.168.1.100 or root"
                value={dispatchForm.target}
                onChange={(e) => setDispatchForm(f => ({ ...f, target: e.target.value }))}
              />
            </div>

            <div>
              <Label>Linked Incident ID (optional)</Label>
              <Input
                placeholder="UUID of incident..."
                value={dispatchForm.incident_id}
                onChange={(e) => setDispatchForm(f => ({ ...f, incident_id: e.target.value }))}
              />
            </div>

            <div>
              <Label>Reason</Label>
              <Textarea
                placeholder="Why is this action being dispatched?"
                value={dispatchForm.reason}
                onChange={(e) => setDispatchForm(f => ({ ...f, reason: e.target.value }))}
                rows={2}
              />
            </div>

            <div>
              <Label>Execution Mode</Label>
              <Select value={dispatchForm.execution_mode} onValueChange={(v) => setDispatchForm(f => ({ ...f, execution_mode: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="real">Real (Live Execution)</SelectItem>
                  <SelectItem value="dry_run">Dry Run (Simulation)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchOpen(false)}>Cancel</Button>
            <Button onClick={handleDispatch} disabled={processing === 'dispatch'} className="gap-2">
              {processing === 'dispatch' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Dispatch (Requires Approval)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
