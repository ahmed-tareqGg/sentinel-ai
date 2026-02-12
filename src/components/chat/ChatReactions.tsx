import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { SmilePlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Reaction {
  emoji: string;
  count: number;
  users: string[];
  myReaction: boolean;
}

const EMOJI_OPTIONS = ['👍', '👎', '🔥', '🚨', '✅', '❌', '👀', '🎯', '⚡', '🛡️', '🔍', '💡'];

interface ChatReactionsProps {
  messageId: string;
}

export function ChatReactions({ messageId }: ChatReactionsProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('chat_reactions')
        .select('*')
        .eq('message_id', messageId);

      if (data) {
        const grouped: Record<string, { count: number; users: string[]; myReaction: boolean }> = {};
        data.forEach((r: any) => {
          if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, users: [], myReaction: false };
          grouped[r.emoji].count++;
          grouped[r.emoji].users.push(r.user_email || 'User');
          if (r.user_id === user?.id) grouped[r.emoji].myReaction = true;
        });
        setReactions(Object.entries(grouped).map(([emoji, v]) => ({ emoji, ...v })));
      }
    };
    load();

    const sub = supabase
      .channel(`reactions-${messageId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reactions', filter: `message_id=eq.${messageId}` }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [messageId, user?.id]);

  const toggleReaction = async (emoji: string) => {
    if (!user) return;
    const existing = reactions.find(r => r.emoji === emoji && r.myReaction);
    if (existing) {
      await supabase.from('chat_reactions').delete().eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji);
    } else {
      await supabase.from('chat_reactions').insert({ message_id: messageId, user_id: user.id, user_email: user.email, emoji } as any);
    }
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      {reactions.map(r => (
        <button
          key={r.emoji}
          onClick={() => toggleReaction(r.emoji)}
          title={r.users.join(', ')}
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors',
            r.myReaction
              ? 'bg-primary/20 border-primary/40 text-primary'
              : 'bg-secondary/40 border-border/50 text-muted-foreground hover:bg-secondary/60'
          )}
        >
          <span>{r.emoji}</span>
          <span className="font-medium">{r.count}</span>
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="opacity-0 group-hover:opacity-100 inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-secondary/60 transition-all text-muted-foreground">
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" side="top" align="start">
          <div className="grid grid-cols-6 gap-1">
            {EMOJI_OPTIONS.map(e => (
              <button
                key={e}
                onClick={() => toggleReaction(e)}
                className="h-8 w-8 flex items-center justify-center rounded hover:bg-secondary/60 transition-colors text-base"
              >
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
