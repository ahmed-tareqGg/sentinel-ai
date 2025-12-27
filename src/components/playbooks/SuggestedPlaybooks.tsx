import { useState, useEffect } from 'react';
import { Lightbulb, Sparkles, Check, X, ChevronRight, Loader2, AlertCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PlaybookSuggestion {
  id: string;
  name: string;
  description: string | null;
  suggested_conditions: Record<string, any>;
  suggested_actions: any[];
  reasoning: string;
  pattern_source: string | null;
  confidence_score: number | null;
  incident_count: number | null;
  status: string;
  created_at: string;
}

interface SuggestedPlaybooksProps {
  onPlaybookCreated?: () => void;
}

export function SuggestedPlaybooks({ onPlaybookCreated }: SuggestedPlaybooksProps) {
  const [suggestions, setSuggestions] = useState<PlaybookSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSuggestion, setSelectedSuggestion] = useState<PlaybookSuggestion | null>(null);
  const [processing, setProcessing] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  useEffect(() => {
    fetchSuggestions();
  }, []);
  
  const fetchSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from('playbook_suggestions')
        .select('*')
        .eq('status', 'pending')
        .order('confidence_score', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setSuggestions((data || []) as unknown as PlaybookSuggestion[]);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const generateNewSuggestions = async () => {
    setGenerating(true);
    
    try {
      // Analyze recent incidents for patterns
      const { data: incidents } = await supabase
        .from('incidents')
        .select('id, event_type, severity, risk_level, classification, mitre_technique, recommended_actions')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (!incidents || incidents.length < 5) {
        toast.info('Need more incidents to generate suggestions');
        setGenerating(false);
        return;
      }
      
      // Pattern 1: Repeated event types without playbooks
      const eventTypeCounts = incidents.reduce((acc, inc) => {
        acc[inc.event_type] = (acc[inc.event_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Check existing playbooks
      const { data: existingPlaybooks } = await supabase
        .from('playbooks')
        .select('conditions');
      
      const coveredEventTypes = existingPlaybooks?.map(p => 
        (p.conditions as any)?.event_type
      ).filter(Boolean) || [];
      
      // Find patterns not covered
      for (const [eventType, count] of Object.entries(eventTypeCounts)) {
        if (count >= 3 && !coveredEventTypes.some(c => eventType.toLowerCase().includes(c?.toLowerCase() || ''))) {
          const matchingIncidents = incidents.filter(i => i.event_type === eventType);
          const avgSeverity = matchingIncidents.reduce((s, i) => s + (i.severity || 0), 0) / matchingIncidents.length;
          
          // Generate suggestion
          const suggestion = {
            name: `Auto-Response: ${eventType}`,
            description: `Automatically respond to ${eventType} incidents based on ${count} recent occurrences`,
            suggested_conditions: {
              event_type: eventType,
              min_severity: Math.floor(avgSeverity),
            },
            suggested_actions: [
              { type: 'notify_slack', params: { message: `${eventType} incident detected` } },
              { type: 'escalate', params: { team: 'SOC Team' } },
            ],
            reasoning: `Detected ${count} incidents of type "${eventType}" in recent history. No existing playbook covers this pattern. Average severity: ${avgSeverity.toFixed(1)}`,
            pattern_source: 'repeated_incidents',
            confidence_score: Math.min(50 + count * 5, 95),
            incident_count: count,
            sample_incident_ids: matchingIncidents.slice(0, 5).map(i => i.id),
            status: 'pending',
          };
          
          await supabase.from('playbook_suggestions').insert(suggestion as any);
        }
      }
      
      // Pattern 2: Critical incidents with True Positive classification
      const criticalTPs = incidents.filter(i => 
        i.risk_level === 'Critical' && i.classification === 'True Positive'
      );
      
      if (criticalTPs.length >= 2) {
        const suggestion = {
          name: 'Critical Threat Auto-Containment',
          description: 'Immediate containment for confirmed critical threats',
          suggested_conditions: {
            risk_level: 'Critical',
            classification: 'True Positive',
          },
          suggested_actions: [
            { type: 'isolate_host', params: {} },
            { type: 'block_ip', params: {} },
            { type: 'notify_slack', params: { message: 'Critical threat contained automatically' } },
            { type: 'escalate', params: { team: 'SOC Leadership' } },
          ],
          reasoning: `${criticalTPs.length} critical True Positive incidents detected. Recommend automated containment to reduce MTTR.`,
          pattern_source: 'repeated_incidents',
          confidence_score: 90,
          incident_count: criticalTPs.length,
          sample_incident_ids: criticalTPs.slice(0, 5).map(i => i.id),
          status: 'pending',
        };
        
        // Check if similar doesn't exist
        const { data: existing } = await supabase
          .from('playbook_suggestions')
          .select('id')
          .eq('name', suggestion.name)
          .eq('status', 'pending');
        
        if (!existing?.length) {
          await supabase.from('playbook_suggestions').insert(suggestion as any);
        }
      }
      
      toast.success('Generated new playbook suggestions based on incident patterns');
      fetchSuggestions();
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast.error('Failed to generate suggestions');
    } finally {
      setGenerating(false);
    }
  };
  
  const handleApprove = async () => {
    if (!selectedSuggestion) return;
    setProcessing(true);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // Create actual playbook
      const { data: newPlaybook, error: createError } = await supabase
        .from('playbooks')
        .insert({
          name: selectedSuggestion.name,
          description: selectedSuggestion.description,
          conditions: selectedSuggestion.suggested_conditions,
          actions: selectedSuggestion.suggested_actions,
          is_active: true,
          created_by: userData.user?.id || null,
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      // Update suggestion status
      await supabase
        .from('playbook_suggestions')
        .update({
          status: 'converted',
          reviewed_at: new Date().toISOString(),
          reviewed_by: userData.user?.id || null,
          converted_playbook_id: newPlaybook.id,
        })
        .eq('id', selectedSuggestion.id);
      
      // Log to audit
      await supabase.from('compliance_audit_logs').insert({
        action: 'playbook_suggestion_approved',
        actor_type: 'user',
        actor_id: userData.user?.id || null,
        actor_email: userData.user?.email || null,
        resource_type: 'playbook_suggestion',
        resource_id: selectedSuggestion.id,
        result: 'success',
        details: { converted_to: newPlaybook.id },
      } as any);
      
      toast.success(`Playbook "${selectedSuggestion.name}" created successfully!`);
      setSelectedSuggestion(null);
      fetchSuggestions();
      onPlaybookCreated?.();
    } catch (error) {
      console.error('Error approving suggestion:', error);
      toast.error('Failed to create playbook');
    } finally {
      setProcessing(false);
    }
  };
  
  const handleDismiss = async () => {
    if (!selectedSuggestion) return;
    setProcessing(true);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      await supabase
        .from('playbook_suggestions')
        .update({
          status: 'dismissed',
          reviewed_at: new Date().toISOString(),
          reviewed_by: userData.user?.id || null,
        })
        .eq('id', selectedSuggestion.id);
      
      toast.success('Suggestion dismissed');
      setSelectedSuggestion(null);
      fetchSuggestions();
    } catch (error) {
      console.error('Error dismissing suggestion:', error);
      toast.error('Failed to dismiss suggestion');
    } finally {
      setProcessing(false);
    }
  };
  
  const getPatternBadge = (source: string | null) => {
    switch (source) {
      case 'repeated_incidents':
        return <Badge variant="secondary" className="text-xs">Pattern: Repeated Incidents</Badge>;
      case 'analyst_behavior':
        return <Badge variant="secondary" className="text-xs">Pattern: Analyst Actions</Badge>;
      case 'manual_actions':
        return <Badge variant="secondary" className="text-xs">Pattern: Manual Responses</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">AI Suggested</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-warning" />
              <CardTitle className="text-base">AI-Suggested Playbooks</CardTitle>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={generateNewSuggestions}
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Analyze Patterns
            </Button>
          </div>
          <CardDescription>
            Intelligent playbook recommendations based on incident patterns and analyst behavior
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No pending suggestions</p>
              <p className="text-xs mt-1">Click "Analyze Patterns" to generate new suggestions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedSuggestion(suggestion)}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{suggestion.name}</span>
                      {getPatternBadge(suggestion.pattern_source)}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {suggestion.reasoning}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {suggestion.confidence_score && (
                      <div className="flex items-center gap-1 text-xs">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        <span>{suggestion.confidence_score}%</span>
                      </div>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Detail Dialog */}
      <Dialog open={!!selectedSuggestion} onOpenChange={(open) => !open && setSelectedSuggestion(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-warning" />
              {selectedSuggestion?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedSuggestion?.description}
            </DialogDescription>
          </DialogHeader>
          
          {selectedSuggestion && (
            <div className="space-y-4 py-4">
              {/* Reasoning */}
              <div className="rounded-lg bg-warning/10 border border-warning/30 p-3">
                <p className="text-sm">{selectedSuggestion.reasoning}</p>
              </div>
              
              {/* Conditions */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Trigger Conditions</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedSuggestion.suggested_conditions).map(([key, value]) => (
                    <Badge key={key} variant="outline">
                      {key}: {String(value)}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {/* Actions */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Suggested Actions</h4>
                <div className="space-y-1">
                  {selectedSuggestion.suggested_actions.map((action: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{idx + 1}.</span>
                      <Badge variant="secondary">{action.type.replace(/_/g, ' ')}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {selectedSuggestion.incident_count && (
                  <span>Based on {selectedSuggestion.incident_count} incidents</span>
                )}
                {selectedSuggestion.confidence_score && (
                  <span>•</span>
                )}
                {selectedSuggestion.confidence_score && (
                  <span>Confidence: {selectedSuggestion.confidence_score}%</span>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handleDismiss}
              disabled={processing}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Dismiss
            </Button>
            <Button 
              onClick={handleApprove}
              disabled={processing}
              className="gap-2"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Create Playbook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
