import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  Clock,
  Hash,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';

interface CorrelationRule {
  id: string;
  name: string;
  description: string | null;
  match_field: string;
  match_operator: string;
  match_value: string | null;
  event_type_filter: string[] | null;
  threshold_count: number;
  time_window_minutes: number;
  severity_override: number | null;
  incident_title_template: string | null;
  is_active: boolean;
  hits_count: number | null;
  last_triggered_at: string | null;
  created_at: string;
}

const MATCH_FIELDS = [
  { value: 'src_ip', label: 'Source IP' },
  { value: 'dst_ip', label: 'Destination IP' },
  { value: 'hostname', label: 'Hostname' },
  { value: 'event_type', label: 'Event Type' },
  { value: 'user', label: 'User' },
  { value: 'mitre_technique', label: 'MITRE Technique' },
];

const MATCH_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'regex', label: 'Regex Match' },
  { value: 'any', label: 'Any Value' },
];

const EVENT_TYPES = [
  'authentication',
  'firewall',
  'malware',
  'intrusion',
  'data_exfiltration',
  'privilege_escalation',
  'lateral_movement',
  'command_control',
];

const emptyRule = {
  name: '',
  description: '',
  match_field: 'src_ip',
  match_operator: 'any',
  match_value: '',
  event_type_filter: [] as string[],
  threshold_count: 3,
  time_window_minutes: 10,
  severity_override: 4,
  incident_title_template: '',
};

