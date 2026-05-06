import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AgentHealthDashboard } from '@/components/agents/AgentHealthDashboard';
import { 
  Server, 
  Monitor, 
  Cloud, 
  Wifi, 
  WifiOff, 
  Plus, 
  RefreshCw, 
  Key, 
  Trash2, 
  Play,
  Copy,
  Check,
  AlertCircle,
  Clock,
  Activity,
  Download,
  Package,
  Network,
  Terminal,
  Shield,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
  Timer
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { LicenseManagement } from '@/components/licenses/LicenseManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface DataSource {
  id: string;
  name: string;
  type: string;
  hostname: string | null;
  ip_address: string | null;
  os_type: string | null;
  os_version: string | null;
  agent_version: string | null;
  status: string;
  last_heartbeat: string | null;
  last_log_received: string | null;
  logs_received_today: number;
  logs_received_total: number;
  log_types: string[];
  created_at: string;
  agent_api_keys?: {
    id: string;
    key_prefix: string;
    name: string;
    last_used: string | null;
    is_active: boolean;
    expires_at: string | null;
  }[];
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  linux_agent: <Terminal className="h-5 w-5 text-orange-500" />,
  windows_agent: <Monitor className="h-5 w-5 text-blue-500" />,
  siem: <Server className="h-5 w-5 text-purple-500" />,
  syslog: <Activity className="h-5 w-5 text-green-500" />,
  api: <Cloud className="h-5 w-5 text-cyan-500" />,
  cloud: <Cloud className="h-5 w-5 text-indigo-500" />,
};

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  active: { color: 'bg-green-500', icon: <Wifi className="h-3 w-3" /> },
  inactive: { color: 'bg-gray-500', icon: <WifiOff className="h-3 w-3" /> },
  pending: { color: 'bg-yellow-500', icon: <Clock className="h-3 w-3" /> },
  error: { color: 'bg-red-500', icon: <AlertCircle className="h-3 w-3" /> },
};

