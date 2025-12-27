import { AppLayout } from '@/components/layout/AppLayout';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { ClassificationChart } from '@/components/dashboard/ClassificationChart';
import { MitreChart } from '@/components/dashboard/MitreChart';
import { StatCard } from '@/components/dashboard/StatCard';
import { dashboardStats, severityDistribution } from '@/lib/mockData';
import { TrendingDown, Clock, Target, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Analytics() {
  return (
    <AppLayout title="Analytics" subtitle="Security metrics and performance insights">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Alert Noise Reduction"
          value="62%"
          subtitle="vs. pre-AI baseline"
          icon={<TrendingDown className="h-5 w-5" />}
          variant="success"
        />
        <StatCard
          title="Mean Time to Respond"
          value="4.2 min"
          subtitle="Target: 5 min"
          icon={<Clock className="h-5 w-5" />}
          variant="primary"
        />
        <StatCard
          title="SLA Compliance"
          value={`${dashboardStats.slaCompliance}%`}
          subtitle="Last 30 days"
          icon={<Target className="h-5 w-5" />}
          variant="success"
        />
        <StatCard
          title="SOC Efficiency"
          value="+45%"
          subtitle="Analyst productivity"
          icon={<Users className="h-5 w-5" />}
          variant="primary"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TrendChart />
        <ClassificationChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MitreChart />
        
        {/* Severity Distribution */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Severity Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityDistribution}>
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
                  {severityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
