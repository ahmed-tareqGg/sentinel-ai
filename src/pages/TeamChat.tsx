import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Hash, AtSign, AlertTriangle, Loader2, Edit2, Trash2, X, Check, Pin, Flag, Reply, CornerDownRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { Link } from 'react-router-dom';
import { ChatReactions } from '@/components/chat/ChatReactions';
import { IncidentMentionDropdown } from '@/components/chat/IncidentMentionDropdown';
import { TypingIndicator, useTypingBroadcast } from '@/components/chat/TypingIndicator';
import { OnlineUsers } from '@/components/chat/OnlineUsers';
import { ChatReadReceipts, useMarkAsRead } from '@/components/chat/ChatReadReceipts';

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_email: string | null;
  sender_name: string | null;
  content: string;
  mentions: string[];
  incident_id: string | null;
  channel: string;
  is_edited: boolean;
  is_pinned: boolean;
  priority: string;
  reply_to_id: string | null;
  created_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
}

const CHANNELS = [
  { id: 'general', label: 'General', icon: Hash },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
];

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal', color: '' },
  { value: 'urgent', label: 'Urgent', color: 'text-orange-400' },
  { value: 'critical', label: 'Critical', color: 'text-red-400' },
];

export default function TeamChat() {
  const { user, profile, role } = useAuth();
  const HIGH_ROLES = ['admin', 'ciso', 'soc_manager', 'soc_tier_3'];
  const canPinAny = role ? HIGH_ROLES.includes(role) : false;
  const canDeleteAny = role ? ['admin', 'ciso', 'soc_manager'].includes(role) : false;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [channel, setChannel] = useState('general');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [showIncidents, setShowIncidents] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [incidentFilter, setIncidentFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [incidentIndex, setIncidentIndex] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [priority, setPriority] = useState('normal');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { signalTyping, stopTyping } = useTypingBroadcast(channel);

  // Load users for mentions
  useEffect(() => {
    const loadUsers = async () => {
      const { data } = await supabase.from('profiles').select('id, email, full_name');
      if (data) setUsers(data);
    };
    loadUsers();
  }, []);

  // Load messages for channel
  useEffect(() => {
    setLoading(true);
    const loadMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('channel', channel)
        .order('created_at', { ascending: true })
        .limit(200);
      setMessages((data as ChatMessage[]) || []);
      setLoading(false);
      setTimeout(() => scrollToBottom(), 100);
    };
    loadMessages();
  }, [channel]);

  // Realtime subscription
  useEffect(() => {
    const sub = supabase
      .channel(`chat-${channel}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'chat_messages',
        filter: `channel=eq.${channel}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => [...prev, payload.new as ChatMessage]);
          setTimeout(() => scrollToBottom(), 50);
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === (payload.new as ChatMessage).id ? payload.new as ChatMessage : m));
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [channel]);

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const ids: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) ids.push(match[2]);
    return ids;
  };

  const extractIncidentId = (text: string): string | null => {
    const match = text.match(/#\[([^\]]+)\]\(([^)]+)\)/);
    return match ? match[2] : null;
  };

  const filteredUsers = users.filter(u => {
    if (!mentionFilter) return true;
    const name = (u.full_name || u.email || '').toLowerCase();
    return name.includes(mentionFilter.toLowerCase());
  }).slice(0, 6);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewMessage(val);
    signalTyping();

    const cursorPos = e.target.selectionStart || 0;
    const textBefore = val.slice(0, cursorPos);

    // Detect @ trigger
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setShowMentions(true);
      setShowIncidents(false);
      setMentionFilter(atMatch[1]);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
    }

    // Detect # trigger for incidents
    const hashMatch = textBefore.match(/#(\w*)$/);
    if (hashMatch) {
      setShowIncidents(true);
      setShowMentions(false);
      setIncidentFilter(hashMatch[1]);
      setIncidentIndex(0);
    } else {
      setShowIncidents(false);
    }
  };

  const insertMention = (u: UserProfile) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBefore = newMessage.slice(0, cursorPos);
    const textAfter = newMessage.slice(cursorPos);
    const beforeAt = textBefore.replace(/@\w*$/, '');
    const displayName = u.full_name || u.email.split('@')[0];
    const mentionTag = `@[${displayName}](${u.id})`;
    setNewMessage(beforeAt + mentionTag + ' ' + textAfter);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const insertIncident = (inc: { id: string; incident_number: string }) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBefore = newMessage.slice(0, cursorPos);
    const textAfter = newMessage.slice(cursorPos);
    const beforeHash = textBefore.replace(/#\w*$/, '');
    const tag = `#[${inc.incident_number}](${inc.id})`;
    setNewMessage(beforeHash + tag + ' ' + textAfter);
    setShowIncidents(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, filteredUsers.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (filteredUsers[mentionIndex]) insertMention(filteredUsers[mentionIndex]); }
      else if (e.key === 'Escape') setShowMentions(false);
      return;
    }
    if (showIncidents) {
      if (e.key === 'Escape') setShowIncidents(false);
      // Selection handled by dropdown click
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    setSending(true);
    stopTyping();
    const mentions = extractMentions(newMessage);
    const incidentId = extractIncidentId(newMessage);
    const { error } = await supabase.from('chat_messages').insert({
      sender_id: user.id,
      sender_email: profile?.email || user.email,
      sender_name: profile?.full_name || profile?.email?.split('@')[0],
      content: newMessage.trim(),
      mentions,
      incident_id: incidentId,
      channel,
      priority,
      reply_to_id: replyTo?.id || null,
    } as any);
    if (error) {
      toast.error('Failed to send message');
    } else {
      setNewMessage('');
      setPriority('normal');
      setReplyTo(null);
    }
    setSending(false);
  };

  const deleteMessage = async (id: string) => {
    await supabase.from('chat_messages').delete().eq('id', id);
  };

  const saveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    await supabase.from('chat_messages').update({ content: editContent, is_edited: true } as any).eq('id', id);
    setEditingId(null);
  };

  const togglePin = async (msg: ChatMessage) => {
    await supabase.from('chat_messages').update({ is_pinned: !msg.is_pinned } as any).eq('id', msg.id);
    toast.success(msg.is_pinned ? 'Message unpinned' : 'Message pinned');
  };

  // Render message content with highlighted @mentions and #incidents
  const renderContent = (content: string) => {
    // Split by both @mentions and #incidents
    const parts = content.split(/(@\[([^\]]+)\]\(([^)]+)\)|#\[([^\]]+)\]\(([^)]+)\))/g);
    const elements: React.ReactNode[] = [];
    let i = 0;
    while (i < parts.length) {
      if (parts[i] === undefined) { i++; continue; }
      // Check for @mention
      if (i + 5 < parts.length && parts[i + 1]?.startsWith('@[')) {
        elements.push(<span key={i}>{parts[i]}</span>);
        elements.push(
          <Badge key={`m-${i}`} variant="secondary" className="text-xs px-1.5 py-0 mx-0.5 bg-primary/20 text-primary border-primary/30 font-medium">
            @{parts[i + 2]}
          </Badge>
        );
        i += 6;
      }
      // Check for #incident  
      else if (i + 5 < parts.length && parts[i + 1]?.startsWith('#[')) {
        elements.push(<span key={i}>{parts[i]}</span>);
        const incNumber = parts[i + 4];
        const incId = parts[i + 5];
        elements.push(
          <Link
            key={`inc-${i}`}
            to={`/incidents/${incId}`}
            className="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded bg-destructive/10 border border-destructive/30 text-destructive text-xs font-mono font-bold hover:bg-destructive/20 transition-colors"
          >
            <AlertTriangle className="h-3 w-3" />
            {incNumber}
          </Link>
        );
        i += 6;
      } else {
        if (parts[i]) elements.push(<span key={i}>{parts[i]}</span>);
        i++;
      }
    }
    return elements;
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return 'Yesterday ' + format(d, 'HH:mm');
    return format(d, 'MMM d, HH:mm');
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email.slice(0, 2).toUpperCase();
    return '??';
  };

  const myMentionCount = messages.filter(m => user && m.mentions?.includes(user.id)).length;
  const pinnedMessages = messages.filter(m => m.is_pinned);
  const displayMessages = showPinnedOnly ? pinnedMessages : messages;

  // Mark visible messages as read
  useMarkAsRead(displayMessages, channel);

  return (
    <AppLayout title="Team Chat" subtitle="Real-time SOC communication with @mentions and #incident linking">
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Channels sidebar */}
        <div className="w-56 border-r border-border/50 bg-card/50 flex flex-col shrink-0">
          <div className="p-4 border-b border-border/50">
            <h2 className="text-sm font-bold text-foreground">Channels</h2>
          </div>
          <div className="flex-1 p-2 space-y-1">
            {CHANNELS.map(ch => (
              <button
                key={ch.id}
                onClick={() => { setChannel(ch.id); setShowPinnedOnly(false); }}
                className={cn(
                  'flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  channel === ch.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                )}
              >
                <ch.icon className="h-4 w-4" />
                {ch.label}
              </button>
            ))}
          </div>

          {/* Pinned messages shortcut */}
          {pinnedMessages.length > 0 && (
            <div className="px-3 py-2 border-t border-border/50">
              <button
                onClick={() => setShowPinnedOnly(!showPinnedOnly)}
                className={cn(
                  'flex items-center gap-2 w-full text-xs transition-colors',
                  showPinnedOnly ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Pin className="h-3 w-3" />
                {pinnedMessages.length} pinned
              </button>
            </div>
          )}

          {/* My mentions */}
          {myMentionCount > 0 && (
            <div className="p-3 border-t border-border/50">
              <div className="flex items-center gap-2 text-xs text-primary">
                <AtSign className="h-3.5 w-3.5" />
                <span>{myMentionCount} mention{myMentionCount > 1 ? 's' : ''} in #{channel}</span>
              </div>
            </div>
          )}

          {/* Online users */}
          <OnlineUsers />
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Channel header */}
          <div className="h-14 border-b border-border/50 flex items-center px-5 gap-3 shrink-0">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">{CHANNELS.find(c => c.id === channel)?.label}</h3>
            <Badge variant="outline" className="text-xs">{messages.length} messages</Badge>
            {showPinnedOnly && (
              <Badge variant="secondary" className="text-xs bg-primary/20 text-primary">
                <Pin className="h-3 w-3 mr-1" /> Pinned only
              </Badge>
            )}
            <div className="ml-auto text-[10px] text-muted-foreground">
              <span className="opacity-60">@ mention users</span>
              <span className="mx-2 opacity-30">|</span>
              <span className="opacity-60"># link incidents</span>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : displayMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Hash className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">{showPinnedOnly ? 'No pinned messages' : `No messages yet in #${channel}`}</p>
                <p className="text-xs mt-1">{showPinnedOnly ? 'Pin important messages to find them quickly' : 'Be the first to send a message!'}</p>
              </div>
            ) : (
              displayMessages.map((msg) => {
                const isOwn = msg.sender_id === user?.id;
                const isMentioned = user && msg.mentions?.includes(user.id);
                const isUrgent = msg.priority === 'urgent' || msg.priority === 'critical';
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'group flex gap-3 rounded-lg px-3 py-2 transition-colors',
                      isMentioned && 'bg-primary/5 border border-primary/20',
                      isUrgent && !isMentioned && 'border border-destructive/20 bg-destructive/5',
                      msg.is_pinned && !isMentioned && !isUrgent && 'border border-yellow-500/20 bg-yellow-500/5',
                      !isMentioned && !isUrgent && !msg.is_pinned && 'hover:bg-secondary/30'
                    )}
                  >
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {getInitials(msg.sender_name, msg.sender_email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      {/* Reply quote */}
                      {msg.reply_to_id && (() => {
                        const repliedMsg = messages.find(m => m.id === msg.reply_to_id);
                        if (!repliedMsg) return null;
                        return (
                          <div className="flex items-start gap-1.5 mb-1 pl-2 border-l-2 border-primary/40 rounded-sm">
                            <CornerDownRight className="h-3 w-3 text-primary/50 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-[10px] font-semibold text-primary/70">{repliedMsg.sender_name || repliedMsg.sender_email?.split('@')[0]}</span>
                              <p className="text-[11px] text-muted-foreground truncate max-w-md">{repliedMsg.content.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1').replace(/#\[([^\]]+)\]\([^)]+\)/g, '#$1')}</p>
                            </div>
                          </div>
                        );
                      })()}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">
                          {msg.sender_name || msg.sender_email?.split('@')[0]}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
                        <ChatReadReceipts messageId={msg.id} senderId={msg.sender_id} />
                        {msg.is_edited && <span className="text-[10px] text-muted-foreground italic">(edited)</span>}
                        {msg.is_pinned && (
                          <Pin className="h-3 w-3 text-yellow-500" />
                        )}
                        {msg.priority === 'urgent' && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-orange-500/30 text-orange-400">⚠ Urgent</Badge>
                        )}
                        {msg.priority === 'critical' && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-500/30 text-red-400">🚨 Critical</Badge>
                        )}
                        {isMentioned && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-primary/20 text-primary">mentioned you</Badge>
                        )}
                      </div>

                      {editingId === msg.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(msg.id); if (e.key === 'Escape') setEditingId(null); }}
                            className="h-8 text-sm"
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(msg.id)}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground/90 break-words">{renderContent(msg.content)}</p>
                      )}

                      {msg.incident_id && !msg.content.includes('#[') && (
                        <Link to={`/incidents/${msg.incident_id}`} className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline">
                          <AlertTriangle className="h-3 w-3" /> View Incident
                        </Link>
                      )}

                      {/* Reactions */}
                      <ChatReactions messageId={msg.id} />
                    </div>

                    {/* Actions */}
                    <div className="opacity-0 group-hover:opacity-100 flex items-start gap-1 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }} title="Reply">
                        <Reply className="h-3 w-3" />
                      </Button>
                      {/* Pin: own messages always, any message for high roles */}
                      {(isOwn || canPinAny) && (
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => togglePin(msg)} title={msg.is_pinned ? 'Unpin' : 'Pin'}>
                          <Pin className="h-3 w-3" />
                        </Button>
                      )}
                      {isOwn && editingId !== msg.id && (
                        <>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteMessage(msg.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      {/* High roles can delete any message */}
                      {!isOwn && canDeleteAny && (
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteMessage(msg.id)} title="Delete (Admin)">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Typing indicator */}
          <TypingIndicator channel={channel} />

          {/* Input area */}
          <div className="border-t border-border/50 shrink-0 relative">
            {/* Reply preview */}
            {replyTo && (
              <div className="flex items-center gap-2 px-4 py-2 bg-secondary/30 border-b border-border/30">
                <CornerDownRight className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-semibold text-primary">Replying to {replyTo.sender_name || replyTo.sender_email?.split('@')[0]}</span>
                  <p className="text-xs text-muted-foreground truncate">{replyTo.content.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1').replace(/#\[([^\]]+)\]\([^)]+\)/g, '#$1')}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setReplyTo(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <div className="p-4">
            {/* User mention dropdown */}
            {showMentions && filteredUsers.length > 0 && (
              <div className="absolute bottom-full left-4 right-4 mb-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                {filteredUsers.map((u, idx) => (
                  <button
                    key={u.id}
                    onClick={() => insertMention(u)}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2 text-sm hover:bg-secondary/60 transition-colors',
                      idx === mentionIndex && 'bg-secondary/60'
                    )}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {getInitials(u.full_name, u.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="font-medium text-foreground">{u.full_name || u.email.split('@')[0]}</p>
                      <p className="text-[10px] text-muted-foreground">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Incident mention dropdown */}
            {showIncidents && (
              <IncidentMentionDropdown
                filter={incidentFilter}
                selectedIndex={incidentIndex}
                onSelect={(inc) => insertIncident(inc)}
              />
            )}

            {/* Priority selector + input */}
            <div className="flex items-center gap-2">
              {/* Priority toggle */}
              <button
                onClick={() => {
                  const idx = PRIORITY_OPTIONS.findIndex(p => p.value === priority);
                  setPriority(PRIORITY_OPTIONS[(idx + 1) % PRIORITY_OPTIONS.length].value);
                }}
                className={cn(
                  'h-9 w-9 flex items-center justify-center rounded-md border border-border/50 shrink-0 transition-colors',
                  priority === 'urgent' && 'border-orange-500/50 bg-orange-500/10',
                  priority === 'critical' && 'border-red-500/50 bg-red-500/10',
                )}
                title={`Priority: ${priority}`}
              >
                <Flag className={cn(
                  'h-4 w-4',
                  priority === 'normal' && 'text-muted-foreground',
                  priority === 'urgent' && 'text-orange-400',
                  priority === 'critical' && 'text-red-400',
                )} />
              </button>

              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message #${channel}... (@ mention, # link incident)`}
                  className="pr-16 bg-secondary/30"
                  disabled={sending}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <AtSign className="h-3.5 w-3.5 text-muted-foreground/40" />
                  <Hash className="h-3.5 w-3.5 text-muted-foreground/40" />
                </div>
              </div>
              <Button onClick={sendMessage} disabled={sending || !newMessage.trim()} size="icon" className="shrink-0">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
