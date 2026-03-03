import { useMemo } from 'react';
import { Incident } from '@/hooks/useIncidents';
import { cn } from '@/lib/utils';

interface RiskScoreGaugeProps {
  incidents: Incident[];
}

export function RiskScoreGauge({ incidents }: RiskScoreGaugeProps) {
  const { score, label, color, factors } = useMemo(() => {
    const open = incidents.filter(i => i.status !== 'Closed' && i.status !== 'Resolved');
    const critical = open.filter(i => i.risk_level === 'Critical').length;
    const high = open.filter(i => i.risk_level === 'High').length;
    const unassigned = open.filter(i => !i.assigned_to && !(i as any).incident_owner_id).length;

    // Score: 0-100 (100 = worst)
    let s = 0;
    s += Math.min(critical * 15, 45); // up to 45 from criticals
    s += Math.min(high * 8, 25);      // up to 25 from highs
    s += Math.min(unassigned * 5, 20); // up to 20 from unassigned
    s += Math.min(open.length, 10);    // up to 10 from total open
    s = Math.min(s, 100);

    const lbl = s >= 75 ? 'Critical' : s >= 50 ? 'High' : s >= 25 ? 'Medium' : 'Low';
    const clr = s >= 75 ? 'text-destructive' : s >= 50 ? 'text-warning' : s >= 25 ? 'text-primary' : 'text-success';

    return {
      score: s,
      label: lbl,
      color: clr,
      factors: { critical, high, unassigned, totalOpen: open.length },
    };
  }, [incidents]);

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference * 0.75; // 270° arc
  const rotation = -225; // start from bottom-left

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Risk Score</h3>

      <div className="flex flex-col items-center">
        <svg width="160" height="140" viewBox="0 0 160 140">
          {/* Background arc */}
          <circle
            cx="80" cy="80" r={radius}
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
            transform={`rotate(${rotation} 80 80)`}
          />
          {/* Score arc */}
          <circle
            cx="80" cy="80" r={radius}
            fill="none"
            stroke={score >= 75 ? 'hsl(var(--destructive))' : score >= 50 ? 'hsl(var(--warning))' : score >= 25 ? 'hsl(var(--primary))' : 'hsl(var(--success))'}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
            strokeDashoffset={strokeDashoffset}
            transform={`rotate(${rotation} 80 80)`}
            className="transition-all duration-1000"
          />
          <text x="80" y="72" textAnchor="middle" className={cn('text-3xl font-bold fill-foreground')}>{score}</text>
          <text x="80" y="92" textAnchor="middle" className="text-xs fill-muted-foreground">{label}</text>
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
        <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
          <span className="text-muted-foreground">Critical</span>
          <span className="font-bold text-destructive">{factors.critical}</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
          <span className="text-muted-foreground">High</span>
          <span className="font-bold text-warning">{factors.high}</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
          <span className="text-muted-foreground">Unassigned</span>
          <span className="font-bold text-foreground">{factors.unassigned}</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
          <span className="text-muted-foreground">Open</span>
          <span className="font-bold text-foreground">{factors.totalOpen}</span>
        </div>
      </div>
    </div>
  );
}
