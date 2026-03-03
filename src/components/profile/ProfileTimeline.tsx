import { Activity, FileText, MessageSquare, AlertTriangle, CheckCircle, Zap, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

export interface RecentActivity {
  id: string;
  type: 'assigned' | 'resolved' | 'note' | 'escalated' | 'playbook' | 'chat';
  title: string;
  detail: string;
  timestamp: string;
}

const activityConfig: Record<string, { icon: typeof Activity; color: string }> = {
  note: { icon: FileText, color: 'text-blue-400 bg-blue-500/10' },
  chat: { icon: MessageSquare, color: 'text-cyan-400 bg-cyan-500/10' },
  assigned: { icon: AlertTriangle, color: 'text-amber-400 bg-amber-500/10' },
  resolved: { icon: CheckCircle, color: 'text-emerald-400 bg-emerald-500/10' },
  escalated: { icon: Zap, color: 'text-orange-400 bg-orange-500/10' },
  playbook: { icon: ClipboardList, color: 'text-purple-400 bg-purple-500/10' },
};

interface ProfileTimelineProps {
  activities: RecentActivity[];
}

export function ProfileTimeline({ activities }: ProfileTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Activity Timeline
        </h3>
      </div>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[27px] top-0 bottom-0 w-px bg-border" />
        
        <div className="divide-y divide-border">
          {activities.map((act, i) => {
            const config = activityConfig[act.type] || activityConfig.note;
            const Icon = config.icon;
            return (
              <motion.div
                key={act.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="px-4 py-3 flex items-start gap-3 relative"
              >
                <div className={cn('mt-0.5 p-1.5 rounded-full z-10 shrink-0', config.color.split(' ')[1])}>
                  <Icon className={cn('h-3.5 w-3.5', config.color.split(' ')[0])} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{act.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{act.detail}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                  {formatDistanceToNow(new Date(act.timestamp), { addSuffix: true })}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
