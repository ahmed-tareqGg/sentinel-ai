import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, MessageSquare, ClipboardCheck, UserCheck, Info, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  icon: string | null;
  severity: string;
  is_read: boolean;
  link: string | null;
  reference_id: string | null;
  reference_type: string | null;
  metadata: any;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  incident: { icon: AlertTriangle, color: 'text-destructive', label: 'Incidents' },
  chat_mention: { icon: MessageSquare, color: 'text-primary', label: 'Mentions' },
  approval: { icon: ClipboardCheck, color: 'text-warning', label: 'Approvals' },
  assignment: { icon: UserCheck, color: 'text-success', label: 'Assignments' },
  escalation: { icon: AlertTriangle, color: 'text-destructive', label: 'Escalations' },
  system: { icon: Info, color: 'text-muted-foreground', label: 'System' },
};

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-destructive animate-pulse',
  warning: 'bg-warning',
  info: 'bg-primary',
};

export function NotificationCenter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) setNotifications(data as Notification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev].slice(0, 50));

          // Show toast for critical/warning
          if (newNotif.severity === 'critical') {
            toast.error(newNotif.title, {
              description: newNotif.body || undefined,
              duration: 10000,
              action: newNotif.link ? {
                label: 'View',
                onClick: () => navigate(newNotif.link!),
              } : undefined,
            });
          } else if (newNotif.severity === 'warning') {
            toast.warning(newNotif.title, {
              description: newNotif.body || undefined,
              duration: 7000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllAsRead = async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
  };

  const clearAll = async () => {
    if (!user) return;
    setNotifications([]);
    await supabase.from('notifications').delete().eq('user_id', user.id);
  };

  const handleClick = (notif: Notification) => {
    markAsRead(notif.id);
    if (notif.link) {
      navigate(notif.link);
      setOpen(false);
    }
  };

  const filteredNotifications = activeTab === 'all'
    ? notifications
    : activeTab === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications.filter((n) => n.type === activeTab);

  const getTypeIcon = (type: string) => {
    const config = TYPE_CONFIG[type] || TYPE_CONFIG.system;
    const IconComp = config.icon;
    return <IconComp className={cn('h-4 w-4', config.color)} />;
  };

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return '';
    }
  };

  // Count by type for tabs
  const typeCounts = notifications.reduce((acc, n) => {
    if (!n.is_read) {
      acc[n.type] = (acc[n.type] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-7 w-7">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground px-0.5">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-foreground">Notifications</h4>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={markAllAsRead}>
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 text-muted-foreground hover:text-destructive" onClick={clearAll}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b border-border px-2">
            <TabsList className="h-8 bg-transparent gap-0.5 w-full justify-start">
              <TabsTrigger value="all" className="text-[10px] h-6 px-2 data-[state=active]:bg-secondary">
                All
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-[10px] h-6 px-2 data-[state=active]:bg-secondary">
                Unread {unreadCount > 0 && `(${unreadCount})`}
              </TabsTrigger>
              {Object.entries(typeCounts).map(([type, count]) => (
                <TabsTrigger key={type} value={type} className="text-[10px] h-6 px-2 data-[state=active]:bg-secondary">
                  {TYPE_CONFIG[type]?.label || type}
                  {count > 0 && (
                    <span className="ml-1 text-[9px] text-destructive font-bold">{count}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Content */}
          <ScrollArea className="max-h-[400px]">
            {loading ? (
              <div className="p-6 text-center">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Loading...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No notifications</p>
                <p className="text-xs mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredNotifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={cn(
                      'w-full p-3 text-left hover:bg-secondary/50 transition-colors group',
                      !notif.is_read && 'bg-primary/5'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Severity dot + icon */}
                      <div className="relative shrink-0 mt-0.5">
                        {getTypeIcon(notif.type)}
                        {!notif.is_read && (
                          <span className={cn(
                            'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full',
                            SEVERITY_DOT[notif.severity] || SEVERITY_DOT.info
                          )} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            'text-xs leading-tight',
                            notif.is_read ? 'text-muted-foreground' : 'text-foreground font-medium'
                          )}>
                            {notif.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                            {formatTime(notif.created_at)}
                          </span>
                        </div>
                        {notif.body && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                            {notif.body}
                          </p>
                        )}
                        {/* Metadata tags */}
                        {notif.metadata && Object.keys(notif.metadata).length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {notif.metadata.risk_level && (
                              <Badge variant="outline" className={cn(
                                'text-[9px] h-4 px-1',
                                notif.metadata.risk_level === 'Critical' && 'border-destructive/50 text-destructive',
                                notif.metadata.risk_level === 'High' && 'border-warning/50 text-warning',
                              )}>
                                {notif.metadata.risk_level}
                              </Badge>
                            )}
                            {notif.metadata.event_type && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1">
                                {notif.metadata.event_type}
                              </Badge>
                            )}
                            {notif.metadata.channel && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1">
                                #{notif.metadata.channel}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Mark read button */}
                      {!notif.is_read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notif.id);
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
