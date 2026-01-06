import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Terminal
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
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
  const { isManager, isCISO } = useAuth();
  const canManage = isManager || isCISO;
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
  
  const [simulateData, setSimulateData] = useState({
    log_type: 'security',
    count: 5,
  });

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

  const stats = {
    total: dataSources?.length || 0,
    active: dataSources?.filter(s => s.status === 'active').length || 0,
    logsToday: dataSources?.reduce((sum, s) => sum + (s.logs_received_today || 0), 0) || 0,
    totalLogs: dataSources?.reduce((sum, s) => sum + (s.logs_received_total || 0), 0) || 0,
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

                <div className="flex flex-wrap gap-1">
                  {source.log_types?.map((type) => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                </div>

                {canManage && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
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
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Data Source Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Data Source</DialogTitle>
            <DialogDescription>
              Register a new log source or VM agent
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="agent" className="mt-4">
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

            <TabsContent value="manual" className="mt-4">
              <div className="text-center py-8 text-muted-foreground">
                <p>Manual configuration coming soon.</p>
                <p className="text-sm mt-2">Use the VM Agent tab to register agents.</p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => registerMutation.mutate(formData)}
              disabled={!formData.hostname || registerMutation.isPending}
            >
              {registerMutation.isPending ? 'Registering...' : 'Register Agent'}
            </Button>
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
              <p className="font-medium mb-2">Usage:</p>
              <p>Include this key in the X-Agent-Key header when sending logs:</p>
              <pre className="mt-2 p-2 bg-secondary rounded text-xs overflow-x-auto">
{`curl -X POST \\
  -H "X-Agent-Key: ${newApiKey?.slice(0, 20)}..." \\
  -H "Content-Type: application/json" \\
  -d '{"logs": [...]}' \\
  https://api.socmind.io/agent-gateway/ingest`}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Download SOCMind Agent</DialogTitle>
            <DialogDescription>
              Choose your operating system to download the lightweight log collection agent
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <a
              href="/agents/socmind-agent-linux.sh"
              download="socmind-agent-linux.sh"
              className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <Terminal className="h-10 w-10 text-orange-500" />
              <div className="flex-1">
                <p className="font-medium">Linux Agent</p>
                <p className="text-sm text-muted-foreground">
                  Bash script for Ubuntu, Debian, RHEL, CentOS
                </p>
              </div>
              <Download className="h-5 w-5 text-muted-foreground" />
            </a>

            <a
              href="/agents/socmind-agent-windows.ps1"
              download="socmind-agent-windows.ps1"
              className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <Monitor className="h-10 w-10 text-blue-500" />
              <div className="flex-1">
                <p className="font-medium">Windows Agent</p>
                <p className="text-sm text-muted-foreground">
                  PowerShell script for Windows Server 2016+
                </p>
              </div>
              <Download className="h-5 w-5 text-muted-foreground" />
            </a>

            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-sm font-medium mb-2">Quick Start:</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p><strong>Linux:</strong></p>
                <pre className="bg-background p-2 rounded overflow-x-auto">
{`chmod +x socmind-agent-linux.sh
sudo ./socmind-agent-linux.sh configure
sudo ./socmind-agent-linux.sh run`}
                </pre>
                <p className="mt-3"><strong>Windows (Run as Administrator):</strong></p>
                <pre className="bg-background p-2 rounded overflow-x-auto">
{`.\\socmind-agent-windows.ps1 configure
.\\socmind-agent-windows.ps1 run`}
                </pre>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAgentDownloadOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}