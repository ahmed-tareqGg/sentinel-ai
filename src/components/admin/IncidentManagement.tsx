import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  Search, 
  RefreshCw, 
  Trash2, 
  Archive, 
  RotateCcw,
  MoreHorizontal,
  Shield
} from 'lucide-react';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface IncidentManagementProps {
  safeMode: boolean;
}

interface Incident {
  id: string;
  incident_number: string;
  event_type: string;
  severity: number;
  status: string;
  risk_level: string;
  classification: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export function IncidentManagement({ safeMode }: IncidentManagementProps) {
  const { user } = useAuth();
  const [activeIncidents, setActiveIncidents] = useState<Incident[]>([]);
  const [deletedIncidents, setDeletedIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [deleteType, setDeleteType] = useState<'soft' | 'hard'>('soft');

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      // Fetch active incidents
      const { data: active, error: activeError } = await supabase
        .from('incidents')
        .select('id, incident_number, event_type, severity, status, risk_level, classification, created_at, deleted_at, deleted_by')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (activeError) throw activeError;

      // Fetch deleted incidents
      const { data: deleted, error: deletedError } = await supabase
        .from('incidents')
        .select('id, incident_number, event_type, severity, status, risk_level, classification, created_at, deleted_at, deleted_by')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(50);

      if (deletedError) throw deletedError;

      setActiveIncidents(active || []);
      setDeletedIncidents(deleted || []);
    } catch (error) {
      console.error('Error fetching incidents:', error);
      toast.error('Failed to fetch incidents');
    } finally {
      setLoading(false);
    }
  };

  const softDeleteIncident = async (incident: Incident) => {
    try {
      const { error } = await supabase
        .from('incidents')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
          status: 'Archived'
        })
        .eq('id', incident.id);

      if (error) throw error;

      // Log the action
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'soft_delete_incident',
        resource_type: 'incident',
        resource_id: incident.id,
        details: { incident_number: incident.incident_number }
      });

      toast.success(`Incident ${incident.incident_number} archived`);
      fetchIncidents();
    } catch (error) {
      console.error('Error archiving incident:', error);
      toast.error('Failed to archive incident');
    }
  };

  const hardDeleteIncident = async (incident: Incident) => {
    if (safeMode) {
      toast.error('Hard delete is disabled in Safe Mode');
      return;
    }

    try {
      const { error } = await supabase
        .from('incidents')
        .delete()
        .eq('id', incident.id);

      if (error) throw error;

      // Log the action
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'hard_delete_incident',
        resource_type: 'incident',
        resource_id: incident.id,
        details: { incident_number: incident.incident_number, permanent: true }
      });

      toast.success(`Incident ${incident.incident_number} permanently deleted`);
      fetchIncidents();
    } catch (error) {
      console.error('Error deleting incident:', error);
      toast.error('Failed to delete incident');
    }
  };

  const restoreIncident = async (incident: Incident) => {
    try {
      const { error } = await supabase
        .from('incidents')
        .update({
          deleted_at: null,
          deleted_by: null,
          status: 'Open'
        })
        .eq('id', incident.id);

      if (error) throw error;

      // Log the action
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'restore_incident',
        resource_type: 'incident',
        resource_id: incident.id,
        details: { incident_number: incident.incident_number }
      });

      toast.success(`Incident ${incident.incident_number} restored`);
      fetchIncidents();
    } catch (error) {
      console.error('Error restoring incident:', error);
      toast.error('Failed to restore incident');
    }
  };

  const getSeverityBadge = (severity: number) => {
    if (severity >= 8) return <Badge variant="destructive">Critical</Badge>;
    if (severity >= 6) return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">High</Badge>;
    if (severity >= 4) return <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">Medium</Badge>;
    return <Badge variant="secondary">Low</Badge>;
  };

  const filteredActive = activeIncidents.filter(i =>
    i.incident_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.classification.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDeleted = deletedIncidents.filter(i =>
    i.incident_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.event_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const IncidentRow = ({ incident, isDeleted = false }: { incident: Incident; isDeleted?: boolean }) => (
    <TableRow key={incident.id}>
      <TableCell className="font-mono text-sm font-medium">
        {incident.incident_number}
      </TableCell>
      <TableCell className="text-sm">{incident.event_type}</TableCell>
      <TableCell>{getSeverityBadge(incident.severity)}</TableCell>
      <TableCell>
        <Badge variant="outline">{incident.status}</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {new Date(incident.created_at).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right">
        {isDeleted ? (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => restoreIncident(incident)}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Restore
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={safeMode}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Permanently Delete Incident?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action is irreversible. All evidence and data for incident{' '}
                    <strong>{incident.incident_number}</strong> will be permanently lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => hardDeleteIncident(incident)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => softDeleteIncident(incident)}>
                <Archive className="h-4 w-4 mr-2" />
                Archive Incident
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem 
                    disabled={safeMode}
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Permanently
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Permanently Delete Incident?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action is irreversible. All evidence and data for incident{' '}
                      <strong>{incident.incident_number}</strong> will be permanently lost.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => hardDeleteIncident(incident)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Incidents
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{activeIncidents.length}</div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Archived Incidents
            </CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{deletedIncidents.length}</div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Safe Mode
            </CardTitle>
            <Shield className={`h-4 w-4 ${safeMode ? 'text-success' : 'text-destructive'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${safeMode ? 'text-success' : 'text-destructive'}`}>
              {safeMode ? 'ON' : 'OFF'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search incidents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={fetchIncidents} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Incidents Table */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Incident Management
          </CardTitle>
          <CardDescription>
            Archive or permanently delete incidents. Archived incidents can be restored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">Active ({filteredActive.length})</TabsTrigger>
              <TabsTrigger value="archived">Archived ({filteredDeleted.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Incident #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredActive.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No active incidents found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredActive.map((incident) => (
                      <IncidentRow key={incident.id} incident={incident} />
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="archived" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Incident #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredDeleted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No archived incidents
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDeleted.map((incident) => (
                      <IncidentRow key={incident.id} incident={incident} isDeleted />
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Safe Mode Notice */}
      {safeMode && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Shield className="h-5 w-5 text-success" />
            <p className="text-sm text-success">
              Safe Mode is enabled. Permanent deletions are disabled.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
