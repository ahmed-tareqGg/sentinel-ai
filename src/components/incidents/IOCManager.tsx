import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { logUserAction } from '@/lib/auditLogger';

interface IOC {
  id: string;
  incident_id: string;
  ioc_type: string;
  value: string;
  confidence: string;
  source: string;
  notes: string | null;
  added_by_email: string | null;
  created_at: string;
}

interface IOCManagerProps {
  incidentId: string;
}

const IOC_TYPES = [
  { value: 'ip', label: 'IP Address' },
  { value: 'domain', label: 'Domain' },
  { value: 'url', label: 'URL' },
  { value: 'file_hash', label: 'File Hash' },
  { value: 'email', label: 'Email' },
  { value: 'user', label: 'User' },
  { value: 'process', label: 'Process' },
];

const CONFIDENCE_COLORS: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  low: 'bg-muted text-muted-foreground border-border',
};

export function IOCManager({ incidentId }: IOCManagerProps) {
  const { user, profile } = useAuth();
  const [iocs, setIocs] = useState<IOC[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const [newType, setNewType] = useState('ip');
  const [newValue, setNewValue] = useState('');
  const [newConfidence, setNewConfidence] = useState('medium');
  const [newSource, setNewSource] = useState('manual');
  const [newNotes, setNewNotes] = useState('');

  useEffect(() => {
    fetchIOCs();
  }, [incidentId]);

  const fetchIOCs = async () => {
    const { data, error } = await supabase
      .from('incident_iocs')
      .select('*')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching IOCs:', error);
    } else {
      setIocs(data || []);
    }
    setLoading(false);
  };

  const addIOC = async () => {
    if (!newValue.trim()) {
      toast.error('IOC value is required');
      return;
    }
    setAdding(true);

    try {
      const { error } = await supabase.from('incident_iocs').insert({
        incident_id: incidentId,
        ioc_type: newType,
        value: newValue.trim(),
        confidence: newConfidence,
        source: newSource,
        notes: newNotes || null,
        added_by: user?.id,
        added_by_email: profile?.email,
      });

      if (error) throw error;

      await supabase.from('incident_timeline').insert({
        incident_id: incidentId,
        stage: `IOC Added: ${newType.toUpperCase()}`,
        details: `${newValue} (${newConfidence}) — by ${profile?.email}`,
      });

      await logUserAction('add_ioc', 'incident_ioc', incidentId, 'success', {
        ioc_type: newType,
        value: newValue,
      });

      toast.success('IOC added');
      setNewValue('');
      setNewNotes('');
      fetchIOCs();
    } catch (err) {
      console.error('Failed to add IOC:', err);
      toast.error('Failed to add IOC');
    } finally {
      setAdding(false);
    }
  };

  const deleteIOC = async (id: string) => {
    const { error } = await supabase.from('incident_iocs').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete IOC');
    } else {
      toast.success('IOC removed');
      fetchIOCs();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          Indicators of Compromise
          <Badge variant="secondary" className="ml-auto">{iocs.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add IOC Form */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
          <Select value={newType} onValueChange={setNewType}>
            <SelectTrigger className="bg-secondary/50">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {IOC_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="IOC Value (e.g., 185.234.247.10)"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="md:col-span-2 bg-secondary/50"
          />
          <Select value={newConfidence} onValueChange={setNewConfidence}>
            <SelectTrigger className="bg-secondary/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Source"
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            className="bg-secondary/50"
          />
          <Button onClick={addIOC} disabled={adding} size="sm">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Add
          </Button>
        </div>

        {/* IOC Table */}
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : iocs.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">No IOCs collected yet</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Added By</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {iocs.map((ioc) => (
                  <TableRow key={ioc.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {ioc.ioc_type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{ioc.value}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={CONFIDENCE_COLORS[ioc.confidence]}>
                        {ioc.confidence}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ioc.source}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{ioc.added_by_email?.split('@')[0]}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => deleteIOC(ioc.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
