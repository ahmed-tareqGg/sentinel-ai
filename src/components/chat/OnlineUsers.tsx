import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users } from 'lucide-react';

interface OnlineUser {
  id: string;
  name: string;
  online_at: string;
}

export function OnlineUsers() {
  const { user, profile } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    const chan = supabase.channel('online-users', {
      config: { presence: { key: user?.id || 'anon' } },
    });

    chan
      .on('presence', { event: 'sync' }, () => {
        const state = chan.presenceState();
        const users: OnlineUser[] = [];
        Object.entries(state).forEach(([key, values]) => {
          (values as any[]).forEach(v => {
            users.push({ id: key, name: v.name || 'User', online_at: v.online_at });
          });
        });
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await chan.track({
            name: profile?.full_name || profile?.email?.split('@')[0] || 'User',
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => { supabase.removeChannel(chan); };
  }, [user?.id, profile]);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="border-t border-border/50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Online ({onlineUsers.length})
        </span>
      </div>
      <div className="space-y-1.5">
        {onlineUsers.map(u => (
          <div key={u.id} className="flex items-center gap-2">
            <div className="relative">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{getInitials(u.name)}</AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-card" />
            </div>
            <span className="text-xs text-foreground truncate">{u.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
