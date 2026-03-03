import { AlertTriangle, CheckCircle, Eye, Activity, Zap, MessageSquare, ClipboardList, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface UserStats {
  assigned: number;
  resolved: number;
  closed: number;
  notes: number;
  escalated: number;
  playbookExecutions: number;
  chatMessages: number;
  approvals: number;
  avgResponseTime?: string;
}

interface ProfileStatsProps {
  stats: UserStats;
  isTier1: boolean;
}

export function ProfileStats({ stats, isTier1 }: ProfileStatsProps) {
  const statCards = [
    { icon: AlertTriangle, label: 'Assigned', value: stats.assigned, color: 'text-amber-400' },
    { icon: CheckCircle, label: 'Resolved', value: stats.resolved, color: 'text-emerald-400' },
    ...(!isTier1 ? [{ icon: Eye, label: 'Closed', value: stats.closed, color: 'text-blue-400' }] : []),
    { icon: Activity, label: 'Notes', value: stats.notes, color: 'text-primary' },
    { icon: Zap, label: 'Escalated', value: stats.escalated, color: 'text-orange-400' },
    { icon: MessageSquare, label: 'Messages', value: stats.chatMessages, color: 'text-cyan-400' },
    { icon: ClipboardList, label: 'Approvals', value: stats.approvals, color: 'text-purple-400' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {statCards.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-xl border border-border bg-card p-3 text-center hover:border-primary/30 transition-colors"
        >
          <s.icon className={cn('h-4 w-4 mx-auto mb-1', s.color)} />
          <p className="text-lg font-bold text-foreground">{s.value}</p>
          <p className="text-[10px] text-muted-foreground">{s.label}</p>
        </motion.div>
      ))}
    </div>
  );
}
