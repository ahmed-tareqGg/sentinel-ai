import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Paperclip, Upload, Trash2, Loader2, FileText, Image, File } from 'lucide-react';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { logUserAction } from '@/lib/auditLogger';

interface Evidence {
  id: string;
  incident_id: string;
  evidence_type: string;
  title: string;
  description: string | null;
  file_name: string | null;
  file_url: string | null;
  file_size: number | null;
  source: string;
  added_by_email: string | null;
  created_at: string;
}

interface EvidenceManagerProps {
  incidentId: string;
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  log: FileText,
  screenshot: Image,
  report: FileText,
  pcap: File,
  config: File,
  other: File,
};

export function EvidenceManager({ incidentId }: EvidenceManagerProps) {
  const { user, profile } = useAuth();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceType, setEvidenceType] = useState('log');
  const [source, setSource] = useState('manual');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetchEvidence();
  }, [incidentId]);

  const fetchEvidence = async () => {
    const { data, error } = await supabase
      .from('incident_evidence')
      .select('*')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching evidence:', error);
    else setEvidence(data || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setUploading(true);

    try {
      let fileUrl = null;
      let fileName = null;
      let fileSize = null;

      if (file) {
        const filePath = `${incidentId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('incident-evidence')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('incident-evidence')
          .getPublicUrl(filePath);

        fileUrl = urlData.publicUrl;
        fileName = file.name;
        fileSize = file.size;
      }

      const { error } = await supabase.from('incident_evidence').insert({
        incident_id: incidentId,
        evidence_type: evidenceType,
        title: title.trim(),
        description: description || null,
        file_name: fileName,
        file_url: fileUrl,
        file_size: fileSize,
        source,
        added_by: user?.id,
        added_by_email: profile?.email,
      });

      if (error) throw error;

      await supabase.from('incident_timeline').insert({
        incident_id: incidentId,
        stage: `Evidence Added: ${evidenceType}`,
        details: `${title} — by ${profile?.email}`,
      });

      await logUserAction('add_evidence', 'incident_evidence', incidentId, 'success', {
        evidence_type: evidenceType,
        title,
      });

      toast.success('Evidence attached');
      setDialogOpen(false);
      setTitle('');
      setDescription('');
      setFile(null);
      fetchEvidence();
    } catch (err) {
      console.error('Failed to add evidence:', err);
      toast.error('Failed to attach evidence');
    } finally {
      setUploading(false);
    }
  };

  const deleteEvidence = async (id: string) => {
    const { error } = await supabase.from('incident_evidence').delete().eq('id', id);
    if (error) toast.error('Failed to remove');
    else { toast.success('Evidence removed'); fetchEvidence(); }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-primary" />
            Evidence & Attachments
            <Badge variant="secondary" className="ml-auto">{evidence.length}</Badge>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Add Evidence
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : evidence.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">No evidence attached yet</p>
          ) : (
            <div className="space-y-2">
              {evidence.map((ev) => {
                const Icon = TYPE_ICONS[ev.evidence_type] || File;
                return (
                  <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{ev.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">{ev.evidence_type}</Badge>
                          {ev.file_name && <span>{ev.file_name} ({formatSize(ev.file_size)})</span>}
                          <span>by {ev.added_by_email?.split('@')[0]}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {ev.file_url && (
                        <Button variant="ghost" size="sm" onClick={() => window.open(ev.file_url!, '_blank')}>
                          <FileText className="h-3 w-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => deleteEvidence(ev.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Attach Evidence</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-secondary/50" placeholder="e.g., Network capture of C2 traffic" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={evidenceType} onValueChange={setEvidenceType}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="log">Log</SelectItem>
                    <SelectItem value="screenshot">Screenshot</SelectItem>
                    <SelectItem value="report">Report</SelectItem>
                    <SelectItem value="pcap">PCAP</SelectItem>
                    <SelectItem value="config">Config</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Input value={source} onChange={(e) => setSource(e.target.value)} className="bg-secondary/50" placeholder="Manual / EDR / SIEM" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-secondary/50" rows={2} placeholder="Brief description of the evidence..." />
            </div>
            <div className="space-y-2">
              <Label>File (optional)</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="bg-secondary/50" accept=".pdf,.png,.jpg,.jpeg,.txt,.pcap,.zip,.log,.csv" />
              <p className="text-[11px] text-muted-foreground">Max 20MB. Supported: PDF, Images, TXT, PCAP, ZIP, LOG, CSV</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Attach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
