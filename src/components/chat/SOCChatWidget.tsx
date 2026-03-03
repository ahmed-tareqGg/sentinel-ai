import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Send, Bot, User, Loader2, Minimize2, Maximize2, Plus, History, ArrowLeft, Trash2, Paperclip, Image as ImageIcon, FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { backendUrl, publishableKey, supabase } from '@/integrations/backend/client';
import ReactMarkdown from 'react-markdown';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: { name: string; type: string; base64: string; url?: string }[];
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
}

const CHAT_URL = `${backendUrl}/functions/v1/soc-chat`;

const CONTEXT_PROMPTS: Record<string, string[]> = {
  '/dashboard': ['Daily briefing', 'Top threats right now', 'SLA compliance status', 'Open critical incidents'],
  '/incidents': ['Summarize open incidents', 'Which incidents need triage?', 'Show false positive trends', 'Unassigned incidents'],
  '/compliance': ['Coverage gaps analysis', 'Next audit preparation', 'Non-compliant controls', 'Evidence status'],
  '/threat-intel': ['Active threat actors', 'Trending IOCs', 'OSINT summary', 'Malware campaigns'],
  '/playbooks': ['Suggest playbook for latest incident', 'Automation rate', 'Failed playbook runs', 'Create new playbook'],
};

const DEFAULT_PROMPTS = [
  'Current security posture summary',
  'What are the open critical incidents?',
  'Show me compliance coverage status',
  'Which incidents need immediate action?',
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function SOCChatWidget() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen for external open events (e.g. from Dashboard AI Copilot card)
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('open-soc-chat', handler);
    return () => window.removeEventListener('open-soc-chat', handler);
  }, []);

  const activeConvo = conversations.find(c => c.id === activeId) || null;
  const messages = activeConvo?.messages || [];

  // Load conversations from DB with message counts
  const loadConversations = useCallback(async () => {
    setLoadingConvos(true);
    try {
      const { data: convos, error } = await supabase
        .from('ai_conversations')
        .select('*, ai_messages(count)')
        .order('updated_at', { ascending: false });
      
      if (error) { console.error('Load convos error:', error); return; }
      
      const mapped: Conversation[] = (convos || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        messages: [],
        messageCount: c.ai_messages?.[0]?.count || 0,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));
      
      setConversations(mapped);
      setActiveId(prev => {
        if (!prev && mapped.length > 0) return mapped[0].id;
        return prev;
      });
    } catch (e) {
      console.error('Load conversations failed:', e);
    } finally {
      setLoadingConvos(false);
    }
  }, []);

  // Load messages for active conversation
  const loadMessages = useCallback(async (convoId: string) => {
    const { data: msgs, error } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', convoId)
      .order('created_at', { ascending: true });
    
    if (error) { console.error('Load messages error:', error); return; }
    
    setConversations(prev => prev.map(c => 
      c.id === convoId 
        ? { ...c, messages: (msgs || []).map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content })) }
        : c
    ));
  }, []);

  useEffect(() => {
    if (isOpen) loadConversations();
  }, [isOpen, loadConversations]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !showHistory) inputRef.current?.focus();
  }, [isOpen, showHistory]);

  const updateConvoMessages = (id: string, updater: (msgs: Message[]) => Message[]) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, messages: updater(c.messages) } : c));
  };

  const startNewChat = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({ user_id: user.id, title: 'New Chat' })
      .select()
      .single();
    
    if (error || !data) { console.error('Create convo error:', error); return; }
    
    const newConvo: Conversation = {
      id: data.id,
      title: data.title,
      messages: [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    setConversations(prev => [newConvo, ...prev]);
    setActiveId(data.id);
    setShowHistory(false);
  };

  const openConvo = (id: string) => {
    setActiveId(id);
    setShowHistory(false);
  };

  const deleteConvo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('ai_conversations').delete().eq('id', id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      setActiveId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) setPendingFiles(prev => [...prev, ...files].slice(0, 5));
    e.target.value = '';
  };

  const removePendingFile = (idx: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const sendMessage = async (text: string) => {
    if ((!text.trim() && pendingFiles.length === 0) || isLoading) return;

    let currentId = activeId;
    if (!currentId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('ai_conversations')
        .insert({ user_id: user.id, title: 'New Chat' })
        .select()
        .single();
      if (error || !data) return;
      const newConvo: Conversation = { id: data.id, title: data.title, messages: [], createdAt: data.created_at, updatedAt: data.updated_at };
      setConversations(prev => [newConvo, ...prev]);
      currentId = data.id;
      setActiveId(currentId);
    }

    // Process attachments
    const attachments: { name: string; type: string; base64: string; url?: string }[] = [];
    for (const file of pendingFiles) {
      try {
        const base64 = await fileToBase64(file);
        attachments.push({ name: file.name, type: file.type, base64, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined });
      } catch (err) { console.error('Failed to read file:', err); }
    }

    const messageText = text.trim() || (attachments.length > 0 ? `📎 Attached ${attachments.length} file(s) for analysis` : '');
    const userMsg: Message = { role: 'user', content: messageText, attachments };

    // Save user message to DB
    await supabase.from('ai_messages').insert({ conversation_id: currentId, role: 'user', content: messageText });

    // Update title if first message
    const convo = conversations.find(c => c.id === currentId);
    if (convo && convo.messages.length === 0) {
      const title = messageText.slice(0, 50) + (messageText.length > 50 ? '...' : '');
      await supabase.from('ai_conversations').update({ title }).eq('id', currentId);
      setConversations(prev => prev.map(c => c.id === currentId ? { ...c, title } : c));
    }

    const allMessages = [...(convo?.messages || []), userMsg];
    updateConvoMessages(currentId!, () => allMessages);

    setInput('');
    setPendingFiles([]);
    setIsLoading(true);

    let assistantContent = '';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const apiMessages = allMessages.map(m => {
        if (m.attachments && m.attachments.length > 0) {
          const parts: any[] = [];
          parts.push({ type: 'text', text: m.content });
          for (const att of m.attachments) {
            if (att.base64 && att.type.startsWith('image/')) {
              parts.push({ type: 'image_url', image_url: { url: `data:${att.type};base64,${att.base64}` } });
            } else if (att.base64) {
              parts.push({ type: 'text', text: `[Attached file: ${att.name} (${att.type})]` });
            }
          }
          return { role: m.role, content: parts };
        }
        return { role: m.role, content: m.content };
      });

      // Rate limit: 1 request per 5 seconds
      const now = Date.now();
      const lastReqTime = (window as any).__socChatLastReq || 0;
      if (now - lastReqTime < 5000) {
        throw new Error('Please wait a few seconds before sending another message.');
      }
      (window as any).__socChatLastReq = now;

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken || publishableKey}`,
        },
        body: JSON.stringify({ messages: apiMessages, current_route: location.pathname }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        if (resp.status === 429) throw new Error('AI is busy. Please wait 30 seconds and try again.');
        if (resp.status === 402) throw new Error('AI credits exhausted. Contact admin to add credits.');
        if (resp.status === 503) throw new Error('All AI providers are temporarily unavailable. Try again in a minute.');
        throw new Error(errData.error || 'Failed to connect');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              const snapshot = assistantContent;
              updateConvoMessages(currentId!, msgs => {
                const last = msgs[msgs.length - 1];
                if (last?.role === 'assistant') {
                  return msgs.map((m, i) => i === msgs.length - 1 ? { ...m, content: snapshot } : m);
                }
                return [...msgs, { role: 'assistant', content: snapshot }];
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Save assistant message to DB
      if (assistantContent) {
        await supabase.from('ai_messages').insert({ conversation_id: currentId, role: 'assistant', content: assistantContent });
      }

    } catch (e) {
      console.error('Chat error:', e);
      const errMsg = `⚠️ ${e instanceof Error ? e.message : 'Connection failed'}`;
      updateConvoMessages(currentId!, msgs => [...msgs, { role: 'assistant', content: errMsg }]);
      await supabase.from('ai_messages').insert({ conversation_id: currentId, role: 'assistant', content: errMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground shadow-lg transition-all hover:scale-105 glow-primary animate-fade-in"
      >
        <Bot className="h-5 w-5" />
        <span className="text-sm font-semibold">SOCMind AI</span>
      </button>
    );
  }

  return (
    <div className={cn(
      'fixed z-50 flex flex-col rounded-xl border border-border bg-card shadow-2xl animate-scale-in transition-all duration-300',
      isExpanded
        ? 'bottom-4 right-4 left-4 top-20 md:left-auto md:w-[700px] md:top-4'
        : 'bottom-6 right-6 w-[420px] h-[600px]'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-xl bg-gradient-to-r from-primary/15 to-primary/5 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          {showHistory ? (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(false)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <div className="relative">
              <div className="rounded-lg bg-primary/20 p-1.5">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-card" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">
              {showHistory ? 'Chat History' : 'SOCMind AI'}
            </p>
            {!showHistory && <p className="text-[10px] text-muted-foreground">Online — Real-time SOC Intelligence</p>}
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {!showHistory && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={startNewChat} title="New Chat">
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setShowHistory(true)} title="Chat History">
                <History className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setIsOpen(false); setShowHistory(false); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* History View */}
      {showHistory ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {loadingConvos ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <History className="h-8 w-8 opacity-50" />
              <p className="text-sm">No previous conversations</p>
            </div>
          ) : (
            conversations.map(convo => (
              <button
                key={convo.id}
                onClick={() => openConvo(convo.id)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors group',
                  convo.id === activeId
                    ? 'bg-primary/10 text-foreground'
                    : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                <Bot className="h-4 w-4 flex-shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{convo.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {convo.messageCount || convo.messages.length} msgs • {new Date(convo.updatedAt).toLocaleDateString('en-US')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive flex-shrink-0"
                  onClick={(e) => deleteConvo(convo.id, e)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </button>
            ))
          )}
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-primary hover:bg-primary/10 transition-colors mt-2 border border-dashed border-primary/30"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm font-medium">New Chat</span>
          </button>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-4 pt-4">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center rounded-xl bg-primary/10 p-3 mb-3">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Hi! I'm SOCMind AI</p>
                  <p className="text-xs text-muted-foreground mt-1">Ask me anything about incidents, compliance, threats & more</p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {QUICK_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(prompt)}
                      className="text-left text-xs rounded-lg border border-border/50 bg-secondary/30 px-3 py-2.5 text-muted-foreground hover:bg-secondary hover:text-foreground hover:border-border transition-all"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-2.5', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="rounded-lg bg-primary/15 p-1.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  </div>
                )}
                <div className={cn(
                  'max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-secondary/80 text-foreground rounded-bl-sm'
                )} dir="auto" style={{ unicodeBidi: 'plaintext' } as React.CSSProperties}>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {msg.attachments.map((att, idx) => (
                        att.type.startsWith('image/') && att.url ? (
                          <img key={idx} src={att.url} alt={att.name} className="max-w-[160px] max-h-[120px] rounded-md object-cover border border-white/10" />
                        ) : (
                          <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/10 text-[10px]">
                            <FileText className="h-3 w-3" />
                            {att.name}
                          </div>
                        )
                      ))}
                    </div>
                  )}
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_li]:my-0.5 [&_code]:text-primary [&_code]:bg-primary/10 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-black/20 [&_pre]:rounded-lg [&_pre]:p-2 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm" dir="auto" style={{ unicodeBidi: 'plaintext' } as React.CSSProperties}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span dir="auto" style={{ unicodeBidi: 'plaintext' } as React.CSSProperties}>{msg.content}</span>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="rounded-lg bg-secondary p-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex gap-2.5">
                <div className="rounded-lg bg-primary/15 p-1.5 mt-1">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-secondary/80 rounded-xl rounded-bl-sm px-3.5 py-2.5">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-border p-3 space-y-2">
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {pendingFiles.map((file, idx) => {
                  const isImage = file.type.startsWith('image/');
                  return (
                    <div key={idx} className="relative group flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border/50 bg-secondary/30 text-xs">
                      {isImage ? (
                        <img src={URL.createObjectURL(file)} alt={file.name} className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-primary" />
                      )}
                      <span className="text-foreground max-w-[80px] truncate">{file.name}</span>
                      <button
                        onClick={() => removePendingFile(idx)}
                        className="h-4 w-4 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center hover:bg-destructive"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-end gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Attach files or images"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.csv,.json,.log,.xml,.yaml,.yml"
                onChange={handleFileSelect}
                className="hidden"
              />
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about any incident, compliance, or threat..."
                className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[36px] max-h-[100px]"
                dir="auto"
                disabled={isLoading}
                rows={1}
              />
              <Button
                type="button"
                size="icon"
                disabled={isLoading || (!input.trim() && pendingFiles.length === 0)}
                className="h-8 w-8 shrink-0"
                onClick={() => sendMessage(input)}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
