import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Hash, AtSign, AlertTriangle, Loader2, Edit2, Trash2, X, Check, Pin, Flag, Reply, CornerDownRight, Shield, Pencil, ArrowLeft, Lock, Plus, LogIn, PanelLeftClose, PanelLeftOpen, Paperclip, Image, FileText, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { Link } from 'react-router-dom';
import { ChatReactions } from '@/components/chat/ChatReactions';
import { IncidentMentionDropdown } from '@/components/chat/IncidentMentionDropdown';
import { PolicyMentionDropdown } from '@/components/chat/PolicyMentionDropdown';
import { TypingIndicator, useTypingBroadcast } from '@/components/chat/TypingIndicator';
import { OnlineUsers } from '@/components/chat/OnlineUsers';
import { ChatReadReceipts, useMarkAsRead } from '@/components/chat/ChatReadReceipts';

interface ChatAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

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
  attachments: ChatAttachment[] | null;
  created_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
}

interface UserRole {
  user_id: string;
  role: string;
}

const ROLE_HIERARCHY: Record<string, number> = {
  admin: 7,
  ciso: 6,
  soc_manager: 5,
  soc_tier_3: 4,
  soc_tier_2: 3,
  soc_tier_1: 2,
  grc_engineer: 3,
  demo_user: 1,
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  ciso: 'CISO',
  soc_manager: 'Manager',
  soc_tier_3: 'Tier 3',
  soc_tier_2: 'Tier 2',
  soc_tier_1: 'Tier 1',
  grc_engineer: 'GRC',
  demo_user: 'Demo',
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

const CHANNELS = [
  { id: 'general', label: 'General', icon: Hash },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'compliance', label: 'Compliance', icon: Shield },
];

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal', color: '' },
  { value: 'urgent', label: 'Urgent', color: 'text-orange-400' },
  { value: 'critical', label: 'Critical', color: 'text-red-400' },
];

interface PrivateChannel {
  id: string;
  name: string;
  created_by: string;
  created_by_id: string;
}

