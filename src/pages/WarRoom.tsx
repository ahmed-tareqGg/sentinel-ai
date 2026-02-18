import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertTriangle, Shield, Clock, Send, Users, Activity, 
  ArrowLeft, Radio, MessageSquare, Loader2, Plus, CheckSquare,
  Square, Timer, ListTodo, UserCheck, Zap, Target, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
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

interface Task {
  id: string;
  title: string;
  assignee: string;
  status: 'pending' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
}

interface TimelineEvent {
  id: string;
  action: string;
  actor: string;
  time: string;
  type: 'system' | 'user' | 'ai';
}

const SLA_LIMITS: Record<string, number> = {
  Critical: 15,
  High: 30,
  Medium: 60,
  Low: 240,
};

export default function WarRoom() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const [incident, setIncident] = useState<IncidentData | null>(null);
  const [messages, setMessages] = useState<WarRoomMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'tasks' | 'timeline'>('chat');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Task['priority']>('medium');
  const [showTaskForm, setShowTaskForm] = useState(false);

  // Countdown timer
  const [elapsed, setElapsed] = useState(0);

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

  // Timer
  useEffect(() => {
    if (!incident) return;
    const startTime = new Date(incident.created_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [incident]);

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  // Load tasks from localStorage (keyed by incident id)
  useEffect(() => {
    if (!id) return;
    const stored = localStorage.getItem(`warroom_tasks_${id}`);
    if (stored) setTasks(JSON.parse(stored));
  }, [id]);

  const saveTasks = (updated: Task[]) => {
    setTasks(updated);
    if (id) localStorage.setItem(`warroom_tasks_${id}`, JSON.stringify(updated));
  };

  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    const task: Task = {
      id: crypto.randomUUID(),
      title: newTaskTitle.trim(),
      assignee: newTaskAssignee || profile?.full_name || 'Unassigned',
      status: 'pending',
      priority: newTaskPriority,
      created_at: new Date().toISOString(),
    };
    saveTasks([...tasks, task]);
    setNewTaskTitle('');
    setNewTaskAssignee('');
    setNewTaskPriority('medium');
    setShowTaskForm(false);
    toast.success('Task added');
  };

  const toggleTaskStatus = (taskId: string) => {
    const updated = tasks.map(t => {
      if (t.id !== taskId) return t;
      const cycle: Record<Task['status'], Task['status']> = {
        pending: 'in_progress',
        in_progress: 'done',
        done: 'pending',
      };
      return { ...t, status: cycle[t.status] };
    });
    saveTasks(updated);
  };

  const deleteTask = (taskId: string) => {
    saveTasks(tasks.filter(t => t.id !== taskId));
  };

  // Load messages
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

  // Build timeline from messages + tasks
  const timeline: TimelineEvent[] = [
    { id: 'start', action: `Incident ${incident?.incident_number} opened`, actor: 'System', time: incident?.created_at || '', type: 'system' as const },
    ...messages.slice(0, 20).map(m => ({
      id: m.id,
      action: m.content.slice(0, 80) + (m.content.length > 80 ? '…' : ''),
      actor: m.sender_name || m.sender_email?.split('@')[0] || 'Analyst',
      time: m.created_at,
      type: 'user' as const,
    })),
    ...tasks.filter(t => t.status === 'done').map(t => ({
      id: t.id,
      action: `Task completed: ${t.title}`,
      actor: t.assignee,
      time: t.created_at,
      type: 'user' as const,
    })),
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

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
    Critical: 'bg-destructive/20 text-destructive border-destructive/30',
    High: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    Medium: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    Low: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  const priorityColors: Record<string, string> = {
    critical: 'text-destructive',
    high: 'text-orange-400',
    medium: 'text-yellow-400',
    low: 'text-muted-foreground',
  };

  const statusColors: Record<string, string> = {
    pending: 'text-muted-foreground',
    in_progress: 'text-primary',
    done: 'text-green-500',
  };

  const slaLimit = SLA_LIMITS[incident.risk_level] || 60;
  const slaElapsedMinutes = elapsed / 60;
  const slaPercent = Math.min((slaElapsedMinutes / slaLimit) * 100, 100);
  const slaBreached = slaElapsedMinutes > slaLimit;
  const slaRemaining = Math.max(0, slaLimit - slaElapsedMinutes);

  const doneTasks = tasks.filter(t => t.status === 'done').length;

  return (
    <AppLayout title={`War Room — ${incident.incident_number}`} subtitle="Emergency Response Coordination">
      <div className="flex flex-col h-[calc(100vh-140px)]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <Link to={`/incidents/${id}`}>
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-1.5">
            <Radio className="h-4 w-4 text-destructive animate-pulse" />
            <span className="text-sm font-bold text-foreground">LIVE</span>
          </div>
          <Badge className={riskColors[incident.risk_level] || riskColors.Medium}>
            {incident.risk_level}
          </Badge>
          <Badge variant="outline">{incident.status}</Badge>
          
          {/* SLA Timer */}
          <div className={`flex items-center gap-1.5 ml-auto px-3 py-1 rounded-full border text-xs font-mono font-bold ${
            slaBreached 
              ? 'bg-destructive/10 border-destructive/30 text-destructive' 
              : slaPercent > 80
              ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
              : 'bg-primary/10 border-primary/30 text-primary'
          }`}>
            <Timer className="h-3.5 w-3.5" />
            {slaBreached ? 'SLA BREACHED' : `SLA: ${Math.floor(slaRemaining)}m remaining`}
            <span className="text-muted-foreground ml-1">| {formatElapsed(elapsed)}</span>
          </div>
        </div>

        {/* SLA Progress Bar */}
        <div className="mb-3">
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${slaBreached ? 'bg-destructive' : slaPercent > 80 ? 'bg-orange-500' : 'bg-primary'}`}
              initial={{ width: 0 }}
              animate={{ width: `${slaPercent}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
            <span>0 min</span>
            <span>{slaLimit} min SLA ({incident.risk_level})</span>
          </div>
        </div>

        {/* Incident Summary Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          <div className="rounded-lg border border-border bg-card p-2.5">
            <p className="text-[10px] text-muted-foreground mb-0.5">Event Type</p>
            <p className="text-xs font-semibold text-foreground truncate">{incident.event_type}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2.5">
            <p className="text-[10px] text-muted-foreground mb-0.5">Source IP</p>
            <p className="text-xs font-mono text-foreground">{incident.src_ip || 'N/A'}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2.5">
            <p className="text-[10px] text-muted-foreground mb-0.5">MITRE</p>
            <p className="text-xs font-semibold text-primary truncate">{incident.mitre_technique || 'N/A'}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2.5">
            <p className="text-[10px] text-muted-foreground mb-0.5">Tasks</p>
            <p className="text-xs font-semibold text-foreground">{doneTasks}/{tasks.length} done</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2.5">
            <p className="text-[10px] text-muted-foreground mb-0.5">Detected</p>
            <p className="text-xs text-foreground">{format(new Date(incident.created_at), 'MMM dd, HH:mm')}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3">
          {(['chat', 'tasks', 'timeline'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary'
              }`}
            >
              {tab === 'chat' && <MessageSquare className="h-3.5 w-3.5" />}
              {tab === 'tasks' && <ListTodo className="h-3.5 w-3.5" />}
              {tab === 'timeline' && <Activity className="h-3.5 w-3.5" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'tasks' && tasks.length > 0 && (
                <Badge variant="outline" className="text-[9px] h-4 px-1 ml-0.5">{tasks.length}</Badge>
              )}
              {tab === 'chat' && messages.length > 0 && (
                <Badge variant="outline" className="text-[9px] h-4 px-1 ml-0.5">{messages.length}</Badge>
              )}
            </button>
          ))}
        </div>

        {/* Chat Tab */}
        <AnimatePresence mode="wait">
          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex-1 rounded-xl border border-border bg-card flex flex-col overflow-hidden min-h-0"
            >
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-destructive/5">
                <MessageSquare className="h-4 w-4 text-destructive" />
                <span className="text-sm font-semibold text-foreground">War Room Communications</span>
                <span className="text-xs text-muted-foreground ml-auto">{messages.length} messages</span>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">War Room is active. Start coordinating the response.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
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
            </motion.div>
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex-1 rounded-xl border border-border bg-card flex flex-col overflow-hidden min-h-0"
            >
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
                <ListTodo className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Response Tasks</span>
                <span className="text-xs text-muted-foreground ml-auto">{doneTasks}/{tasks.length} completed</span>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowTaskForm(!showTaskForm)}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Task
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 min-h-0 space-y-2">
                {/* Task Form */}
                <AnimatePresence>
                  {showTaskForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3 rounded-lg border border-primary/20 bg-primary/5 mb-3"
                    >
                      <div className="space-y-2">
                        <Input
                          placeholder="Task description..."
                          value={newTaskTitle}
                          onChange={e => setNewTaskTitle(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <div className="flex gap-2">
                          <Input
                            placeholder="Assign to (name)"
                            value={newTaskAssignee}
                            onChange={e => setNewTaskAssignee(e.target.value)}
                            className="h-8 text-xs flex-1"
                          />
                          <select
                            value={newTaskPriority}
                            onChange={e => setNewTaskPriority(e.target.value as Task['priority'])}
                            className="h-8 text-xs rounded-md border border-input bg-background px-2"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs flex-1" onClick={addTask}>Add</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowTaskForm(false)}>Cancel</Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {tasks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No tasks yet. Add tasks to coordinate the response.</p>
                  </div>
                ) : (
                  tasks.map(task => (
                    <motion.div
                      key={task.id}
                      layout
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        task.status === 'done' ? 'bg-green-500/5 border-green-500/20 opacity-70' : 'bg-card border-border'
                      }`}
                    >
                      <button onClick={() => toggleTaskStatus(task.id)} className="mt-0.5">
                        {task.status === 'done' 
                          ? <CheckSquare className="h-4 w-4 text-green-500" />
                          : task.status === 'in_progress'
                          ? <Square className="h-4 w-4 text-primary animate-pulse" />
                          : <Square className="h-4 w-4 text-muted-foreground" />
                        }
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <UserCheck className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground">{task.assignee}</span>
                          <span className={`text-[11px] font-medium ${priorityColors[task.priority]}`}>
                            {task.priority}
                          </span>
                          <span className={`text-[11px] font-medium ${statusColors[task.status]}`}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => deleteTask(task.id)} className="text-muted-foreground hover:text-destructive transition-colors text-[10px]">×</button>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex-1 rounded-xl border border-border bg-card flex flex-col overflow-hidden min-h-0"
            >
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Shared Timeline</span>
                <span className="text-xs text-muted-foreground ml-auto">{timeline.length} events</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                {timeline.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Timeline will populate as actions are taken.</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                    <div className="space-y-3 pl-10">
                      {timeline.map((event, i) => (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="relative"
                        >
                          <div className={`absolute -left-6 top-1 h-2 w-2 rounded-full ${
                            event.type === 'system' ? 'bg-muted-foreground' :
                            event.type === 'ai' ? 'bg-primary' : 'bg-green-500'
                          }`} />
                          <p className="text-xs text-foreground">{event.action}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-primary">{event.actor}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {event.time ? formatDistanceToNow(new Date(event.time), { addSuffix: true }) : ''}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
