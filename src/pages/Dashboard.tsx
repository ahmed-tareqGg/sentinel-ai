import { AlertTriangle, CheckCircle, Clock, Shield, TrendingDown, Activity, Zap, Target } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { IncidentTable } from '@/components/dashboard/IncidentTable';
import { ClassificationChart } from '@/components/dashboard/ClassificationChart';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { MitreChart } from '@/components/dashboard/MitreChart';
import { MitreHeatmap } from '@/components/dashboard/MitreHeatmap';
import { useIncidents } from '@/hooks/useIncidents';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { incidents, loading } = useIncidents();
  const metrics = useAnalytics(incidents);

  const openIncidents = metrics.openIncidents;
  const criticalAlerts = metrics.criticalIncidents;
  const truePositives = metrics.truePositives;
  const falsePositives = metrics.falsePositives;
  const falsePositiveRate = metrics.falsePositiveRate;

  return (
    <AppLayout title="Dashboard" subtitle="Real-time security operations overview">
      {/* SOC Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4" data-tour="soc-metrics">
        <StatCard
          title="MTTD"
          value={metrics.mttd > 0 ? `${metrics.mttd} min` : '< 1 min'}
          subtitle="Mean Time to Detect"
          icon={<Zap className="h-5 w-5" />}
          variant="primary"
        />
        <StatCard
          title="MTTR"
          value={metrics.mttr > 0 ? (metrics.mttr >= 60 ? `${Math.round(metrics.mttr / 60)}h` : `${metrics.mttr} min`) : '< 1 min'}
          subtitle="Mean Time to Respond"
          icon={<Clock className="h-5 w-5" />}
          variant="primary"
        />
        <StatCard
          title="SLA Compliance"
          value={`${metrics.slaCompliance}%`}
          subtitle={`${metrics.closedIncidents} resolved incidents`}
          icon={<Target className="h-5 w-5" />}
          variant={metrics.slaCompliance >= 90 ? 'success' : 'warning'}
        />
        <StatCard
          title="Automation Rate"
          value={`${metrics.playbookAutomationRate}%`}
          subtitle="AI-assisted incidents"
          icon={<Zap className="h-5 w-5" />}
          variant="primary"
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-tour="stat-cards">
        <StatCard
          title="Open Incidents"
          value={openIncidents}
          subtitle={`of ${incidents.length} total`}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant="warning"
        />
        <StatCard
          title="Critical Alerts"
          value={criticalAlerts}
          subtitle="Requires immediate action"
          icon={<Shield className="h-5 w-5" />}
          variant="critical"
        />
        <StatCard
          title="False Positive Rate"
          value={`${falsePositiveRate}%`}
          subtitle="AI classification accuracy"
          icon={<TrendingDown className="h-5 w-5" />}
          variant="success"
        />
        <StatCard
          title="Total Incidents"
          value={incidents.length}
          subtitle="All time"
          icon={<Activity className="h-5 w-5" />}
          variant="primary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6" data-tour="incidents-chart">
        <div className="lg:col-span-2">
          <TrendChart data={metrics.incidentsPerDay} />
        </div>
        <ClassificationChart truePositives={truePositives} falsePositives={falsePositives} />
      </div>

      {/* MITRE Heatmap - Full Width for Investors WOW */}
      <div className="mb-6" data-tour="mitre-heatmap">
        <MitreHeatmap incidents={incidents} />
      </div>

      {/* MITRE & Recent Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MitreChart incidents={incidents} />
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Recent Incidents</h3>
              <Link to="/incidents" className="text-sm text-primary hover:underline">View all</Link>
            </div>
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : incidents.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No incidents yet. Submit a log to get started.</p>
            ) : (
              <IncidentTable incidents={incidents} limit={5} />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
