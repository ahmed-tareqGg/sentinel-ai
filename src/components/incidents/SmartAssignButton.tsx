import { useState } from 'react';
import { UserCheck, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';

interface SmartAssignButtonProps {
  incidentIds: string[];
  onSuccess: () => void;
  disabled?: boolean;
}

export function SmartAssignButton({ incidentIds, onSuccess, disabled }: SmartAssignButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSmartAssign = async () => {
    if (incidentIds.length === 0) return;
    setLoading(true);

    try {
      // Fetch analysts with their open incident counts
      const { data: analysts, error: fetchError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager']);

      if (fetchError) throw fetchError;
      if (!analysts || analysts.length === 0) {
        toast.error('No available analysts found');
        return;
      }

      // Get open incident counts per analyst
      const { data: openCounts, error: countError } = await supabase
        .from('incidents')
        .select('incident_owner_id')
        .not('incident_owner_id', 'is', null)
        .not('status', 'in', '("Closed","Resolved")');

      if (countError) throw countError;

      // Build workload map
      const workloadMap = new Map<string, number>();
      analysts.forEach(a => workloadMap.set(a.user_id, 0));
      (openCounts || []).forEach(i => {
        if (i.incident_owner_id && workloadMap.has(i.incident_owner_id)) {
          workloadMap.set(i.incident_owner_id, (workloadMap.get(i.incident_owner_id) || 0) + 1);
        }
      });

      // Sort analysts by workload (least loaded first), then by tier (higher tier for more incidents)
      const sortedAnalysts = analysts.sort((a, b) => {
        const loadA = workloadMap.get(a.user_id) || 0;
        const loadB = workloadMap.get(b.user_id) || 0;
        return loadA - loadB;
      });

      // Round-robin assign incidents to analysts
      const assignments: { id: string; owner: string }[] = [];
      incidentIds.forEach((incId, idx) => {
        const analyst = sortedAnalysts[idx % sortedAnalysts.length];
        assignments.push({ id: incId, owner: analyst.user_id });
      });

      // Batch update
      let successCount = 0;
      for (const assignment of assignments) {
        const { error } = await supabase
          .from('incidents')
          .update({
            incident_owner_id: assignment.owner,
            status: 'Assigned',
            assigned_at: new Date().toISOString(),
          })
          .eq('id', assignment.id);

        if (!error) successCount++;
      }

      toast.success(`⚡ Smart Assign: ${successCount} incident${successCount > 1 ? 's' : ''} assigned by workload`);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Smart assign failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || loading || incidentIds.length === 0}
          onClick={handleSmartAssign}
          className="gap-1.5 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Smart Assign
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Auto-assign to analyst with least open incidents</p>
      </TooltipContent>
    </Tooltip>
  );
}
