import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Key, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  Calendar, 
  Building2, 
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/backend/client';
import { format, differenceInDays } from 'date-fns';

interface License {
  id: string;
  license_key: string;
  data_source_id: string | null;
  organization_name: string | null;
  license_type: string;
  max_agents: number;
  active_agents: number;
  issued_at: string;
  expires_at: string;
  is_active: boolean;
  last_validated: string | null;
  created_at: string;
}

interface LicenseManagementProps {
  dataSourceId?: string;
  dataSourceName?: string;
}

export function LicenseManagement({ dataSourceId, dataSourceName }: LicenseManagementProps) {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newLicenseKey, setNewLicenseKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [formData, setFormData] = useState({
    organization_name: '',
    license_type: 'standard',
    max_agents: 1,
    expires_value: 365,
    expires_unit: 'days' as 'days' | 'hours',
  });

  // Fetch licenses
  const { data: licenses, isLoading } = useQuery({
    queryKey: ['agent-licenses', dataSourceId],
    queryFn: async () => {
      let query = supabase
        .from('agent_licenses')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (dataSourceId) {
        query = query.eq('data_source_id', dataSourceId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as License[];
    },
  });

  // Generate new license
  const generateMutation = useMutation({
    mutationFn: async () => {
      const expiresDays = formData.expires_unit === 'days' ? formData.expires_value : null;
      const expiresHours = formData.expires_unit === 'hours' ? formData.expires_value : null;

      const { data, error } = await supabase.rpc('generate_agent_license', {
        _data_source_id: dataSourceId || null,
        _organization_name: formData.organization_name || 'Unknown Organization',
        _license_type: formData.license_type,
        _max_agents: formData.max_agents,
        _expires_days: expiresDays,
        _expires_hours: expiresHours,
      });
      
      if (error) throw error;
      return data[0];
    },
    onSuccess: (result) => {
      setNewLicenseKey(result.license_key);
      setCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['agent-licenses'], exact: false });
      queryClient.refetchQueries({ queryKey: ['agent-licenses'], exact: false });
      toast.success('License generated successfully');
    },
    onError: (error) => {
      toast.error('Failed to generate license: ' + (error as Error).message);
    },
  });

  // Revoke license
  const revokeMutation = useMutation({
    mutationFn: async (licenseId: string) => {
      const { error } = await supabase
        .from('agent_licenses')
        .update({ is_active: false })
        .eq('id', licenseId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-licenses'], exact: false });
      queryClient.refetchQueries({ queryKey: ['agent-licenses'], exact: false });
      toast.success('License revoked');
    },
    onError: (error) => {
      toast.error('Failed to revoke license: ' + (error as Error).message);
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLicenseStatus = (license: License) => {
    if (!license.is_active) {
      return { status: 'revoked', color: 'bg-gray-500', icon: <XCircle className="h-3 w-3" /> };
    }
    
    const daysRemaining = differenceInDays(new Date(license.expires_at), new Date());
    
    if (daysRemaining < 0) {
      return { status: 'expired', color: 'bg-red-500', icon: <XCircle className="h-3 w-3" /> };
    }
    if (daysRemaining <= 30) {
      return { status: 'expiring', color: 'bg-yellow-500', icon: <AlertTriangle className="h-3 w-3" /> };
    }
    return { status: 'active', color: 'bg-green-500', icon: <CheckCircle2 className="h-3 w-3" /> };
  };

  const getLicenseTypeColor = (type: string) => {
    switch (type) {
      case 'enterprise': return 'bg-purple-500';
      case 'unlimited': return 'bg-gradient-to-r from-amber-500 to-orange-500';
      case 'trial': return 'bg-blue-500';
      default: return 'bg-primary';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            License Management
          </h3>
          <p className="text-sm text-muted-foreground">
            {dataSourceName ? `Licenses for ${dataSourceName}` : 'Manage agent licenses'}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Generate License
        </Button>
      </div>

      {/* Licenses Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>License Key</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Agents</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <div className="h-8 bg-muted/50 animate-pulse rounded" />
                    </TableCell>
                  </TableRow>
                ))
              ) : licenses?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Key className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No licenses found</p>
                  </TableCell>
                </TableRow>
              ) : (
                licenses?.map((license) => {
                  const { status, color, icon } = getLicenseStatus(license);
                  const daysRemaining = differenceInDays(new Date(license.expires_at), new Date());
                  
                  return (
                    <TableRow key={license.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {license.license_key.slice(0, 9)}...
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(license.license_key)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{license.organization_name || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`${getLicenseTypeColor(license.license_type)} bg-opacity-20 border-0 text-white capitalize`}
                        >
                          {license.license_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {license.active_agents} / {license.max_agents === 999999 ? '∞' : license.max_agents}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                      {daysRemaining <= 1
                        ? format(new Date(license.expires_at), 'MMM dd, yyyy HH:mm')
                        : format(new Date(license.expires_at), 'MMM dd, yyyy')}
                          </span>
                          {daysRemaining > 0 && daysRemaining <= 30 && (
                            <span className="text-xs text-yellow-500">({daysRemaining}d left)</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`${color} bg-opacity-20 border-0 text-white capitalize`}
                        >
                          <span className="flex items-center gap-1">
                            {icon}
                            {status}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {license.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm('Are you sure you want to revoke this license?')) {
                                revokeMutation.mutate(license.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create License Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Generate New License
            </DialogTitle>
            <DialogDescription>
              Create a new license key for agent activation
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="org_name">Organization Name</Label>
              <Input
                id="org_name"
                value={formData.organization_name}
                onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                placeholder="Enter organization name"
              />
            </div>
            
            <div className="space-y-2">
              <Label>License Type</Label>
              <Select 
                value={formData.license_type} 
                onValueChange={(value) => setFormData({ ...formData, license_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial (14 days)</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="unlimited">Unlimited</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_agents">Max Agents</Label>
                <Input
                  id="max_agents"
                  type="number"
                  min={1}
                  value={formData.max_agents}
                  onChange={(e) => setFormData({ ...formData, max_agents: parseInt(e.target.value) || 1 })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Expires In</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    id="expires_value"
                    type="number"
                    min={1}
                    value={formData.expires_value}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        expires_value: parseInt(e.target.value) || 1,
                      })
                    }
                    className="col-span-2"
                  />
                  <Select
                    value={formData.expires_unit}
                    onValueChange={(value) => setFormData({ ...formData, expires_unit: value as 'days' | 'hours' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tip: set Hours = 1 for a 1-hour license.
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? 'Generating...' : 'Generate License'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New License Key Dialog */}
      <Dialog open={!!newLicenseKey} onOpenChange={() => setNewLicenseKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              License Generated Successfully
            </DialogTitle>
            <DialogDescription>
              Copy this license key - it will only be shown once
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-muted p-4 rounded-lg border border-border">
              <div className="flex items-center justify-between gap-2">
                <code className="text-lg font-mono font-bold text-primary">
                  {newLicenseKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(newLicenseKey || '')}
                  className="gap-2"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-500 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Store this license key securely. Add it to your agent.conf file under 'license_key'.</span>
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setNewLicenseKey(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
