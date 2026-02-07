import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  FileText, 
  Search, 
  Download,
  Eye,
  User,
  Shield,
  Bot,
  Server,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { GRCAuditEntry } from '@/hooks/useGRCData';

interface GRCAuditTrailTabProps {
  auditTrail: GRCAuditEntry[];
  loading: boolean;
}

const ACTION_COLORS: Record<string, string> = {
  control_updated: 'bg-blue-500/10 text-blue-500',
  risk_created: 'bg-green-500/10 text-green-500',
  risk_updated: 'bg-yellow-500/10 text-yellow-500',
  risk_deleted: 'bg-red-500/10 text-red-500',
  gap_identified: 'bg-orange-500/10 text-orange-500',
  gap_closed: 'bg-green-500/10 text-green-500',
  evidence_added: 'bg-purple-500/10 text-purple-500',
};

const ENTITY_ICONS: Record<string, typeof User> = {
  compliance_control: Shield,
  risk: FileText,
  gap: FileText,
  evidence: FileText,
};

export function GRCAuditTrailTab({
  auditTrail,
  loading,
}: GRCAuditTrailTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<GRCAuditEntry | null>(null);

  const uniqueActions = [...new Set(auditTrail.map(e => e.action))];
  const uniqueEntities = [...new Set(auditTrail.map(e => e.entity_type))];

  const filteredAudit = auditTrail.filter(entry => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!entry.action.toLowerCase().includes(search) &&
          !entry.entity_name?.toLowerCase().includes(search) &&
          !entry.actor_email?.toLowerCase().includes(search) &&
          !entry.change_summary?.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (filterAction !== 'all' && entry.action !== filterAction) return false;
    if (filterEntity !== 'all' && entry.entity_type !== filterEntity) return false;
    return true;
  });

  const exportAudit = () => {
    const csv = [
      ['Timestamp', 'Actor', 'Action', 'Entity Type', 'Entity Name', 'Change Summary'].join(','),
      ...filteredAudit.map(entry => [
        entry.timestamp,
        entry.actor_email || 'System',
        entry.action,
        entry.entity_type,
        entry.entity_name || '',
        entry.change_summary || '',
      ].map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grc-audit-trail-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('GRC audit trail exported');
  };

  const renderDiff = (oldValue: unknown, newValue: unknown) => {
    if (!oldValue && !newValue) return null;
    
    const old = typeof oldValue === 'object' ? JSON.stringify(oldValue, null, 2) : String(oldValue || '');
    const updated = typeof newValue === 'object' ? JSON.stringify(newValue, null, 2) : String(newValue || '');
    
    return (
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Before</p>
          <pre className="text-xs bg-destructive/10 p-3 rounded-lg overflow-auto max-h-48">
            {old || '(empty)'}
          </pre>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">After</p>
          <pre className="text-xs bg-green-500/10 p-3 rounded-lg overflow-auto max-h-48">
            {updated || '(empty)'}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search audit trail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map(action => (
                  <SelectItem key={action} value={action}>{action.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {uniqueEntities.map(entity => (
                  <SelectItem key={entity} value={entity}>{entity.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportAudit}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card>
        <CardHeader>
          <CardTitle>GRC Audit Trail ({filteredAudit.length})</CardTitle>
          <CardDescription>
            Complete history of all GRC changes with before/after values for compliance auditing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading audit trail...</p>
            </div>
          ) : filteredAudit.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No GRC audit events yet</p>
              <p className="text-sm text-muted-foreground">Changes to controls, risks, and gaps will appear here</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="w-[160px]">Timestamp</TableHead>
                    <TableHead className="w-[180px]">Actor</TableHead>
                    <TableHead className="w-[150px]">Action</TableHead>
                    <TableHead className="w-[120px]">Entity Type</TableHead>
                    <TableHead>Entity / Summary</TableHead>
                    <TableHead className="w-[60px]">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAudit.map((entry) => {
                    const EntityIcon = ENTITY_ICONS[entry.entity_type] || FileText;
                    return (
                      <TableRow key={entry.id} className="hover:bg-secondary/30">
                        <TableCell className="text-xs font-mono">
                          {format(new Date(entry.timestamp), 'MMM dd, HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm truncate max-w-[140px]">
                              {entry.actor_email || 'System'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", ACTION_COLORS[entry.action] || "bg-gray-500/10 text-gray-500")}
                          >
                            {entry.action.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <EntityIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs">{entry.entity_type.replace(/_/g, ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{entry.entity_name || '-'}</div>
                          {entry.change_summary && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {entry.change_summary}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setSelectedEntry(entry)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Audit Entry Details
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
                  <p className="text-sm">{format(new Date(selectedEntry.timestamp), 'PPpp')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Actor</p>
                  <p className="text-sm">{selectedEntry.actor_email || 'System'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Action</p>
                  <Badge className={cn("text-xs", ACTION_COLORS[selectedEntry.action])}>
                    {selectedEntry.action.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Entity</p>
                  <p className="text-sm">{selectedEntry.entity_type} - {selectedEntry.entity_name}</p>
                </div>
              </div>
              
              {selectedEntry.change_summary && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Summary</p>
                  <p className="text-sm">{selectedEntry.change_summary}</p>
                </div>
              )}

              {(selectedEntry.old_value || selectedEntry.new_value) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    Changes <ArrowRight className="h-4 w-4" />
                  </p>
                  {renderDiff(selectedEntry.old_value, selectedEntry.new_value)}
                </div>
              )}

              {selectedEntry.ip_address && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">IP Address</p>
                  <p className="text-sm font-mono">{selectedEntry.ip_address}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
