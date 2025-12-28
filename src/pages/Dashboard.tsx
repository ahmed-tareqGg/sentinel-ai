import { AlertTriangle, CheckCircle, Clock, Shield, TrendingDown, Activity } from 'lucide-react';
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
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <TrendChart data={metrics.incidentsPerDay} />
        </div>
        <ClassificationChart truePositives={truePositives} falsePositives={falsePositives} />
      </div>

      {/* MITRE Heatmap - Full Width for Investors WOW */}
      <div className="mb-6">
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
