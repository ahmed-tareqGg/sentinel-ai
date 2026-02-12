import { useState, useEffect } from 'react';
import { Brain, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';

interface RootCauseAnalysisProps {
  incidentId: string;
}

export function RootCauseAnalysis({ incidentId }: RootCauseAnalysisProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  // Load persisted RCA from DB on mount
  useEffect(() => {
    const loadSavedAnalysis = async () => {
      try {
        const { data } = await supabase
          .from('incidents')
          .select('ai_analysis')
          .eq('id', incidentId)
          .single();

        const rca = (data?.ai_analysis as any)?.root_cause_analysis;
        if (rca) {
          setAnalysis(rca);
        }
      } catch (err) {
        console.error('Failed to load saved RCA:', err);
      } finally {
        setInitialLoading(false);
      }
    };

    loadSavedAnalysis();
  }, [incidentId]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('root-cause-analysis', {
        body: { incident_id: incidentId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const analysisText = data.analysis;
      setAnalysis(analysisText);
      setExpanded(true);

      // Persist RCA to incident's ai_analysis field
      const { data: incident } = await supabase
        .from('incidents')
        .select('ai_analysis')
        .eq('id', incidentId)
        .single();

      const existingAnalysis = (incident?.ai_analysis as Record<string, unknown>) || {};
      await supabase
        .from('incidents')
        .update({
          ai_analysis: {
            ...existingAnalysis,
            root_cause_analysis: analysisText,
            rca_generated_at: new Date().toISOString(),
          } as any,
        })
        .eq('id', incidentId);

      toast.success('Root Cause Analysis complete');
    } catch (err) {
      console.error('RCA error:', err);
      toast.error('Failed to generate analysis');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">AI Root Cause Analysis</h3>
        </div>
        <div className="flex items-center gap-2">
          {analysis && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
          <Button onClick={runAnalysis} disabled={loading} size="sm" variant="outline" className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {loading ? 'Analyzing...' : analysis ? 'Re-Analyze' : 'Run RCA'}
          </Button>
        </div>
      </div>

      {analysis && expanded && (
        <div className="p-4 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
          {analysis}
        </div>
      )}

      {!analysis && !loading && (
        <div className="p-6 text-center text-muted-foreground text-sm">
          <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Click "Run RCA" to generate an AI-powered Root Cause Analysis</p>
          <p className="text-xs mt-1">Analyzes incident data, timeline, IOCs, and similar past incidents</p>
        </div>
      )}
    </div>
  );
}
