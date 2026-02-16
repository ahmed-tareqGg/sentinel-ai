import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';
import { 
  Zap, 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Pause, 
  AlertTriangle, 
  Shield, 
  Bell, 
  Ban, 
  Server, 
  Users, 
  Ticket,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlaybookTemplates } from '@/components/playbooks/PlaybookTemplates';
import { SimulationMode } from '@/components/playbooks/SimulationMode';
import { CorrelationRulesEngine } from '@/components/correlation/CorrelationRulesEngine';
import { SOARActionsDashboard } from '@/components/playbooks/SOARActionsDashboard';
import { useIncidents } from '@/hooks/useIncidents';

interface PlaybookConditions {
  risk_level?: string;
  classification?: string;
  min_severity?: number;
  event_type?: string;
}

interface PlaybookAction {
  type: string;
  params?: Record<string, unknown>;
}

interface Playbook {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  conditions: PlaybookConditions;
  actions: PlaybookAction[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface PlaybookExecution {
  id: string;
  playbook_id: string;
  incident_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  results: any;
  ai_explanation?: string;
  decision_factors?: any;
  execution_mode?: string;
}

const ACTION_TYPES = [
  { value: 'notify_slack', label: 'Send Slack Notification', icon: Bell, color: 'text-blue-500' },
  { value: 'block_ip', label: 'Block IP Address', icon: Ban, color: 'text-destructive' },
  { value: 'isolate_host', label: 'Isolate Host', icon: Server, color: 'text-orange-500' },
  { value: 'disable_user', label: 'Disable User Account', icon: Users, color: 'text-purple-500' },
  { value: 'create_ticket', label: 'Create Support Ticket', icon: Ticket, color: 'text-green-500' },
  { value: 'escalate', label: 'Escalate to Team', icon: AlertTriangle, color: 'text-warning' },
];

const RISK_LEVELS = ['Critical', 'High', 'Medium', 'Low'];
const CLASSIFICATIONS = ['True Positive', 'False Positive', 'Pending'];

export default function Playbooks() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [executions, setExecutions] = useState<PlaybookExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<Playbook | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<PlaybookExecution | null>(null);
  const [executionIncident, setExecutionIncident] = useState<any>(null);
  const { incidents } = useIncidents();
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    conditions: {
      risk_level: '',
      classification: '',
      min_severity: 0,
      event_type: '',
    } as PlaybookConditions,
    actions: [] as PlaybookAction[],
  });

  useEffect(() => {
    fetchPlaybooks();
    fetchExecutions();
  }, []);

  const fetchPlaybooks = async () => {
    try {
      const { data, error } = await supabase
        .from('playbooks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Parse the conditions and actions from JSON
      const parsedPlaybooks = (data || []).map(p => ({
        ...p,
        conditions: typeof p.conditions === 'string' ? JSON.parse(p.conditions) : p.conditions || {},
        actions: typeof p.actions === 'string' ? JSON.parse(p.actions) : p.actions || [],
      }));
      
      setPlaybooks(parsedPlaybooks);
    } catch (error) {
      console.error('Error fetching playbooks:', error);
      toast.error('Failed to load playbooks');
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutions = async () => {
    try {
      const { data, error } = await supabase
        .from('playbook_executions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setExecutions(data || []);
    } catch (error) {
      console.error('Error fetching executions:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      is_active: true,
      conditions: {
        risk_level: '',
        classification: '',
        min_severity: 0,
        event_type: '',
      },
      actions: [],
    });
    setEditingPlaybook(null);
  };

  const handleCreateOrUpdate = async () => {
    if (!formData.name.trim()) {
      toast.error('Playbook name is required');
      return;
    }

    if (formData.actions.length === 0) {
      toast.error('At least one action is required');
      return;
    }

    // Clean up empty conditions
    const cleanConditions: PlaybookConditions = {};
    if (formData.conditions.risk_level) cleanConditions.risk_level = formData.conditions.risk_level;
    if (formData.conditions.classification) cleanConditions.classification = formData.conditions.classification;
    if (formData.conditions.min_severity && formData.conditions.min_severity > 0) cleanConditions.min_severity = formData.conditions.min_severity;
    if (formData.conditions.event_type) cleanConditions.event_type = formData.conditions.event_type;

    try {
      const playbookData = {
        name: formData.name,
        description: formData.description || null,
        is_active: formData.is_active,
        conditions: cleanConditions,
        actions: formData.actions,
      };

      if (editingPlaybook) {
        const { error } = await supabase
          .from('playbooks')
          .update(playbookData as any)
          .eq('id', editingPlaybook.id);

        if (error) throw error;
        toast.success('Playbook updated successfully');
      } else {
        const { error } = await supabase
          .from('playbooks')
          .insert(playbookData as any);

        if (error) throw error;
        toast.success('Playbook created successfully');
      }

      setIsCreateOpen(false);
      resetForm();
      fetchPlaybooks();
    } catch (error) {
      console.error('Error saving playbook:', error);
      toast.error('Failed to save playbook');
    }
  };

  const handleEdit = (playbook: Playbook) => {
    setEditingPlaybook(playbook);
    setFormData({
      name: playbook.name,
      description: playbook.description || '',
      is_active: playbook.is_active,
      conditions: playbook.conditions || {},
      actions: playbook.actions || [],
    });
    setIsCreateOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('playbooks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Playbook deleted successfully');
      fetchPlaybooks();
    } catch (error) {
      console.error('Error deleting playbook:', error);
      toast.error('Failed to delete playbook');
    }
  };

  const handleToggleActive = async (playbook: Playbook) => {
    try {
      const { error } = await supabase
        .from('playbooks')
        .update({ is_active: !playbook.is_active })
        .eq('id', playbook.id);

      if (error) throw error;
      toast.success(playbook.is_active ? 'Playbook deactivated' : 'Playbook activated');
      fetchPlaybooks();
    } catch (error) {
      console.error('Error toggling playbook:', error);
      toast.error('Failed to update playbook');
    }
  };

  const addAction = (actionType: string) => {
    const newAction: PlaybookAction = { type: actionType, params: {} };
    
    // Add default params based on action type
    switch (actionType) {
      case 'notify_slack':
        newAction.params = { message: '' };
        break;
      case 'escalate':
        newAction.params = { team: 'SOC Leadership' };
        break;
    }
    
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, newAction],
    }));
  };

  const removeAction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  };

  const updateActionParams = (index: number, key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.map((action, i) => 
        i === index 
          ? { ...action, params: { ...action.params, [key]: value } }
          : action
      ),
    }));
  };

  const getActionInfo = (type: string) => {
    return ACTION_TYPES.find(a => a.value === type) || { label: type, icon: Zap, color: 'text-muted-foreground' };
  };

  const handleViewExecution = async (execution: PlaybookExecution) => {
    setSelectedExecution(execution);
    // Fetch the incident details
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .eq('id', execution.incident_id)
        .single();
      
      if (!error && data) {
        setExecutionIncident(data);
      }
    } catch (e) {
      console.error('Error fetching incident:', e);
    }
  };

  const getExecutionDuration = (execution: PlaybookExecution) => {
    if (!execution.completed_at) return 'In progress...';
    const start = new Date(execution.started_at).getTime();
    const end = new Date(execution.completed_at).getTime();
    const duration = end - start;
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  };

  return (
    <AppLayout title="Playbooks" subtitle="Configure automated SOAR response playbooks">
      <div className="space-y-6">
        {/* Correlation Rules Engine */}
        <CorrelationRulesEngine />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Playbooks</h1>
            <p className="text-muted-foreground">Configure automated SOAR response playbooks</p>
          </div>
          <div className="flex gap-2">
            <PlaybookTemplates onTemplateApplied={fetchPlaybooks} />
            <SimulationMode 
              playbooks={playbooks} 
              incidents={incidents.map(i => ({
                id: i.id,
                incident_number: i.incident_number,
                event_type: i.event_type,
                severity: i.severity,
                risk_level: i.risk_level,
                classification: i.classification,
                src_ip: i.src_ip,
                message: i.message,
              }))} 
            />
            <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Playbook
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPlaybook ? 'Edit Playbook' : 'Create New Playbook'}</DialogTitle>
                <DialogDescription>
                  Configure trigger conditions and automated response actions
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Playbook Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Critical Incident Response"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe what this playbook does..."
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Active Status</Label>
                      <p className="text-sm text-muted-foreground">Enable or disable this playbook</p>
                    </div>
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                    />
                  </div>
                </div>

                {/* Trigger Conditions */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-1">Trigger Conditions</h4>
                    <p className="text-xs text-muted-foreground">Define when this playbook should execute</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Risk Level</Label>
                      <Select
                        value={formData.conditions.risk_level || 'any'}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          conditions: { ...prev.conditions, risk_level: value === 'any' ? '' : value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Any risk level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          {RISK_LEVELS.map(level => (
                            <SelectItem key={level} value={level}>{level}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Classification</Label>
                      <Select
                        value={formData.conditions.classification || 'any'}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          conditions: { ...prev.conditions, classification: value === 'any' ? '' : value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Any classification" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          {CLASSIFICATIONS.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Minimum Severity</Label>
                      <Select
                        value={String(formData.conditions.min_severity || 0)}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          conditions: { ...prev.conditions, min_severity: parseInt(value) }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Any severity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Any</SelectItem>
                          <SelectItem value="1">1+</SelectItem>
                          <SelectItem value="2">2+</SelectItem>
                          <SelectItem value="3">3+</SelectItem>
                          <SelectItem value="4">4+</SelectItem>
                          <SelectItem value="5">5 only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Event Type Contains</Label>
                      <Input
                        placeholder="e.g., malware, intrusion"
                        value={formData.conditions.event_type || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          conditions: { ...prev.conditions, event_type: e.target.value }
                        }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-1">Response Actions</h4>
                      <p className="text-xs text-muted-foreground">Actions to execute when conditions match</p>
                    </div>
                  </div>
                  
                  {/* Action List */}
                  <div className="space-y-2">
                    {formData.actions.map((action, index) => {
                      const actionInfo = getActionInfo(action.type);
                      const ActionIcon = actionInfo.icon;
                      return (
                        <div key={index} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                          <div className={cn("mt-0.5", actionInfo.color)}>
                            <ActionIcon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{actionInfo.label}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAction(index)}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            {action.type === 'notify_slack' && (
                              <Input
                                placeholder="Custom message (optional)"
                                value={(action.params?.message as string) || ''}
                                onChange={(e) => updateActionParams(index, 'message', e.target.value)}
                                className="text-sm"
                              />
                            )}
                            {action.type === 'escalate' && (
                              <Input
                                placeholder="Team to escalate to"
                                value={(action.params?.team as string) || ''}
                                onChange={(e) => updateActionParams(index, 'team', e.target.value)}
                                className="text-sm"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {ACTION_TYPES.map(action => {
                      const ActionIcon = action.icon;
                      return (
                        <Button
                          key={action.value}
                          variant="outline"
                          size="sm"
                          onClick={() => addAction(action.value)}
                          className="gap-1.5"
                        >
                          <ActionIcon className={cn("h-3.5 w-3.5", action.color)} />
                          {action.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleCreateOrUpdate}>
                  {editingPlaybook ? 'Update Playbook' : 'Create Playbook'}
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="playbooks" className="space-y-4">
          <TabsList>
            <TabsTrigger value="playbooks">Playbooks</TabsTrigger>
            <TabsTrigger value="soar-actions">SOAR Actions</TabsTrigger>
            <TabsTrigger value="executions">Execution History</TabsTrigger>
          </TabsList>

          <TabsContent value="playbooks" className="space-y-4">
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader className="space-y-2">
                      <div className="h-5 w-1/3 bg-muted rounded" />
                      <div className="h-4 w-2/3 bg-muted rounded" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : playbooks.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <Zap className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Playbooks Yet</h3>
                  <p className="text-muted-foreground text-center mb-4 max-w-sm">
                    Create your first automated response playbook to streamline incident handling.
                  </p>
                  <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Playbook
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {playbooks.map(playbook => (
                  <Card key={playbook.id} className={cn(
                    "transition-all",
                    !playbook.is_active && "opacity-60"
                  )}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-lg",
                            playbook.is_active ? "bg-primary/10" : "bg-muted"
                          )}>
                            <Zap className={cn(
                              "h-5 w-5",
                              playbook.is_active ? "text-primary" : "text-muted-foreground"
                            )} />
                          </div>
                          <div>
                            <CardTitle className="text-base">{playbook.name}</CardTitle>
                            <Badge variant={playbook.is_active ? "default" : "secondary"} className="mt-1">
                              {playbook.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(playbook)}
                            className="h-8 w-8"
                          >
                            {playbook.is_active ? (
                              <Pause className="h-4 w-4 text-warning" />
                            ) : (
                              <Play className="h-4 w-4 text-success" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(playbook)}
                            className="h-8 w-8"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Playbook</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{playbook.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDelete(playbook.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      {playbook.description && (
                        <CardDescription className="mt-2">{playbook.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Conditions */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">TRIGGER CONDITIONS</p>
                        <div className="flex flex-wrap gap-1.5">
                          {playbook.conditions.risk_level && (
                            <Badge variant="outline" className="text-xs">
                              Risk: {playbook.conditions.risk_level}
                            </Badge>
                          )}
                          {playbook.conditions.classification && (
                            <Badge variant="outline" className="text-xs">
                              {playbook.conditions.classification}
                            </Badge>
                          )}
                          {playbook.conditions.min_severity && playbook.conditions.min_severity > 0 && (
                            <Badge variant="outline" className="text-xs">
                              Severity ≥ {playbook.conditions.min_severity}
                            </Badge>
                          )}
                          {playbook.conditions.event_type && (
                            <Badge variant="outline" className="text-xs">
                              Type: {playbook.conditions.event_type}
                            </Badge>
                          )}
                          {Object.keys(playbook.conditions).length === 0 && (
                            <span className="text-xs text-muted-foreground">No conditions (manual trigger only)</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">ACTIONS ({playbook.actions.length})</p>
                        <div className="flex flex-wrap gap-1.5">
                          {playbook.actions.map((action, i) => {
                            const actionInfo = getActionInfo(action.type);
                            const ActionIcon = actionInfo.icon;
                            return (
                              <Badge key={i} variant="secondary" className="gap-1 text-xs">
                                <ActionIcon className={cn("h-3 w-3", actionInfo.color)} />
                                {actionInfo.label}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="executions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Executions</CardTitle>
                <CardDescription>History of playbook executions</CardDescription>
              </CardHeader>
              <CardContent>
                {executions.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No executions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {executions.map(execution => {
                      const playbook = playbooks.find(p => p.id === execution.playbook_id);
                      return (
                        <button 
                          key={execution.id} 
                          onClick={() => handleViewExecution(execution)}
                          className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-all cursor-pointer text-left"
                        >
                          <div className="flex items-center gap-3">
                            {execution.status === 'completed' ? (
                              <CheckCircle2 className="h-5 w-5 text-success" />
                            ) : execution.status === 'failed' ? (
                              <XCircle className="h-5 w-5 text-destructive" />
                            ) : (
                              <Clock className="h-5 w-5 text-warning animate-pulse" />
                            )}
                            <div>
                              <p className="font-medium text-sm">
                                {playbook?.name || 'Default Playbook'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Incident: {execution.incident_id.slice(0, 8)}...
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <Badge variant={
                                execution.status === 'completed' ? 'default' :
                                execution.status === 'failed' ? 'destructive' : 'secondary'
                              }>
                                {execution.status}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(execution.started_at).toLocaleString()}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Execution Details Dialog */}
        <Dialog open={!!selectedExecution} onOpenChange={(open) => { if (!open) { setSelectedExecution(null); setExecutionIncident(null); } }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedExecution?.status === 'completed' ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : selectedExecution?.status === 'failed' ? (
                  <XCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <Clock className="h-5 w-5 text-warning" />
                )}
                Execution Details
              </DialogTitle>
              <DialogDescription>
                {playbooks.find(p => p.id === selectedExecution?.playbook_id)?.name || 'Playbook Execution'}
              </DialogDescription>
            </DialogHeader>

            {selectedExecution && (
              <div className="space-y-6 py-4">
                {/* Execution Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-secondary/50 border">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant={
                      selectedExecution.status === 'completed' ? 'default' :
                      selectedExecution.status === 'failed' ? 'destructive' : 'secondary'
                    } className="mt-1">
                      {selectedExecution.status}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50 border">
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="font-semibold text-sm mt-1">{getExecutionDuration(selectedExecution)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50 border">
                    <p className="text-xs text-muted-foreground">Mode</p>
                    <Badge variant="outline" className="mt-1">
                      {selectedExecution.execution_mode || 'real'}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50 border">
                    <p className="text-xs text-muted-foreground">Started</p>
                    <p className="font-semibold text-xs mt-1">
                      {new Date(selectedExecution.started_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Incident Info */}
                {executionIncident && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        Incident Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Incident:</span>
                          <span className="ml-2 font-medium">{executionIncident.incident_number}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Type:</span>
                          <span className="ml-2 font-medium">{executionIncident.event_type}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Risk Level:</span>
                          <Badge variant={
                            executionIncident.risk_level === 'Critical' ? 'destructive' :
                            executionIncident.risk_level === 'High' ? 'secondary' : 'outline'
                          } className="ml-2">
                            {executionIncident.risk_level}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Classification:</span>
                          <span className="ml-2 font-medium">{executionIncident.classification}</span>
                        </div>
                        {executionIncident.src_ip && (
                          <div>
                            <span className="text-muted-foreground">Source IP:</span>
                            <span className="ml-2 font-mono text-xs">{executionIncident.src_ip}</span>
                          </div>
                        )}
                        {executionIncident.dst_ip && (
                          <div>
                            <span className="text-muted-foreground">Dest IP:</span>
                            <span className="ml-2 font-mono text-xs">{executionIncident.dst_ip}</span>
                          </div>
                        )}
                      </div>
                      {executionIncident.message && (
                        <div className="mt-2 p-2 rounded bg-muted/50 text-xs">
                          {executionIncident.message}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* AI Explanation */}
                {selectedExecution.ai_explanation && (
                  <Card className="border-primary/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        AI Explanation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">{selectedExecution.ai_explanation}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Decision Factors */}
                {selectedExecution.decision_factors && Object.keys(selectedExecution.decision_factors).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Decision Factors</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(selectedExecution.decision_factors).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between p-2 rounded bg-secondary/50 text-sm">
                            <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                            <span className="font-medium">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Executed Actions */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Executed Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(() => {
                        const playbook = playbooks.find(p => p.id === selectedExecution.playbook_id);
                        const actions = playbook?.actions || [];
                        const results = selectedExecution.results || {};
                        
                        if (actions.length === 0) {
                          return (
                            <p className="text-sm text-muted-foreground">No actions recorded</p>
                          );
                        }

                        return actions.map((action: PlaybookAction, idx: number) => {
                          const actionInfo = getActionInfo(action.type);
                          const ActionIcon = actionInfo.icon;
                          const actionResult = results[action.type] || results[`action_${idx}`];
                          const isSuccess = actionResult?.success !== false;
                          
                          return (
                            <div key={idx} className={cn(
                              "p-3 rounded-lg border",
                              isSuccess ? "bg-green-500/10 border-green-500/30" : "bg-destructive/10 border-destructive/30"
                            )}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {isSuccess ? (
                                    <CheckCircle2 className="h-4 w-4 text-success" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-destructive" />
                                  )}
                                  <ActionIcon className={cn("h-4 w-4", actionInfo.color)} />
                                  <span className="font-medium text-sm">{actionInfo.label}</span>
                                </div>
                                <Badge variant={isSuccess ? 'default' : 'destructive'} className="text-xs">
                                  {isSuccess ? 'Success' : 'Failed'}
                                </Badge>
                              </div>
                              {action.params && Object.keys(action.params).length > 0 && (
                                <div className="mt-2 pl-6 text-xs text-muted-foreground">
                                  {Object.entries(action.params).map(([k, v]) => (
                                    <div key={k}>
                                      <span className="capitalize">{k}:</span> <span className="font-mono">{String(v)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {actionResult?.message && (
                                <div className="mt-2 pl-6 text-xs">
                                  {actionResult.message}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </CardContent>
                </Card>

                {/* Raw Results */}
                {selectedExecution.results && Object.keys(selectedExecution.results).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Raw Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs bg-secondary/50 p-3 rounded-lg overflow-auto max-h-48">
                        {JSON.stringify(selectedExecution.results, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { setSelectedExecution(null); setExecutionIncident(null); }}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}