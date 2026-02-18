import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Loader2, ChevronDown, ChevronUp, Zap, Shield, AlertTriangle,
  Search, Lock, Network, Terminal, FileWarning, Eye, Crosshair,
  ArrowRight, Clock, Sparkles, Play, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AIIncidentTimelineProps {
  incidentId: string;
  incident: any;
}

interface TimelineStage {
  id: string;
  phase: string;
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
  time?: string;
  description: string;
  aiNarrative?: string;
  mitreId?: string;
  mitreName?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isAI?: boolean;
}

const PHASE_ICONS: Record<string, any> = {
  'Reconnaissance': Search,
  'Initial Access': Lock,
  'Execution': Terminal,
  'Persistence': Shield,
  'Privilege Escalation': Zap,
  'Defense Evasion': Eye,
  'Credential Access': Lock,
  'Discovery': Crosshair,
  'Lateral Movement': Network,
  'Collection': FileWarning,
  'Command and Control': Network,
  'Exfiltration': AlertTriangle,
  'Impact': AlertTriangle,
};

const PHASE_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  'Reconnaissance': { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  'Initial Access': { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  'Execution': { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  'Persistence': { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  'Privilege Escalation': { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  'Defense Evasion': { color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  'Credential Access': { color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30' },
  'Discovery': { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  'Lateral Movement': { color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  'Collection': { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  'Command and Control': { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
  'Exfiltration': { color: 'text-red-500', bg: 'bg-red-600/10', border: 'border-red-600/30' },
  'Impact': { color: 'text-red-600', bg: 'bg-red-700/10', border: 'border-red-700/30' },
  'default': { color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
};

function buildTimelineFromIncident(incident: any): TimelineStage[] {
  const stages: TimelineStage[] = [];
  const aiAnalysis = incident?.ai_analysis;

  // Add detected event as starting point
  stages.push({
    id: 'detection',
    phase: 'Detection',
    icon: Eye,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/30',
    time: incident.timestamp,
    description: incident.message || incident.event_type,
    severity: incident.severity >= 4 ? 'critical' : incident.severity >= 3 ? 'high' : 'medium',
  });

  // Add attack chain stages from AI analysis
  if (aiAnalysis?.attack_chain?.stages) {
    aiAnalysis.attack_chain.stages.forEach((stage: any, idx: number) => {
      const colors = PHASE_COLORS[stage.tactic] || PHASE_COLORS['default'];
      const Icon = PHASE_ICONS[stage.tactic] || Zap;
      stages.push({
        id: `chain-${idx}`,
        phase: stage.tactic,
        icon: Icon,
        color: colors.color,
        bgColor: colors.bg,
        borderColor: colors.border,
        time: stage.time,
        description: `${stage.technique} — ${stage.tactic}`,
        mitreId: stage.technique,
        severity: 'high',
        isAI: true,
      });
    });
  } else if (incident.mitre_tactic) {
    // Single tactic
    const colors = PHASE_COLORS[incident.mitre_tactic] || PHASE_COLORS['default'];
    const Icon = PHASE_ICONS[incident.mitre_tactic] || Zap;
    stages.push({
      id: 'mitre-main',
      phase: incident.mitre_tactic,
      icon: Icon,
      color: colors.color,
      bgColor: colors.bg,
      borderColor: colors.border,
      time: incident.timestamp,
      description: incident.mitre_technique || incident.mitre_tactic,
      mitreId: incident.mitre_technique,
      severity: incident.risk_level === 'Critical' ? 'critical' : 'high',
      isAI: true,
    });
  }

  // Deduplicate by phase+time
  const seen = new Set<string>();
  return stages.filter(s => {
    const key = `${s.phase}-${s.time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function AIIncidentTimeline({ incidentId, incident }: AIIncidentTimelineProps) {
  const [stages, setStages] = useState<TimelineStage[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiNarratives, setAiNarratives] = useState<Record<string, string>>({});
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [streamingNarrative, setStreamingNarrative] = useState('');
  const [streamingStageId, setStreamingStageId] = useState<string | null>(null);
  const [animatedStages, setAnimatedStages] = useState<Set<string>>(new Set());
  const [fullNarrative, setFullNarrative] = useState<string | null>(null);
  const [generatingFull, setGeneratingFull] = useState(false);

  useEffect(() => {
    if (incident) {
      const built = buildTimelineFromIncident(incident);
      setStages(built);
      // Animate stages in sequence
      built.forEach((s, i) => {
        setTimeout(() => {
          setAnimatedStages(prev => new Set([...prev, s.id]));
        }, i * 200);
      });
    }
  }, [incident]);

  const generateFullNarrative = async () => {
    setGeneratingFull(true);
    setFullNarrative(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { backendUrl, publishableKey } = await import('@/integrations/backend/client');
      
      const prompt = `You are a senior SOC analyst. Write a concise, engaging narrative (150-200 words) of this security incident, telling the attack story from start to finish like a thriller. Be technical but readable. Use past tense.

Incident: ${incident.event_type}
Risk Level: ${incident.risk_level}
MITRE Tactic: ${incident.mitre_tactic}
MITRE Technique: ${incident.mitre_technique}
Source IP: ${incident.src_ip}
Message: ${incident.message}
Attack Chain: ${incident.ai_analysis?.attack_chain?.chain_label || 'Unknown'}

Write the narrative now:`;

      const resp = await fetch(`${backendUrl}/functions/v1/soc-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || publishableKey}`,
          'apikey': publishableKey,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          current_route: '/incidents',
        }),
      });

      if (!resp.ok) throw new Error('Failed to generate narrative');

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No stream');

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
            if (delta) { content += delta; setFullNarrative(content); }
          } catch {}
        }
      }
    } catch (e) {
      toast.error('Failed to generate narrative');
    } finally {
      setGeneratingFull(false);
    }
  };

  const severityDot = (sev: string) => {
    if (sev === 'critical') return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]';
    if (sev === 'high') return 'bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.6)]';
    if (sev === 'medium') return 'bg-yellow-500 shadow-[0_0_4px_rgba(234,179,8,0.5)]';
    return 'bg-blue-500';
  };

  if (!stages.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Brain className="h-5 w-5 text-primary" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI Attack Timeline</h3>
            <p className="text-xs text-muted-foreground">AI-reconstructed attack progression</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {incident.ai_analysis?.attack_chain?.chain_label && (
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary hidden sm:flex">
              {incident.ai_analysis.attack_chain.chain_label}
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={generateFullNarrative}
            disabled={generatingFull}
            className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 h-7 text-xs"
          >
            {generatingFull ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            <span className="hidden sm:inline">AI Story</span>
          </Button>
        </div>
      </div>

      {/* AI Full Narrative */}
      <AnimatePresence>
        {(fullNarrative || generatingFull) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-border"
          >
            <div className="p-4 bg-primary/5">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-primary mb-1.5">AI Incident Narrative</p>
                  {generatingFull && !fullNarrative ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Reconstructing attack story...
                    </div>
                  ) : (
                    <p className="text-sm text-foreground/90 leading-relaxed">{fullNarrative}</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline */}
      <div className="p-5">
        {/* Horizontal connector line for desktop */}
        <div className="hidden lg:flex items-center mb-6 relative">
          {stages.map((stage, idx) => {
            const Icon = stage.icon;
            const isLast = idx === stages.length - 1;
            return (
              <div key={stage.id} className="flex items-center flex-1 min-w-0">
                <motion.button
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={animatedStages.has(stage.id) ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
                  className={cn(
                    'relative flex flex-col items-center gap-1.5 cursor-pointer group shrink-0',
                  )}
                >
                  <div className={cn(
                    'relative h-10 w-10 rounded-full border-2 flex items-center justify-center transition-all duration-200',
                    stage.bgColor, stage.borderColor,
                    expandedStage === stage.id && 'scale-110 ring-2 ring-offset-1 ring-offset-background ring-primary/50',
                    'group-hover:scale-110'
                  )}>
                    <Icon className={cn('h-4 w-4', stage.color)} />
                    {/* Severity glow dot */}
                    <span className={cn(
                      'absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-background',
                      severityDot(stage.severity)
                    )} />
                    {stage.isAI && (
                      <span className="absolute -bottom-0.5 -left-0.5 h-2 w-2 rounded-full bg-primary border border-background" />
                    )}
                  </div>
                  <span className={cn('text-[9px] font-medium text-center leading-tight max-w-[60px]', stage.color)}>
                    {stage.phase}
                  </span>
                  {stage.time && (
                    <span className="text-[8px] text-muted-foreground">
                      {new Date(stage.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </motion.button>
                {!isLast && (
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={animatedStages.has(stage.id) ? { scaleX: 1 } : { scaleX: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="flex-1 h-[2px] bg-gradient-to-r from-border to-border/30 mx-1 origin-left"
                  >
                    <div className="h-full w-full bg-gradient-to-r from-primary/20 to-transparent" />
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile vertical timeline */}
        <div className="lg:hidden space-y-0">
          {stages.map((stage, idx) => {
            const Icon = stage.icon;
            const isLast = idx === stages.length - 1;
            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, x: -20 }}
                animate={animatedStages.has(stage.id) ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                transition={{ delay: idx * 0.1 }}
                className="relative flex gap-3"
              >
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
                    className={cn(
                      'relative h-8 w-8 rounded-full border-2 flex items-center justify-center shrink-0',
                      stage.bgColor, stage.borderColor
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5', stage.color)} />
                    <span className={cn(
                      'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-background',
                      severityDot(stage.severity)
                    )} />
                  </button>
                  {!isLast && <div className="w-px flex-1 bg-border/50 my-1" />}
                </div>
                <button
                  onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
                  className="flex-1 pb-4 text-left"
                >
                  <p className={cn('text-xs font-semibold', stage.color)}>{stage.phase}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{stage.description}</p>
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Expanded stage detail */}
        <AnimatePresence>
          {expandedStage && (() => {
            const stage = stages.find(s => s.id === expandedStage);
            if (!stage) return null;
            const Icon = stage.icon;
            return (
              <motion.div
                key={expandedStage}
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'mt-4 rounded-lg border p-4',
                  stage.bgColor, stage.borderColor
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('h-8 w-8 rounded-full border flex items-center justify-center shrink-0', stage.bgColor, stage.borderColor)}>
                    <Icon className={cn('h-4 w-4', stage.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={cn('text-sm font-semibold', stage.color)}>{stage.phase}</span>
                      {stage.mitreId && (
                        <a
                          href={`https://attack.mitre.org/techniques/${stage.mitreId.replace('.', '/')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] bg-background/50 border border-border rounded px-1.5 py-0.5 text-muted-foreground hover:text-primary transition-colors font-mono"
                        >
                          {stage.mitreId} ↗
                        </a>
                      )}
                      {stage.isAI && (
                        <Badge variant="secondary" className="text-[9px] h-4 gap-1">
                          <Brain className="h-2.5 w-2.5" />AI
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80">{stage.description}</p>
                    {stage.time && (
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(stage.time).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]" />
            Critical
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            High
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary border border-background" />
            AI-detected
          </span>
          <span className="ml-auto flex items-center gap-1">
            <span>Click stage for details</span>
          </span>
        </div>
      </div>
    </div>
  );
}
