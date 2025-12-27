import { AlertTriangle, CheckCircle, Clock, Shield, TrendingDown, Activity } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { IncidentTable } from '@/components/dashboard/IncidentTable';
import { ClassificationChart } from '@/components/dashboard/ClassificationChart';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { MitreChart } from '@/components/dashboard/MitreChart';
import { mockIncidents, dashboardStats } from '@/lib/mockData';

export default function Dashboard() {
  return (
    <AppLayout title="Dashboard" subtitle="Real-time security operations overview">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Open Incidents"
          value={dashboardStats.openIncidents}
          subtitle={`of ${dashboardStats.totalIncidents} total`}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant="warning"
          trend={{ value: 12, isPositive: false }}
        />
        <StatCard
          title="Critical Alerts"
          value={dashboardStats.criticalAlerts}
          subtitle="Requires immediate action"
          icon={<Shield className="h-5 w-5" />}
          variant="critical"
        />
        <StatCard
          title="False Positive Rate"
          value={`${dashboardStats.falsePositiveRate}%`}
          subtitle="Last 7 days"
          icon={<TrendingDown className="h-5 w-5" />}
          variant="success"
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Avg Response Time"
          value={dashboardStats.avgResponseTime}
          subtitle="SLA Compliance: 94%"
          icon={<Clock className="h-5 w-5" />}
          variant="primary"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <TrendChart />
        </div>
        <ClassificationChart />
      </div>

      {/* MITRE & Recent Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MitreChart />
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Recent Incidents</h3>
              <a href="/incidents" className="text-sm text-primary hover:underline">View all</a>
            </div>
            <IncidentTable incidents={mockIncidents} limit={5} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
