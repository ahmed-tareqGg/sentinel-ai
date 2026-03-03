import { useMemo } from 'react';
import { Incident } from '@/hooks/useIncidents';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface IncidentHeatmapProps {
  incidents: Incident[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function IncidentHeatmap({ incidents }: IncidentHeatmapProps) {
  const { grid, maxCount } = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;

    incidents.forEach(inc => {
      const d = new Date(inc.created_at);
      if (d.getTime() < weekAgo) return;
      g[d.getDay()][d.getHours()]++;
    });

    let max = 1;
    g.forEach(row => row.forEach(v => { if (v > max) max = v; }));
    return { grid: g, maxCount: max };
  }, [incidents]);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-secondary/30';
    const ratio = count / maxCount;
    if (ratio > 0.75) return 'bg-destructive/80';
    if (ratio > 0.5) return 'bg-warning/70';
    if (ratio > 0.25) return 'bg-primary/50';
    return 'bg-primary/20';
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Incidents by Hour (7 days)</h3>

      <TooltipProvider delayDuration={100}>
        <div className="overflow-x-auto">
          <div className="min-w-[500px]">
            {/* Hour labels */}
            <div className="flex gap-[2px] ml-10 mb-1">
              {HOURS.map(h => (
                <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">
                  {h % 4 === 0 ? `${h}h` : ''}
                </div>
              ))}
            </div>

            {/* Grid */}
            {DAYS.map((day, di) => (
              <div key={day} className="flex items-center gap-[2px] mb-[2px]">
                <span className="text-[10px] text-muted-foreground w-9 text-right pr-1 shrink-0">{day}</span>
                {HOURS.map(h => (
                  <Tooltip key={h}>
                    <TooltipTrigger asChild>
                      <div className={cn('flex-1 h-4 rounded-[3px] transition-colors cursor-default', getColor(grid[di][h]))} />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {day} {h}:00 — {grid[di][h]} incident{grid[di][h] !== 1 ? 's' : ''}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center gap-2 mt-3 ml-10">
              <span className="text-[10px] text-muted-foreground">Less</span>
              {['bg-secondary/30', 'bg-primary/20', 'bg-primary/50', 'bg-warning/70', 'bg-destructive/80'].map((c, i) => (
                <div key={i} className={cn('w-3 h-3 rounded-[2px]', c)} />
              ))}
              <span className="text-[10px] text-muted-foreground">More</span>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}
