import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, Loader2, X, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase, backendUrl, publishableKey } from '@/integrations/backend/client';
import ReactMarkdown from 'react-markdown';

const FUNCTIONS_URL = `${backendUrl}/functions/v1`;

const SUGGESTIONS = [
  'Show critical incidents from this week',
  'How many false positives today?',
  'Which IPs triggered the most alerts?',
  'MITRE techniques detected this month',
];

export function NaturalLanguageSearch() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setLoading(true);
    setShowResults(true);
    setResult(null);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const resp = await fetch(`${FUNCTIONS_URL}/soc-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || publishableKey}`,
          'apikey': publishableKey,
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Answer this SOC question concisely (max 100 words, use tables/lists if helpful): ${q}`
          }],
          current_route: '/dashboard',
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed: ${resp.status}`);
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let content = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              content += delta;
              setResult(content);
            }
          } catch {}
        }
      }

      if (!content) setResult('No results found.');
    } catch (e: any) {
      console.error('Search error:', e);
      setResult(`⚠️ ${e.message || 'Search failed. Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Ask anything... e.g. 'Show critical incidents from this week'"
            className="pl-10 pr-10 bg-background/50 border-primary/20 focus:border-primary/40"
          />
          {query && (
            <button onClick={() => { setQuery(''); setShowResults(false); setResult(null); }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Button size="sm" onClick={() => handleSearch()} disabled={loading || !query.trim()} className="gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Ask AI
        </Button>
      </div>

      {/* Suggestions */}
      {!showResults && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => { setQuery(s); handleSearch(s); }}
              className="text-[11px] px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="mt-3 rounded-lg border border-border bg-card p-4"
          >
            {loading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Searching...</span>
              </div>
            ) : result ? (
              <div className="prose prose-sm prose-invert max-w-none text-sm [&_strong]:text-foreground [&_table]:text-xs">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            ) : null}
            <div className="flex justify-end mt-2">
              <button onClick={() => { setShowResults(false); setResult(null); }} className="text-xs text-muted-foreground hover:text-foreground">
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
