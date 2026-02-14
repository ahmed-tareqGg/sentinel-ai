import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, Shield, Zap, Clock } from 'lucide-react';
import { supabase } from '@/integrations/backend/client';
import { cn } from '@/lib/utils';

interface ActivityItem {
  id: string;
  type: 'detected' | 'resolved' | 'escalated' | 'contained';
  title: string;
  time: string;
  severity?: string;
}

export function DemoLiveActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // Fetch recent incidents
    const fetchActivity = async () => {
      const { data } = await supabase
        .from('incidents')
        .select('id, incident_number, event_type, status, severity, risk_level, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(8);

      if (data) {
        const items: ActivityItem[] = data.map(inc => {
          let type: ActivityItem['type'] = 'detected';
          if (inc.status === 'Resolved' || inc.status === 'Closed') type = 'resolved';
          else if (inc.status === 'Escalated') type = 'escalated';
          else if (inc.status === 'Contained') type = 'contained';

          const timeAgo = getTimeAgo(new Date(inc.updated_at));

          return {
            id: inc.id,
            type,
            title: `${inc.incident_number} — ${inc.event_type}`,
            time: timeAgo,
            severity: inc.risk_level || (inc.severity >= 7 ? 'High' : 'Medium'),
          };
        });
        setActivities(items);
      }
    };

    fetchActivity();

    // Subscribe to realtime
    const channel = supabase
      .channel('demo-activity')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => {
        fetchActivity();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'resolved': return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case 'escalated': return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
      case 'contained': return <Shield className="h-3.5 w-3.5 text-primary" />;
      default: return <Zap className="h-3.5 w-3.5 text-destructive" />;
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'Critical': return 'text-destructive';
      case 'High': return 'text-amber-500';
      default: return 'text-muted-foreground';
    }
  };

  if (activities.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Activity</span>
      </div>
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {activities.map((item, i) => (
          <div 
            key={item.id} 
            className={cn(
              "flex items-center gap-2 p-2 rounded-md bg-muted/30 text-xs transition-all",
              i === 0 && "animate-fade-in"
            )}
          >
            {getIcon(item.type)}
            <span className="flex-1 truncate">{item.title}</span>
            <span className={cn("text-[10px]", getSeverityColor(item.severity))}>{item.severity}</span>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{item.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
