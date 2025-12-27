import { AppLayout } from '@/components/layout/AppLayout';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { ClassificationChart } from '@/components/dashboard/ClassificationChart';
import { MitreChart } from '@/components/dashboard/MitreChart';
import { StatCard } from '@/components/dashboard/StatCard';
import { useIncidents } from '@/hooks/useIncidents';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Clock, Target, Zap, AlertTriangle, TrendingDown, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Analytics() {
  const { incidents, loading } = useIncidents();
  const metrics = useAnalytics(incidents);

  if (loading) {
    return (
      <AppLayout title="Analytics" subtitle="Security metrics and performance insights">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Analytics" subtitle="Security metrics and performance insights">
      {/* KPIs - SOC Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Mean Time to Detect"
          value={metrics.mttd > 0 ? `${metrics.mttd} min` : 'N/A'}
          subtitle="MTTD - Event to Detection"
          icon={<Zap className="h-5 w-5" />}
          variant="primary"
        />
        <StatCard
          title="Mean Time to Respond"
          value={metrics.mttr > 0 ? `${metrics.mttr} min` : 'N/A'}
          subtitle="MTTR - Detection to Resolution"
          icon={<Clock className="h-5 w-5" />}
          variant="primary"
        />
        <StatCard
          title="SLA Compliance"
          value={`${metrics.slaCompliance}%`}
          subtitle={`${metrics.closedIncidents} closed incidents`}
          icon={<Target className="h-5 w-5" />}
          variant={metrics.slaCompliance >= 90 ? 'success' : 'warning'}
        />
        <StatCard
          title="False Positive Rate"
          value={`${metrics.falsePositiveRate}%`}
          subtitle="AI classification accuracy"
          icon={<TrendingDown className="h-5 w-5" />}
          variant={metrics.falsePositiveRate <= 30 ? 'success' : 'warning'}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Incidents"
          value={metrics.totalIncidents}
          subtitle={`${metrics.openIncidents} open`}
          icon={<Activity className="h-5 w-5" />}
          variant="primary"
        />
        <StatCard
          title="Critical Alerts"
          value={metrics.criticalIncidents}
          subtitle="Requires immediate action"
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={metrics.criticalIncidents > 0 ? 'critical' : 'success'}
        />
        <StatCard
          title="High Risk"
          value={metrics.highIncidents}
          subtitle="Elevated priority"
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={metrics.highIncidents > 0 ? 'warning' : 'success'}
        />
        <StatCard
          title="Automation Rate"
          value={`${metrics.playbookAutomationRate}%`}
          subtitle="AI-assisted incidents"
          icon={<Zap className="h-5 w-5" />}
          variant="primary"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TrendChart data={metrics.incidentsPerDay} />
        <ClassificationChart 
          truePositives={metrics.truePositives} 
          falsePositives={metrics.falsePositives} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MitreChart incidents={incidents} />
        
        {/* Severity Distribution */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Severity Distribution</h3>
          <div className="h-64">
            {metrics.severityDistribution.some(s => s.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.severityDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(215, 20%, 55%)" 
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(215, 20%, 55%)" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(222, 47%, 8%)', 
                      border: '1px solid hsl(222, 30%, 18%)',
                      borderRadius: '8px',
                      color: 'hsl(210, 40%, 96%)'
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {metrics.severityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No severity data yet
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
