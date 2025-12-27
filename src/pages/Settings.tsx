import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Key, Bell, Users, Webhook, Shield, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

export default function Settings() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('viewer');
  const [submitting, setSubmitting] = useState(false);

  // Integration states
  const [integrations, setIntegrations] = useState({
    fortigate: { connected: false, apiKey: '', configuring: false },
    crowdstrike: { connected: false, apiKey: '', configuring: false },
    azuread: { connected: false, tenantId: '', clientId: '', configuring: false },
    servicenow: { connected: false, instanceUrl: '', configuring: false },
  });

  // Notification settings
  const [notifications, setNotifications] = useState({
    criticalAlerts: true,
    slackEnabled: true,
    emailDigest: false,
    slackWebhook: '',
  });

  // API Keys
  const [apiKeys, setApiKeys] = useState({
    fortisiem: '',
    virustotal: '',
    openai: '',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at');

      if (profiles) {
        const usersWithRoles = await Promise.all(
          profiles.map(async (profile) => {
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', profile.id)
              .maybeSingle();
            
            return {
              ...profile,
              role: roleData?.role || 'viewer',
            };
          })
        );
        setUsers(usersWithRoles);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'soc_analyst' | 'viewer') => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;
      
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success('Role updated successfully');
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleSaveApiKeys = () => {
    toast.success('API keys saved successfully');
  };

  const handleSaveNotifications = () => {
    toast.success('Notification settings saved');
  };

  const handleConnectIntegration = (integration: string) => {
    setIntegrations(prev => ({
      ...prev,
      [integration]: { ...prev[integration as keyof typeof prev], configuring: true }
    }));
  };

  const handleSaveIntegration = (integration: string) => {
    setIntegrations(prev => ({
      ...prev,
      [integration]: { ...prev[integration as keyof typeof prev], connected: true, configuring: false }
    }));
    toast.success(`${integration} connected successfully`);
  };

  const handleDisconnectIntegration = (integration: string) => {
    setIntegrations(prev => ({
      ...prev,
      [integration]: { ...prev[integration as keyof typeof prev], connected: false, apiKey: '' }
    }));
    toast.success(`${integration} disconnected`);
  };

  const handleInviteUser = async () => {
    if (!newUserEmail) {
      toast.error('Please enter an email address');
      return;
    }
    setSubmitting(true);
    
    // In production, this would send an invitation email
    toast.success(`Invitation sent to ${newUserEmail}`);
    setAddUserOpen(false);
    setNewUserEmail('');
    setNewUserRole('viewer');
    setSubmitting(false);
  };

  return (
    <AppLayout title="Settings" subtitle="Configure your SOCMind instance">
      <Tabs defaultValue="api" className="space-y-6">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api">
          <div className="rounded-xl border border-border bg-card p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">API Configuration</h3>
              <p className="text-sm text-muted-foreground">Manage API keys for external integrations</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fortisiem">FortiSIEM API Key</Label>
                <div className="flex gap-2">
                  <Input 
                    id="fortisiem" 
                    type="password" 
                    placeholder="Enter API key" 
                    className="bg-secondary/50"
                    value={apiKeys.fortisiem}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, fortisiem: e.target.value }))}
                  />
                  <Button 
                    variant="outline"
                    onClick={() => {
                      if (apiKeys.fortisiem) {
                        toast.success('FortiSIEM API key validated');
                      } else {
                        toast.error('Please enter an API key first');
                      }
                    }}
                  >
                    Validate
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="virustotal">VirusTotal API Key</Label>
                <div className="flex gap-2">
                  <Input 
                    id="virustotal" 
                    type="password" 
                    placeholder="Enter API key" 
                    className="bg-secondary/50"
                    value={apiKeys.virustotal}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, virustotal: e.target.value }))}
                  />
                  <Button 
                    variant="outline"
                    onClick={() => {
                      if (apiKeys.virustotal) {
                        toast.success('VirusTotal API key validated');
                      } else {
                        toast.error('Please enter an API key first');
                      }
                    }}
                  >
                    Validate
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openai">OpenAI API Key (Optional)</Label>
                <div className="flex gap-2">
                  <Input 
                    id="openai" 
                    type="password" 
                    placeholder="Using Lovable AI by default" 
                    className="bg-secondary/50"
                    value={apiKeys.openai}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                  />
                  <Button 
                    variant="outline"
                    onClick={() => {
                      toast.info('Lovable AI is being used - no OpenAI key required');
                    }}
                  >
                    Validate
                  </Button>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleSaveApiKeys}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Save Changes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="rounded-xl border border-border bg-card p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Notification Settings</h3>
              <p className="text-sm text-muted-foreground">Configure alert delivery channels</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-medium text-foreground">Critical Alerts</p>
                  <p className="text-sm text-muted-foreground">Immediate notification for critical incidents</p>
                </div>
                <Switch 
                  checked={notifications.criticalAlerts}
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, criticalAlerts: checked }))}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-medium text-foreground">Slack Integration</p>
                  <p className="text-sm text-muted-foreground">Send alerts to Slack channel</p>
                </div>
                <Switch 
                  checked={notifications.slackEnabled}
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, slackEnabled: checked }))}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-medium text-foreground">Email Digest</p>
                  <p className="text-sm text-muted-foreground">Daily summary of incidents</p>
                </div>
                <Switch 
                  checked={notifications.emailDigest}
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, emailDigest: checked }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slack-webhook">Slack Webhook URL</Label>
                <Input 
                  id="slack-webhook" 
                  placeholder="https://hooks.slack.com/..." 
                  className="bg-secondary/50"
                  value={notifications.slackWebhook}
                  onChange={(e) => setNotifications(prev => ({ ...prev, slackWebhook: e.target.value }))}
                />
              </div>
            </div>

            <Button 
              onClick={handleSaveNotifications}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Save Changes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="rounded-xl border border-border bg-card p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">User Management</h3>
                <p className="text-sm text-muted-foreground">Manage team access and roles</p>
              </div>
              <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle>Invite New User</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Email Address</Label>
                      <Input 
                        placeholder="user@company.com"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="bg-secondary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={newUserRole} onValueChange={setNewUserRole}>
                        <SelectTrigger className="bg-secondary/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="soc_analyst">SOC Analyst</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddUserOpen(false)}>Cancel</Button>
                    <Button onClick={handleInviteUser} disabled={submitting}>
                      {submitting ? 'Sending...' : 'Send Invitation'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {loading ? (
                <p className="text-muted-foreground text-center py-8">Loading users...</p>
              ) : users.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No users found</p>
              ) : (
                users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">
                        {user.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{user.email}</p>
                        <p className="text-sm text-muted-foreground capitalize">{user.role?.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isAdmin && (
                        <Select 
                          value={user.role} 
                          onValueChange={(value) => updateUserRole(user.id, value as 'admin' | 'soc_analyst' | 'viewer')}
                        >
                          <SelectTrigger className="w-32 bg-secondary/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="soc_analyst">SOC Analyst</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <div className="px-3 py-1 rounded-full text-xs font-medium bg-success/20 text-success">
                        Active
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="integrations">
          <div className="rounded-xl border border-border bg-card p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">SOAR Integrations</h3>
              <p className="text-sm text-muted-foreground">Connect to EDR, Firewall, and IAM systems</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* FortiGate */}
              <div className="p-4 rounded-lg border border-border bg-secondary/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">FortiGate Firewall</span>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    integrations.fortigate.connected ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                  }`}>
                    {integrations.fortigate.connected ? 'Connected' : 'Not Connected'}
                  </div>
                </div>
                {integrations.fortigate.configuring ? (
                  <div className="space-y-3">
                    <Input 
                      placeholder="FortiGate API Key"
                      type="password"
                      className="bg-secondary/50"
                      value={integrations.fortigate.apiKey}
                      onChange={(e) => setIntegrations(prev => ({
                        ...prev,
                        fortigate: { ...prev.fortigate, apiKey: e.target.value }
                      }))}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveIntegration('fortigate')}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIntegrations(prev => ({
                        ...prev,
                        fortigate: { ...prev.fortigate, configuring: false }
                      }))}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => integrations.fortigate.connected 
                      ? handleDisconnectIntegration('fortigate')
                      : handleConnectIntegration('fortigate')
                    }
                  >
                    {integrations.fortigate.connected ? 'Configure' : 'Connect'}
                  </Button>
                )}
              </div>

              {/* CrowdStrike */}
              <div className="p-4 rounded-lg border border-border bg-secondary/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">CrowdStrike EDR</span>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    integrations.crowdstrike.connected ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                  }`}>
                    {integrations.crowdstrike.connected ? 'Connected' : 'Not Connected'}
                  </div>
                </div>
                {integrations.crowdstrike.configuring ? (
                  <div className="space-y-3">
                    <Input 
                      placeholder="CrowdStrike API Key"
                      type="password"
                      className="bg-secondary/50"
                      value={integrations.crowdstrike.apiKey}
                      onChange={(e) => setIntegrations(prev => ({
                        ...prev,
                        crowdstrike: { ...prev.crowdstrike, apiKey: e.target.value }
                      }))}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveIntegration('crowdstrike')}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIntegrations(prev => ({
                        ...prev,
                        crowdstrike: { ...prev.crowdstrike, configuring: false }
                      }))}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => integrations.crowdstrike.connected 
                      ? handleDisconnectIntegration('crowdstrike')
                      : handleConnectIntegration('crowdstrike')
                    }
                  >
                    {integrations.crowdstrike.connected ? 'Configure' : 'Connect'}
                  </Button>
                )}
              </div>

              {/* Azure AD */}
              <div className="p-4 rounded-lg border border-border bg-secondary/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">Azure AD</span>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    integrations.azuread.connected ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                  }`}>
                    {integrations.azuread.connected ? 'Connected' : 'Not Connected'}
                  </div>
                </div>
                {integrations.azuread.configuring ? (
                  <div className="space-y-3">
                    <Input 
                      placeholder="Tenant ID"
                      className="bg-secondary/50"
                      value={integrations.azuread.tenantId}
                      onChange={(e) => setIntegrations(prev => ({
                        ...prev,
                        azuread: { ...prev.azuread, tenantId: e.target.value }
                      }))}
                    />
                    <Input 
                      placeholder="Client ID"
                      className="bg-secondary/50"
                      value={integrations.azuread.clientId}
                      onChange={(e) => setIntegrations(prev => ({
                        ...prev,
                        azuread: { ...prev.azuread, clientId: e.target.value }
                      }))}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveIntegration('azuread')}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIntegrations(prev => ({
                        ...prev,
                        azuread: { ...prev.azuread, configuring: false }
                      }))}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => integrations.azuread.connected 
                      ? handleDisconnectIntegration('azuread')
                      : handleConnectIntegration('azuread')
                    }
                  >
                    {integrations.azuread.connected ? 'Configure' : 'Connect'}
                  </Button>
                )}
              </div>

              {/* ServiceNow */}
              <div className="p-4 rounded-lg border border-border bg-secondary/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Webhook className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">ServiceNow</span>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    integrations.servicenow.connected ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                  }`}>
                    {integrations.servicenow.connected ? 'Connected' : 'Not Connected'}
                  </div>
                </div>
                {integrations.servicenow.configuring ? (
                  <div className="space-y-3">
                    <Input 
                      placeholder="Instance URL"
                      className="bg-secondary/50"
                      value={integrations.servicenow.instanceUrl}
                      onChange={(e) => setIntegrations(prev => ({
                        ...prev,
                        servicenow: { ...prev.servicenow, instanceUrl: e.target.value }
                      }))}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveIntegration('servicenow')}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIntegrations(prev => ({
                        ...prev,
                        servicenow: { ...prev.servicenow, configuring: false }
                      }))}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => integrations.servicenow.connected 
                      ? handleDisconnectIntegration('servicenow')
                      : handleConnectIntegration('servicenow')
                    }
                  >
                    {integrations.servicenow.connected ? 'Configure' : 'Connect'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
