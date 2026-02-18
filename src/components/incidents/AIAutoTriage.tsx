import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Zap, CheckCircle2, Clock, AlertTriangle, ArrowRight, Loader2, Bot, Shield, Tag, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';

interface TriageResult {
  incidentId: string;
  incidentNumber: string;
  eventType: string;
  severity: number;
  originalClassification: string;
  suggestedClassification: string;
  suggestedRiskLevel: string;
  suggestedPriority: 'P1' | 'P2' | 'P3' | 'P4';
  confidence: number;
  reasoning: string;
  mitreTechnique?: string;
  status: 'pending' | 'applied' | 'dismissed';
}

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  P1: { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30', label: 'P1 - Critical' },
  P2: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'P2 - High' },
  P3: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'P3 - Medium' },
  P4: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'P4 - Low' },
};

function computeAutoTriage(incident: any): Omit<TriageResult, 'status'> {
  const sev = incident.severity || 5;
  const eventType = (incident.event_type || '').toLowerCase();

  let priority: 'P1' | 'P2' | 'P3' | 'P4' = 'P3';
  let suggestedClassification = incident.classification || 'Pending';
  let suggestedRiskLevel = incident.risk_level || 'Medium';
  let confidence = 65;
  let reasoning = '';
  let mitreTechnique = incident.mitre_technique;

  if (sev >= 9 || eventType.includes('ransomware') || eventType.includes('apt')) {
    priority = 'P1'; confidence = 91; suggestedRiskLevel = 'Critical';
    reasoning = `Severity ${sev}/10 with ${incident.event_type} pattern indicates active threat requiring immediate response.`;
    suggestedClassification = 'True Positive';
  } else if (sev >= 7 || eventType.includes('exfiltration') || eventType.includes('lateral')) {
    priority = 'P2'; confidence = 82; suggestedRiskLevel = 'High';
    reasoning = `High severity data movement or lateral activity detected. Escalation to Tier 2 recommended.`;
    suggestedClassification = 'True Positive';
  } else if (sev >= 5 || eventType.includes('brute') || eventType.includes('malware')) {
    priority = 'P2'; confidence = 76; suggestedRiskLevel = 'High';
    reasoning = `Credential attack or malware execution pattern. Requires investigation within SLA window.`;
    suggestedClassification = 'True Positive';
  } else if (sev >= 3 || eventType.includes('phishing') || eventType.includes('auth')) {
    priority = 'P3'; confidence = 68; suggestedRiskLevel = 'Medium';
    reasoning = `Authentication anomaly or phishing indicator. Standard triage procedure applies.`;
    suggestedClassification = incident.classification || 'Pending';
  } else {
    priority = 'P4'; confidence = 55; suggestedRiskLevel = 'Low';
    reasoning = `Low severity event. Likely informational - monitor and verify no escalation.`;
    suggestedClassification = incident.classification === 'False Positive' ? 'False Positive' : 'Pending';
  }

  // Boost confidence if MITRE data available
  if (mitreTechnique) confidence = Math.min(confidence + 8, 97);
  // Boost if src/dst IPs available
  if (incident.src_ip && incident.dst_ip) confidence = Math.min(confidence + 5, 97);

  return {
    incidentId: incident.id,
    incidentNumber: incident.incident_number,
    eventType: incident.event_type,
    severity: sev,
    originalClassification: incident.classification || 'Pending',
    suggestedClassification,
    suggestedRiskLevel,
    suggestedPriority: priority,
    confidence,
    reasoning,
    mitreTechnique,
  };
}

