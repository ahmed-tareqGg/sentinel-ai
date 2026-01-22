import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Save, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  Plus,
  Trash2,
  Link as LinkIcon,
  Calendar,
  User as UserIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ComplianceControl, ComplianceEvidence } from '@/hooks/useComplianceData';

interface ControlDetailsDialogProps {
  control: ComplianceControl & { 
    evidenceCount: number; 
    complianceEvidenceList: ComplianceEvidence[];
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Partial<ComplianceControl>) => Promise<boolean>;
  onAddEvidence: (evidence: Omit<ComplianceEvidence, 'id' | 'control_id' | 'created_at' | 'created_by'>) => Promise<boolean>;
  onDeleteEvidence: (evidenceId: string) => Promise<boolean>;
}

export function ControlDetailsDialog({
  control,
  open,
  onOpenChange,
  onSave,
  onAddEvidence,
  onDeleteEvidence,
}: ControlDetailsDialogProps) {
  const [formData, setFormData] = useState({
    applicable: control.applicable || 'yes',
    justification: control.justification || '',
    implemented: control.implemented || false,
    implementation_description: control.implementation_description || '',
    evidence_reference: control.evidence_reference || '',
    risk_reference: control.risk_reference || '',
    comments: control.comments || '',
    owner: control.owner || '',
  });

  const [newEvidence, setNewEvidence] = useState({
    title: '',
    evidence_type: 'policy',
    source: 'SOCMind',
    reference_id: '',
    description: '',
    file_url: '',
  });

  const [saving, setSaving] = useState(false);
  const [addingEvidence, setAddingEvidence] = useState(false);
  const [showAddEvidence, setShowAddEvidence] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const success = await onSave({
      ...formData,
      status: formData.implemented ? 'implemented' : (formData.applicable === 'no' ? 'not_applicable' : 'not_implemented'),
    });
    setSaving(false);
    if (success) {
      toast.success('Control updated successfully');
    } else {
      toast.error('Failed to update control');
    }
  };

  const handleAddEvidence = async () => {
    if (!newEvidence.title) {
      toast.error('Evidence title is required');
      return;
    }
    setAddingEvidence(true);
    const success = await onAddEvidence(newEvidence);
    setAddingEvidence(false);
    if (success) {
      toast.success('Evidence added successfully');
      setNewEvidence({
        title: '',
        evidence_type: 'policy',
        source: 'SOCMind',
        reference_id: '',
        description: '',
        file_url: '',
      });
      setShowAddEvidence(false);
    } else {
      toast.error('Failed to add evidence');
    }
  };

  const handleDeleteEvidence = async (evidenceId: string) => {
    const success = await onDeleteEvidence(evidenceId);
    if (success) {
      toast.success('Evidence deleted');
    } else {
      toast.error('Failed to delete evidence');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono">
              {control.control_code}
            </Badge>
            {control.title}
          </DialogTitle>
          <DialogDescription>
            {control.description || 'Manage control implementation details, evidence, and documentation.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Control Details</TabsTrigger>
            <TabsTrigger value="evidence">
              Evidence ({control.evidenceCount})
            </TabsTrigger>
            <TabsTrigger value="risk">Risk & Comments</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[500px] mt-4 pr-4">
            {/* Details Tab */}
            <TabsContent value="details" className="space-y-6 mt-0">
              {/* Applicability Section */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Applicability
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Applicable</Label>
                    <Select 
                      value={formData.applicable} 
                      onValueChange={(v) => setFormData({...formData, applicable: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">
                          <span className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Yes - Applicable
                          </span>
                        </SelectItem>
                        <SelectItem value="no">
                          <span className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            No - Not Applicable
                          </span>
                        </SelectItem>
                        <SelectItem value="na">
                          <span className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            N/A
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Justification</Label>
                    <Textarea 
                      placeholder="Explain why this control is/isn't applicable..."
                      value={formData.justification}
                      onChange={(e) => setFormData({...formData, justification: e.target.value})}
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Implementation Section */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Implementation
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">Implemented</Label>
                      <p className="text-sm text-muted-foreground">
                        Mark this control as fully implemented
                      </p>
                    </div>
                    <Switch
                      checked={formData.implemented}
                      onCheckedChange={(checked) => setFormData({...formData, implemented: checked})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Implementation Description</Label>
                    <Textarea 
                      placeholder="Describe how this control is implemented in your organization..."
                      value={formData.implementation_description}
                      onChange={(e) => setFormData({...formData, implementation_description: e.target.value})}
                      rows={4}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Owner Section */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-blue-500" />
                  Ownership
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Control Owner</Label>
                    <Input 
                      placeholder="e.g., CISO, IT Manager, Security Team..."
                      value={formData.owner}
                      onChange={(e) => setFormData({...formData, owner: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Review</Label>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground border rounded-md px-3 py-2">
                      <Calendar className="h-4 w-4" />
                      {control.last_review || 'Not reviewed yet'}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Evidence Tab */}
            <TabsContent value="evidence" className="space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-500" />
                  Evidence Documents
                </h4>
                <Button 
                  size="sm" 
                  onClick={() => setShowAddEvidence(!showAddEvidence)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Evidence
                </Button>
              </div>

              {showAddEvidence && (
                <Card>
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Title *</Label>
                        <Input 
                          placeholder="Evidence title..."
                          value={newEvidence.title}
                          onChange={(e) => setNewEvidence({...newEvidence, title: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select 
                          value={newEvidence.evidence_type} 
                          onValueChange={(v) => setNewEvidence({...newEvidence, evidence_type: v})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="policy">Policy Document</SelectItem>
                            <SelectItem value="log">Log/Audit Trail</SelectItem>
                            <SelectItem value="incident">Incident Record</SelectItem>
                            <SelectItem value="report">Report</SelectItem>
                            <SelectItem value="screenshot">Screenshot</SelectItem>
                            <SelectItem value="procedure">Procedure</SelectItem>
                            <SelectItem value="configuration">Configuration</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Source</Label>
                        <Input 
                          placeholder="e.g., SOCMind, Jira, ServiceNow..."
                          value={newEvidence.source}
                          onChange={(e) => setNewEvidence({...newEvidence, source: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Reference ID</Label>
                        <Input 
                          placeholder="e.g., INC-001, LOG-123..."
                          value={newEvidence.reference_id}
                          onChange={(e) => setNewEvidence({...newEvidence, reference_id: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea 
                        placeholder="Describe this evidence..."
                        value={newEvidence.description}
                        onChange={(e) => setNewEvidence({...newEvidence, description: e.target.value})}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL/Link (optional)</Label>
                      <Input 
                        placeholder="https://..."
                        value={newEvidence.file_url}
                        onChange={(e) => setNewEvidence({...newEvidence, file_url: e.target.value})}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowAddEvidence(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddEvidence} disabled={addingEvidence}>
                        {addingEvidence ? 'Adding...' : 'Add Evidence'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Evidence Summary Reference */}
              <div className="space-y-2">
                <Label>Evidence Summary Reference</Label>
                <Input 
                  placeholder="Quick reference link or summary..."
                  value={formData.evidence_reference}
                  onChange={(e) => setFormData({...formData, evidence_reference: e.target.value})}
                />
              </div>

              {/* Evidence List */}
              <div className="space-y-2">
                {control.complianceEvidenceList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No evidence attached yet</p>
                    <p className="text-xs">Add evidence documents to support this control</p>
                  </div>
                ) : (
                  control.complianceEvidenceList.map(ev => (
                    <Card key={ev.id}>
                      <CardContent className="py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded",
                            ev.evidence_type === 'policy' && "bg-blue-500/10",
                            ev.evidence_type === 'log' && "bg-green-500/10",
                            ev.evidence_type === 'incident' && "bg-red-500/10",
                            ev.evidence_type === 'report' && "bg-purple-500/10",
                          )}>
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{ev.title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {ev.evidence_type}
                              </Badge>
                              {ev.source && <span>• {ev.source}</span>}
                              {ev.reference_id && <span>• {ev.reference_id}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ev.file_url && (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={ev.file_url} target="_blank" rel="noopener noreferrer">
                                <LinkIcon className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDeleteEvidence(ev.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Risk & Comments Tab */}
            <TabsContent value="risk" className="space-y-6 mt-0">
              <div className="space-y-4">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Risk Reference
                </h4>
                <div className="space-y-2">
                  <Label>Risk Register Reference</Label>
                  <Input 
                    placeholder="e.g., RISK-001, Link to risk register..."
                    value={formData.risk_reference}
                    onChange={(e) => setFormData({...formData, risk_reference: e.target.value})}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Additional Comments
                </h4>
                <div className="space-y-2">
                  <Label>Comments / Notes</Label>
                  <Textarea 
                    placeholder="Any additional notes, observations, or action items..."
                    value={formData.comments}
                    onChange={(e) => setFormData({...formData, comments: e.target.value})}
                    rows={6}
                  />
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
