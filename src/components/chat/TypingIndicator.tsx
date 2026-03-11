import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';

interface TypingIndicatorProps {
  channel: string;
}

export function TypingIndicator({ channel }: TypingIndicatorProps) {
  const { user, profile } = useAuth();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    const chan = supabase.channel(`typing-${channel}`, {
      config: { presence: { key: user?.id || 'anon' } },
    });

    chan
      .on('presence', { event: 'sync' }, () => {
        const state = chan.presenceState();
        const names: string[] = [];
        Object.entries(state).forEach(([key, values]) => {
          if (key !== user?.id) {
            (values as any[]).forEach(v => {
              if (v.typing) names.push(v.name || 'Someone');
            });
          }
        });
        setTypingUsers(names);
      })
      .subscribe();

    return () => { supabase.removeChannel(chan); };
  }, [channel, user?.id]);

  const broadcastTyping = async (isTyping: boolean) => {
    const chan = supabase.channel(`typing-${channel}`);
    await chan.track({
      typing: isTyping,
      name: profile?.full_name || profile?.email?.split('@')[0] || 'User',
    });
  };

  if (typingUsers.length === 0) return null;

  const text = typingUsers.length === 1
    ? `${typingUsers[0]} is typing...`
    : typingUsers.length === 2
      ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
      : `${typingUsers.length} people are typing...`;

  return (
    <div className="px-5 py-1 text-xs text-muted-foreground animate-pulse">
      {text}
    </div>
  );
}

export function useTypingBroadcast(channel: string) {
  const { user, profile } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const chan = supabase.channel(`typing-${channel}`, {
      config: { presence: { key: user?.id || 'anon' } },
    });
    chan.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await chan.track({ typing: false, name: profile?.full_name || profile?.email?.split('@')[0] || 'User' });
      }
    });
    channelRef.current = chan;

    return () => {
      supabase.removeChannel(chan);
    };
  }, [channel, user?.id, profile]);

  const signalTyping = () => {
    if (!channelRef.current) return;
    channelRef.current.track({
      typing: true,
      name: profile?.full_name || profile?.email?.split('@')[0] || 'User',
    });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      channelRef.current?.track({
        typing: false,
        name: profile?.full_name || profile?.email?.split('@')[0] || 'User',
      });
    }, 2000);
  };

  const stopTyping = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    channelRef.current?.track({
      typing: false,
      name: profile?.full_name || profile?.email?.split('@')[0] || 'User',
    });
  };

  return { signalTyping, stopTyping };
}
