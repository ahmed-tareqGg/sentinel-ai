import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, XCircle, User, ArrowRight, TrendingDown, TrendingUp, 
  Clock, DollarSign, AlertTriangle, CheckCircle2 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScenarioProps {
  metrics: {
    mttd: number;
    mttr: number;
    totalIncidents: number;
    criticalIncidents: number;
    highIncidents: number;
    falsePositiveRate: number;
    slaCompliance: number;
    playbookAutomationRate: number;
  };
  valueProtected: string | null;
  incidentsLoading: boolean;
}

export function DemoScenarioComparison({ metrics, valueProtected, incidentsLoading }: ScenarioProps) {
  const realMttd = metrics.mttd > 0 ? `${metrics.mttd} min` : '< 1 min';
  const realMttr = metrics.mttr > 0 ? `${metrics.mttr} min` : '< 1 min';
  const potentialBreachCost = metrics.criticalIncidents * 250000 + metrics.highIncidents * 50000;

  const rows = [
    {
      label: 'Mean Time to Detect',
      manual: '45 min',
      ai: realMttd,
      improvement: metrics.mttd > 0 ? `${Math.max(0, Math.round((1 - metrics.mttd / 45) * 100))}%` : '95%+',
    },
    {
      label: 'Mean Time to Respond',
      manual: '4.2 hours',
      ai: realMttr,
      improvement: metrics.mttr > 0 ? `${Math.max(0, Math.round((1 - metrics.mttr / 252) * 100))}%` : '98%+',
    },
    {
      label: 'False Positive Rate',
      manual: '76%',
      ai: `${metrics.falsePositiveRate}%`,
      improvement: `${Math.max(0, Math.round((1 - metrics.falsePositiveRate / 76) * 100))}%`,
    },
    {
      label: 'Analyst Workload',
      manual: '120 alerts/day',
      ai: `${Math.max(1, Math.round(metrics.totalIncidents * (1 - metrics.playbookAutomationRate / 100)))} escalations/day`,
      improvement: `${metrics.playbookAutomationRate}%`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Side-by-side comparison header */}
      <div className="grid grid-cols-[1fr_1fr_auto_1fr] gap-4 items-end text-center">
        <div />
        <div>
          <Badge variant="outline" className="gap-1.5 py-1.5 px-3 border-destructive/30 text-destructive bg-destructive/5">
            <User className="h-3.5 w-3.5" />
            Traditional SOC
          </Badge>
        </div>
        <div />
        <div>
          <Badge className="gap-1.5 py-1.5 px-3 bg-green-500/10 text-green-500 border border-green-500/30">
            <Shield className="h-3.5 w-3.5" />
            SOCMind AI
          </Badge>
        </div>
      </div>

      {/* Comparison rows */}
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[1fr_1fr_auto_1fr] gap-4 items-center">
            <div className="text-sm font-medium text-muted-foreground text-right pr-2">
              {row.label}
            </div>
            <Card className="bg-destructive/5 border-destructive/20">
              <CardContent className="p-3 text-center">
                <span className="text-lg font-bold text-destructive">{row.manual}</span>
              </CardContent>
            </Card>
            <div className="flex flex-col items-center gap-1">
              <ArrowRight className="h-4 w-4 text-green-500" />
              <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0.5">
                <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
                {row.improvement}
              </Badge>
            </div>
            <Card className="bg-green-500/5 border-green-500/20">
              <CardContent className="p-3 text-center">
                <span className="text-lg font-bold text-green-500">{row.ai}</span>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Bottom impact cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
        <Card className="bg-gradient-to-br from-destructive/10 to-transparent border-destructive/20">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
            <p className="text-xs text-muted-foreground mb-1">Without SOCMind</p>
            <p className="text-xl font-bold text-destructive">
              ${potentialBreachCost > 0 ? `${(potentialBreachCost / 1000000).toFixed(1)}M+` : '5.3M+'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Potential breach cost</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
          <CardContent className="p-4 text-center">
            <DollarSign className="h-6 w-6 text-green-500 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground mb-1">Value Protected</p>
            <p className="text-xl font-bold text-green-500">
              {valueProtected !== null ? valueProtected : incidentsLoading ? '...' : '$0'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              From {metrics.criticalIncidents} critical + {metrics.highIncidents} high incidents
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-xs text-muted-foreground mb-1">SLA Compliance</p>
            <p className="text-xl font-bold text-primary">{metrics.slaCompliance}%</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {metrics.totalIncidents} incidents processed
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
