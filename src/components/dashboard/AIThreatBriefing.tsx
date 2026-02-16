import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, X, ChevronRight, AlertTriangle, Shield, TrendingUp, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/backend/client';
import ReactMarkdown from 'react-markdown';

interface AIThreatBriefingProps {
  totalIncidents: number;
  criticalIncidents: number;
  openIncidents: number;
  mttd: number;
  mttr: number;
  falsePositiveRate: number;
}

export function AIThreatBriefing({ totalIncidents, criticalIncidents, openIncidents, mttd, mttr, falsePositiveRate }: AIThreatBriefingProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    const today = new Date().toDateString();
    return sessionStorage.getItem('threat_briefing_dismissed') === today;
  });

  // Show briefing card on first load if not dismissed today
  useEffect(() => {
    if (!dismissed && totalIncidents > 0) {
      setIsOpen(true);
    }
  }, [dismissed, totalIncidents]);

  const generateBriefing = async () => {
    if (briefing) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('soc-chat', {
        body: {
          messages: [{
            role: 'user',
            content: `Generate a brief daily threat briefing (max 150 words) based on these SOC metrics:
- Total incidents: ${totalIncidents}
- Critical: ${criticalIncidents}
- Open: ${openIncidents}
- MTTD: ${mttd} min
- MTTR: ${mttr} min
- False Positive Rate: ${falsePositiveRate}%

Format: Start with a one-line threat level assessment, then 3 key points with emoji bullets, then a recommended priority action. Keep it concise and actionable.`
          }],
          current_route: '/dashboard',
        },
      });
      
      if (error) throw error;
      
      // Handle streaming response
      if (typeof data === 'string') {
        // Parse SSE stream
        const lines = data.split('\n');
        let content = '';
        for (const line of lines) {
          if (line.startsWith('data: ') && line.slice(6).trim() !== '[DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6));
              content += parsed.choices?.[0]?.delta?.content || '';
            } catch {}
          }
        }
        setBriefing(content || 'Briefing generated.');
      } else if (data?.choices?.[0]?.message?.content) {
        setBriefing(data.choices[0].message.content);
      } else {
        // Fallback local briefing
        setBriefing(generateLocalBriefing());
      }
    } catch (e) {
      console.error('Briefing error:', e);
      setBriefing(generateLocalBriefing());
    } finally {
      setLoading(false);
    }
  };

  const generateLocalBriefing = () => {
    const level = criticalIncidents > 3 ? '🔴 HIGH' : criticalIncidents > 0 ? '🟡 ELEVATED' : '🟢 NORMAL';
    return `**Threat Level: ${level}**

🔍 **${totalIncidents}** total incidents detected, **${openIncidents}** currently open requiring attention
⚡ Detection speed at **${mttd || '< 1'} min** MTTD — ${mttd <= 5 ? 'excellent performance' : 'needs optimization'}
🎯 AI accuracy at **${100 - falsePositiveRate}%** — ${falsePositiveRate <= 20 ? 'strong classification' : 'review AI tuning recommended'}

**Priority Action:** ${criticalIncidents > 0 ? `Address ${criticalIncidents} critical incident(s) immediately` : 'Continue monitoring — no critical threats detected'}`;
  };

  useEffect(() => {
    if (isOpen && !briefing && !loading) {
      generateBriefing();
    }
  }, [isOpen]);

  const handleDismiss = () => {
    setIsOpen(false);
    setDismissed(true);
    sessionStorage.setItem('threat_briefing_dismissed', new Date().toDateString());
  };

  if (dismissed && !isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => { setIsOpen(true); }}
      >
        <Brain className="h-4 w-4 text-primary" />
        AI Briefing
      </Button>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -10, height: 0 }}
          className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent overflow-hidden mb-4"
        >
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/20 p-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Daily Threat Briefing</h3>
                  <p className="text-[10px] text-muted-foreground">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismiss}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Analyzing threat landscape...</span>
              </div>
            ) : briefing ? (
              <div className="prose prose-sm prose-invert max-w-none text-sm text-muted-foreground [&_strong]:text-foreground [&_p]:my-1">
                <ReactMarkdown>{briefing}</ReactMarkdown>
              </div>
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
