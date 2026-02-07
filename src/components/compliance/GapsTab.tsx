import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertTriangle, 
  Search, 
  CheckCircle2,
  XCircle,
  Clock,
  Scan,
  Edit
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { ControlGap, GapStats } from '@/hooks/useGRCData';

interface GapsTabProps {
  gaps: ControlGap[];
  gapStats: GapStats;
  onUpdateGap: (gapId: string, updates: Partial<ControlGap>) => Promise<boolean>;
  onCloseGap: (gapId: string) => Promise<boolean>;
  onIdentifyGaps: () => Promise<number>;
  loading: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-green-500 text-white',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-500/10 text-red-500 border-red-500/30',
  in_progress: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  remediated: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  closed: 'bg-green-500/10 text-green-500 border-green-500/30',
};

export function GapsTab({
  gaps,
  gapStats,
  onUpdateGap,
  onCloseGap,
  onIdentifyGaps,
  loading,
}: GapsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [editingGap, setEditingGap] = useState<ControlGap | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const [formData, setFormData] = useState({
    gap_status: 'open',
    gap_severity: 'medium',
    remediation_plan: '',
    target_date: '',
  });

  const handleScanGaps = async () => {
    setIsScanning(true);
    const count = await onIdentifyGaps();
    setIsScanning(false);
    toast.success(`Found ${count} new gaps`);
  };

  const handleEdit = (gap: ControlGap) => {
    setEditingGap(gap);
    setFormData({
      gap_status: gap.gap_status,
      gap_severity: gap.gap_severity,
      remediation_plan: gap.remediation_plan || '',
      target_date: gap.target_date || '',
    });
  };

  const handleSave = async () => {
    if (!editingGap) return;
    const success = await onUpdateGap(editingGap.id, formData);
    if (success) {
      toast.success('Gap updated');
      setEditingGap(null);
    } else {
      toast.error('Failed to update gap');
    }
  };

  const handleClose = async (gapId: string) => {
    const success = await onCloseGap(gapId);
    if (success) {
      toast.success('Gap closed');
    } else {
      toast.error('Failed to close gap');
    }
  };

  const filteredGaps = gaps.filter(gap => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!gap.control_code?.toLowerCase().includes(search) &&
          !gap.control_title?.toLowerCase().includes(search) &&
          !gap.gap_description?.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (filterStatus !== 'all' && gap.gap_status !== filterStatus) return false;
    if (filterSeverity !== 'all' && gap.gap_severity !== filterSeverity) return false;
    return true;
  });

  const isOverdue = (gap: ControlGap) => {
    return gap.target_date && new Date(gap.target_date) < new Date() && gap.gap_status !== 'closed';
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-primary" />
              <div>
                <p className="text-2xl font-bold">{gapStats.totalGaps}</p>
                <p className="text-xs text-muted-foreground">Total Gaps</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-6 w-6 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{gapStats.openGaps}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{gapStats.closedGaps}</p>
                <p className="text-xs text-muted-foreground">Closed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{gapStats.criticalGaps}</p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{gapStats.highGaps}</p>
                <p className="text-xs text-muted-foreground">High</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{gapStats.overdueGaps}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search gaps..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="remediated">Remediated</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleScanGaps} disabled={isScanning}>
              <Scan className={cn("h-4 w-4 mr-2", isScanning && "animate-spin")} />
              Scan for Gaps
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gaps Table */}
      <Card>
        <CardHeader>
          <CardTitle>Control Gaps ({filteredGaps.length})</CardTitle>
          <CardDescription>Identified gaps in compliance controls requiring remediation</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading gaps...</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="w-[100px]">Control</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[100px]">Severity</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead>Remediation Plan</TableHead>
                    <TableHead className="w-[120px]">Target Date</TableHead>
                    <TableHead className="w-[120px]">Identified</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGaps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No gaps found - Run "Scan for Gaps" to identify missing controls
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredGaps.map((gap) => (
                      <TableRow key={gap.id} className={cn("hover:bg-secondary/30", isOverdue(gap) && "bg-destructive/5")}>
                        <TableCell className="font-mono text-sm">{gap.control_code || '-'}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{gap.control_title || 'Unknown Control'}</div>
                          {gap.gap_description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {gap.gap_description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", SEVERITY_COLORS[gap.gap_severity])}>
                            {gap.gap_severity.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[gap.gap_status])}>
                            {gap.gap_status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {gap.remediation_plan || '-'}
                        </TableCell>
                        <TableCell className={cn("text-xs", isOverdue(gap) && "text-destructive font-medium")}>
                          {gap.target_date ? format(new Date(gap.target_date), 'MMM dd, yyyy') : '-'}
                          {isOverdue(gap) && <span className="ml-1">(OVERDUE)</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(gap.identified_at), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleEdit(gap)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {gap.gap_status !== 'closed' && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleClose(gap.id)}
                              >
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingGap} onOpenChange={(open) => !open && setEditingGap(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Gap</DialogTitle>
            <DialogDescription>
              {editingGap?.control_code} - {editingGap?.control_title}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.gap_status} onValueChange={(v) => setFormData({ ...formData, gap_status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="remediated">Remediated</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={formData.gap_severity} onValueChange={(v) => setFormData({ ...formData, gap_severity: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target_date">Target Date</Label>
              <Input
                id="target_date"
                type="date"
                value={formData.target_date}
                onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="remediation_plan">Remediation Plan</Label>
              <Textarea
                id="remediation_plan"
                placeholder="Describe the remediation plan..."
                value={formData.remediation_plan}
                onChange={(e) => setFormData({ ...formData, remediation_plan: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGap(null)}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
