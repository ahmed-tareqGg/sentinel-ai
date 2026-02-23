import { useEffect, useState, useCallback } from 'react';
import { Activity, AlertTriangle, Shield, Play, CheckCircle, XCircle, Clock, Zap, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/backend/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface FeedItem {
  id: string;
  type: 'incident' | 'playbook' | 'approval';
  title: string;
  subtitle: string;
  severity?: string;
  status?: string;
  timestamp: string;
  link?: string;
}

const MAX_ITEMS = 30;

function mapIncidentToFeed(inc: any): FeedItem {
  return {
    id: `inc-${inc.id}`,
    type: 'incident',
    title: `${inc.incident_number} — ${inc.event_type}`,
    subtitle: inc.src_ip ? `Source: ${inc.src_ip}` : (inc.message?.slice(0, 60) || 'New incident detected'),
    severity: inc.risk_level,
    status: inc.status,
    timestamp: inc.created_at,
    link: `/incidents/${inc.id}`,
  };
}

function mapPlaybookToFeed(exec: any): FeedItem {
  return {
    id: `pb-${exec.id}`,
    type: 'playbook',
    title: `Playbook Execution`,
    subtitle: exec.ai_explanation?.slice(0, 60) || `Status: ${exec.status}`,
    status: exec.status,
    timestamp: exec.started_at,
  };
}

function mapApprovalToFeed(req: any): FeedItem {
  return {
    id: `ap-${req.id}`,
    type: 'approval',
    title: `Approval: ${(req.action_type || '').replace(/_/g, ' ')}`,
    subtitle: req.reason?.slice(0, 60) || 'Pending review',
    status: req.status,
    timestamp: req.created_at,
    link: '/approvals',
  };
}

const typeConfig = {
  incident: {
    icon: AlertTriangle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
  playbook: {
    icon: Play,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  approval: {
    icon: Shield,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
};

const severityColors: Record<string, string> = {
  Critical: 'bg-red-500/20 text-red-300 border-red-500/30',
  High: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  Low: 'bg-green-500/20 text-green-300 border-green-500/30',
};

const statusIcons: Record<string, typeof CheckCircle> = {
  completed: CheckCircle,
  approved: CheckCircle,
  rejected: XCircle,
  pending: Clock,
  running: Zap,
};

export function LiveActivityFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const addItems = useCallback((newItems: FeedItem[]) => {
    setItems(prev => {
      const merged = [...newItems, ...prev];
      const unique = Array.from(new Map(merged.map(i => [i.id, i])).values());
      unique.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return unique.slice(0, MAX_ITEMS);
    });
  }, []);

  useEffect(() => {
    async function loadInitial() {
      setLoading(true);
      const [incRes, pbRes, apRes] = await Promise.all([
        supabase.from('incidents').select('id, incident_number, event_type, src_ip, message, risk_level, status, created_at')
          .is('deleted_at', null).order('created_at', { ascending: false }).limit(10),
        supabase.from('playbook_executions').select('id, status, ai_explanation, started_at')
          .order('started_at', { ascending: false }).limit(10),
        supabase.from('approval_requests').select('id, action_type, reason, status, created_at')
          .order('created_at', { ascending: false }).limit(10),
      ]);

      const feed: FeedItem[] = [
        ...(incRes.data || []).map(mapIncidentToFeed),
        ...(pbRes.data || []).map(mapPlaybookToFeed),
        ...(apRes.data || []).map(mapApprovalToFeed),
      ];
      feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setItems(feed.slice(0, MAX_ITEMS));
      setLoading(false);
    }

    loadInitial();

    // Realtime subscriptions
    const channel = supabase
      .channel('live-activity-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, (payload) => {
        addItems([mapIncidentToFeed(payload.new)]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'playbook_executions' }, (payload) => {
        addItems([mapPlaybookToFeed(payload.new)]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'approval_requests' }, (payload) => {
        addItems([mapApprovalToFeed(payload.new)]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'approval_requests' }, (payload) => {
        setItems(prev => prev.map(i => i.id === `ap-${(payload.new as any).id}` ? mapApprovalToFeed(payload.new) : i));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [addItems]);

  const displayItems = expanded ? items : items.slice(0, 8);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Live Activity Feed</h3>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">{items.length} events</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3 items-center animate-pulse">
              <div className="h-8 w-8 rounded-lg bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 bg-muted rounded" />
                <div className="h-2.5 w-1/2 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-center py-8 text-sm">No activity yet.</p>
      ) : (
        <>
          <div className="space-y-1">
            <AnimatePresence initial={false}>
              {displayItems.map((item) => {
                const config = typeConfig[item.type];
                const Icon = config.icon;
                const StatusIcon = statusIcons[item.status || ''] || Clock;

                const content = (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`group flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer`}
                  >
                    <div className={`p-1.5 rounded-lg ${config.bg} ${config.color} mt-0.5 shrink-0`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                        {item.severity && (
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${severityColors[item.severity] || ''}`}>
                            {item.severity}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                        <span className="text-[10px] text-muted-foreground/60 shrink-0">
                          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    {item.status && (
                      <StatusIcon className={`h-3.5 w-3.5 shrink-0 mt-1 ${
                        item.status === 'completed' || item.status === 'approved' ? 'text-green-400' :
                        item.status === 'rejected' ? 'text-red-400' :
                        item.status === 'running' ? 'text-violet-400' :
                        'text-muted-foreground'
                      }`} />
                    )}
                  </motion.div>
                );

                return item.link ? (
                  <Link key={item.id} to={item.link} className="block">{content}</Link>
                ) : content;
              })}
            </AnimatePresence>
          </div>

          {items.length > 8 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={`h-3.5 w-3.5 mr-1 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              {expanded ? 'Show less' : `Show ${items.length - 8} more`}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
