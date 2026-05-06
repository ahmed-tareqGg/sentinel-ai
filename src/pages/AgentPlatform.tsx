import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot, Download, Activity, Zap, Settings2, Server, Shield,
  Wifi, WifiOff, Clock, AlertCircle, RefreshCw, Terminal,
  Monitor, Copy, Check, Lock, Network, FileSearch, Undo2,
  Radio, Eye, ChevronRight, Package, HardDrive,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { SOARActionsDashboard } from '@/components/playbooks/SOARActionsDashboard';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Agent {
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
  config: any;
}

const AGENT_DOWNLOADS = [
  {
    name: 'SOCMind Universal Agent',
    description: 'Full-featured Python agent with Threat Detection, FIM, Network Monitor, SOAR Executor, Playbooks, and Auto-Recovery.',
    icon: Package,
    color: 'text-primary',
    bg: 'bg-primary/10',
    version: 'v4.0.0',
    files: [
      { label: 'Universal Agent (Python)', file: '/agents/socmind-agent/agent.py', type: 'Python' },
      { label: 'Config Template', file: '/agents/socmind-agent/config.yaml', type: 'YAML' },
      { label: 'Requirements', file: '/agents/socmind-agent/requirements.txt', type: 'TXT' },
    ],
    features: ['Real-Time Threat Detection', 'Network Traffic Monitor', 'File Integrity Monitor', 'SOAR Executor', 'Auto-Recovery & Rollback', 'Local Playbooks', 'Full Audit Trail'],
  },
  {
    name: 'Linux Collector',
    description: 'Lightweight shell-based log collector for Linux servers. Minimal footprint.',
    icon: Terminal,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    version: 'v2.0',
    files: [
      { label: 'Linux Agent (Shell)', file: '/agents/socmind-agent-linux.sh', type: 'Shell' },
    ],
    features: ['Auth/Syslog/Secure collection', 'Auto-rotation support', 'Lightweight (~5KB)'],
  },
  {
    name: 'Windows Collector',
    description: 'PowerShell-based log collector for Windows servers and workstations.',
    icon: Monitor,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    version: 'v2.0',
    files: [
      { label: 'Windows Agent (PowerShell)', file: '/agents/socmind-agent-windows.ps1', type: 'PS1' },
    ],
    features: ['Windows Event Log collection', 'Security/System/Application logs', 'Service-mode support'],
  },
];

const VENDOR_PLUGINS = [
  { name: 'Fortinet', file: '/agents/plugins/fortinet.py', desc: 'FortiGate / FortiOS integration' },
  { name: 'Palo Alto', file: '/agents/plugins/paloalto.py', desc: 'PAN-OS firewall integration' },
  { name: 'Cisco', file: '/agents/plugins/cisco.py', desc: 'Cisco ASA/IOS integration' },
  { name: 'Sophos', file: '/agents/plugins/sophos.py', desc: 'Sophos XG/UTM integration' },
  { name: 'Syslog Listener', file: '/agents/plugins/syslog_listener.py', desc: 'Generic syslog receiver (UDP/TCP)' },
];

const MODULE_INFO = [
  {
    key: 'threat_detection',
    name: 'Real-Time Threat Detection',
    icon: Shield,
    color: 'text-red-500',
    description: 'Local pattern analysis for Brute Force, Port Scan, Privilege Escalation, C2, Credential Dump, Lateral Movement.',
    configKeys: ['brute_force_threshold', 'brute_force_window_seconds', 'port_scan_threshold', 'port_scan_window_seconds'],
  },
  {
    key: 'network_monitor',
    name: 'Network Traffic Monitor',
    icon: Network,
    color: 'text-cyan-500',
    description: 'Passive network monitoring via ss/netstat. Detects C2 Beaconing, Suspicious Ports, Unusual Outbound.',
    configKeys: ['scan_interval_seconds', 'beacon_threshold', 'beacon_window_seconds'],
  },
  {
    key: 'fim',
    name: 'File Integrity Monitor (FIM)',
    icon: FileSearch,
    color: 'text-amber-500',
    description: 'SHA256 hash-based monitoring of sensitive system files (/etc/passwd, /etc/shadow, SAM, SYSTEM).',
    configKeys: ['scan_interval_seconds', 'hash_algorithm'],
  },
  {
    key: 'recovery',
    name: 'Auto-Recovery & Rollback',
    icon: Undo2,
    color: 'text-green-500',
    description: 'Offline event queuing, auto-rollback of failed actions, crash recovery, state persistence.',
    configKeys: ['max_queue_size', 'retry_interval_seconds', 'auto_rollback'],
  },
];

