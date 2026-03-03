import { useMemo } from 'react';
import { Crosshair, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Incident } from '@/hooks/useIncidents';
import { cn } from '@/lib/utils';

interface TopAttackersProps {
  incidents: Incident[];
}

export function TopAttackers({ incidents }: TopAttackersProps) {
  const attackers = useMemo(() => {
    const openIncidents = incidents.filter(i => i.status !== 'Closed');
    const ipMap = new Map<string, { count: number; critical: number; lastSeen: string }>();

    openIncidents.forEach(inc => {
      if (!inc.src_ip) return;
      const existing = ipMap.get(inc.src_ip) || { count: 0, critical: 0, lastSeen: inc.created_at };
      existing.count++;
      if (inc.risk_level === 'Critical' || inc.risk_level === 'High') existing.critical++;
      if (inc.created_at > existing.lastSeen) existing.lastSeen = inc.created_at;
      ipMap.set(inc.src_ip, existing);
    });

    return Array.from(ipMap.entries())
      .map(([ip, data]) => ({ ip, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [incidents]);

  const maxCount = attackers[0]?.count || 1;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-destructive" />
          <h3 className="text-sm font-semibold text-foreground">Top Attackers</h3>
        </div>
        <Link to="/threat-intel" className="text-xs text-primary hover:underline flex items-center gap-1">
          Threat Intel <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {attackers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No active attackers</p>
      ) : (
        <div className="space-y-2.5">
          {attackers.map((attacker, i) => (
            <div key={attacker.ip} className="flex items-center gap-3 group">
              <span className="text-xs font-mono text-muted-foreground w-5 text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <Link
                    to={`/threat-intel?ip=${attacker.ip}`}
                    className="text-sm font-mono text-foreground hover:text-primary transition-colors truncate"
                  >
                    {attacker.ip}
                  </Link>
                  <div className="flex items-center gap-2">
                    {attacker.critical > 0 && (
                      <span className="text-[10px] font-bold text-destructive">{attacker.critical} crit</span>
                    )}
                    <span className="text-xs font-semibold text-muted-foreground">{attacker.count}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      attacker.critical > 0 ? 'bg-destructive' : 'bg-warning'
                    )}
                    style={{ width: `${(attacker.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
