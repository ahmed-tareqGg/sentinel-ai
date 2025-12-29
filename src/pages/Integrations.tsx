import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { 
  MessageSquare, 
  Shield, 
  Ticket, 
  AlertTriangle, 
  Server,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Settings,
  Loader2,
  Zap,
  Eye,
  Bot,
  Brain,
  Rocket,
  ShieldAlert
} from 'lucide-react';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Integration {
  id: string;
  name: string;
  display_name: string;
  type: string;
  is_enabled: boolean;
  is_configured: boolean;
  config: any;
  last_successful_call: string | null;
  last_error: string | null;
  execution_mode: string;
  created_at: string;
  updated_at: string;
}

const INTEGRATION_ICONS: Record<string, typeof MessageSquare> = {
  slack: MessageSquare,
  virustotal: Shield,
  jira: Ticket,
  servicenow: Ticket,
  pagerduty: AlertTriangle,
  fortisiem: Server,
  crowdstrike: Shield,
  sentinelone: Shield,
};

const TYPE_COLORS: Record<string, string> = {
  notification: 'bg-blue-500/10 text-blue-500',
  threat_intel: 'bg-purple-500/10 text-purple-500',
  ticketing: 'bg-green-500/10 text-green-500',
  siem: 'bg-orange-500/10 text-orange-500',
  edr: 'bg-red-500/10 text-red-500',
};

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<Integration | null>(null);
  const [autonomousMode, setAutonomousMode] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(75);
  const [savingAutonomous, setSavingAutonomous] = useState(false);
  const [jiraConfig, setJiraConfig] = useState({
    base_url: '',
    project_key: '',
    api_token: '',
    email: '',
  });

  useEffect(() => {
    fetchIntegrations();
    loadAutonomousSettings();
  }, []);

  const loadAutonomousSettings = async () => {
    try {
      const { data } = await supabase
        .from('integrations')
        .select('autonomous_mode_enabled, auto_execution_threshold')
        .eq('name', 'autonomous_soc')
        .single();
      
      if (data) {
        setAutonomousMode(data.autonomous_mode_enabled || false);
        setConfidenceThreshold(data.auto_execution_threshold || 75);
      }
    } catch (error) {
      console.error('Error loading autonomous settings:', error);
    }
  };

  const saveAutonomousSettings = async () => {
    setSavingAutonomous(true);
    try {
      // Check if autonomous_soc integration exists
      const { data: existing } = await supabase
        .from('integrations')
        .select('id')
        .eq('name', 'autonomous_soc')
        .single();

      if (existing) {
        await supabase
          .from('integrations')
          .update({
            autonomous_mode_enabled: autonomousMode,
            auto_execution_threshold: confidenceThreshold,
            is_enabled: autonomousMode,
            execution_mode: autonomousMode ? 'real' : 'disabled',
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('integrations')
          .insert({
            name: 'autonomous_soc',
            display_name: 'Autonomous SOC',
            type: 'automation',
            is_enabled: autonomousMode,
            is_configured: true,
            autonomous_mode_enabled: autonomousMode,
            auto_execution_threshold: confidenceThreshold,
            execution_mode: autonomousMode ? 'real' : 'disabled',
          });
      }

      toast.success(`Autonomous SOC ${autonomousMode ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error saving autonomous settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSavingAutonomous(false);
    }
  };

  const fetchIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .order('type', { ascending: true });

      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      toast.error('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  const toggleIntegration = async (integration: Integration) => {
    try {
      const newEnabled = !integration.is_enabled;
      const newMode = newEnabled 
        ? (integration.is_configured ? 'real' : 'simulated') 
        : 'disabled';

      const { error } = await supabase
        .from('integrations')
        .update({ 
          is_enabled: newEnabled,
          execution_mode: newMode 
        })
        .eq('id', integration.id);

      if (error) throw error;

      toast.success(`${integration.display_name} ${newEnabled ? 'enabled' : 'disabled'}`);
      fetchIntegrations();
    } catch (error) {
      console.error('Error toggling integration:', error);
      toast.error('Failed to update integration');
    }
  };

  const testIntegration = async (integration: Integration) => {
    setTesting(integration.id);
    
    // Simulate test call
    await new Promise(r => setTimeout(r, 2000));

    try {
      const success = integration.is_configured;
      
      await supabase
        .from('integrations')
        .update({ 
          last_successful_call: success ? new Date().toISOString() : integration.last_successful_call,
          last_error: success ? null : 'Test failed: Not configured'
        })
        .eq('id', integration.id);

      if (success) {
        toast.success(`${integration.display_name} test successful`);
      } else {
        toast.error(`${integration.display_name} test failed: Not configured`);
      }
      
      fetchIntegrations();
    } catch (error) {
      console.error('Error testing integration:', error);
      toast.error('Test failed');
    } finally {
      setTesting(null);
    }
  };

  const saveJiraConfig = async () => {
    if (!configuring) return;

    try {
      const isConfigured = jiraConfig.base_url && jiraConfig.project_key && jiraConfig.api_token;
      
      const { error } = await supabase
        .from('integrations')
        .update({ 
          config: jiraConfig,
          is_configured: !!isConfigured,
          execution_mode: isConfigured ? 'real' : 'simulated'
        })
        .eq('id', configuring.id);

      if (error) throw error;

      toast.success('Jira configuration saved');
      setConfiguring(null);
      fetchIntegrations();
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    }
  };

  const getStatusBadge = (integration: Integration) => {
    if (!integration.is_enabled) {
      return <Badge variant="secondary">Disabled</Badge>;
    }
    if (integration.execution_mode === 'real' && integration.is_configured) {
      return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Real</Badge>;
    }
    return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Simulated</Badge>;
  };

  const groupedIntegrations = integrations.reduce((acc, int) => {
    if (!acc[int.type]) acc[int.type] = [];
    acc[int.type].push(int);
    return acc;
  }, {} as Record<string, Integration[]>);

  return (
    <AppLayout title="Integrations" subtitle="Manage external service connections and execution modes">
      <div className="space-y-6">
        {/* Autonomous SOC Mode Card */}
        <Card className={cn(
          "border-2 transition-all",
          autonomousMode 
            ? "border-primary bg-primary/5" 
            : "border-border"
        )}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-3 rounded-xl",
                  autonomousMode ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Autonomous SOC Mode
                    {autonomousMode && (
                      <Badge className="bg-primary text-primary-foreground animate-pulse">
                        ACTIVE
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    AI-driven automatic incident response - no human approval required
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={autonomousMode}
                onCheckedChange={setAutonomousMode}
                className="scale-125"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-background border">
                <Brain className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">AI Analysis</p>
                  <p className="text-xs text-muted-foreground">Auto-classify incidents</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-background border">
                <Rocket className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Auto Playbooks</p>
                  <p className="text-xs text-muted-foreground">Execute without approval</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-background border">
                <ShieldAlert className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Auto Escalation</p>
                  <p className="text-xs text-muted-foreground">Tier 1 → 2 → 3</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-background border">
                <Ticket className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Auto Tickets</p>
                  <p className="text-xs text-muted-foreground">Jira + PDF Reports</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Confidence Threshold for Auto-Execution</Label>
                <Badge variant="outline" className="font-mono">{confidenceThreshold}%</Badge>
              </div>
              <Slider
                value={[confidenceThreshold]}
                onValueChange={([value]) => setConfidenceThreshold(value)}
                min={50}
                max={95}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Playbooks will only auto-execute when AI confidence is above this threshold
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={saveAutonomousSettings} disabled={savingAutonomous}>
                {savingAutonomous ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save Autonomous Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {integrations.filter(i => i.execution_mode === 'real').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Real Mode</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Eye className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {integrations.filter(i => i.execution_mode === 'simulated').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Simulated</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">
                    {integrations.filter(i => i.execution_mode === 'disabled').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Disabled</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Zap className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{integrations.length}</p>
                  <p className="text-xs text-muted-foreground">Total Integrations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Integration List */}
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({integrations.length})</TabsTrigger>
            <TabsTrigger value="notification">Notification</TabsTrigger>
            <TabsTrigger value="ticketing">Ticketing</TabsTrigger>
            <TabsTrigger value="threat_intel">Threat Intel</TabsTrigger>
            <TabsTrigger value="edr">EDR</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {loading ? (
                [1, 2, 3, 4].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-5 w-1/3 bg-muted rounded" />
                    </CardHeader>
                  </Card>
                ))
              ) : (
                integrations.map(integration => {
                  const Icon = INTEGRATION_ICONS[integration.name] || Server;
                  return (
                    <Card key={integration.id} className={cn(
                      "transition-all",
                      !integration.is_enabled && "opacity-60"
                    )}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg", TYPE_COLORS[integration.type])}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{integration.display_name}</CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {integration.type}
                                </Badge>
                                {getStatusBadge(integration)}
                              </div>
                            </div>
                          </div>
                          <Switch
                            checked={integration.is_enabled}
                            onCheckedChange={() => toggleIntegration(integration)}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Configuration</span>
                          <Badge variant={integration.is_configured ? "default" : "secondary"}>
                            {integration.is_configured ? 'Configured' : 'Not Configured'}
                          </Badge>
                        </div>
                        
                        {integration.last_successful_call && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Last call: {new Date(integration.last_successful_call).toLocaleString()}
                          </div>
                        )}

                        {integration.last_error && (
                          <div className="text-xs text-destructive">
                            Error: {integration.last_error}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testIntegration(integration)}
                            disabled={testing === integration.id}
                            className="flex-1"
                          >
                            {testing === integration.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Test
                              </>
                            )}
                          </Button>
                          {(integration.name === 'jira' || integration.name === 'servicenow') && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setConfiguring(integration);
                                    setJiraConfig(integration.config as any || {
                                      base_url: '',
                                      project_key: '',
                                      api_token: '',
                                      email: '',
                                    });
                                  }}
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Configure {integration.display_name}</DialogTitle>
                                  <DialogDescription>
                                    Enter your {integration.display_name} credentials to enable real mode
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label>Base URL</Label>
                                    <Input
                                      placeholder="https://your-domain.atlassian.net"
                                      value={jiraConfig.base_url}
                                      onChange={(e) => setJiraConfig(prev => ({ ...prev, base_url: e.target.value }))}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Project Key</Label>
                                    <Input
                                      placeholder="SOC"
                                      value={jiraConfig.project_key}
                                      onChange={(e) => setJiraConfig(prev => ({ ...prev, project_key: e.target.value }))}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input
                                      placeholder="your-email@company.com"
                                      value={jiraConfig.email}
                                      onChange={(e) => setJiraConfig(prev => ({ ...prev, email: e.target.value }))}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>API Token</Label>
                                    <Input
                                      type="password"
                                      placeholder="Your Jira API token"
                                      value={jiraConfig.api_token}
                                      onChange={(e) => setJiraConfig(prev => ({ ...prev, api_token: e.target.value }))}
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button onClick={saveJiraConfig}>Save Configuration</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          {['notification', 'ticketing', 'threat_intel', 'edr'].map(type => (
            <TabsContent key={type} value={type} className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                {integrations.filter(i => i.type === type).map(integration => {
                  const Icon = INTEGRATION_ICONS[integration.name] || Server;
                  return (
                    <Card key={integration.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg", TYPE_COLORS[integration.type])}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{integration.display_name}</CardTitle>
                              {getStatusBadge(integration)}
                            </div>
                          </div>
                          <Switch
                            checked={integration.is_enabled}
                            onCheckedChange={() => toggleIntegration(integration)}
                          />
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Execution Mode Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Execution Mode Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-green-500">Real Mode</p>
                  <p className="text-xs text-muted-foreground">
                    Actions execute against real external APIs. Requires valid credentials.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10">
                <Eye className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-yellow-500">Simulated Mode</p>
                  <p className="text-xs text-muted-foreground">
                    Actions return mock responses. No external calls made. Safe for demos.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                <XCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Disabled</p>
                  <p className="text-xs text-muted-foreground">
                    Integration is turned off. Actions are skipped entirely.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
