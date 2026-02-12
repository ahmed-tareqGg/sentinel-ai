import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/backend/client';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IncidentOption {
  id: string;
  incident_number: string;
  event_type: string;
  severity: number;
  risk_level: string | null;
  status: string | null;
}

interface IncidentMentionDropdownProps {
  filter: string;
  selectedIndex: number;
  onSelect: (incident: IncidentOption) => void;
}

const riskColors: Record<string, string> = {
  Critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  High: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Low: 'bg-green-500/20 text-green-400 border-green-500/30',
};

export function IncidentMentionDropdown({ filter, selectedIndex, onSelect }: IncidentMentionDropdownProps) {
  const [incidents, setIncidents] = useState<IncidentOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let query = supabase
        .from('incidents')
        .select('id, incident_number, event_type, severity, risk_level, status')
        .order('created_at', { ascending: false })
        .limit(8);

      if (filter) {
        query = query.or(`incident_number.ilike.%${filter}%,event_type.ilike.%${filter}%`);
      }

      const { data } = await query;
      setIncidents((data as IncidentOption[]) || []);
      setLoading(false);
    };
    load();
  }, [filter]);

  if (loading) {
    return (
      <div className="absolute bottom-full left-4 right-4 mb-1 bg-card border border-border rounded-lg shadow-lg p-3 z-50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Search className="h-3 w-3 animate-pulse" /> Searching incidents...
        </div>
      </div>
    );
  }

  if (incidents.length === 0) return null;

  return (
    <div className="absolute bottom-full left-4 right-4 mb-1 bg-card border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto z-50">
      <div className="px-3 py-1.5 border-b border-border/50">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Link Incident</span>
      </div>
      {incidents.map((inc, idx) => (
        <button
          key={inc.id}
          onClick={() => onSelect(inc)}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2 text-sm hover:bg-secondary/60 transition-colors',
            idx === selectedIndex && 'bg-secondary/60'
          )}
        >
          <AlertTriangle className={cn('h-4 w-4 shrink-0', inc.risk_level === 'Critical' ? 'text-red-400' : inc.risk_level === 'High' ? 'text-orange-400' : 'text-yellow-400')} />
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-primary text-xs">{inc.incident_number}</span>
              <Badge variant="outline" className={cn('text-[9px] px-1 py-0', riskColors[inc.risk_level || 'Low'])}>
                {inc.risk_level}
              </Badge>
              <Badge variant="outline" className="text-[9px] px-1 py-0">{inc.status}</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{inc.event_type}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
