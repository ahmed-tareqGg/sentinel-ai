import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Loader2, Minimize2, Maximize2, Plus, History, ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { backendUrl, publishableKey, supabase } from '@/integrations/backend/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

const CHAT_URL = `${backendUrl}/functions/v1/soc-chat`;
const STORAGE_KEY = 'socmind-conversations';

const QUICK_PROMPTS = [
  'Current security posture summary',
  'What are the open critical incidents?',
  'Top MITRE techniques detected',
  'Which incidents need immediate action?',
];

function loadConversations(): Conversation[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveConversations(convos: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
}

function generateTitle(messages: Message[]): string {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return 'New Chat';
  const text = firstUser.content.slice(0, 50);
  return text.length < firstUser.content.length ? text + '...' : text;
}

function createNewConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: 'New Chat',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function SOCChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeId, setActiveId] = useState<string | null>(() => {
    const convos = loadConversations();
    return convos.length > 0 ? convos[0].id : null;
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeConvo = conversations.find(c => c.id === activeId) || null;
  const messages = activeConvo?.messages || [];

  // Persist
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !showHistory) inputRef.current?.focus();
  }, [isOpen, showHistory]);

  const updateConvo = (id: string, updater: (c: Conversation) => Conversation) => {
    setConversations(prev => prev.map(c => c.id === id ? updater(c) : c));
  };

  const startNewChat = () => {
    const newConvo = createNewConversation();
    setConversations(prev => [newConvo, ...prev]);
    setActiveId(newConvo.id);
    setShowHistory(false);
  };

  const openConvo = (id: string) => {
    setActiveId(id);
    setShowHistory(false);
  };

  const deleteConvo = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      setActiveId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    let currentId = activeId;
    if (!currentId) {
      const newConvo = createNewConversation();
      setConversations(prev => [newConvo, ...prev]);
      currentId = newConvo.id;
      setActiveId(currentId);
    }

    const userMsg: Message = { role: 'user', content: text.trim() };
    
    // Update conversation with user message
    const convo = conversations.find(c => c.id === currentId) || createNewConversation();
    const allMessages = [...convo.messages, userMsg];
    
    updateConvo(currentId!, c => ({
      ...c,
      messages: allMessages,
      title: c.messages.length === 0 ? text.trim().slice(0, 50) + (text.trim().length > 50 ? '...' : '') : c.title,
      updatedAt: Date.now(),
    }));
    
    setInput('');
    setIsLoading(true);

    let assistantContent = '';

    try {
      // Get current user session for auth context
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken || publishableKey}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
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
              updateConvo(currentId!, c => {
                const msgs = [...c.messages];
                const last = msgs[msgs.length - 1];
                if (last?.role === 'assistant') {
                  msgs[msgs.length - 1] = { ...last, content: snapshot };
                } else {
                  msgs.push({ role: 'assistant', content: snapshot });
                }
                return { ...c, messages: msgs, updatedAt: Date.now() };
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error('Chat error:', e);
      updateConvo(currentId!, c => ({
        ...c,
        messages: [...c.messages, { role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : 'Connection failed'}` }],
        updatedAt: Date.now(),
      }));
    } finally {
      setIsLoading(false);
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
        : 'bottom-6 right-6 w-[400px] h-[560px]'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-xl bg-primary/10 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {showHistory ? (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(false)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <div className="relative">
              <Bot className="h-5 w-5 text-primary" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-success animate-pulse" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">
              {showHistory ? 'Chat History' : 'SOCMind AI Assistant'}
            </p>
            {!showHistory && <p className="text-xs text-muted-foreground">Real-time SOC Intelligence</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!showHistory && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startNewChat} title="New Chat">
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(true)} title="Chat History">
                <History className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setIsOpen(false); setShowHistory(false); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* History View */}
      {showHistory ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {conversations.length === 0 ? (
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
                    {convo.messages.length} messages • {new Date(convo.updatedAt).toLocaleDateString('en-US')}
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
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Bot className="h-5 w-5 text-primary" />
                  <p className="text-sm">Hi! I'm SOCMind AI Assistant. How can I help you?</p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {QUICK_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(prompt)}
                      className="text-left text-xs rounded-lg border border-border bg-secondary/50 px-3 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="rounded-full bg-primary/20 p-1.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  </div>
                )}
                <div className={cn(
                  'max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground'
                )}>
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="rounded-full bg-secondary p-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex gap-2">
                <div className="rounded-full bg-primary/20 p-1.5 mt-1">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-secondary rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <form
              onSubmit={e => { e.preventDefault(); sendMessage(input); }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about any incident or threat..."
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={isLoading}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="h-9 w-9">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
