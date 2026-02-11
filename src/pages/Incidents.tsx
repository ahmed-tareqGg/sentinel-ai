import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Download, Plus, RefreshCw, Shield, XCircle, ArrowUpCircle, CheckCircle2, UserPlus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { IncidentTable } from '@/components/dashboard/IncidentTable';
import { useIncidents } from '@/hooks/useIncidents';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileImportDialog } from '@/components/incidents/FileImportDialog';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';

export default function Incidents() {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const [filter, setFilter] = useState<string>('all');
  const { incidents, loading, refetch } = useIncidents();
  const { role, isDemoUser, canModifyData } = useAuth();
  const canModifyIncidents = canModifyData && role && ['soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager', 'ciso', 'admin'].includes(role);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newLog, setNewLog] = useState({
    eventType: 'Malware',
    severity: '3',
    srcIP: '',
    dstIP: '',
    msg: '',
    fileHash: '',
  });

  const [newIncident, setNewIncident] = useState({
    eventType: 'Malware',
    severity: '4',
    srcIP: '',
    dstIP: '',
    msg: '',
    fileHash: '',
    classification: 'True Positive',
    riskLevel: 'High',
    mitreTechnique: '',
    mitreTactic: '',
  });

  // Apply search filter first, then status filter
  const searchFiltered = searchQuery
    ? incidents.filter(i => 
        i.incident_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.event_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.classification.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.message && i.message.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (i.src_ip && i.src_ip.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (i.dst_ip && i.dst_ip.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : incidents;

  const filteredIncidents = filter === 'all' 
    ? searchFiltered 
    : searchFiltered.filter(i => i.status.toLowerCase().replace(' ', '-') === filter);

  const filters = [
    { key: 'all', label: 'All', count: incidents.length },
    { key: 'open', label: 'Open', count: incidents.filter(i => i.status === 'Open' || i.status === 'New').length },
    { key: 'assigned', label: 'Assigned', count: incidents.filter(i => i.status === 'Assigned').length },
    { key: 'in-progress', label: 'In Progress', count: incidents.filter(i => i.status === 'In Progress').length },
    { key: 'escalated', label: 'Escalated', count: incidents.filter(i => i.status === 'Escalated').length },
    { key: 'resolved', label: 'Resolved', count: incidents.filter(i => i.status === 'Resolved').length },
    { key: 'closed', label: 'Closed', count: incidents.filter(i => i.status === 'Closed').length },
  ];

  const handleSubmitLog = async () => {
    setSubmitting(true);
    try {
      const response = await supabase.functions.invoke('ingest-log', {
        body: {
          logs: {
            eventType: newLog.eventType,
            severity: parseInt(newLog.severity),
            srcIP: newLog.srcIP,
            dstIP: newLog.dstIP,
            msg: newLog.msg,
            fileHash: newLog.fileHash || undefined,
          },
          source: 'Manual Entry',
        },
      });

      if (response.error) throw response.error;
      
      toast.success('Log submitted for analysis');
      refetch();
      setDialogOpen(false);
      setNewLog({
        eventType: 'Malware',
        severity: '3',
        srcIP: '',
        dstIP: '',
        msg: '',
        fileHash: '',
      });
    } catch (error) {
      console.error('Failed to submit log:', error);
      toast.error('Failed to submit log');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateIncident = async () => {
    setSubmitting(true);
    try {
      const severity = parseInt(newIncident.severity);
      const { data, error } = await supabase
        .from('incidents')
        .insert({
          incident_number: 'TEMP', // Auto-generated by DB trigger
          event_type: newIncident.eventType,
          severity,
          src_ip: newIncident.srcIP || null,
          dst_ip: newIncident.dstIP || null,
          message: newIncident.msg,
          file_hash: newIncident.fileHash || null,
          classification: newIncident.classification,
          risk_level: newIncident.riskLevel,
          confidence: newIncident.classification === 'True Positive' ? 85 : 50,
          mitre_technique: newIncident.mitreTechnique || null,
          mitre_tactic: newIncident.mitreTactic || null,
          raw_log: { manual: true, created_by: 'analyst' } as any,
          ai_analysis: { source: 'manual_creation', note: 'Manually created by analyst' } as any,
          evidence: [],
          recommended_actions: [],
        } as any)
        .select('incident_number')
        .single();

      if (error) throw error;

      toast.success(`✅ Incident ${data.incident_number} created successfully`);
      refetch();
      setIncidentDialogOpen(false);
      setNewIncident({
        eventType: 'Malware',
        severity: '4',
        srcIP: '',
        dstIP: '',
        msg: '',
        fileHash: '',
        classification: 'True Positive',
        riskLevel: 'High',
        mitreTechnique: '',
        mitreTactic: '',
      });
    } catch (error: any) {
      console.error('Failed to create incident:', error);
      toast.error(error?.message || 'Failed to create incident');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkAction = async (action: 'close' | 'escalate' | 'resolve') => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    try {
      const updates: Record<string, any> = {};
      if (action === 'close') {
        updates.status = 'Closed';
        updates.closed_at = new Date().toISOString();
      } else if (action === 'escalate') {
        updates.status = 'Escalated';
        updates.escalated_at = new Date().toISOString();
      } else if (action === 'resolve') {
        updates.status = 'Resolved';
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('incidents')
        .update(updates)
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast.success(`✅ ${selectedIds.size} incidents ${action === 'close' ? 'closed' : action === 'escalate' ? 'escalated' : 'resolved'}`);
      setSelectedIds(new Set());
      refetch();
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${action} incidents`);
    } finally {
      setBulkProcessing(false);
    }
  };

  return (
    <AppLayout title="Incidents" subtitle="Security incident management">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6" data-tour="incidents-filters">
        <div className="flex items-center gap-2">
          {filters.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f.key)}
              className={filter === f.key ? 'bg-primary text-primary-foreground' : ''}
            >
              {f.label}
              <Badge variant="secondary" className="ml-2 bg-secondary/50" data-tour="severity-badge">
                {f.count}
              </Badge>
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {canModifyIncidents && <FileImportDialog onSuccess={refetch} />}
          {canModifyIncidents && (
            <>
              {/* Create Incident Directly */}
              <Dialog open={incidentDialogOpen} onOpenChange={setIncidentDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="default" className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    <Shield className="h-4 w-4 mr-2" />
                    Create Incident
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create Incident Manually</DialogTitle>
                    <DialogDescription>Create an incident directly without waiting for AI analysis pipeline.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Event Type</Label>
                        <Select value={newIncident.eventType} onValueChange={(v) => setNewIncident(prev => ({ ...prev, eventType: v }))}>
                          <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Malware">Malware</SelectItem>
                            <SelectItem value="Authentication">Authentication</SelectItem>
                            <SelectItem value="Brute Force">Brute Force</SelectItem>
                            <SelectItem value="Traffic">Traffic</SelectItem>
                            <SelectItem value="Execution">Execution</SelectItem>
                            <SelectItem value="Data Exfiltration">Data Exfiltration</SelectItem>
                            <SelectItem value="Lateral Movement">Lateral Movement</SelectItem>
                            <SelectItem value="Privilege Escalation">Privilege Escalation</SelectItem>
                            <SelectItem value="DNS">DNS</SelectItem>
                            <SelectItem value="Phishing">Phishing</SelectItem>
                            <SelectItem value="Ransomware">Ransomware</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Severity</Label>
                        <Select value={newIncident.severity} onValueChange={(v) => setNewIncident(prev => ({ ...prev, severity: v }))}>
                          <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 - Info</SelectItem>
                            <SelectItem value="2">2 - Low</SelectItem>
                            <SelectItem value="3">3 - Medium</SelectItem>
                            <SelectItem value="4">4 - High</SelectItem>
                            <SelectItem value="5">5 - Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Classification</Label>
                        <Select value={newIncident.classification} onValueChange={(v) => setNewIncident(prev => ({ ...prev, classification: v }))}>
                          <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="True Positive">True Positive</SelectItem>
                            <SelectItem value="False Positive">False Positive</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Risk Level</Label>
                        <Select value={newIncident.riskLevel} onValueChange={(v) => setNewIncident(prev => ({ ...prev, riskLevel: v }))}>
                          <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Critical">Critical</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="Low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Source IP</Label>
                        <Input placeholder="10.0.1.5" value={newIncident.srcIP} onChange={(e) => setNewIncident(prev => ({ ...prev, srcIP: e.target.value }))} className="bg-secondary/50" />
                      </div>
                      <div className="space-y-2">
                        <Label>Destination IP</Label>
                        <Input placeholder="185.234.247.10" value={newIncident.dstIP} onChange={(e) => setNewIncident(prev => ({ ...prev, dstIP: e.target.value }))} className="bg-secondary/50" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>MITRE Technique</Label>
                        <Input placeholder="T1110" value={newIncident.mitreTechnique} onChange={(e) => setNewIncident(prev => ({ ...prev, mitreTechnique: e.target.value }))} className="bg-secondary/50" />
                      </div>
                      <div className="space-y-2">
                        <Label>MITRE Tactic</Label>
                        <Input placeholder="Credential Access" value={newIncident.mitreTactic} onChange={(e) => setNewIncident(prev => ({ ...prev, mitreTactic: e.target.value }))} className="bg-secondary/50" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea placeholder="Describe the incident..." value={newIncident.msg} onChange={(e) => setNewIncident(prev => ({ ...prev, msg: e.target.value }))} className="bg-secondary/50" />
                    </div>
                    <div className="space-y-2">
                      <Label>File Hash (optional)</Label>
                      <Input placeholder="MD5/SHA256" value={newIncident.fileHash} onChange={(e) => setNewIncident(prev => ({ ...prev, fileHash: e.target.value }))} className="bg-secondary/50" />
                    </div>
                    <Button onClick={handleCreateIncident} disabled={submitting || !newIncident.msg} className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {submitting ? 'Creating...' : '🚨 Create Incident Now'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Submit Log (AI pipeline) */}
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground">
                    <Plus className="h-4 w-4 mr-2" />
                    Submit Log
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle>Submit Security Log</DialogTitle>
                    <DialogDescription>Submit a log for AI analysis pipeline processing.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Event Type</Label>
                        <Select value={newLog.eventType} onValueChange={(v) => setNewLog(prev => ({ ...prev, eventType: v }))}>
                          <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Malware">Malware</SelectItem>
                            <SelectItem value="Authentication">Authentication</SelectItem>
                            <SelectItem value="Traffic">Traffic</SelectItem>
                            <SelectItem value="Execution">Execution</SelectItem>
                            <SelectItem value="Data Exfiltration">Data Exfiltration</SelectItem>
                            <SelectItem value="DNS">DNS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Severity (1-5)</Label>
                        <Select value={newLog.severity} onValueChange={(v) => setNewLog(prev => ({ ...prev, severity: v }))}>
                          <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 - Low</SelectItem>
                            <SelectItem value="2">2 - Low</SelectItem>
                            <SelectItem value="3">3 - Medium</SelectItem>
                            <SelectItem value="4">4 - High</SelectItem>
                            <SelectItem value="5">5 - Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Source IP</Label>
                        <Input placeholder="10.0.1.5" value={newLog.srcIP} onChange={(e) => setNewLog(prev => ({ ...prev, srcIP: e.target.value }))} className="bg-secondary/50" />
                      </div>
                      <div className="space-y-2">
                        <Label>Destination IP</Label>
                        <Input placeholder="185.234.247.10" value={newLog.dstIP} onChange={(e) => setNewLog(prev => ({ ...prev, dstIP: e.target.value }))} className="bg-secondary/50" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Message</Label>
                      <Textarea placeholder="Describe the security event..." value={newLog.msg} onChange={(e) => setNewLog(prev => ({ ...prev, msg: e.target.value }))} className="bg-secondary/50" />
                    </div>
                    <div className="space-y-2">
                      <Label>File Hash (optional)</Label>
                      <Input placeholder="MD5/SHA256 hash" value={newLog.fileHash} onChange={(e) => setNewLog(prev => ({ ...prev, fileHash: e.target.value }))} className="bg-secondary/50" />
                    </div>
                    <Button onClick={handleSubmitLog} disabled={submitting || !newLog.srcIP || !newLog.msg} className="w-full bg-primary text-primary-foreground">
                      {submitting ? 'Analyzing...' : 'Submit for AI Analysis'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading incidents...</p>
        </div>
      ) : incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-muted-foreground mb-4">No incidents yet</p>
          {canModifyIncidents && (
            <Button onClick={() => setIncidentDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Incident
            </Button>
          )}
        </div>
      ) : (
        <div data-tour="incidents-table">
          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
              <div className="h-4 w-px bg-border" />
              <Button size="sm" variant="outline" disabled={bulkProcessing} onClick={() => handleBulkAction('close')}>
                <XCircle className="h-4 w-4 mr-1" /> Close
              </Button>
              <Button size="sm" variant="outline" disabled={bulkProcessing} onClick={() => handleBulkAction('escalate')}>
                <ArrowUpCircle className="h-4 w-4 mr-1" /> Escalate
              </Button>
              <Button size="sm" variant="outline" disabled={bulkProcessing} onClick={() => handleBulkAction('resolve')}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Resolve
              </Button>
              <div className="ml-auto">
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
              </div>
            </div>
          )}
          <IncidentTable
            incidents={filteredIncidents}
            selectable={!!canModifyIncidents}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        </div>
      )}
    </AppLayout>
  );
}