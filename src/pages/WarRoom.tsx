import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  AlertTriangle, Shield, Clock, Send, Users, Activity, 
  ArrowLeft, Radio, MessageSquare, Loader2 
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface WarRoomMessage {
  id: string;
  sender_id: string;
  sender_name: string | null;
  sender_email: string | null;
  content: string;
  created_at: string;
}

interface IncidentData {
  id: string;
  incident_number: string;
  event_type: string;
  severity: number;
  risk_level: string;
  status: string;
  src_ip: string | null;
  message: string | null;
  mitre_technique: string | null;
  created_at: string;
}

export default function WarRoom() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const [incident, setIncident] = useState<IncidentData | null>(null);
  const [messages, setMessages] = useState<WarRoomMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load incident
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data } = await supabase.from('incidents').select('*').eq('id', id).single();
      if (data) setIncident(data as unknown as IncidentData);
      setLoading(false);
    };
    load();
  }, [id]);

  // Load war room messages (using chat_messages with channel = warroom:<id>)
  const channelName = `warroom:${id}`;
  
  useEffect(() => {
    if (!id) return;
    const loadMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('id, sender_id, sender_name, sender_email, content, created_at')
        .eq('channel', channelName)
        .order('created_at', { ascending: true })
        .limit(200);
      setMessages((data as WarRoomMessage[]) || []);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
    };
    loadMessages();

    // Realtime
    const sub = supabase
      .channel(`warroom-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel=eq.${channelName}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as WarRoomMessage]);
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
      })
      .subscribe();
    
    return () => { supabase.removeChannel(sub); };
  }, [id, channelName]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !id) return;
    setSending(true);
    const { error } = await supabase.from('chat_messages').insert({
      sender_id: user.id,
      sender_name: profile?.full_name || profile?.email?.split('@')[0],
      sender_email: profile?.email,
      content: newMessage.trim(),
      channel: channelName,
    });
    if (error) toast.error('Failed to send');
    else setNewMessage('');
    setSending(false);
  };

  if (loading) {
    return (
      <AppLayout title="War Room" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!incident) {
    return (
      <AppLayout title="War Room" subtitle="Incident not found">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Incident not found</p>
          <Link to="/incidents"><Button variant="outline" className="mt-4">Back to Incidents</Button></Link>
        </div>
      </AppLayout>
    );
  }

  const riskColors: Record<string, string> = {
    Critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    High: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    Medium: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    Low: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  return (
    <AppLayout title={`War Room — ${incident.incident_number}`} subtitle="Emergency Response Coordination">
      <div className="flex flex-col h-[calc(100vh-140px)]">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <Link to={`/incidents/${id}`}>
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-red-500 animate-pulse" />
            <span className="text-sm font-semibold text-foreground">LIVE</span>
          </div>
          <Badge className={riskColors[incident.risk_level] || riskColors.Medium}>
            {incident.risk_level}
          </Badge>
          <Badge variant="outline">{incident.status}</Badge>
        </div>

        {/* Incident Summary Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground mb-1">Event Type</p>
            <p className="text-sm font-semibold text-foreground truncate">{incident.event_type}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground mb-1">Source IP</p>
            <p className="text-sm font-mono text-foreground">{incident.src_ip || 'N/A'}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground mb-1">MITRE</p>
            <p className="text-sm font-semibold text-primary truncate">{incident.mitre_technique || 'N/A'}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground mb-1">Detected</p>
            <p className="text-sm text-foreground">{format(new Date(incident.created_at), 'MMM dd, HH:mm')}</p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 rounded-xl border border-border bg-card flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-red-500/5">
            <MessageSquare className="h-4 w-4 text-red-400" />
            <span className="text-sm font-semibold text-foreground">War Room Communications</span>
            <span className="text-xs text-muted-foreground ml-auto">{messages.length} messages</span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">War Room is active. Start coordinating the response.</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isMine = msg.sender_id === user?.id;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] rounded-lg px-3 py-2 ${
                      isMine ? 'bg-primary/15 text-foreground' : 'bg-secondary text-foreground'
                    }`}>
                      {!isMine && (
                        <p className="text-[10px] font-semibold text-primary mb-0.5">
                          {msg.sender_name || msg.sender_email?.split('@')[0]}
                        </p>
                      )}
                      <p className="text-sm" dir="auto">{msg.content}</p>
                      <p className="text-[9px] text-muted-foreground mt-1">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </p>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 flex gap-2">
            <Input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message to the war room..."
              className="flex-1"
              dir="auto"
            />
            <Button onClick={sendMessage} disabled={sending || !newMessage.trim()} size="sm" className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
