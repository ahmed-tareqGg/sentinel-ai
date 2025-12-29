import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Edit2, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AnalystFeedbackProps {
  executionId?: string;
  playbookId: string;
  incidentId: string;
  playbookName: string;
  onFeedbackSubmitted?: () => void;
  className?: string;
}

export function AnalystFeedback({ 
  executionId, 
  playbookId, 
  incidentId, 
  playbookName,
  onFeedbackSubmitted,
  className 
}: AnalystFeedbackProps) {
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'correct' | 'incorrect' | 'modified'>('correct');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    setSubmitting(true);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // Submit feedback
      const { error: feedbackError } = await supabase
        .from('playbook_feedback')
        .insert({
          playbook_id: playbookId,
          incident_id: incidentId,
          execution_id: executionId || null,
          analyst_id: userData.user?.id || null,
          feedback_type: feedbackType,
          notes: notes || null,
        } as any);
      
      if (feedbackError) throw feedbackError;
      
      // Update learning metrics
      const { data: existingLearning } = await supabase
        .from('playbook_learning')
        .select('*')
        .eq('playbook_id', playbookId)
        .single();
      
      if (existingLearning) {
        const updates: any = { last_updated: new Date().toISOString() };
        if (feedbackType === 'correct') {
          updates.approval_count = (existingLearning.approval_count || 0) + 1;
          // Increase confidence slightly
          updates.confidence_adjustment = Math.min((existingLearning.confidence_adjustment || 0) + 1, 15);
        } else if (feedbackType === 'incorrect') {
          updates.rejection_count = (existingLearning.rejection_count || 0) + 1;
          // Decrease confidence
          updates.confidence_adjustment = Math.max((existingLearning.confidence_adjustment || 0) - 2, -20);
        } else {
          updates.modification_count = (existingLearning.modification_count || 0) + 1;
        }
        
        await supabase
          .from('playbook_learning')
          .update(updates)
          .eq('playbook_id', playbookId);
      } else {
        // Create new learning record
        await supabase
          .from('playbook_learning')
          .insert({
            playbook_id: playbookId,
            approval_count: feedbackType === 'correct' ? 1 : 0,
            rejection_count: feedbackType === 'incorrect' ? 1 : 0,
            modification_count: feedbackType === 'modified' ? 1 : 0,
            confidence_adjustment: feedbackType === 'correct' ? 1 : feedbackType === 'incorrect' ? -2 : 0,
          } as any);
      }
      
      // Log to compliance audit
      await supabase.from('compliance_audit_logs').insert({
        action: 'playbook_feedback',
        actor_type: 'user',
        actor_id: userData.user?.id || null,
        actor_email: userData.user?.email || null,
        resource_type: 'playbook',
        resource_id: playbookId,
        result: 'success',
        details: { feedback_type: feedbackType, incident_id: incidentId },
      } as any);
      
      toast.success('Feedback submitted - AI will learn from this!');
      setOpen(false);
      setNotes('');
      onFeedbackSubmitted?.();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };
  
  const quickFeedback = async (type: 'correct' | 'incorrect') => {
    setFeedbackType(type);
    setSubmitting(true);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      await supabase.from('playbook_feedback').insert({
        playbook_id: playbookId,
        incident_id: incidentId,
        execution_id: executionId || null,
        analyst_id: userData.user?.id || null,
        feedback_type: type,
      } as any);
      
      toast.success(type === 'correct' ? 'Marked as correct response' : 'Marked as incorrect - will adjust');
    } catch (error) {
      console.error('Quick feedback error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className={cn("border-dashed", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Analyst Feedback
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Help the AI learn from this playbook execution
        </p>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1 flex-1 border-green-500/30 hover:bg-green-500/10"
            onClick={() => quickFeedback('correct')}
            disabled={submitting}
          >
            <ThumbsUp className="h-3 w-3 text-green-500" />
            Correct
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1 flex-1 border-destructive/30 hover:bg-destructive/10"
            onClick={() => quickFeedback('incorrect')}
            disabled={submitting}
          >
            <ThumbsDown className="h-3 w-3 text-destructive" />
            Incorrect
          </Button>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Edit2 className="h-3 w-3" />
                Details
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Playbook Feedback</DialogTitle>
                <DialogDescription>
                  Provide feedback on "{playbookName}" execution to improve AI decisions
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-3">
                  <Label>Was this response appropriate?</Label>
                  <RadioGroup value={feedbackType} onValueChange={(v) => setFeedbackType(v as any)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="correct" id="correct" />
                      <Label htmlFor="correct" className="font-normal cursor-pointer">
                        ✅ Correct - The playbook responded appropriately
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="incorrect" id="incorrect" />
                      <Label htmlFor="incorrect" className="font-normal cursor-pointer">
                        ❌ Incorrect - This was not the right response
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="modified" id="modified" />
                      <Label htmlFor="modified" className="font-normal cursor-pointer">
                        🔧 Modified - I had to adjust the response
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="What would have been the better response? Any suggestions for improvement?"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit Feedback
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