export default function TeamChat() {
  const navigate = useNavigate();
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
  const [userRoles, setUserRoles] = useState<Map<string, string>>(new Map());
  const [showMentions, setShowMentions] = useState(false);
  const [showIncidents, setShowIncidents] = useState(false);
  const [showPolicies, setShowPolicies] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [incidentFilter, setIncidentFilter] = useState('');
  const [policyFilter, setPolicyFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [incidentIndex, setIncidentIndex] = useState(0);
  const [policyIndex, setPolicyIndex] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [priority, setPriority] = useState('normal');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { signalTyping, stopTyping } = useTypingBroadcast(channel);

  // Private channels state
  const [privateChannels, setPrivateChannels] = useState<PrivateChannel[]>([]);
  const [unlockedChannels, setUnlockedChannels] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('socmind_unlocked_channels');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [joinTargetChannel, setJoinTargetChannel] = useState<PrivateChannel | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelPassword, setNewChannelPassword] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [joiningChannel, setJoiningChannel] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const myRoleLevel = role ? (ROLE_HIERARCHY[role] || 0) : 0;

  // Load users and roles for mentions
  useEffect(() => {
    const loadUsers = async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('id, email, full_name, display_name'),
        supabase.from('user_roles').select('user_id, role'),
      ]);
      if (profilesRes.data) setUsers(profilesRes.data as UserProfile[]);
      if (rolesRes.data) {
        const roleMap = new Map<string, string>();
        (rolesRes.data as UserRole[]).forEach(r => roleMap.set(r.user_id, r.role));
        setUserRoles(roleMap);
      }
    };
    loadUsers();
  }, []);

  // Load private channels
  useEffect(() => {
    const loadPrivateChannels = async () => {
      const { data } = await supabase
        .from('private_channels')
        .select('id, name, created_by, created_by_id')
        .order('created_at', { ascending: true });
      if (data) setPrivateChannels(data as PrivateChannel[]);
    };
    loadPrivateChannels();

    const sub = supabase
      .channel('private-channels-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_channels' }, () => {
        loadPrivateChannels();
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const createPrivateChannel = async () => {
    if (!newChannelName.trim() || !newChannelPassword.trim()) return;
    setCreatingChannel(true);
    const { data, error } = await supabase.rpc('create_private_channel', {
      _name: newChannelName.trim(),
      _password: newChannelPassword.trim(),
    });
    if (error) {
      toast.error('Failed to create private channel');
    } else {
      toast.success('Private channel created!');
      const channelId = data as string;
      setUnlockedChannels(prev => {
        const next = new Set(prev).add(channelId);
        localStorage.setItem('socmind_unlocked_channels', JSON.stringify([...next]));
        return next;
      });
      setChannel(`private:${channelId}`);
      setCreateDialogOpen(false);
      setNewChannelName('');
      setNewChannelPassword('');
    }
    setCreatingChannel(false);
  };

  const joinPrivateChannel = async () => {
    if (!joinTargetChannel || !joinPassword.trim()) return;
    setJoiningChannel(true);
    const { data, error } = await supabase.rpc('verify_channel_password', {
      _channel_id: joinTargetChannel.id,
      _password: joinPassword.trim(),
    });
    if (error || !data) {
      toast.error('Wrong password!');
    } else {
      toast.success(`Joined #${joinTargetChannel.name}`);
      setUnlockedChannels(prev => {
        const next = new Set(prev).add(joinTargetChannel.id);
        localStorage.setItem('socmind_unlocked_channels', JSON.stringify([...next]));
        return next;
      });
      setChannel(`private:${joinTargetChannel.id}`);
      setJoinDialogOpen(false);
      setJoinPassword('');
      setJoinTargetChannel(null);
    }
    setJoiningChannel(false);
  };

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
      setMessages((data as unknown as ChatMessage[]) || []);
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
    const name = (u.display_name || u.full_name || u.email || '').toLowerCase();
    return name.includes(mentionFilter.toLowerCase()) || u.email.toLowerCase().includes(mentionFilter.toLowerCase());
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
      setShowPolicies(false);
      setIncidentFilter(hashMatch[1]);
      setIncidentIndex(0);
    } else {
      setShowIncidents(false);
    }

    // Detect $ trigger for compliance policies
    const dollarMatch = textBefore.match(/\$(\w*)$/);
    if (dollarMatch) {
      setShowPolicies(true);
      setShowMentions(false);
      setShowIncidents(false);
      setPolicyFilter(dollarMatch[1]);
      setPolicyIndex(0);
    } else {
      setShowPolicies(false);
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

  const insertPolicy = (pol: { id: string; control_code: string }) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBefore = newMessage.slice(0, cursorPos);
    const textAfter = newMessage.slice(cursorPos);
    const beforeDollar = textBefore.replace(/\$\w*$/, '');
    const tag = `$[${pol.control_code}](${pol.id})`;
    setNewMessage(beforeDollar + tag + ' ' + textAfter);
    setShowPolicies(false);
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
      return;
    }
    if (showPolicies) {
      if (e.key === 'Escape') setShowPolicies(false);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const uploadFiles = async (files: File[]): Promise<ChatAttachment[]> => {
    const uploaded: ChatAttachment[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop();
      const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('chat-attachments').upload(path, file);
      if (error) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }
      const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(path);
      uploaded.push({
        name: file.name,
        url: urlData.publicUrl,
        type: file.type,
        size: file.size,
      });
    }
    return uploaded;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingFiles(prev => [...prev, ...files]);
    }
    e.target.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && pendingFiles.length === 0) || !user) return;
    setSending(true);
    setUploading(pendingFiles.length > 0);
    stopTyping();

    let attachments: ChatAttachment[] = [];
    if (pendingFiles.length > 0) {
      attachments = await uploadFiles(pendingFiles);
    }

    const mentions = extractMentions(newMessage);
    const incidentId = extractIncidentId(newMessage);
    const myProfile = users.find(u => u.id === user.id);
    const senderDisplayName = myProfile?.display_name || profile?.full_name || profile?.email?.split('@')[0];
    const { error } = await supabase.from('chat_messages').insert({
      sender_id: user.id,
      sender_email: profile?.email || user.email,
      sender_name: senderDisplayName,
      content: newMessage.trim() || (attachments.length > 0 ? `📎 ${attachments.length} file(s)` : ''),
      mentions,
      incident_id: incidentId,
      channel,
      priority,
      reply_to_id: replyTo?.id || null,
      attachments: attachments.length > 0 ? attachments : [],
    } as any);
    if (error) {
      toast.error('Failed to send message');
    } else {
      setNewMessage('');
      setPriority('normal');
      setReplyTo(null);
      setPendingFiles([]);
    }
    setSending(false);
    setUploading(false);
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
    // Split by @mentions, #incidents, and $policies
    const parts = content.split(/(@\[([^\]]+)\]\(([^)]+)\)|#\[([^\]]+)\]\(([^)]+)\)|\$\[([^\]]+)\]\(([^)]+)\))/g);
    const elements: React.ReactNode[] = [];
    let i = 0;
    while (i < parts.length) {
      if (parts[i] === undefined) { i++; continue; }
      // Check for @mention
      if (i + 7 < parts.length && parts[i + 1]?.startsWith('@[')) {
        elements.push(<span key={i}>{parts[i]}</span>);
        elements.push(
          <Badge key={`m-${i}`} variant="secondary" className="text-xs px-1.5 py-0 mx-0.5 bg-primary/20 text-primary border-primary/30 font-medium">
            @{parts[i + 2]}
          </Badge>
        );
        i += 8;
      }
      // Check for #incident  
      else if (i + 7 < parts.length && parts[i + 1]?.startsWith('#[')) {
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
        i += 8;
      }
      // Check for $policy
      else if (i + 7 < parts.length && parts[i + 1]?.startsWith('$[')) {
        elements.push(<span key={i}>{parts[i]}</span>);
        const controlCode = parts[i + 6];
        elements.push(
          <Link
            key={`pol-${i}`}
            to="/compliance"
            className="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary text-xs font-mono font-bold hover:bg-primary/20 transition-colors"
          >
            <Shield className="h-3 w-3" />
            {controlCode}
          </Link>
        );
        i += 8;
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

  // Get the display name for a sender based on role visibility rules
  const getSenderDisplayName = (senderId: string, senderName: string | null, senderEmail: string | null) => {
    const senderProfile = users.find(u => u.id === senderId);
    const senderRole = userRoles.get(senderId);
    const senderRoleLevel = senderRole ? (ROLE_HIERARCHY[senderRole] || 0) : 0;
    
    const displayName = senderProfile?.display_name || senderName || senderEmail?.split('@')[0] || 'Unknown';
    const realName = senderProfile?.full_name || senderEmail?.split('@')[0] || 'Unknown';
    
    // If it's the user's own message, show their display name
    if (senderId === user?.id) return { displayName, realName, showRealName: true };
    
    // If viewer's role is >= sender's role, show both names
    if (myRoleLevel >= senderRoleLevel) {
      return { displayName, realName, showRealName: true };
    }
    
    // Lower roles can only see display name + role badge of higher roles
    return { displayName, realName, showRealName: false };
  };

  const getSenderRole = (senderId: string) => userRoles.get(senderId) || null;

  const saveDisplayName = async () => {
    if (!user || !newDisplayName.trim()) return;
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: newDisplayName.trim() } as any)
      .eq('id', user.id);
    if (error) {
      toast.error('Failed to update display name');
    } else {
      toast.success('Display name updated');
      setEditingDisplayName(false);
      // Refresh users
      const { data } = await supabase.from('profiles').select('id, email, full_name, display_name');
      if (data) setUsers(data as UserProfile[]);
    }
  };

  const myMentionCount = messages.filter(m => user && m.mentions?.includes(user.id)).length;
  const pinnedMessages = messages.filter(m => m.is_pinned);
  const displayMessages = showPinnedOnly ? pinnedMessages : messages;

  // Mark visible messages as read
  useMarkAsRead(displayMessages, channel);


  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Compact chat header */}
      <div className="flex items-center gap-2 h-9 px-3 border-b border-border/50 bg-card/80 shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSidebarOpen(prev => !prev)} title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}>
          {sidebarOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
        </Button>
        <Hash className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">Team Chat</span>
        <span className="text-[10px] text-muted-foreground">— {channel}</span>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Channels sidebar */}
        {sidebarOpen && (
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

            {/* Private Channels */}
            <div className="mt-3 pt-3 border-t border-border/30">
              <div className="flex items-center justify-between px-3 mb-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Private Channels</span>
              </div>
              {/* Create & Join buttons */}
              <div className="flex gap-1 px-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-7 text-[10px] gap-1"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="h-3 w-3" /> Create
                </Button>
              </div>
              {privateChannels.map(pc => {
                const isUnlocked = unlockedChannels.has(pc.id) || pc.created_by_id === user?.id;
                const isActive = channel === `private:${pc.id}`;
                return (
                  <button
                    key={pc.id}
                    onClick={() => {
                      if (isUnlocked) {
                        setChannel(`private:${pc.id}`);
                        setShowPinnedOnly(false);
                      } else {
                        setJoinTargetChannel(pc);
                        setJoinPassword('');
                        setJoinDialogOpen(true);
                      }
                    }}
                    className={cn(
                      'flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                    )}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span className="truncate flex-1 text-left">{pc.name}</span>
                    {!isUnlocked && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 border-primary/30 text-primary">
                        Join
                      </Badge>
                    )}
                  </button>
                );
              })}
              {privateChannels.length === 0 && (
                <p className="px-3 py-1 text-[10px] text-muted-foreground italic">No private channels yet</p>
              )}
            </div>
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

          {/* Display Name Editor */}
          <div className="p-3 border-t border-border/50">
            {editingDisplayName ? (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Display Name</p>
                <Input
                  value={newDisplayName}
                  onChange={e => setNewDisplayName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveDisplayName(); if (e.key === 'Escape') setEditingDisplayName(false); }}
                  placeholder="Enter display name..."
                  className="h-7 text-xs"
                  autoFocus
                />
                <div className="flex gap-1">
                  <Button size="sm" className="h-6 text-[10px] flex-1" onClick={saveDisplayName}>
                    <Check className="h-3 w-3 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditingDisplayName(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  const myProfile = users.find(u => u.id === user?.id);
                  setNewDisplayName(myProfile?.display_name || profile?.full_name || '');
                  setEditingDisplayName(true);
                }}
                className="flex items-center gap-2 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="h-3 w-3" />
                <span>Edit Display Name</span>
              </button>
            )}
            {role && (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', ROLE_BADGE_COLORS[role] || '')}>
                  {ROLE_LABELS[role] || role}
                </Badge>
                <span className="text-[10px] text-muted-foreground">Your role</span>
              </div>
            )}
          </div>

          {/* Online users */}
          <OnlineUsers />
        </div>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Channel header */}
          <div className="h-14 border-b border-border/50 flex items-center px-5 gap-3 shrink-0">
            {channel.startsWith('private:') ? <Lock className="h-5 w-5 text-muted-foreground" /> : <Hash className="h-5 w-5 text-muted-foreground" />}
            <h3 className="font-semibold text-foreground">
              {channel.startsWith('private:')
                ? privateChannels.find(pc => `private:${pc.id}` === channel)?.name || 'Private'
                : CHANNELS.find(c => c.id === channel)?.label}
            </h3>
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
              <span className="mx-2 opacity-30">|</span>
              <span className="opacity-60">$ link policies</span>
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
                const nameInfo = getSenderDisplayName(msg.sender_id, msg.sender_name, msg.sender_email);
                const senderRole = getSenderRole(msg.sender_id);
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
                        {getInitials(nameInfo.displayName, msg.sender_email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      {/* Reply quote */}
                      {msg.reply_to_id && (() => {
                        const repliedMsg = messages.find(m => m.id === msg.reply_to_id);
                        if (!repliedMsg) return null;
                        const replyNameInfo = getSenderDisplayName(repliedMsg.sender_id, repliedMsg.sender_name, repliedMsg.sender_email);
                        return (
                          <div className="flex items-start gap-1.5 mb-1 pl-2 border-l-2 border-primary/40 rounded-sm">
                            <CornerDownRight className="h-3 w-3 text-primary/50 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-[10px] font-semibold text-primary/70">{replyNameInfo.displayName}</span>
                              <p className="text-[11px] text-muted-foreground truncate max-w-md">{repliedMsg.content.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1').replace(/#\[([^\]]+)\]\([^)]+\)/g, '#$1')}</p>
                            </div>
                          </div>
                        );
                      })()}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">
                          {nameInfo.displayName}
                        </span>
                        {nameInfo.showRealName && nameInfo.realName !== nameInfo.displayName && (
                          <span className="text-[10px] text-muted-foreground">({nameInfo.realName})</span>
                        )}
                        {senderRole && (
                          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', ROLE_BADGE_COLORS[senderRole] || 'bg-muted text-muted-foreground')}>
                            {ROLE_LABELS[senderRole] || senderRole}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
                        
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

                      {/* Attachments */}
                      {msg.attachments && (msg.attachments as ChatAttachment[]).length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {(msg.attachments as ChatAttachment[]).map((att, idx) => {
                            const isImage = att.type?.startsWith('image/');
                            return isImage ? (
                              <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                                <img src={att.url} alt={att.name} className="max-w-[240px] max-h-[180px] rounded-md border border-border/50 object-cover hover:opacity-90 transition-opacity" />
                              </a>
                            ) : (
                              <a
                                key={idx}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 rounded-md border border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-colors max-w-[240px]"
                              >
                                <FileText className="h-4 w-4 text-primary shrink-0" />
                                <span className="text-xs text-foreground truncate">{att.name}</span>
                                <Download className="h-3 w-3 text-muted-foreground shrink-0" />
                              </a>
                            );
                          })}
                        </div>
                      )}
                      {msg.incident_id && !msg.content.includes('#[') && (
                        <Link to={`/incidents/${msg.incident_id}`} className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline">
                          <AlertTriangle className="h-3 w-3" /> View Incident
                        </Link>
                      )}

                      {/* Reactions */}
                      <ChatReactions messageId={msg.id} />
                      {/* Read receipts - show who saw this message */}
                      <ChatReadReceipts messageId={msg.id} senderId={msg.sender_id} />
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
                <div className="px-3 py-1.5 border-b border-border/50">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mention User</span>
                </div>
                {filteredUsers.map((u, idx) => {
                  const uRole = userRoles.get(u.id);
                  return (
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
                          {getInitials(u.display_name || u.full_name, u.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-foreground">{u.display_name || u.full_name || u.email.split('@')[0]}</p>
                          {uRole && (
                            <Badge variant="outline" className={cn('text-[8px] px-1 py-0', ROLE_BADGE_COLORS[uRole] || '')}>
                              {ROLE_LABELS[uRole] || uRole}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{u.email}</p>
                      </div>
                    </button>
                  );
                })}
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

            {/* Policy mention dropdown */}
            {showPolicies && (
              <PolicyMentionDropdown
                filter={policyFilter}
                selectedIndex={policyIndex}
                onSelect={(pol) => insertPolicy(pol)}
              />
            )}

            {/* Pending files preview */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {pendingFiles.map((file, idx) => {
                  const isImage = file.type.startsWith('image/');
                  return (
                    <div key={idx} className="relative group/file flex items-center gap-2 px-2 py-1.5 rounded-md border border-border/50 bg-secondary/30">
                      {isImage ? (
                        <img src={URL.createObjectURL(file)} alt={file.name} className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <FileText className="h-4 w-4 text-primary" />
                      )}
                      <span className="text-xs text-foreground max-w-[120px] truncate">{file.name}</span>
                      <button onClick={() => removePendingFile(idx)} className="h-4 w-4 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center hover:bg-destructive transition-colors">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Priority selector + attach + input */}
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

              {/* File attach button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-9 w-9 flex items-center justify-center rounded-md border border-border/50 shrink-0 transition-colors hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                title="Attach files"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json,.xml,.yaml,.yml,.log,.zip"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message #${channel}... (@ mention, # incident, $ policy)`}
                  className="pr-16 bg-secondary/30"
                  disabled={sending}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <AtSign className="h-3.5 w-3.5 text-muted-foreground/40" />
                  <Hash className="h-3.5 w-3.5 text-muted-foreground/40" />
                  <Shield className="h-3.5 w-3.5 text-muted-foreground/40" />
                </div>
              </div>
              <Button onClick={sendMessage} disabled={sending || (!newMessage.trim() && pendingFiles.length === 0)} size="icon" className="shrink-0">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Private Channel Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Create Private Channel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Channel Name</label>
              <Input
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                placeholder="e.g. incident-response-team"
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Password</label>
              <Input
                type="password"
                value={newChannelPassword}
                onChange={e => setNewChannelPassword(e.target.value)}
                placeholder="Set a password for this channel"
                className="h-9"
              />
            </div>
            <Button
              onClick={createPrivateChannel}
              disabled={creatingChannel || !newChannelName.trim() || !newChannelPassword.trim()}
              className="w-full"
            >
              {creatingChannel ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Channel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Private Channel Dialog */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="h-4 w-4 text-primary" />
              Join #{joinTargetChannel?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">This channel is password-protected. Enter the password to join.</p>
            <Input
              type="password"
              value={joinPassword}
              onChange={e => setJoinPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') joinPrivateChannel(); }}
              placeholder="Enter channel password"
              className="h-9"
              autoFocus
            />
            <Button
              onClick={joinPrivateChannel}
              disabled={joiningChannel || !joinPassword.trim()}
              className="w-full"
            >
              {joiningChannel ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
              Join Channel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