export function AIAutoTriage() {
  const [results, setResults] = useState<TriageResult[]>([]);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runTriage = async () => {
    setRunning(true);
    try {
      // Fetch pending/new incidents
      const { data, error } = await supabase
        .from('incidents')
        .select('id, incident_number, event_type, severity, classification, risk_level, status, src_ip, dst_ip, mitre_technique, message')
        .in('status', ['New', 'Open', 'Pending'])
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const triageResults: TriageResult[] = (data || []).map(incident => ({
        ...computeAutoTriage(incident),
        status: 'pending',
      }));

      setResults(triageResults);
      setLastRun(new Date());
      toast.success(`AI Triage analyzed ${triageResults.length} incidents`);
    } catch (err: any) {
      toast.error('Triage failed: ' + err.message);
    } finally {
      setRunning(false);
    }
  };

  const applyTriage = async (result: TriageResult) => {
    setApplying(result.incidentId);
    try {
      const { error } = await supabase
        .from('incidents')
        .update({
          classification: result.suggestedClassification,
          risk_level: result.suggestedRiskLevel,
          status: result.suggestedPriority === 'P1' ? 'Escalated' : 'Assigned',
        } as any)
        .eq('id', result.incidentId);

      if (error) throw error;

      setResults(prev => prev.map(r => r.incidentId === result.incidentId ? { ...r, status: 'applied' } : r));
      toast.success(`✅ Triage applied to ${result.incidentNumber}`);
    } catch (err: any) {
      toast.error('Failed to apply triage: ' + err.message);
    } finally {
      setApplying(null);
    }
  };

  const dismissTriage = (incidentId: string) => {
    setResults(prev => prev.map(r => r.incidentId === incidentId ? { ...r, status: 'dismissed' } : r));
  };

  const applyAll = async () => {
    const pending = results.filter(r => r.status === 'pending');
    for (const r of pending) {
      await applyTriage(r);
      await new Promise(res => setTimeout(res, 150));
    }
  };

  const pending = results.filter(r => r.status === 'pending');
  const applied = results.filter(r => r.status === 'applied');

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI Auto-Triage</h3>
            <p className="text-xs text-muted-foreground">
              {lastRun ? `Last run: ${lastRun.toLocaleTimeString()}` : 'Automatically classify & prioritize new incidents'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pending.length > 0 && (
            <Button variant="outline" size="sm" onClick={applyAll} className="h-8 text-xs gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Apply All ({pending.length})
            </Button>
          )}
          <Button onClick={runTriage} disabled={running} size="sm" className="h-8 text-xs gap-1.5">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
            {running ? 'Analyzing...' : 'Run Auto-Triage'}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
            <p className="text-lg font-bold text-foreground">{pending.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pending</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
            <p className="text-lg font-bold text-emerald-400">{applied.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Applied</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
            <p className="text-lg font-bold text-primary">
              {results.length > 0 ? Math.round(results.reduce((s, r) => s + r.confidence, 0) / results.length) : 0}%
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg Confidence</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && !running && (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-xl">
          <Brain className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No triage results yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Click "Run Auto-Triage" to analyze pending incidents</p>
        </div>
      )}

      {/* Results List */}
      <AnimatePresence>
        {results.map((result, index) => {
          const pc = PRIORITY_CONFIG[result.suggestedPriority];
          const isDone = result.status !== 'pending';
          return (
            <motion.div
              key={result.incidentId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: isDone ? 0.55 : 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-xl border bg-card p-4 transition-all ${
                result.status === 'applied' ? 'border-emerald-500/30' :
                result.status === 'dismissed' ? 'border-border/30' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Badge className={`flex-shrink-0 text-[10px] font-bold ${pc.color} ${pc.bg} border ${pc.border}`}>
                    {pc.label}
                  </Badge>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold font-mono text-foreground">{result.incidentNumber}</span>
                      <span className="text-xs text-muted-foreground">{result.eventType}</span>
                      <Badge variant="outline" className="text-[10px] h-4">Sev {result.severity}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{result.reasoning}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Tag className="h-3 w-3" /> {result.originalClassification}
                        <ArrowRight className="h-3 w-3 mx-1 text-primary" />
                        <span className="text-primary font-medium">{result.suggestedClassification}</span>
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Shield className="h-3 w-3" /> Risk:
                        <span className="text-foreground font-medium ml-0.5">{result.suggestedRiskLevel}</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Confidence: <span className="text-primary font-medium">{result.confidence}%</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {result.status === 'applied' && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  )}
                  {result.status === 'dismissed' && (
                    <span className="text-xs text-muted-foreground">Dismissed</span>
                  )}
                  {result.status === 'pending' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => dismissTriage(result.incidentId)}
                        className="h-7 text-xs text-muted-foreground"
                      >
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => applyTriage(result)}
                        disabled={applying === result.incidentId}
                        className="h-7 text-xs gap-1"
                      >
                        {applying === result.incidentId ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3" />
                        )}
                        Apply
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