export default function DataSources() {
  const { isManager, isCISO, isAdmin } = useAuth();
  const canManage = isManager || isCISO || isAdmin;
  const queryClient = useQueryClient();
  
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [simulateDialogOpen, setSimulateDialogOpen] = useState(false);
  const [agentDownloadOpen, setAgentDownloadOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    hostname: '',
    os_type: 'linux',
    ip_address: '',
    log_types: ['auth', 'system', 'security'],
  });
  
  const [manualFormData, setManualFormData] = useState({
    name: '',
    type: 'syslog',
    hostname: '',
    port: '514',
    protocol: 'udp',
    log_types: ['security'],
  });
  
  const [addDialogTab, setAddDialogTab] = useState('agent');
  
  const [simulateData, setSimulateData] = useState({
    log_type: 'security',
    count: 5,
  });

  // Agent download OTP verification
  const [downloadPasswordDialog, setDownloadPasswordDialog] = useState(false);
  const [downloadPassword, setDownloadPassword] = useState('');
  const [pendingDownloadUrl, setPendingDownloadUrl] = useState('');
  const [pendingDownloadName, setPendingDownloadName] = useState('');
  const [downloadPasswordError, setDownloadPasswordError] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const handleAgentDownload = async (url: string, filename: string) => {
    setPendingDownloadUrl(url);
    setPendingDownloadName(filename);
    setDownloadPassword('');
    setDownloadPasswordError(false);
    setCodeSent(false);
    setDownloadPasswordDialog(true);
    setIsSendingCode(true);
    try {
      const { error } = await supabase.functions.invoke('agent-download-otp', {
        body: { action: 'send' },
      });
      if (error) throw error;
      setCodeSent(true);
      toast.success('Verification code sent to the platform owner');
    } catch {
      toast.error('Failed to send verification code');
    } finally {
      setIsSendingCode(false);
    }
  };

  const resendCode = async () => {
    setIsSendingCode(true);
    try {
      const { error } = await supabase.functions.invoke('agent-download-otp', {
        body: { action: 'send' },
      });
      if (error) throw error;
      setCodeSent(true);
      toast.success('A new code was sent');
    } catch {
      toast.error('Failed to resend code');
    } finally {
      setIsSendingCode(false);
    }
  };

  const confirmDownload = async () => {
    setIsVerifyingCode(true);
    setDownloadPasswordError(false);
    try {
      const { data, error } = await supabase.functions.invoke('agent-download-otp', {
        body: { action: 'verify', code: downloadPassword },
      });
      if (error || !data?.authorized) {
        setDownloadPasswordError(true);
        toast.error(data?.error || 'Invalid or expired code');
        return;
      }
      const link = document.createElement('a');
      link.href = pendingDownloadUrl;
      link.download = pendingDownloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadPasswordDialog(false);
      toast.success(`Downloading ${pendingDownloadName}`);
    } catch {
      setDownloadPasswordError(true);
      toast.error('Verification failed');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Fetch data sources
  const { data: dataSources, isLoading, refetch } = useQuery({
    queryKey: ['data-sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_sources')
        .select('*, agent_api_keys(id, key_prefix, name, last_used, is_active, expires_at)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DataSource[];
    },
    refetchInterval: 15000,
  });

  // Fetch SOAR actions queue
  const { data: soarActions, refetch: refetchSoar } = useQuery({
    queryKey: ['soar-actions-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('soar_actions')
        .select('*')
        .in('status', ['approved', 'dispatched', 'completed', 'failed'])
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 8000,
  });

  // Register new agent
  const registerMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: result, error } = await supabase.functions.invoke('agent-gateway/register', {
        body: {
          hostname: data.hostname,
          os_type: data.os_type,
          os_version: data.os_type === 'windows' ? 'Windows Server 2022' : 'Ubuntu 22.04',
          agent_version: '1.0.0',
          ip_address: data.ip_address || '0.0.0.0',
          log_types: data.log_types,
        },
      });
      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      setNewApiKey(result.api_key);
      setAddDialogOpen(false);
      setKeyDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      toast.success('Agent registered successfully');
    },
    onError: (error) => {
      toast.error('Failed to register agent: ' + (error as Error).message);
    },
  });

  // Register manual data source
  const registerManualMutation = useMutation({
    mutationFn: async (data: typeof manualFormData) => {
      // Insert directly into data_sources table
      const { data: result, error } = await supabase
        .from('data_sources')
        .insert({
          name: data.name,
          type: data.type,
          hostname: data.hostname || null,
          ip_address: null,
          os_type: null,
          os_version: null,
          agent_version: null,
          status: 'pending',
          log_types: data.log_types,
          config: {
            port: parseInt(data.port) || 514,
            protocol: data.protocol,
          },
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      setAddDialogOpen(false);
      setManualFormData({
        name: '',
        type: 'syslog',
        hostname: '',
        port: '514',
        protocol: 'udp',
        log_types: ['security'],
      });
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      toast.success('Data source added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add data source: ' + (error as Error).message);
    },
  });

  // Generate new API key
  const generateKeyMutation = useMutation({
    mutationFn: async (dataSourceId: string) => {
      const { data: result, error } = await supabase.functions.invoke('agent-gateway/generate-key', {
        body: {
          data_source_id: dataSourceId,
          name: 'Generated Key',
          expires_days: 365,
        },
      });
      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      setNewApiKey(result.api_key);
      setKeyDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      toast.success('New API key generated');
    },
    onError: (error) => {
      toast.error('Failed to generate key: ' + (error as Error).message);
    },
  });

  // Delete data source
  const deleteMutation = useMutation({
    mutationFn: async (dataSourceId: string) => {
      const { data: result, error } = await supabase.functions.invoke('agent-gateway/delete', {
        body: { data_source_id: dataSourceId },
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      toast.success('Data source deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete: ' + (error as Error).message);
    },
  });

  // Simulate logs
  const simulateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSource) throw new Error('No source selected');
      const { data: result, error } = await supabase.functions.invoke('agent-gateway/simulate', {
        body: {
          data_source_id: selectedSource.id,
          log_type: simulateData.log_type,
          count: simulateData.count,
        },
      });
      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      setSimulateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      toast.success(`Simulated ${result.logs_sent} logs, created ${result.incidents?.length || 0} incidents`);
    },
    onError: (error) => {
      toast.error('Simulation failed: ' + (error as Error).message);
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimeAgo = (date: string | null) => {
    if (!date) return 'Never';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Fetch actual log counts from raw_logs table
  const { data: logStats } = useQuery({
    queryKey: ['log-stats'],
    queryFn: async () => {
      // Get today's date in UTC
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // Get total logs count 
      const { count: totalCount } = await supabase
        .from('raw_logs')
        .select('*', { count: 'exact', head: true });

      // Get today's logs count
      const { count: todayCount } = await supabase
        .from('raw_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayISO);

      return {
        total: totalCount || 0,
        today: todayCount || 0,
      };
    },
    refetchInterval: 10000,
  });

  const stats = {
    total: dataSources?.length || 0,
    active: dataSources?.filter(s => s.status === 'active').length || 0,
    logsToday: logStats?.today || dataSources?.reduce((sum, s) => sum + (s.logs_received_today || 0), 0) || 0,
    totalLogs: logStats?.total || dataSources?.reduce((sum, s) => sum + (s.logs_received_total || 0), 0) || 0,
  };

  return (
    <AppLayout title="Data Sources" subtitle="Manage log ingestion sources and VM agents">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sources</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Server className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-500">{stats.active}</p>
              </div>
              <Wifi className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Logs Today</p>
                <p className="text-2xl font-bold">{stats.logsToday.toLocaleString()}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Logs</p>
                <p className="text-2xl font-bold">{stats.totalLogs.toLocaleString()}</p>
              </div>
              <Cloud className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {canManage && (
            <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Data Source
            </Button>
          )}
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setAgentDownloadOpen(true)}>
          <Download className="h-4 w-4" />
          Download Agent
        </Button>
      </div>

      {/* License Management Section */}
      {canManage && (
        <div id="license-section" className="mb-6">
          <LicenseManagement />
        </div>
      )}

      {/* Data Sources Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-card border-border animate-pulse">
              <CardContent className="p-6 h-48" />
            </Card>
          ))
        ) : dataSources?.length === 0 ? (
          <Card className="col-span-full bg-card border-border">
            <CardContent className="p-12 text-center">
              <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Data Sources</h3>
              <p className="text-muted-foreground mb-4">
                Add your first data source to start ingesting logs
              </p>
              {canManage && (
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Data Source
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          dataSources?.map((source) => (
            <Card key={source.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {TYPE_ICONS[source.type] || <Server className="h-5 w-5" />}
                    <div>
                      <CardTitle className="text-base">{source.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {source.ip_address || source.hostname || 'No IP'}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`${STATUS_CONFIG[source.status]?.color} bg-opacity-20 border-0 text-white`}
                  >
                    <span className="flex items-center gap-1">
                      {STATUS_CONFIG[source.status]?.icon}
                      {source.status}
                    </span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Last Heartbeat</p>
                    <p className="font-medium">{formatTimeAgo(source.last_heartbeat)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Log</p>
                    <p className="font-medium">{formatTimeAgo(source.last_log_received)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Logs Today</p>
                    <p className="font-medium">{source.logs_received_today?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Logs</p>
                    <p className="font-medium">{source.logs_received_total?.toLocaleString() || 0}</p>
                  </div>
                </div>

                {/* Heartbeat warning */}
                {source.status === 'active' && source.last_heartbeat && (() => {
                  const secsAgo = (Date.now() - new Date(source.last_heartbeat).getTime()) / 1000;
                  if (secsAgo > 120) {
                    return (
                      <div className="flex items-center gap-1.5 text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        No heartbeat for {Math.floor(secsAgo / 60)}m — agent may be offline
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="flex flex-wrap gap-1">
                  {source.log_types?.map((type) => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                </div>

                {canManage && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-border">
                    {/* Agent Controls */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={async () => {
                          await supabase.functions.invoke('agent-gateway/control', {
                            body: { agent_id: source.id, action: 'start' }
                          });
                          toast.success('Start command sent');
                          refetch();
                        }}
                        disabled={source.status === 'active'}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Start
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                        onClick={async () => {
                          await supabase.functions.invoke('agent-gateway/control', {
                            body: { agent_id: source.id, action: source.status === 'paused' ? 'resume' : 'pause' }
                          });
                          toast.success(source.status === 'paused' ? 'Resume command sent' : 'Pause command sent');
                          refetch();
                        }}
                      >
                        {source.status === 'paused' ? (
                          <>
                            <Play className="h-3 w-3 mr-1" />
                            Resume
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3 mr-1" />
                            Pause
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={async () => {
                          await supabase.functions.invoke('agent-gateway/control', {
                            body: { agent_id: source.id, action: 'stop' }
                          });
                          toast.success('Stop command sent');
                          refetch();
                        }}
                        disabled={source.status === 'inactive'}
                      >
                        <AlertCircle className="h-3 w-3" />
                      </Button>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSelectedSource(source);
                          setSimulateDialogOpen(true);
                        }}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Simulate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateKeyMutation.mutate(source.id)}
                      >
                        <Key className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Delete this data source?')) {
                            deleteMutation.mutate(source.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Agent Health Dashboard */}
      <AgentHealthDashboard />

      {/* SOAR Actions Queue */}
      <Card className="mt-6 border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-yellow-500" />
                SOAR Actions Queue
                {soarActions?.filter(a => a.status === 'approved').length ? (
                  <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                    {soarActions.filter(a => a.status === 'approved').length} pending
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Live view of actions being dispatched to the Executor agent
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetchSoar()}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!soarActions || soarActions.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
              No recent actions
            </div>
          ) : (
            <div className="divide-y divide-border">
              {soarActions.map((action: any) => {
                const statusConfig: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
                  approved: { icon: <Timer className="h-3 w-3" />, label: 'Awaiting Executor', cls: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30' },
                  dispatched: { icon: <Loader2 className="h-3 w-3 animate-spin" />, label: 'Dispatched', cls: 'text-blue-500 bg-blue-500/10 border-blue-500/30' },
                  completed: { icon: <CheckCircle2 className="h-3 w-3" />, label: 'Completed', cls: 'text-green-500 bg-green-500/10 border-green-500/30' },
                  failed: { icon: <XCircle className="h-3 w-3" />, label: 'Failed', cls: 'text-destructive bg-destructive/10 border-destructive/30' },
                  rolled_back: { icon: <RotateCcw className="h-3 w-3" />, label: 'Rolled Back', cls: 'text-muted-foreground bg-muted/30 border-border' },
                };
                const s = statusConfig[action.status] || statusConfig.approved;
                const actionEmoji: Record<string, string> = {
                  block_ip: '🚫', isolate_host: '🔒', kill_process: '⚡', 
                  disable_user: '👤', lock_account: '🔐', unblock_ip: '✅',
                  unisolate_host: '🔓', delete_file: '🗑️', reset_password: '🔑',
                };
                const emoji = actionEmoji[action.action_type] || '⚙️';
                return (
                  <div key={action.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg">{emoji}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {action.action_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Target: <code className="bg-muted px-1 rounded">{action.target || 'N/A'}</code>
                          {action.action_id && <span className="ml-2 opacity-60">{action.action_id}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground">
                        {action.created_at && formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}
                      </span>
                      <Badge variant="outline" className={cn('text-xs gap-1', s.cls)}>
                        {s.icon}
                        {s.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Data Source Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Data Source</DialogTitle>
            <DialogDescription>
              Register a new log source or VM agent
            </DialogDescription>
          </DialogHeader>

          <Tabs value={addDialogTab} onValueChange={setAddDialogTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="agent">VM Agent</TabsTrigger>
              <TabsTrigger value="manual">Manual</TabsTrigger>
            </TabsList>
            
            <TabsContent value="agent" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Hostname</Label>
                <Input
                  placeholder="server-01.example.com"
                  value={formData.hostname}
                  onChange={(e) => setFormData(prev => ({ ...prev, hostname: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Operating System</Label>
                <Select
                  value={formData.os_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, os_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linux">Linux</SelectItem>
                    <SelectItem value="windows">Windows</SelectItem>
                    <SelectItem value="macos">macOS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>IP Address (optional)</Label>
                <Input
                  placeholder="192.168.1.100"
                  value={formData.ip_address}
                  onChange={(e) => setFormData(prev => ({ ...prev, ip_address: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Log Types</Label>
                <div className="flex flex-wrap gap-4">
                  {['auth', 'system', 'security', 'application'].map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={type}
                        checked={formData.log_types.includes(type)}
                        onCheckedChange={(checked) => {
                          setFormData(prev => ({
                            ...prev,
                            log_types: checked
                              ? [...prev.log_types, type]
                              : prev.log_types.filter(t => t !== type),
                          }));
                        }}
                      />
                      <label htmlFor={type} className="text-sm capitalize">{type}</label>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Source Name</Label>
                <Input
                  placeholder="Corporate SIEM"
                  value={manualFormData.name}
                  onChange={(e) => setManualFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Source Type</Label>
                <Select
                  value={manualFormData.type}
                  onValueChange={(value) => setManualFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="syslog">Syslog</SelectItem>
                    <SelectItem value="siem">SIEM Integration</SelectItem>
                    <SelectItem value="api">API Endpoint</SelectItem>
                    <SelectItem value="cloud">Cloud Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Hostname / Endpoint</Label>
                <Input
                  placeholder={manualFormData.type === 'api' ? 'https://api.example.com/logs' : 'siem.example.com'}
                  value={manualFormData.hostname}
                  onChange={(e) => setManualFormData(prev => ({ ...prev, hostname: e.target.value }))}
                />
              </div>

              {manualFormData.type === 'syslog' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Port</Label>
                    <Input
                      placeholder="514"
                      value={manualFormData.port}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, port: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Protocol</Label>
                    <Select
                      value={manualFormData.protocol}
                      onValueChange={(value) => setManualFormData(prev => ({ ...prev, protocol: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="udp">UDP</SelectItem>
                        <SelectItem value="tcp">TCP</SelectItem>
                        <SelectItem value="tls">TLS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Log Types</Label>
                <div className="flex flex-wrap gap-4">
                  {['auth', 'system', 'security', 'application', 'network', 'firewall'].map((type) => (
                    <div key={`manual-${type}`} className="flex items-center space-x-2">
                      <Checkbox
                        id={`manual-${type}`}
                        checked={manualFormData.log_types.includes(type)}
                        onCheckedChange={(checked) => {
                          setManualFormData(prev => ({
                            ...prev,
                            log_types: checked
                              ? [...prev.log_types, type]
                              : prev.log_types.filter(t => t !== type),
                          }));
                        }}
                      />
                      <label htmlFor={`manual-${type}`} className="text-sm capitalize">{type}</label>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            {addDialogTab === 'agent' ? (
              <Button 
                onClick={() => registerMutation.mutate(formData)}
                disabled={!formData.hostname || registerMutation.isPending}
              >
                {registerMutation.isPending ? 'Registering...' : 'Register Agent'}
              </Button>
            ) : (
              <Button 
                onClick={() => registerManualMutation.mutate(manualFormData)}
                disabled={!manualFormData.name || registerManualMutation.isPending}
              >
                {registerManualMutation.isPending ? 'Adding...' : 'Add Source'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Key Display Dialog */}
      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>API Key Generated</DialogTitle>
            <DialogDescription>
              Copy this key now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-secondary rounded-lg font-mono text-sm break-all">
              {newApiKey}
            </div>

            <Button
              className="w-full gap-2"
              onClick={() => newApiKey && copyToClipboard(newApiKey)}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy to Clipboard
                </>
              )}
            </Button>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">API Endpoint:</p>
              <pre className="p-2 bg-secondary rounded text-xs overflow-x-auto mb-3">
https://kglmzurhiiuhxmzykkqv.supabase.co/functions/v1/agent-gateway
              </pre>
              <p className="font-medium mb-2">Usage:</p>
              <p>Include this key in the X-Agent-Key header when sending logs:</p>
              <pre className="mt-2 p-2 bg-secondary rounded text-xs overflow-x-auto">
{`curl -X POST \\
  -H "X-Agent-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"logs": [...]}' \\
  https://kglmzurhiiuhxmzykkqv.supabase.co/functions/v1/agent-gateway/ingest`}
              </pre>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => {
              setKeyDialogOpen(false);
              setNewApiKey(null);
            }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Simulate Logs Dialog */}
      <Dialog open={simulateDialogOpen} onOpenChange={setSimulateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simulate Logs</DialogTitle>
            <DialogDescription>
              Generate test logs from {selectedSource?.name} for demo purposes
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Log Type</Label>
              <Select
                value={simulateData.log_type}
                onValueChange={(value) => setSimulateData(prev => ({ ...prev, log_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auth">Authentication Logs</SelectItem>
                  <SelectItem value="system">System Logs</SelectItem>
                  <SelectItem value="security">Security Logs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Number of Logs</Label>
              <Select
                value={simulateData.count.toString()}
                onValueChange={(value) => setSimulateData(prev => ({ ...prev, count: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 log</SelectItem>
                  <SelectItem value="5">5 logs</SelectItem>
                  <SelectItem value="10">10 logs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSimulateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => simulateMutation.mutate()}
              disabled={simulateMutation.isPending}
            >
              {simulateMutation.isPending ? 'Simulating...' : 'Generate Logs'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agent Download Dialog */}
      <Dialog open={agentDownloadOpen} onOpenChange={setAgentDownloadOpen}>
        <DialogContent className="sm:max-w-2xl h-[90vh] max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Download SOCMind Agent</DialogTitle>
            <DialogDescription>
              Download the agent and configure it with your API credentials
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 pr-4">
            <div className="space-y-4 py-2">
              {/* API Endpoint Section */}
              <div className="rounded-lg border border-primary/50 bg-primary/5 p-3">
                <p className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  API Configuration
                </p>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">API Endpoint</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 bg-background p-2 rounded text-xs font-mono border border-border overflow-x-auto">
                        https://kglmzurhiiuhxmzykkqv.supabase.co/functions/v1/agent-gateway
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard('https://kglmzurhiiuhxmzykkqv.supabase.co/functions/v1/agent-gateway')}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="border-t border-border pt-2">
                    <Label className="text-xs text-muted-foreground">Agent API Key</Label>
                    {dataSources && dataSources.length > 0 && dataSources[0].agent_api_keys && dataSources[0].agent_api_keys.length > 0 ? (
                      <div className="mt-1">
                        <p className="text-xs text-muted-foreground">
                          Your existing key: <code className="bg-background px-2 py-1 rounded">{dataSources[0].agent_api_keys[0].key_prefix}...</code>
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 gap-2"
                          onClick={() => {
                            if (dataSources[0]) {
                              generateKeyMutation.mutate(dataSources[0].id);
                            }
                          }}
                        >
                          <Key className="h-3 w-3" />
                          Generate New Key
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <p className="text-xs text-yellow-500 bg-yellow-500/10 p-2 rounded flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          No agent registered. Register an agent first.
                        </p>
                        <Button
                          size="sm"
                          className="mt-2 gap-2"
                          onClick={() => {
                            setAgentDownloadOpen(false);
                            setAddDialogOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4" />
                          Register Agent
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {/* License Key Section */}
                  <div className="border-t border-border pt-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      License Key
                    </Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-2"
                      onClick={() => {
                        setAgentDownloadOpen(false);
                        const licenseSection = document.getElementById('license-section');
                        if (licenseSection) {
                          licenseSection.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                    >
                      <Shield className="h-3 w-3" />
                      Manage Licenses
                    </Button>
                  </div>
                </div>
              </div>

              {/* Download Agents */}
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Basic Agents</TabsTrigger>
                  <TabsTrigger value="universal">Universal Agent</TabsTrigger>
                  <TabsTrigger value="executor">Executor</TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="mt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleAgentDownload('/agents/socmind-agent-linux.sh', 'socmind-agent-linux.sh')}
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer text-center"
                    >
                      <Terminal className="h-8 w-8 text-orange-500" />
                      <div>
                        <p className="font-medium text-sm">Linux Agent</p>
                        <p className="text-xs text-muted-foreground">Ubuntu, Debian, RHEL</p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleAgentDownload('/agents/socmind-agent-windows.ps1', 'socmind-agent-windows.ps1')}
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer text-center"
                    >
                      <Monitor className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="font-medium text-sm">Windows Agent</p>
                        <p className="text-xs text-muted-foreground">Windows Server 2016+</p>
                      </div>
                    </button>
                  </div>
                  
                  {/* Basic Quick Start */}
                  <div className="rounded-lg border border-border bg-secondary/30 p-3 mt-3">
                    <p className="text-xs font-medium mb-2">🚀 Quick Start:</p>
                    <pre className="bg-background p-2 rounded text-xs overflow-x-auto text-muted-foreground">
{`# Linux
chmod +x socmind-agent-linux.sh && ./socmind-agent-linux.sh

# Windows (Run as Administrator)
.\\socmind-agent-windows.ps1`}
                    </pre>
                  </div>
                </TabsContent>
                
                <TabsContent value="universal" className="mt-3 space-y-3">
                  {/* Production Agent */}
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="flex items-center gap-3 mb-3">
                      <Package className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">SOCMind Universal Agent v3.0.0</p>
                        <p className="text-xs text-muted-foreground">Production-ready Python SOAR Agent</p>
                      </div>
                    </div>
                    
                    {/* Core Files */}
                    <div className="space-y-2 mb-3">
                      <p className="text-xs font-medium text-muted-foreground">📦 Core</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { href: '/agents/socmind-agent/agent.py', name: 'agent.py (Entry)', icon: Terminal },
                          { href: '/agents/socmind-agent/config.yaml', name: 'config.yaml', icon: Package },
                          { href: '/agents/socmind-agent/requirements.txt', name: 'requirements.txt', icon: Package },
                        ].map((file) => (
                          <button
                            key={file.name}
                            onClick={() => handleAgentDownload(file.href, file.href.split('/').pop() || file.name)}
                            className="flex items-center gap-1.5 p-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-colors text-xs"
                          >
                            <file.icon className="h-3 w-3 text-primary" />
                            <span className="truncate">{file.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Core Modules */}
                    <div className="space-y-2 mb-3">
                      <p className="text-xs font-medium text-muted-foreground">🧠 core/ — Engine Modules</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { href: '/agents/socmind-agent/core/collector.py', name: 'collector.py' },
                          { href: '/agents/socmind-agent/core/executor.py', name: 'executor.py' },
                          { href: '/agents/socmind-agent/core/playbook_engine.py', name: 'playbook_engine.py' },
                          { href: '/agents/socmind-agent/core/approval_client.py', name: 'approval_client.py' },
                          { href: '/agents/socmind-agent/core/audit_logger.py', name: 'audit_logger.py' },
                          { href: '/agents/socmind-agent/core/heartbeat.py', name: 'heartbeat.py' },
                        ].map((file) => (
                          <button
                            key={file.name}
                            onClick={() => handleAgentDownload(file.href, file.name)}
                            className="flex items-center gap-1.5 p-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-colors text-xs"
                          >
                            <Terminal className="h-3 w-3 text-cyan-500" />
                            <span className="truncate">{file.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Action Handlers */}
                    <div className="space-y-2 mb-3">
                      <p className="text-xs font-medium text-muted-foreground">⚔️ actions/ — SOAR Actions</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { href: '/agents/socmind-agent/actions/block_ip.py', name: 'block_ip' },
                          { href: '/agents/socmind-agent/actions/unblock_ip.py', name: 'unblock_ip' },
                          { href: '/agents/socmind-agent/actions/kill_process.py', name: 'kill_process' },
                          { href: '/agents/socmind-agent/actions/lock_user.py', name: 'lock_user' },
                          { href: '/agents/socmind-agent/actions/delete_file.py', name: 'delete_file' },
                          { href: '/agents/socmind-agent/actions/notify_user.py', name: 'notify_user' },
                        ].map((file) => (
                          <button
                            key={file.name}
                            onClick={() => handleAgentDownload(file.href, file.href.split('/').pop() || file.name)}
                            className="flex items-center gap-1.5 p-1.5 rounded border border-border hover:border-primary hover:bg-primary/5 transition-colors text-xs"
                          >
                            <Shield className="h-3 w-3 text-red-500" />
                            <span className="truncate">{file.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Vendor Plugins */}
                    <div className="space-y-2 mb-3">
                      <p className="text-xs font-medium text-muted-foreground">🌐 vendors/ — Log Parsers + MITRE</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { href: '/agents/socmind-agent/vendors/fortinet.py', name: 'Fortinet', color: 'text-red-500' },
                          { href: '/agents/socmind-agent/vendors/paloalto.py', name: 'Palo Alto', color: 'text-orange-500' },
                          { href: '/agents/socmind-agent/vendors/cisco.py', name: 'Cisco', color: 'text-blue-500' },
                          { href: '/agents/socmind-agent/vendors/syslog.py', name: 'Syslog', color: 'text-green-500' },
                        ].map((file) => (
                          <button
                            key={file.name}
                            onClick={() => handleAgentDownload(file.href, file.href.split('/').pop() || file.name)}
                            className="flex items-center gap-1.5 p-1.5 rounded border border-border hover:border-primary hover:bg-primary/5 transition-colors text-xs"
                          >
                            <Network className={`h-3 w-3 ${file.color}`} />
                            <span className="truncate">{file.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Playbooks */}
                    <div className="space-y-2 mb-3">
                      <p className="text-xs font-medium text-muted-foreground">📋 playbooks/ — YAML Playbooks</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { href: '/agents/socmind-agent/playbooks/brute_force.yaml', name: 'Brute Force' },
                          { href: '/agents/socmind-agent/playbooks/malware_c2.yaml', name: 'Malware C2' },
                          { href: '/agents/socmind-agent/playbooks/suspicious_login.yaml', name: 'Suspicious Login' },
                        ].map((file) => (
                          <button
                            key={file.name}
                            onClick={() => handleAgentDownload(file.href, file.href.split('/').pop() || file.name)}
                            className="flex items-center gap-1.5 p-1.5 rounded border border-border hover:border-primary hover:bg-primary/5 transition-colors text-xs"
                          >
                            <Activity className="h-3 w-3 text-yellow-500" />
                            <span className="truncate">{file.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Utils */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">🔧 utils/ — Security Utilities</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { href: '/agents/socmind-agent/utils/signer.py', name: 'signer.py' },
                          { href: '/agents/socmind-agent/utils/permissions.py', name: 'permissions.py' },
                        ].map((file) => (
                          <button
                            key={file.name}
                            onClick={() => handleAgentDownload(file.href, file.href.split('/').pop() || file.name)}
                            className="flex items-center gap-1.5 p-1.5 rounded border border-border hover:border-primary hover:bg-primary/5 transition-colors text-xs"
                          >
                            <Key className="h-3 w-3 text-purple-500" />
                            <span className="truncate">{file.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Setup Instructions */}
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <p className="text-xs font-medium mb-1">📁 Directory Structure:</p>
                    <pre className="bg-background p-2 rounded text-xs overflow-x-auto text-muted-foreground mb-2">
{`socmind-agent/
├── agent.py              # Entry point
├── config.yaml           # Configuration
├── requirements.txt      # Dependencies
├── core/                 # Engine modules
│   ├── collector.py      # Log collection
│   ├── executor.py       # SOAR action execution
│   ├── playbook_engine.py # Playbook runner
│   ├── approval_client.py # Approval workflow
│   ├── audit_logger.py   # Audit trail
│   └── heartbeat.py      # Health monitoring
├── actions/              # Action handlers
│   ├── block_ip.py       # IP blocking
│   ├── kill_process.py   # Process termination
│   └── ...               # More actions
├── vendors/              # Vendor parsers
│   ├── fortinet.py       # FortiGate
│   ├── paloalto.py       # PAN-OS
│   └── cisco.py          # ASA/FTD
├── playbooks/            # YAML playbooks
│   ├── brute_force.yaml
│   └── malware_c2.yaml
└── utils/                # Utilities
    ├── signer.py         # Request signing
    └── permissions.py    # OS permissions`}
                    </pre>
                    <p className="text-xs font-medium mb-1">🚀 Quick Start:</p>
                    <pre className="bg-background p-2 rounded text-xs overflow-x-auto text-muted-foreground">
{`pip install -r requirements.txt
python3 agent.py configure
python3 agent.py run            # Live mode
python3 agent.py run --dry-run  # Simulation`}
                    </pre>
                  </div>
                </TabsContent>

                {/* ── Executor Tab ── */}
                <TabsContent value="executor" className="mt-3 space-y-3">

                  {/* Header */}
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-3">
                    <Shield className="h-6 w-6 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">SOCMind Executor v2.0.0</p>
                      <p className="text-xs text-muted-foreground mt-0.5">محرك تنفيذ الـ SOAR Actions — ينفذ الأوامر الأمنية على الشبكة فعلياً (block IP, isolate host, إلخ)</p>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded px-2 py-1">
                        <AlertCircle className="h-3 w-3 flex-shrink-0" />
                        <span>شغّله على جهاز واحد بصلاحيات (Jump Server / Bastion) — مش على الـ endpoints</span>
                      </div>
                    </div>
                  </div>

                  {/* How it works */}
                  <div className="rounded-lg border border-border bg-secondary/20 p-3">
                    <p className="text-xs font-semibold mb-2 text-foreground">🔄 إزاي بيشتغل؟</p>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 font-bold text-[10px]">1</span>
                        <span>المحلل (Analyst) بيعمل Action من الـ Platform (مثلاً: Block IP)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 font-bold text-[10px]">2</span>
                        <span>الـ Manager أو CISO بيوافق من صفحة الـ Approvals</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 font-bold text-[10px]">3</span>
                        <span>الـ Executor بيعمل Poll كل 5 ثواني — ولما يلاقي أمر approved بينفذه فعلياً على السيرفر</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">4</span>
                        <span>بيرجع النتيجة للـ Platform ويسجلها في الـ Audit Log والـ Timeline</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 1: Download */}
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">1</span>
                      تحميل الـ Executor
                    </p>
                    <button
                      onClick={() => handleAgentDownload('/agents/socmind-executor.py', 'socmind-executor.py')}
                      className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border border-destructive/50 hover:border-destructive hover:bg-destructive/10 transition-colors text-sm font-medium"
                    >
                      <Download className="h-4 w-4 text-destructive" />
                      تحميل socmind-executor.py
                    </button>
                  </div>

                  {/* Step 2: Install */}
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">2</span>
                      تثبيت المتطلبات (مرة واحدة بس)
                    </p>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">✅ الطريقة العادية (Windows / macOS / Ubuntu)</p>
                        <pre className="bg-background border border-border p-2 rounded text-xs text-muted-foreground overflow-x-auto">pip install requests psutil</pre>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">🐉 Kali Linux / Debian / بتجيبك error "externally-managed-environment"</p>
                        <pre className="bg-background border border-border p-2 rounded text-xs text-muted-foreground overflow-x-auto">{`pip install requests psutil --break-system-packages`}</pre>
                        <p className="text-xs text-muted-foreground mt-1">أو استخدم venv (الأفضل):</p>
                        <pre className="bg-background border border-border p-2 rounded text-xs text-muted-foreground overflow-x-auto">{`python3 -m venv venv
source venv/bin/activate
pip install requests psutil
python3 socmind-executor.py configure`}</pre>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Configure */}
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">3</span>
                      إعداد الـ Executor (أول مرة فقط)
                    </p>
                    <pre className="bg-background border border-border p-2 rounded text-xs text-muted-foreground overflow-x-auto">python3 socmind-executor.py configure</pre>
                    <p className="text-xs text-muted-foreground">هيطلب منك:</p>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">① API Endpoint (انسخه واحطّه)</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 bg-background border border-border p-1.5 rounded text-xs font-mono overflow-x-auto whitespace-nowrap">
                            https://kglmzurhiiuhxmzykkqv.supabase.co/functions/v1
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-shrink-0 h-7 px-2"
                            onClick={() => copyToClipboard('https://kglmzurhiiuhxmzykkqv.supabase.co/functions/v1')}
                          >
                            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">② API Key — اضغط "Generate New Key" من فوق وانسخه</Label>
                      </div>
                    </div>
                  </div>

                  {/* Step 4: Run */}
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">4</span>
                      تشغيل الـ Executor
                    </p>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">▶ تشغيل حقيقي (يحتاج صلاحيات Admin/Root)</p>
                        <pre className="bg-background border border-border p-2 rounded text-xs text-green-600 dark:text-green-400 overflow-x-auto">{`# Linux
sudo python3 socmind-executor.py start

# Windows (Run as Administrator)
python socmind-executor.py start`}</pre>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">🧪 وضع الاختبار (بدون تنفيذ فعلي — للتجربة)</p>
                        <pre className="bg-background border border-border p-2 rounded text-xs text-blue-600 dark:text-blue-400 overflow-x-auto">python3 socmind-executor.py dryrun</pre>
                      </div>
                    </div>
                  </div>

                  {/* Other commands */}
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs font-semibold mb-2">📋 أوامر مفيدة أخرى</p>
                    <div className="space-y-1.5 text-xs">
                      {[
                        { cmd: 'python3 socmind-executor.py test', desc: 'اختبار الاتصال بالـ Platform' },
                        { cmd: 'python3 socmind-executor.py status', desc: 'إظهار الحالة وآخر 5 actions' },
                        { cmd: 'python3 socmind-executor.py rollback', desc: 'التراجع عن آخر action قابل للعكس' },
                      ].map(({ cmd, desc }) => (
                        <div key={cmd} className="flex items-center justify-between gap-2 bg-background border border-border rounded p-1.5">
                          <code className="font-mono text-[11px] text-foreground">{cmd}</code>
                          <span className="text-muted-foreground text-[11px] flex-shrink-0">{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Supported Actions */}
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs font-semibold mb-2">⚡ الـ Actions المدعومة (26 action)</p>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      {[
                        { category: "🌐 Network", actions: ["block_ip", "unblock_ip", "isolate_host", "unisolate_host", "flush_dns", "block_domain"] },
                        { category: "⚙️ Process/Service", actions: ["kill_process", "suspend_process", "stop_service", "start_service", "restart_service"] },
                        { category: "👤 User/Identity", actions: ["disable_user", "enable_user", "lock_user", "unlock_user", "reset_password", "force_logoff"] },
                        { category: "📁 File/Forensics", actions: ["quarantine_file", "delete_file", "wipe_file", "collect_forensics", "dump_memory"] },
                        { category: "🔔 Notifications", actions: ["notify_user", "send_alert"] },
                        { category: "🔑 Credentials", actions: ["rotate_credentials", "revoke_token"] },
                      ].map((group) => (
                        <div key={group.category} className="rounded border border-border p-2">
                          <p className="font-semibold text-foreground mb-1">{group.category}</p>
                          <div className="space-y-0.5">
                            {group.actions.map((a) => (
                              <p key={a} className="text-muted-foreground font-mono text-[11px]">{a}</p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>

          <DialogFooter className="flex-shrink-0 pt-2">
            <Button variant="outline" onClick={() => setAgentDownloadOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Download Password Dialog */}
      <Dialog open={downloadPasswordDialog} onOpenChange={setDownloadPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Agent Download - Authentication
            </DialogTitle>
            <DialogDescription>
              Enter the download password to access agent files.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="download-password">Password</Label>
              <Input
                id="download-password"
                type="password"
                placeholder="Enter download password..."
                value={downloadPassword}
                onChange={(e) => {
                  setDownloadPassword(e.target.value);
                  setDownloadPasswordError(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && confirmDownload()}
                className={downloadPasswordError ? 'border-red-500' : ''}
              />
              {downloadPasswordError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Incorrect password. Please try again.
                </p>
              )}
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">📦 File: {pendingDownloadName}</p>
              <p>Agent source code will be downloaded as plain text (not obfuscated).</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDownloadPasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmDownload} className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}