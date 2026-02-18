import { AppLayout } from '@/components/layout/AppLayout';
import { AnimatedPage, AnimatedCard, AnimatedSection } from '@/components/ui/animated-card';
import { useIncidents } from '@/hooks/useIncidents';
import { useAnalytics } from '@/hooks/useAnalytics';
import { AnalystLeaderboard } from '@/components/gamification/AnalystLeaderboard';
import { Shield, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, Target, Activity, BarChart3, PieChart, DollarSign, Flame, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, RadialBarChart, RadialBar, Legend, LineChart, Line } from 'recharts';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

function KPICard({ title, value, subtitle, trend, icon, color }: { title: string; value: string | number; subtitle?: string; trend?: { value: number; up: boolean }; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="mt-2 text-3xl font-black text-foreground tabular-nums">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          {trend && (
            <div className={cn("flex items-center gap-1 mt-2 text-xs font-medium", trend.up ? "text-emerald-400" : "text-red-400")}>
              {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend.value)}% vs last week
            </div>
          )}
        </div>
        <div className={cn("p-3 rounded-xl", color)}>{icon}</div>
      </div>
    </div>
  );
}

export default function ExecutiveDashboard() {
  const { incidents } = useIncidents();
  const metrics = useAnalytics(incidents);

  const riskData = [
    { name: 'Critical', value: metrics.criticalIncidents, fill: 'hsl(0, 84%, 60%)' },
    { name: 'High', value: metrics.highIncidents, fill: 'hsl(25, 95%, 53%)' },
    { name: 'Medium', value: incidents.filter(i => i.risk_level === 'Medium').length, fill: 'hsl(187, 100%, 50%)' },
    { name: 'Low', value: incidents.filter(i => i.risk_level === 'Low').length, fill: 'hsl(142, 71%, 45%)' },
  ].filter(d => d.value > 0);

  const statusData = [
    { name: 'Open', count: metrics.openIncidents, fill: 'hsl(25, 95%, 53%)' },
    { name: 'Investigating', count: incidents.filter(i => i.status === 'Investigating').length, fill: 'hsl(187, 100%, 50%)' },
    { name: 'Resolved', count: incidents.filter(i => i.status === 'Resolved').length, fill: 'hsl(142, 71%, 45%)' },
    { name: 'Closed', count: metrics.closedIncidents, fill: 'hsl(210, 50%, 50%)' },
  ];

  // Readiness score based on all metrics
  const readinessFactors = [
    { name: 'Detection Speed', value: metrics.mttd <= 5 ? 100 : metrics.mttd <= 15 ? 75 : metrics.mttd <= 30 ? 50 : 25, fill: 'hsl(var(--primary))' },
    { name: 'Response Time', value: metrics.mttr <= 30 ? 100 : metrics.mttr <= 60 ? 75 : metrics.mttr <= 120 ? 50 : 25, fill: 'hsl(187, 100%, 50%)' },
    { name: 'SLA Compliance', value: metrics.slaCompliance, fill: 'hsl(142, 71%, 45%)' },
    { name: 'Automation', value: metrics.playbookAutomationRate, fill: 'hsl(25, 95%, 53%)' },
  ];
  const overallReadiness = Math.round(readinessFactors.reduce((s, f) => s + f.value, 0) / readinessFactors.length);

  // Financial risk estimate: $50K per critical, $15K per high, $5K per medium
  const financialRisk = metrics.criticalIncidents * 50000 + metrics.highIncidents * 15000 +
    incidents.filter(i => i.risk_level === 'Medium').length * 5000;

  const formatMoney = (n: number) =>
    n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`;

  // Top threat types
  const threatTypes = incidents.reduce<Record<string, number>>((acc, i) => {
    acc[i.event_type] = (acc[i.event_type] || 0) + 1;
    return acc;
  }, {});
  const topThreats = Object.entries(threatTypes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return (
    <AppLayout title="Executive Dashboard" subtitle="Strategic overview for leadership">
      <AnimatedPage>
        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <AnimatedCard index={0}>
            <KPICard title="Total Incidents" value={incidents.length} subtitle="All time" icon={<Activity className="h-5 w-5 text-primary" />} color="bg-primary/20" />
          </AnimatedCard>
          <AnimatedCard index={1}>
            <KPICard title="Critical / High" value={`${metrics.criticalIncidents} / ${metrics.highIncidents}`} subtitle="Requiring attention" icon={<AlertTriangle className="h-5 w-5 text-orange-400" />} color="bg-orange-500/20" />
          </AnimatedCard>
          <AnimatedCard index={2}>
            <KPICard title="MTTR" value={metrics.mttr > 0 ? (metrics.mttr >= 60 ? `${Math.round(metrics.mttr / 60)}h` : `${metrics.mttr}m`) : '< 1m'} subtitle="Mean Time to Respond" icon={<Clock className="h-5 w-5 text-cyan-400" />} color="bg-cyan-500/20" />
          </AnimatedCard>
          <AnimatedCard index={3}>
            <KPICard title="SOC Readiness" value={`${overallReadiness}%`} subtitle="Overall security posture" icon={<Shield className="h-5 w-5 text-emerald-400" />} color="bg-emerald-500/20" trend={{ value: 5, up: overallReadiness >= 50 }} />
          </AnimatedCard>
        </div>

        {/* Financial Risk + SLA + Open */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <AnimatedCard index={4}>
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Estimated Financial Risk</p>
                  <p className="mt-2 text-3xl font-black text-destructive tabular-nums">{formatMoney(financialRisk)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Based on incident severity distribution</p>
                </div>
                <div className="p-3 rounded-xl bg-destructive/20"><DollarSign className="h-5 w-5 text-destructive" /></div>
              </div>
            </div>
          </AnimatedCard>
          <AnimatedCard index={5}>
            <div className="rounded-xl border border-warning/20 bg-warning/5 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">SLA Compliance</p>
                  <p className="mt-2 text-3xl font-black text-foreground tabular-nums">{metrics.slaCompliance}%</p>
                  <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-warning"
                      initial={{ width: 0 }}
                      animate={{ width: `${metrics.slaCompliance}%` }}
                      transition={{ duration: 1.2 }}
                    />
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-warning/20"><Lock className="h-5 w-5 text-warning" /></div>
              </div>
            </div>
          </AnimatedCard>
          <AnimatedCard index={6}>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Open Incidents</p>
                  <p className="mt-2 text-3xl font-black text-primary tabular-nums">{metrics.openIncidents}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{metrics.criticalIncidents} critical need immediate action</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/20"><Flame className="h-5 w-5 text-primary" /></div>
              </div>
            </div>
          </AnimatedCard>
        </div>

        {/* Charts row */}
        <AnimatedSection>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Risk Distribution */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><PieChart className="h-4 w-4 text-muted-foreground" /> Risk Distribution</h3>
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPie>
                  <Pie data={riskData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {riskData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </div>

            {/* Top Threat Types */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Flame className="h-4 w-4 text-muted-foreground" /> Top Threat Types</h3>
              {topThreats.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topThreats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={90} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Readiness Gauge */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Target className="h-4 w-4 text-muted-foreground" /> Readiness Factors</h3>
              <div className="space-y-3">
                {readinessFactors.map(f => (
                  <div key={f.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{f.name}</span>
                      <span className="font-medium text-foreground">{f.value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: f.fill }}
                        initial={{ width: 0 }}
                        animate={{ width: `${f.value}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border text-center">
                <p className="text-3xl font-black text-foreground">{overallReadiness}%</p>
                <p className="text-xs text-muted-foreground">Overall Readiness</p>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Leaderboard + Incident Trend */}
        <AnimatedSection>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnalystLeaderboard />
            
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Incident Volume (7 Days)</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={metrics.incidentsPerDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                  <Bar dataKey="incidents" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Total" />
                  <Bar dataKey="truePositive" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} name="True Positive" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </AnimatedSection>
      </AnimatedPage>
    </AppLayout>
  );
}
