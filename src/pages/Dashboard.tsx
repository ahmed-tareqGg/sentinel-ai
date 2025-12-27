import { AlertTriangle, CheckCircle, Clock, Shield, TrendingDown, Activity } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { IncidentTable } from '@/components/dashboard/IncidentTable';
import { ClassificationChart } from '@/components/dashboard/ClassificationChart';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { MitreChart } from '@/components/dashboard/MitreChart';
import { useIncidents } from '@/hooks/useIncidents';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { incidents, loading } = useIncidents();

  const openIncidents = incidents.filter(i => i.status === 'Open').length;
  const criticalAlerts = incidents.filter(i => i.risk_level === 'Critical').length;
  const truePositives = incidents.filter(i => i.classification === 'True Positive').length;
  const falsePositives = incidents.filter(i => i.classification === 'False Positive').length;
  const totalClassified = truePositives + falsePositives;
  const falsePositiveRate = totalClassified > 0 ? Math.round((falsePositives / totalClassified) * 100) : 0;

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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <TrendChart />
        </div>
        <ClassificationChart truePositives={truePositives} falsePositives={falsePositives} />
      </div>

      {/* MITRE & Recent Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MitreChart />
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
