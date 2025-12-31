import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Shield, 
  Activity, 
  AlertTriangle,
  Server,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';
import { supabase } from '@/integrations/backend/client';

interface CloudOverviewProps {
  safeMode: boolean;
}

interface Stats {
  totalIncidents: number;
  openIncidents: number;
  activePlaybooks: number;
  totalExecutions: number;
  pendingApprovals: number;
  recentErrors: number;
}

export function CloudOverview({ safeMode }: CloudOverviewProps) {
  const [stats, setStats] = useState<Stats>({
    totalIncidents: 0,
    openIncidents: 0,
    activePlaybooks: 0,
    totalExecutions: 0,
    pendingApprovals: 0,
    recentErrors: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [incidents, openIncidents, playbooks, executions, approvals] = await Promise.all([
        supabase.from('incidents').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('status', 'Open').is('deleted_at', null),
        supabase.from('playbooks').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('playbook_executions').select('id', { count: 'exact', head: true }),
        supabase.from('approval_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      ]);

      setStats({
        totalIncidents: incidents.count || 0,
        openIncidents: openIncidents.count || 0,
        activePlaybooks: playbooks.count || 0,
        totalExecutions: executions.count || 0,
        pendingApprovals: approvals.count || 0,
        recentErrors: 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const overviewCards = [
    {
      title: 'Total Incidents',
      value: stats.totalIncidents,
      icon: AlertTriangle,
      color: 'text-warning',
      bgColor: 'bg-warning/10'
    },
    {
      title: 'Open Incidents',
      value: stats.openIncidents,
      icon: Activity,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10'
    },
    {
      title: 'Active Playbooks',
      value: stats.activePlaybooks,
      icon: Zap,
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    {
      title: 'Playbook Executions',
      value: stats.totalExecutions,
      icon: Server,
      color: 'text-success',
      bgColor: 'bg-success/10'
    },
    {
      title: 'Pending Approvals',
      value: stats.pendingApprovals,
      icon: Clock,
      color: 'text-accent',
      bgColor: 'bg-accent/10'
    },
    {
      title: 'Safe Mode',
      value: safeMode ? 'ON' : 'OFF',
      icon: Shield,
      color: safeMode ? 'text-success' : 'text-destructive',
      bgColor: safeMode ? 'bg-success/10' : 'bg-destructive/10'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {overviewCards.map((card) => (
          <Card key={card.title} className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${card.color}`}>
                {loading ? '...' : card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Health */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            System Health
          </CardTitle>
          <CardDescription>Current status of backend services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <ServiceStatus name="Database" status="operational" />
            <ServiceStatus name="Authentication" status="operational" />
            <ServiceStatus name="Edge Functions" status="operational" />
            <ServiceStatus name="Realtime" status="operational" />
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Recent System Activity</CardTitle>
          <CardDescription>Latest backend operations and events</CardDescription>
        </CardHeader>
        <CardContent>
          <RecentActivity />
        </CardContent>
      </Card>
    </div>
  );
}

function ServiceStatus({ name, status }: { name: string; status: 'operational' | 'degraded' | 'down' }) {
  const statusConfig = {
    operational: { color: 'text-success', bg: 'bg-success', label: 'Operational' },
    degraded: { color: 'text-warning', bg: 'bg-warning', label: 'Degraded' },
    down: { color: 'text-destructive', bg: 'bg-destructive', label: 'Down' }
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
      <span className="font-medium">{name}</span>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${config.bg} animate-pulse`} />
        <span className={`text-sm ${config.color}`}>{config.label}</span>
      </div>
    </div>
  );
}

function RecentActivity() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading activities...</div>;
  }

  if (activities.length === 0) {
    return <div className="text-muted-foreground text-sm">No recent activity</div>;
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
          <div>
            <p className="font-medium text-sm">{activity.action}</p>
            <p className="text-xs text-muted-foreground">
              {activity.resource_type} • {activity.resource_id || 'N/A'}
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(activity.created_at).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
