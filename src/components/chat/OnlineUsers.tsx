import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnlineUser {
  id: string;
  name: string;
  displayName: string | null;
  role: string | null;
  online_at: string;
}

const ROLE_HIERARCHY: Record<string, number> = {
  admin: 7, ciso: 6, soc_manager: 5, soc_tier_3: 4, soc_tier_2: 3, soc_tier_1: 2, grc_engineer: 3, demo_user: 1,
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', ciso: 'CISO', soc_manager: 'Manager', soc_tier_3: 'Tier 3', soc_tier_2: 'Tier 2', soc_tier_1: 'Tier 1', grc_engineer: 'GRC', demo_user: 'Demo',
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  ciso: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  soc_manager: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  soc_tier_3: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  soc_tier_2: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  soc_tier_1: 'bg-green-500/20 text-green-400 border-green-500/30',
  grc_engineer: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  demo_user: 'bg-muted text-muted-foreground border-border',
};

export function OnlineUsers() {
  const { user, profile, role } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  const myRoleLevel = role ? (ROLE_HIERARCHY[role] || 0) : 0;

  useEffect(() => {
    // Fetch display_name for current user
    const getDisplayName = async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('profiles').select('display_name').eq('id', user.id).single();
      return (data as any)?.display_name || null;
    };

    const chan = supabase.channel('online-users', {
      config: { presence: { key: user?.id || 'anon' } },
    });

    chan
      .on('presence', { event: 'sync' }, () => {
        const state = chan.presenceState();
        // Deduplicate by user ID (same user, multiple tabs)
        const seen = new Map<string, OnlineUser>();
        Object.entries(state).forEach(([key, values]) => {
          if (!seen.has(key)) {
            const v = (values as any[])[0];
            seen.set(key, {
              id: key,
              name: v.name || 'User',
              displayName: v.displayName || null,
              role: v.role || null,
              online_at: v.online_at,
            });
          }
        });
        setOnlineUsers(Array.from(seen.values()));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const displayName = await getDisplayName();
          await chan.track({
            name: profile?.full_name || profile?.email?.split('@')[0] || 'User',
            displayName,
            role: role || null,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => { supabase.removeChannel(chan); };
  }, [user?.id, profile, role]);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getVisibleName = (u: OnlineUser) => {
    const displayName = u.displayName || u.name;
    const realName = u.name;
    const uRoleLevel = u.role ? (ROLE_HIERARCHY[u.role] || 0) : 0;

    if (u.id === user?.id) return { displayName, realName, showRealName: true };
    if (myRoleLevel >= uRoleLevel) return { displayName, realName, showRealName: true };
    return { displayName, realName, showRealName: false };
  };

  return (
    <div className="border-t border-border/50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Online ({onlineUsers.length})
        </span>
      </div>
      <div className="space-y-1.5">
        {onlineUsers.map(u => {
          const nameInfo = getVisibleName(u);
          return (
            <div key={u.id} className="flex items-center gap-2">
              <div className="relative shrink-0">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{getInitials(nameInfo.displayName)}</AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success border-2 border-card" />
              </div>
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <span className="text-xs text-foreground truncate">{nameInfo.displayName}</span>
                {nameInfo.showRealName && nameInfo.realName !== nameInfo.displayName && (
                  <span className="text-[9px] text-muted-foreground truncate">({nameInfo.realName})</span>
                )}
                {u.role && (
                  <Badge variant="outline" className={cn('text-[8px] px-1 py-0 shrink-0', ROLE_BADGE_COLORS[u.role] || '')}>
                    {ROLE_LABELS[u.role] || u.role}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
