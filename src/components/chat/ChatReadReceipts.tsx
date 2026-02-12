import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Eye } from 'lucide-react';

interface ReadReceipt {
  user_id: string;
  user_name: string | null;
  read_at: string;
}

interface ChatReadReceiptsProps {
  messageId: string;
  senderId: string;
}

export function ChatReadReceipts({ messageId, senderId }: ChatReadReceiptsProps) {
  const { user } = useAuth();
  const [readers, setReaders] = useState<ReadReceipt[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('chat_read_receipts')
        .select('user_id, user_name, read_at')
        .eq('message_id', messageId);
      if (data) setReaders(data as ReadReceipt[]);
    };
    load();

    const sub = supabase
      .channel(`read-${messageId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_read_receipts', filter: `message_id=eq.${messageId}` }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [messageId]);

  // Filter out the sender themselves
  const othersWhoRead = readers.filter(r => r.user_id !== senderId);
  if (othersWhoRead.length === 0) return null;

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const MAX_SHOW = 5;
  const visible = othersWhoRead.slice(0, MAX_SHOW);
  const remaining = othersWhoRead.length - MAX_SHOW;

  return (
    <div className="flex items-center gap-1 mt-1">
      <Eye className="h-3 w-3 text-muted-foreground/50 shrink-0" />
      <TooltipProvider>
        <div className="flex -space-x-1.5">
          {visible.map(r => (
            <Tooltip key={r.user_id}>
              <TooltipTrigger asChild>
                <Avatar className="h-4.5 w-4.5 border border-card cursor-default" style={{ height: 18, width: 18 }}>
                  <AvatarFallback className="text-[7px] bg-primary/10 text-primary">
                    {getInitials(r.user_name)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px] px-2 py-1">
                {r.user_name || 'User'}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        {remaining > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[9px] text-muted-foreground ml-1 cursor-default">+{remaining}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {othersWhoRead.slice(MAX_SHOW).map(r => (
                <p key={r.user_id}>{r.user_name || 'User'}</p>
              ))}
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  );
}

/** Hook to mark messages as read when they become visible */
export function useMarkAsRead(messages: { id: string; sender_id: string }[], channel: string) {
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user || messages.length === 0) return;

    const unreadByOthers = messages.filter(m => m.sender_id !== user.id);
    if (unreadByOthers.length === 0) return;

    const markRead = async () => {
      const ids = unreadByOthers.map(m => m.id);
      
      const { data: existing } = await supabase
        .from('chat_read_receipts')
        .select('message_id')
        .eq('user_id', user.id)
        .in('message_id', ids);

      const alreadyRead = new Set((existing || []).map((e: any) => e.message_id));
      const toInsert = ids
        .filter(id => !alreadyRead.has(id))
        .map(id => ({
          message_id: id,
          user_id: user.id,
          user_name: profile?.full_name || profile?.email?.split('@')[0] || 'User',
        }));

      if (toInsert.length > 0) {
        await supabase.from('chat_read_receipts').insert(toInsert as any);
      }
    };

    const timer = setTimeout(markRead, 500);
    return () => clearTimeout(timer);
  }, [messages.length, channel, user?.id]);
}
