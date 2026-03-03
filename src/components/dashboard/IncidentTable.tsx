import { useNavigate } from 'react-router-dom';
import { ExternalLink, MoreHorizontal, UserCheck, ArrowUpCircle, XCircle, Clock } from 'lucide-react';
import { Incident } from '@/hooks/useIncidents';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { RelatedIncidentsBadge } from '@/components/incidents/RelatedIncidentsBadge';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';

interface IncidentTableProps {
  incidents: Incident[];
  allIncidents?: Incident[];
  limit?: number;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  onRefresh?: () => void;
}

const SLA_MINUTES: Record<string, number> = {
  Critical: 15, High: 30, Medium: 60, Low: 240, Info: 480,
};

function getSlaStatus(incident: Incident) {
  if (incident.status === 'Closed' || incident.status === 'Resolved') return null;
  const slaMin = SLA_MINUTES[incident.risk_level] || 60;
  const elapsed = (Date.now() - new Date(incident.created_at).getTime()) / 60000;
  const remaining = slaMin - elapsed;
  const pct = Math.max(0, Math.min(100, (remaining / slaMin) * 100));
  const breached = remaining <= 0;
  const warning = pct <= 20 && !breached;
  return { pct, remaining, breached, warning, slaMin };
}

const severityColors: Record<number, string> = {
  1: 'bg-success/20 text-success border-success/30',
  2: 'bg-success/20 text-success border-success/30',
  3: 'bg-primary/20 text-primary border-primary/30',
  4: 'bg-warning/20 text-warning border-warning/30',
  5: 'bg-critical/20 text-critical border-critical/30',
};

const statusColors: Record<string, string> = {
  'Open': 'bg-destructive/20 text-destructive border-destructive/30',
  'In Progress': 'bg-warning/20 text-warning border-warning/30',
  'Closed': 'bg-muted text-muted-foreground border-border',
};

const classificationColors: Record<string, string> = {
  'True Positive': 'bg-destructive/20 text-destructive border-destructive/30',
  'False Positive': 'bg-success/20 text-success border-success/30',
  'Pending': 'bg-muted text-muted-foreground border-border',
};

export function IncidentTable({ incidents, allIncidents, limit, selectable, selectedIds, onSelectionChange, onRefresh }: IncidentTableProps) {
  const navigate = useNavigate();
  const displayedIncidents = limit ? incidents.slice(0, limit) : incidents;
  const relatedPool = allIncidents || incidents;

  const allSelected = displayedIncidents.length > 0 && selectedIds && displayedIncidents.every(i => selectedIds.has(i.id));
  const someSelected = selectedIds && displayedIncidents.some(i => selectedIds.has(i.id)) && !allSelected;

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(displayedIncidents.map(i => i.id)));
    }
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  if (displayedIncidents.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">No incidents to display</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              {selectable && (
                <th className="px-4 py-3 w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source IP</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dest IP</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Severity</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Classification</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confidence</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">SLA</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Related</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayedIncidents.map((incident) => (
              <tr 
                key={incident.id} 
                className={cn(
                  "transition-colors hover:bg-secondary/20 cursor-pointer",
                  selectable && selectedIds?.has(incident.id) && "bg-primary/5"
                )}
                onClick={() => navigate(`/incidents/${incident.id}`)}
              >
                {selectable && (
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds?.has(incident.id) || false}
                      onCheckedChange={() => toggleOne(incident.id)}
                      aria-label={`Select ${incident.incident_number}`}
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <span className="font-mono text-sm font-medium text-primary">{incident.incident_number}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-foreground">{incident.event_type}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-mono text-foreground/80">{incident.src_ip || '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-mono text-foreground/80">{incident.dst_ip || '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={cn('font-mono', severityColors[incident.severity])}>
                    {incident.severity}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={cn(classificationColors[incident.classification ?? 'Pending'])}>
                    {incident.classification || 'Pending'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {incident.confidence > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full bg-secondary overflow-hidden">
                        <div 
                          className={cn(
                            'h-full rounded-full transition-all',
                            incident.confidence >= 80 ? 'bg-success' : 
                            incident.confidence >= 50 ? 'bg-warning' : 'bg-destructive'
                          )}
                          style={{ width: `${incident.confidence}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono text-muted-foreground">{incident.confidence}%</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <RelatedIncidentsBadge incident={incident} allIncidents={relatedPool} />
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={cn(statusColors[incident.status])}>
                    {incident.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    const sla = getSlaStatus(incident);
                    if (!sla) return <span className="text-xs text-muted-foreground">—</span>;
                    return (
                      <div className="flex items-center gap-1.5 min-w-[80px]">
                        <div className="h-1.5 w-14 rounded-full bg-secondary overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              sla.breached ? 'bg-destructive' : sla.warning ? 'bg-warning' : 'bg-success'
                            )}
                            style={{ width: `${sla.pct}%` }}
                          />
                        </div>
                        <span className={cn('text-[10px] font-mono', sla.breached ? 'text-destructive' : sla.warning ? 'text-warning' : 'text-muted-foreground')}>
                          {sla.breached ? 'Breached' : `${Math.ceil(sla.remaining)}m`}
                        </span>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-primary hover:text-primary hover:bg-primary/10 h-7 w-7 p-0"
                      onClick={() => navigate(`/incidents/${incident.id}`)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    {incident.status !== 'Closed' && incident.status !== 'Resolved' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border w-44">
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer text-xs"
                            onClick={async () => {
                              const { data: { user } } = await supabase.auth.getUser();
                              if (!user) return;
                              const { error } = await supabase.from('incidents').update({
                                incident_owner_id: user.id,
                                status: 'Assigned',
                                assigned_at: new Date().toISOString(),
                              }).eq('id', incident.id);
                              if (error) toast.error('Failed to assign');
                              else { toast.success(`Assigned ${incident.incident_number} to you`); onRefresh?.(); }
                            }}
                          >
                            <UserCheck className="h-3.5 w-3.5" /> Assign to me
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer text-xs"
                            onClick={async () => {
                              const { error } = await supabase.from('incidents').update({
                                status: 'Escalated',
                                escalated_at: new Date().toISOString(),
                              }).eq('id', incident.id);
                              if (error) toast.error('Failed to escalate');
                              else { toast.success(`Escalated ${incident.incident_number}`); onRefresh?.(); }
                            }}
                          >
                            <ArrowUpCircle className="h-3.5 w-3.5" /> Escalate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer text-xs text-muted-foreground"
                            onClick={async () => {
                              const { error } = await supabase.from('incidents').update({
                                classification: 'False Positive',
                                status: 'Closed',
                                closed_at: new Date().toISOString(),
                                closed_reason: 'Closed as False Positive from table',
                              }).eq('id', incident.id);
                              if (error) toast.error('Failed to close');
                              else { toast.success(`${incident.incident_number} closed as FP`); onRefresh?.(); }
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Close as FP
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
