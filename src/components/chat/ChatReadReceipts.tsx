import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCheck, Check } from 'lucide-react';

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
  const isOwn = user?.id === senderId;

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

  // Only show read receipts on own messages
  if (!isOwn) return null;

  const othersWhoRead = readers.filter(r => r.user_id !== senderId);
  if (othersWhoRead.length === 0) {
    return (
      <span className="inline-flex items-center ml-1" title="Sent">
        <Check className="h-3 w-3 text-muted-foreground/50" />
      </span>
    );
  }

  const names = othersWhoRead.map(r => r.user_name || 'User').join(', ');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center ml-1 cursor-default">
            <CheckCheck className="h-3 w-3 text-primary" />
            {othersWhoRead.length > 1 && (
              <span className="text-[9px] text-primary ml-0.5">{othersWhoRead.length}</span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-semibold mb-0.5">Seen by:</p>
          {othersWhoRead.map(r => (
            <p key={r.user_id} className="text-muted-foreground">{r.user_name || 'User'}</p>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
      
      // Check which ones we already read
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

    // Small delay to batch
    const timer = setTimeout(markRead, 500);
    return () => clearTimeout(timer);
  }, [messages.length, channel, user?.id]);
}
