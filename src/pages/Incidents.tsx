import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Download, Plus, RefreshCw } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { IncidentTable } from '@/components/dashboard/IncidentTable';
import { useIncidents } from '@/hooks/useIncidents';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileImportDialog } from '@/components/incidents/FileImportDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Incidents() {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const [filter, setFilter] = useState<string>('all');
  const { incidents, loading, refetch } = useIncidents();
  const { canModifyIncidents } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newLog, setNewLog] = useState({
    eventType: 'Malware',
    severity: '3',
    srcIP: '',
    dstIP: '',
    msg: '',
    fileHash: '',
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
    { key: 'open', label: 'Open', count: incidents.filter(i => i.status === 'Open').length },
    { key: 'in-progress', label: 'In Progress', count: incidents.filter(i => i.status === 'In Progress').length },
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

  return (
    <AppLayout title="Incidents" subtitle="Security incident management">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
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
              <Badge variant="secondary" className="ml-2 bg-secondary/50">
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
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Event Type</Label>
                      <Select value={newLog.eventType} onValueChange={(v) => setNewLog(prev => ({ ...prev, eventType: v }))}>
                        <SelectTrigger className="bg-secondary/50">
                          <SelectValue />
                        </SelectTrigger>
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
                        <SelectTrigger className="bg-secondary/50">
                          <SelectValue />
                        </SelectTrigger>
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
                      <Input 
                        placeholder="10.0.1.5"
                        value={newLog.srcIP}
                        onChange={(e) => setNewLog(prev => ({ ...prev, srcIP: e.target.value }))}
                        className="bg-secondary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Destination IP</Label>
                      <Input 
                        placeholder="185.234.247.10"
                        value={newLog.dstIP}
                        onChange={(e) => setNewLog(prev => ({ ...prev, dstIP: e.target.value }))}
                        className="bg-secondary/50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea 
                      placeholder="Describe the security event..."
                      value={newLog.msg}
                      onChange={(e) => setNewLog(prev => ({ ...prev, msg: e.target.value }))}
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>File Hash (optional)</Label>
                    <Input 
                      placeholder="MD5/SHA256 hash"
                      value={newLog.fileHash}
                      onChange={(e) => setNewLog(prev => ({ ...prev, fileHash: e.target.value }))}
                      className="bg-secondary/50"
                    />
                  </div>
                  <Button 
                    onClick={handleSubmitLog} 
                    disabled={submitting || !newLog.srcIP || !newLog.msg}
                    className="w-full bg-primary text-primary-foreground"
                  >
                    {submitting ? 'Analyzing...' : 'Submit for AI Analysis'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
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
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Submit Your First Log
            </Button>
          )}
        </div>
      ) : (
        <IncidentTable incidents={filteredIncidents} />
      )}
    </AppLayout>
  );
}