export default function AgentPlatform() {
  const { isManager, isCISO, isAdmin } = useAuth();
  const canManage = isManager || isCISO || isAdmin;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('monitoring');
  const [downloadPwdDialog, setDownloadPwdDialog] = useState(false);
  const [downloadPwd, setDownloadPwd] = useState('');
  const [pendingDownload, setPendingDownload] = useState({ url: '', name: '' });
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Fetch agents
  const { data: agents, isLoading, refetch } = useQuery({
    queryKey: ['agent-platform-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_sources')
        .select('*')
        .order('last_heartbeat', { ascending: false });
      if (error) throw error;
      return data as Agent[];
    },
    refetchInterval: 15000,
  });

  const activeAgents = agents?.filter(a => a.status === 'active') || [];
  const inactiveAgents = agents?.filter(a => a.status !== 'active') || [];
  const totalLogs = agents?.reduce((sum, a) => sum + (a.logs_received_total || 0), 0) || 0;

  const handleDownload = async (url: string, filename: string) => {
    setPendingDownload({ url, name: filename });
    setDownloadPwd('');
    setCodeSent(false);
    setDownloadPwdDialog(true);
    // Auto-send code
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
    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('agent-download-otp', {
        body: { action: 'verify', code: downloadPwd },
      });

      if (error || !data?.authorized) {
        toast.error(data?.error || 'Invalid or expired code');
        return;
      }

      const link = document.createElement('a');
      link.href = pendingDownload.url;
      link.download = pendingDownload.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadPwdDialog(false);
      toast.success(`Downloading ${pendingDownload.name}`);
    } catch {
      toast.error('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    const cfg: Record<string, { class: string; icon: typeof Wifi }> = {
      active: { class: 'bg-green-500/10 text-green-500 border-green-500/30', icon: Wifi },
      inactive: { class: 'bg-muted text-muted-foreground border-border', icon: WifiOff },
      pending: { class: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30', icon: Clock },
      error: { class: 'bg-destructive/10 text-destructive border-destructive/30', icon: AlertCircle },
    };
    const c = cfg[status] || cfg.inactive;
    const Icon = c.icon;
    return (
      <Badge variant="outline" className={cn('gap-1', c.class)}>
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  return (
    <AppLayout title="Agent Platform" subtitle="Manage, monitor, and control all SOCMind agents">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{agents?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Total Agents</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-500/10">
              <Wifi className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">{activeAgents.length}</p>
              <p className="text-xs text-muted-foreground">Online</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-destructive/10">
              <WifiOff className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{inactiveAgents.length}</p>
              <p className="text-xs text-muted-foreground">Offline</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10">
              <Activity className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalLogs.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Logs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10">
              <Shield className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">v4.0.0</p>
              <p className="text-xs text-muted-foreground">Latest Version</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="monitoring" className="gap-1.5 text-xs sm:text-sm">
            <Radio className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Live</span> Monitoring
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-1.5 text-xs sm:text-sm">
            <Zap className="h-3.5 w-3.5" />
            Actions <span className="hidden sm:inline">& Rollback</span>
          </TabsTrigger>
          <TabsTrigger value="downloads" className="gap-1.5 text-xs sm:text-sm">
            <Download className="h-3.5 w-3.5" />
            Downloads
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5 text-xs sm:text-sm">
            <Settings2 className="h-3.5 w-3.5" />
            Modules
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAB: Live Monitoring ═══ */}
        <TabsContent value="monitoring" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Radio className="h-5 w-5 text-green-500" />
              Connected Agents
            </h3>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[1,2,3].map(i => (
                <Card key={i} className="animate-pulse"><CardContent className="h-40 p-6" /></Card>
              ))}
            </div>
          ) : agents?.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Bot className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium mb-1">No Agents Connected</h3>
                <p className="text-sm text-muted-foreground mb-4">Download and deploy an agent to get started</p>
                <Button onClick={() => setActiveTab('downloads')} className="gap-2">
                  <Download className="h-4 w-4" />
                  Go to Downloads
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {agents?.map((agent) => (
                <Card key={agent.id} className={cn(
                  "hover:border-primary/50 transition-all",
                  agent.status === 'active' && "border-green-500/20",
                  agent.status === 'error' && "border-destructive/30",
                )}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2.5 rounded-lg",
                          agent.status === 'active' ? "bg-green-500/10" : "bg-muted",
                        )}>
                          {agent.os_type === 'windows' ? (
                            <Monitor className={cn("h-5 w-5", agent.status === 'active' ? "text-blue-500" : "text-muted-foreground")} />
                          ) : (
                            <Terminal className={cn("h-5 w-5", agent.status === 'active' ? "text-orange-500" : "text-muted-foreground")} />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-base">{agent.name}</CardTitle>
                          <CardDescription className="text-xs">{agent.hostname || agent.ip_address || 'N/A'}</CardDescription>
                        </div>
                      </div>
                      {getStatusBadge(agent.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">IP Address</p>
                        <p className="font-mono text-xs">{agent.ip_address || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">OS</p>
                        <p className="text-xs">{agent.os_type ? `${agent.os_type} ${agent.os_version || ''}`.trim() : '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Agent Version</p>
                        <p className="text-xs font-mono">{agent.agent_version || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Last Heartbeat</p>
                        <p className="text-xs">
                          {agent.last_heartbeat
                            ? formatDistanceToNow(new Date(agent.last_heartbeat), { addSuffix: true })
                            : 'Never'}
                        </p>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">
                          Logs Today: <span className="font-medium text-foreground">{(agent.logs_received_today || 0).toLocaleString()}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Total: <span className="font-medium text-foreground">{(agent.logs_received_total || 0).toLocaleString()}</span>
                        </span>
                      </div>
                      {agent.log_types?.length > 0 && (
                        <div className="flex gap-1">
                          {agent.log_types.slice(0, 3).map(t => (
                            <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ TAB: Actions & Rollback ═══ */}
        <TabsContent value="actions">
          <SOARActionsDashboard />
        </TabsContent>

        {/* ═══ TAB: Downloads ═══ */}
        <TabsContent value="downloads" className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-1">Agent Downloads</h3>
            <p className="text-sm text-muted-foreground">Download, deploy, and configure SOCMind security agents on your endpoints.</p>
          </div>

          {/* Agent Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {AGENT_DOWNLOADS.map((agent) => {
              const Icon = agent.icon;
              return (
                <Card key={agent.name} className="hover:border-primary/50 transition-all flex flex-col">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn("p-2.5 rounded-lg", agent.bg)}>
                        <Icon className={cn("h-6 w-6", agent.color)} />
                      </div>
                      <Badge variant="outline" className="text-[10px]">{agent.version}</Badge>
                    </div>
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                    <CardDescription className="text-xs">{agent.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    {/* Features */}
                    <div className="space-y-1">
                      {agent.features.map(f => (
                        <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Check className="h-3 w-3 text-green-500 shrink-0" />
                          {f}
                        </div>
                      ))}
                    </div>
                    <Separator />
                    {/* Download Buttons */}
                    <div className="space-y-2">
                      {agent.files.map(f => (
                        <Button
                          key={f.file}
                          variant="outline"
                          size="sm"
                          className="w-full justify-between text-xs"
                          onClick={() => handleDownload(f.file, f.file.split('/').pop() || '')}
                        >
                          <span className="flex items-center gap-2">
                            <Download className="h-3 w-3" />
                            {f.label}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">{f.type}</Badge>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Vendor Plugins */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Vendor Plugins
              </CardTitle>
              <CardDescription className="text-xs">
                Network device integrations for the Universal Agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {VENDOR_PLUGINS.map(p => (
                  <Button
                    key={p.name}
                    variant="outline"
                    size="sm"
                    className="justify-between text-xs h-auto py-2"
                    onClick={() => handleDownload(p.file, p.file.split('/').pop() || '')}
                  >
                    <div className="text-left">
                      <span className="font-medium">{p.name}</span>
                      <p className="text-muted-foreground text-[10px]">{p.desc}</p>
                    </div>
                    <Download className="h-3 w-3 shrink-0 ml-2" />
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Setup Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Setup Guide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3 items-start">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">1</div>
                <div>
                  <p className="text-sm font-medium">Register Agent</p>
                  <p className="text-xs text-muted-foreground">Go to Data Sources → Add Data Source → Register a new agent to get an API Key.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">2</div>
                <div>
                  <p className="text-sm font-medium">Download & Configure</p>
                  <p className="text-xs text-muted-foreground">Download the agent, edit <code className="bg-muted px-1 rounded">config.yaml</code> with your API endpoint and key.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">3</div>
                <div>
                  <p className="text-sm font-medium">Deploy & Run</p>
                  <div className="mt-1 bg-muted/50 rounded-lg p-2 border border-border">
                    <code className="text-xs font-mono text-foreground">
                      pip install -r requirements.txt && python3 agent.py run
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 ml-2"
                      onClick={() => copyText('pip install -r requirements.txt && python3 agent.py run', 'cmd')}
                    >
                      {copied === 'cmd' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: Modules & Config ═══ */}
        <TabsContent value="config" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">Agent Modules</h3>
            <p className="text-sm text-muted-foreground">
              Overview of all agent capabilities. Module configuration is managed via each agent's local <code className="bg-muted px-1 rounded text-xs">config.yaml</code>.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {MODULE_INFO.map(mod => {
              const Icon = mod.icon;
              return (
                <Card key={mod.key} className="hover:border-primary/50 transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-secondary/50">
                          <Icon className={cn("h-5 w-5", mod.color)} />
                        </div>
                        <div>
                          <CardTitle className="text-sm">{mod.name}</CardTitle>
                        </div>
                      </div>
                      <Badge variant="outline" className="gap-1 text-green-500 border-green-500/30 bg-green-500/10 text-[10px]">
                        <Check className="h-3 w-3" />
                        Available
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">{mod.description}</p>
                    <Separator />
                    <div>
                      <p className="text-xs font-medium mb-2">Config Keys:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {mod.configKeys.map(key => (
                          <Badge key={key} variant="secondary" className="text-[10px] font-mono">{key}</Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Agent Architecture */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agent Architecture — v4.0.0</CardTitle>
              <CardDescription className="text-xs">Complete module overview of the SOCMind Universal Agent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-lg border border-border p-4 font-mono text-xs space-y-2 overflow-x-auto">
                <pre className="text-muted-foreground">{`socmind-agent/
├── agent.py                  # Main entry point (configure | run | status | rollback)
├── config.yaml               # All module settings
├── requirements.txt
│
├── core/
│   ├── collector.py           # Log collection & event classification
│   ├── executor.py            # SOAR action execution with approval checks
│   ├── heartbeat.py           # Platform connectivity heartbeat
│   ├── playbook_engine.py     # Local YAML-based playbook runner
│   ├── approval_client.py     # Human-in-the-loop approval polling
│   ├── audit_logger.py        # Local + remote audit trail
│   ├── threat_detector.py     # 🛡️ Real-time threat detection
│   ├── network_monitor.py     # 📡 Network traffic analysis
│   ├── file_integrity_monitor.py  # 📁 FIM (SHA256)
│   └── recovery_manager.py    # 🔄 Offline queue & auto-rollback
│
├── actions/                   # Pluggable action handlers
│   ├── block_ip.py            # With self-protection
│   ├── unblock_ip.py
│   ├── isolate_host.py        # Smart isolation (keeps mgmt channel)
│   ├── unisolate_host.py      # Stateful rollback
│   ├── kill_process.py
│   ├── lock_user.py
│   ├── delete_file.py
│   └── notify_user.py
│
├── vendors/                   # Network device integrations
│   ├── fortinet.py
│   ├── paloalto.py
│   ├── cisco.py
│   └── syslog.py
│
├── playbooks/                 # Local YAML playbooks
│   ├── brute_force.yaml
│   ├── malware_c2.yaml
│   └── suspicious_login.yaml
│
└── utils/
    ├── permissions.py
    └── signer.py`}</pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* OTP Verification Dialog */}
      <Dialog open={downloadPwdDialog} onOpenChange={setDownloadPwdDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Agent Download — Verification
            </DialogTitle>
            <DialogDescription>
              A 6-digit verification code was sent to the platform owner's email. Enter it below to authorize the download.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Verification code</Label>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={downloadPwd}
              onChange={(e) => setDownloadPwd(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && confirmDownload()}
              placeholder="000000"
              className="tracking-[0.5em] text-center text-lg font-mono"
            />
            <button
              type="button"
              onClick={resendCode}
              disabled={isSendingCode}
              className="text-xs text-primary hover:underline disabled:opacity-50"
            >
              {isSendingCode ? 'Sending…' : codeSent ? 'Resend code' : 'Send code'}
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDownloadPwdDialog(false)}>Cancel</Button>
            <Button onClick={confirmDownload} disabled={isVerifying || downloadPwd.length !== 6} className="gap-2">
              <Download className="h-4 w-4" />
              {isVerifying ? 'Verifying…' : 'Download'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
