import { Card, CardContent } from '@/components/ui/card';
import { Clock, Brain, Scale, DollarSign, Activity, Target, Shield, Zap } from 'lucide-react';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';

interface HighlightProps {
  totalTime: number;
  avgConfidence: number | null;
  playbookCount: number;
  valueProtected: string | null;
  incidentsLoading: boolean;
  metrics: {
    totalIncidents: number;
    slaCompliance: number;
    playbookAutomationRate: number;
    closedIncidents: number;
  };
}

function AnimatedStat({ value, suffix = '' }: { value: number; suffix?: string }) {
  const animated = useAnimatedCounter(value);
  return <>{animated}{suffix}</>;
}

export function DemoKeyHighlights({ totalTime, avgConfidence, playbookCount, valueProtected, incidentsLoading, metrics }: HighlightProps) {
  const highlights = [
    {
      icon: Clock,
      value: totalTime > 0 ? `${(totalTime / 1000).toFixed(1)}s` : '--',
      label: 'Total Response Time',
      color: 'text-green-500',
      gradient: 'from-green-500/20 to-green-500/5',
      border: 'border-green-500/30',
    },
    {
      icon: Brain,
      value: avgConfidence !== null && avgConfidence > 0 ? `${avgConfidence}%` : incidentsLoading ? '...' : '--',
      label: 'AI Confidence',
      color: 'text-primary',
      gradient: 'from-primary/20 to-primary/5',
      border: 'border-primary/30',
    },
    {
      icon: Activity,
      value: metrics.totalIncidents > 0 ? `${metrics.totalIncidents}` : '--',
      label: 'Incidents Processed',
      color: 'text-cyan-400',
      gradient: 'from-cyan-500/20 to-cyan-500/5',
      border: 'border-cyan-500/30',
    },
    {
      icon: Target,
      value: `${metrics.playbookAutomationRate}%`,
      label: 'AI Automation Rate',
      color: 'text-amber-400',
      gradient: 'from-amber-500/20 to-amber-500/5',
      border: 'border-amber-500/30',
    },
    {
      icon: Scale,
      value: playbookCount > 0 ? `${playbookCount}` : '--',
      label: 'Active Playbooks',
      color: 'text-purple-400',
      gradient: 'from-purple-500/20 to-purple-500/5',
      border: 'border-purple-500/30',
    },
    {
      icon: DollarSign,
      value: valueProtected !== null ? valueProtected : incidentsLoading ? '...' : '$0',
      label: 'Value Protected',
      color: 'text-yellow-500',
      gradient: 'from-yellow-500/20 to-yellow-500/5',
      border: 'border-yellow-500/30',
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {highlights.map((h) => {
        const Icon = h.icon;
        return (
          <Card key={h.label} className={`bg-gradient-to-br ${h.gradient} ${h.border}`}>
            <CardContent className="p-4 text-center">
              <Icon className={`h-6 w-6 ${h.color} mx-auto mb-2`} />
              <p className={`text-xl font-bold ${h.color} tabular-nums`}>{h.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{h.label}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
