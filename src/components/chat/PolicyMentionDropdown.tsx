import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/backend/client';
import { Badge } from '@/components/ui/badge';
import { Shield, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PolicyOption {
  id: string;
  control_code: string;
  title: string;
  standard: string;
  category: string | null;
  control_category: string | null;
  implemented: boolean | null;
  applicable: string | null;
}

interface PolicyMentionDropdownProps {
  filter: string;
  selectedIndex: number;
  onSelect: (policy: PolicyOption) => void;
}

const standardColors: Record<string, string> = {
  ISO27001: 'bg-primary/20 text-primary border-primary/30',
  SOC2: 'bg-green-500/20 text-green-400 border-green-500/30',
  GDPR: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const statusColors: Record<string, string> = {
  implemented: 'bg-green-500/20 text-green-400 border-green-500/30',
  not_implemented: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export function PolicyMentionDropdown({ filter, selectedIndex, onSelect }: PolicyMentionDropdownProps) {
  const [policies, setPolicies] = useState<PolicyOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let query = supabase
        .from('compliance_controls')
        .select('id, control_code, title, standard, category, control_category, implemented, applicable')
        .order('control_code', { ascending: true })
        .limit(8);

      if (filter) {
        query = query.or(`control_code.ilike.%${filter}%,title.ilike.%${filter}%,standard.ilike.%${filter}%`);
      }

      const { data } = await query;
      setPolicies((data as PolicyOption[]) || []);
      setLoading(false);
    };
    load();
  }, [filter]);

  if (loading) {
    return (
      <div className="absolute bottom-full left-4 right-4 mb-1 bg-card border border-border rounded-lg shadow-lg p-3 z-50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Search className="h-3 w-3 animate-pulse" /> Searching controls...
        </div>
      </div>
    );
  }

  if (policies.length === 0) return null;

  return (
    <div className="absolute bottom-full left-4 right-4 mb-1 bg-card border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto z-50">
      <div className="px-3 py-1.5 border-b border-border/50">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Link Compliance Control</span>
      </div>
      {policies.map((pol, idx) => (
        <button
          key={pol.id}
          onClick={() => onSelect(pol)}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2 text-sm hover:bg-secondary/60 transition-colors',
            idx === selectedIndex && 'bg-secondary/60'
          )}
        >
          <Shield className={cn('h-4 w-4 shrink-0', pol.implemented ? 'text-green-400' : 'text-yellow-400')} />
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-primary text-xs">{pol.control_code}</span>
              <Badge variant="outline" className={cn('text-[9px] px-1 py-0', standardColors[pol.standard] || 'bg-muted text-muted-foreground')}>
                {pol.standard}
              </Badge>
              <Badge variant="outline" className={cn('text-[9px] px-1 py-0', pol.implemented ? statusColors.implemented : statusColors.not_implemented)}>
                {pol.implemented ? 'Implemented' : 'Not Impl.'}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{pol.title}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