export function CorrelationRulesEngine() {
  const { isManager, isCISO, isAdmin } = useAuth();
  const canManage = isManager || isCISO || isAdmin;
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CorrelationRule | null>(null);
  const [formData, setFormData] = useState(emptyRule);

  // Fetch rules
  const { data: rules, isLoading } = useQuery({
    queryKey: ['correlation-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('correlation_rules')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CorrelationRule[];
    },
  });

  // Create rule
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('correlation_rules').insert({
        name: data.name,
        description: data.description || null,
        match_field: data.match_field,
        match_operator: data.match_operator,
        match_value: data.match_value || null,
        event_type_filter: data.event_type_filter.length > 0 ? data.event_type_filter : null,
        threshold_count: data.threshold_count,
        time_window_minutes: data.time_window_minutes,
        severity_override: data.severity_override,
        incident_title_template: data.incident_title_template || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correlation-rules'] });
      toast.success('Rule created successfully');
      closeDialog();
    },
    onError: (error) => {
      toast.error('Failed to create rule: ' + (error as Error).message);
    },
  });

  // Update rule
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('correlation_rules')
        .update({
          name: data.name,
          description: data.description || null,
          match_field: data.match_field,
          match_operator: data.match_operator,
          match_value: data.match_value || null,
          event_type_filter: data.event_type_filter.length > 0 ? data.event_type_filter : null,
          threshold_count: data.threshold_count,
          time_window_minutes: data.time_window_minutes,
          severity_override: data.severity_override,
          incident_title_template: data.incident_title_template || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correlation-rules'] });
      toast.success('Rule updated successfully');
      closeDialog();
    },
    onError: (error) => {
      toast.error('Failed to update rule: ' + (error as Error).message);
    },
  });

  // Toggle rule
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('correlation_rules')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correlation-rules'] });
    },
    onError: (error) => {
      toast.error('Failed to toggle rule: ' + (error as Error).message);
    },
  });

  // Delete rule
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('correlation_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correlation-rules'] });
      toast.success('Rule deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete rule: ' + (error as Error).message);
    },
  });

  const openCreateDialog = () => {
    setEditingRule(null);
    setFormData(emptyRule);
    setDialogOpen(true);
  };

  const openEditDialog = (rule: CorrelationRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      match_field: rule.match_field,
      match_operator: rule.match_operator,
      match_value: rule.match_value || '',
      event_type_filter: rule.event_type_filter || [],
      threshold_count: rule.threshold_count,
      time_window_minutes: rule.time_window_minutes,
      severity_override: rule.severity_override || 4,
      incident_title_template: rule.incident_title_template || '',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
    setFormData(emptyRule);
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error('Rule name is required');
      return;
    }
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatTimeAgo = (date: string | null) => {
    if (!date) return 'Never';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getSeverityColor = (severity: number | null) => {
    if (!severity) return 'bg-muted';
    if (severity >= 5) return 'bg-red-500';
    if (severity >= 4) return 'bg-orange-500';
    if (severity >= 3) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Correlation Rules Engine</CardTitle>
              <CardDescription>
                Auto-create incidents when multiple events match within a time window
              </CardDescription>
            </div>
          </div>
          {canManage && (
            <Button onClick={openCreateDialog} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Rule
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : rules?.length === 0 ? (
          <div className="text-center py-8">
            <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">No correlation rules configured</p>
            {canManage && (
              <Button onClick={openCreateDialog} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create First Rule
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {rules?.map((rule) => (
              <div
                key={rule.id}
                className={`p-4 rounded-lg border transition-colors ${
                  rule.is_active
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border bg-muted/20 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{rule.name}</h4>
                      {rule.is_active ? (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                        {rule.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline" className="gap-1">
                        <Activity className="h-3 w-3" />
                        {MATCH_FIELDS.find((f) => f.value === rule.match_field)?.label}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Hash className="h-3 w-3" />
                        {rule.threshold_count} events
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {rule.time_window_minutes}m window
                      </Badge>
                      <Badge className={`${getSeverityColor(rule.severity_override)} text-white`}>
                        Severity {rule.severity_override}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right text-xs text-muted-foreground mr-2">
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {rule.hits_count || 0} hits
                      </div>
                      <div>Last: {formatTimeAgo(rule.last_triggered_at)}</div>
                    </div>

                    {canManage && (
                      <>
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: rule.id, is_active: checked })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(rule)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Rule' : 'Create Correlation Rule'}</DialogTitle>
            <DialogDescription>
              Define conditions to auto-create incidents from correlated events
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>Rule Name *</Label>
              <Input
                placeholder="e.g., SSH Brute Force Detection"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional description..."
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Match Field + Operator */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Match Field</Label>
                <Select
                  value={formData.match_field}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, match_field: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATCH_FIELDS.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Operator</Label>
                <Select
                  value={formData.match_operator}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, match_operator: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATCH_OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Match Value (if not 'any') */}
            {formData.match_operator !== 'any' && (
              <div className="space-y-2">
                <Label>Match Value</Label>
                <Input
                  placeholder={
                    formData.match_operator === 'regex'
                      ? 'e.g., ^192\\.168\\..*'
                      : 'e.g., 192.168.1.100'
                  }
                  value={formData.match_value}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, match_value: e.target.value }))
                  }
                />
              </div>
            )}

            {/* Threshold + Time Window */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  Threshold Count
                </Label>
                <Input
                  type="number"
                  min={2}
                  max={100}
                  value={formData.threshold_count}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      threshold_count: parseInt(e.target.value) || 3,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">Min events to trigger</p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Time Window (min)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={formData.time_window_minutes}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      time_window_minutes: parseInt(e.target.value) || 10,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">Correlation window</p>
              </div>
            </div>

            {/* Severity Override */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Incident Severity
              </Label>
              <Select
                value={formData.severity_override.toString()}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, severity_override: parseInt(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 - Critical</SelectItem>
                  <SelectItem value="4">4 - High</SelectItem>
                  <SelectItem value="3">3 - Medium</SelectItem>
                  <SelectItem value="2">2 - Low</SelectItem>
                  <SelectItem value="1">1 - Info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Event Type Filter */}
            <div className="space-y-2">
              <Label>Event Type Filter (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map((type) => (
                  <Badge
                    key={type}
                    variant={formData.event_type_filter.includes(type) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        event_type_filter: prev.event_type_filter.includes(type)
                          ? prev.event_type_filter.filter((t) => t !== type)
                          : [...prev.event_type_filter, type],
                      }))
                    }
                  >
                    {type.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to match all event types
              </p>
            </div>

            {/* Incident Title Template */}
            <div className="space-y-2">
              <Label>Incident Title Template</Label>
              <Input
                placeholder="e.g., Multiple failed logins from {{src_ip}}"
                value={formData.incident_title_template}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, incident_title_template: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Use {'{{field}}'} for dynamic values
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editingRule
                ? 'Update Rule'
                : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
