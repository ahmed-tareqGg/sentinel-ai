import { Card, CardContent } from '@/components/ui/card';
import { Clock, CheckCircle2, XCircle, AlertTriangle, Timer, TrendingUp } from 'lucide-react';

interface ApprovalRequest {
  id: string;
  status: string;
  requested_at: string;
  approved_at: string | null;
  escalation_count: number;
  action_type: string;
  sla_deadline: string | null;
}

interface ApprovalMetricsProps {
  requests: ApprovalRequest[];
}

export function ApprovalMetrics({ requests }: ApprovalMetricsProps) {
  const pending = requests.filter(r => r.status === 'pending').length;
  const approved = requests.filter(r => r.status === 'approved').length;
  const rejected = requests.filter(r => r.status === 'rejected').length;
  const escalated = requests.filter(r => r.escalation_count > 0).length;

  // Avg approval time (in minutes)
  const approvedWithTime = requests.filter(r => r.status === 'approved' && r.approved_at);
  const avgApprovalMinutes = approvedWithTime.length > 0
    ? Math.round(
        approvedWithTime.reduce((sum, r) => {
          const diff = new Date(r.approved_at!).getTime() - new Date(r.requested_at).getTime();
          return sum + diff / 60000;
        }, 0) / approvedWithTime.length
      )
    : 0;

  // SLA breaches
  const slaBreaches = requests.filter(
    r => r.sla_deadline && r.status === 'pending' && new Date(r.sla_deadline) < new Date()
  ).length;

  const metrics = [
    { label: 'Pending', value: pending, icon: Clock, color: 'text-yellow-500', borderColor: 'border-yellow-500/30' },
    { label: 'Approved', value: approved, icon: CheckCircle2, color: 'text-green-500', borderColor: '' },
    { label: 'Rejected', value: rejected, icon: XCircle, color: 'text-destructive', borderColor: '' },
    { label: 'Escalated', value: escalated, icon: AlertTriangle, color: 'text-orange-500', borderColor: '' },
    { label: 'Avg Time', value: `${avgApprovalMinutes}m`, icon: Timer, color: 'text-primary', borderColor: '' },
    { label: 'SLA Breaches', value: slaBreaches, icon: TrendingUp, color: 'text-destructive', borderColor: slaBreaches > 0 ? 'border-destructive/30' : '' },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {metrics.map(({ label, value, icon: Icon, color, borderColor }) => (
        <Card key={label} className={borderColor}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2.5">
              <Icon className={`h-5 w-5 ${color} shrink-0`} />
              <div className="min-w-0">
                <p className="text-lg font-bold leading-tight">{value}</p>
                <p className="text-[11px] text-muted-foreground truncate">{label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
