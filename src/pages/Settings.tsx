import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Key, Bell, Users, Webhook, Shield } from 'lucide-react';

export default function Settings() {
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
                  <Input id="fortisiem" type="password" placeholder="Enter API key" className="bg-secondary/50" />
                  <Button variant="outline">Validate</Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="virustotal">VirusTotal API Key</Label>
                <div className="flex gap-2">
                  <Input id="virustotal" type="password" placeholder="Enter API key" className="bg-secondary/50" />
                  <Button variant="outline">Validate</Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openai">OpenAI API Key</Label>
                <div className="flex gap-2">
                  <Input id="openai" type="password" placeholder="Enter API key" className="bg-secondary/50" />
                  <Button variant="outline">Validate</Button>
                </div>
              </div>
            </div>

            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
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
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-medium text-foreground">Slack Integration</p>
                  <p className="text-sm text-muted-foreground">Send alerts to Slack channel</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-medium text-foreground">Email Digest</p>
                  <p className="text-sm text-muted-foreground">Daily summary of incidents</p>
                </div>
                <Switch />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slack-webhook">Slack Webhook URL</Label>
                <Input id="slack-webhook" placeholder="https://hooks.slack.com/..." className="bg-secondary/50" />
              </div>
            </div>

            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
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
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Add User
              </Button>
            </div>

            <div className="space-y-3">
              {[
                { email: 'admin@company.com', role: 'Admin', status: 'Active' },
                { email: 'analyst@company.com', role: 'SOC Analyst', status: 'Active' },
                { email: 'senior.analyst@company.com', role: 'SOC Analyst', status: 'Active' },
                { email: 'viewer@company.com', role: 'Viewer', status: 'Pending' },
              ].map((user, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">
                      {user.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{user.email}</p>
                      <p className="text-sm text-muted-foreground">{user.role}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    user.status === 'Active' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
                  }`}>
                    {user.status}
                  </div>
                </div>
              ))}
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
              {[
                { name: 'FortiGate Firewall', status: 'Connected', icon: Shield },
                { name: 'CrowdStrike EDR', status: 'Not Connected', icon: Shield },
                { name: 'Azure AD', status: 'Connected', icon: Users },
                { name: 'ServiceNow', status: 'Not Connected', icon: Webhook },
              ].map((integration, idx) => (
                <div key={idx} className="p-4 rounded-lg border border-border bg-secondary/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <integration.icon className="h-5 w-5 text-primary" />
                      <span className="font-medium text-foreground">{integration.name}</span>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      integration.status === 'Connected' ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                    }`}>
                      {integration.status}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    {integration.status === 'Connected' ? 'Configure' : 'Connect'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
