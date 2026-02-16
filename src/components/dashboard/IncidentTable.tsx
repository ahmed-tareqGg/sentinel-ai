import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Incident } from '@/hooks/useIncidents';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface IncidentTableProps {
  incidents: Incident[];
  limit?: number;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
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

export function IncidentTable({ incidents, limit, selectable, selectedIds, onSelectionChange }: IncidentTableProps) {
  const navigate = useNavigate();
  const displayedIncidents = limit ? incidents.slice(0, limit) : incidents;

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
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
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
                  <Badge variant="outline" className={cn(classificationColors[incident.classification])}>
                    {incident.classification}
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
                  <Badge variant="outline" className={cn(statusColors[incident.status])}>
                    {incident.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-primary hover:text-primary hover:bg-primary/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/incidents/${incident.id}`);
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
