import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Lock, ArrowUpRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface IncidentAssignmentProps {
  incidentId: string;
  incidentNumber: string;
  ownerId: string | null;
  ownerRole: string | null;
  ownerEmail?: string | null;
  assignedAt: string | null;
  status: string;
  onUpdate: () => void;
}

export function IncidentAssignment({
  incidentId,
  incidentNumber,
  ownerId,
  ownerRole,
  ownerEmail,
  assignedAt,
  status,
  onUpdate,
}: IncidentAssignmentProps) {
  const { user, profile, role, canModifyData } = useAuth();
  const [assigning, setAssigning] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateTo, setEscalateTo] = useState<string>('tier2');

  const isOwner = user?.id === ownerId;
  const isAssigned = !!ownerId;

  const canReassign = canModifyData && role && ['soc_manager', 'admin', 'ciso'].includes(role);
  const canEscalate = canModifyData && role && ['soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager', 'admin'].includes(role);

  const roleLabels: Record<string, string> = {
    soc_tier_1: 'SOC Tier 1',
    soc_tier_2: 'SOC Tier 2',
    soc_tier_3: 'SOC Tier 3',
    soc_manager: 'SOC Manager',
    admin: 'Admin',
    ciso: 'CISO',
    grc_engineer: 'GRC',
  };

  const handleAssign = async () => {
    if (!user || !canModifyData) return;
    setAssigning(true);

    try {
      const { error } = await supabase
        .from('incidents')
        .update({
          incident_owner_id: user.id,
          incident_owner_role: role,
          assigned_at: new Date().toISOString(),
          status: status === 'Open' || status === 'New' ? 'Assigned' : status,
        })
        .eq('id', incidentId);

      if (error) throw error;

      await supabase.from('incident_timeline').insert({
        incident_id: incidentId,
        stage: 'Assigned',
        details: `Assigned to ${profile?.email || 'analyst'} (${roleLabels[role || ''] || role})`,
      });

      toast.success('Incident assigned to you');
      onUpdate();
    } catch (err) {
      console.error('Assignment failed:', err);
      toast.error('Failed to assign incident');
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async () => {
    if (!canReassign) return;
    setAssigning(true);

    try {
      const { error } = await supabase
        .from('incidents')
        .update({
          incident_owner_id: null,
          incident_owner_role: null,
          assigned_at: null,
          status: 'Open',
        })
        .eq('id', incidentId);

      if (error) throw error;

      await supabase.from('incident_timeline').insert({
        incident_id: incidentId,
        stage: 'Unassigned',
        details: `Unassigned by ${profile?.email || 'manager'}`,
      });

      toast.success('Incident unassigned');
      onUpdate();
    } catch (err) {
      console.error('Unassign failed:', err);
      toast.error('Failed to unassign');
    } finally {
      setAssigning(false);
    }
  };

  const handleEscalate = async () => {
    if (!escalateReason.trim()) {
      toast.error('Please provide escalation reason');
      return;
    }
    setEscalating(true);

    try {
      const tierMap: Record<string, string> = {
        tier2: 'soc_tier_2',
        tier3: 'soc_tier_3',
        manager: 'soc_manager',
      };

      const { error } = await supabase
        .from('incidents')
        .update({
          status: 'Escalated',
          escalated_from: role,
          escalated_to: tierMap[escalateTo],
          escalation_reason: escalateReason,
          escalated_at: new Date().toISOString(),
        })
        .eq('id', incidentId);

      if (error) throw error;

      await supabase.from('incident_timeline').insert({
        incident_id: incidentId,
        stage: `Escalated to ${escalateTo.toUpperCase()}`,
        details: `${escalateReason} — by ${profile?.email || 'analyst'}`,
      });

      // Create an approval request so it appears on the Approvals page
      await supabase.from('approval_requests').insert({
        incident_id: incidentId,
        action_type: `escalation_${escalateTo}`,
        status: 'pending',
        requested_by: profile?.email || user?.id || 'analyst',
        reason: escalateReason,
        sla_deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      // Also call the escalation edge function
      supabase.functions.invoke('escalate-incident', {
        body: { incident_id: incidentId, reason: escalateReason },
      }).catch(console.error);

      toast.success(`Escalated to ${escalateTo.toUpperCase()}`);
      setEscalateOpen(false);
      setEscalateReason('');
      onUpdate();
    } catch (err) {
      console.error('Escalation failed:', err);
      toast.error('Failed to escalate');
    } finally {
      setEscalating(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Assignment Status */}
      {isAssigned ? (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary gap-1.5 py-1.5 px-3">
            <Lock className="h-3 w-3" />
            {isOwner ? 'Assigned to You' : `Locked by ${ownerEmail || 'Analyst'}`}
          </Badge>
          <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-xs">
            {roleLabels[ownerRole || ''] || ownerRole}
          </Badge>
          {assignedAt && (
            <span className="text-xs text-muted-foreground">
              {new Date(assignedAt).toLocaleString()}
            </span>
          )}
          {canReassign && !isOwner && (
            <Button variant="ghost" size="sm" onClick={handleUnassign} disabled={assigning}>
              Unassign
            </Button>
          )}
        </div>
      ) : (
        canModifyData && (
          <Button
            onClick={handleAssign}
            disabled={assigning}
            className="bg-primary text-primary-foreground"
            size="sm"
          >
            {assigning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserCheck className="h-4 w-4 mr-2" />
            )}
            Assign to Me
          </Button>
        )
      )}

      {/* Escalate Button */}
      {canEscalate && status !== 'Closed' && status !== 'Resolved' && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEscalateOpen(true)}
          className="border-warning/30 text-warning hover:bg-warning/10"
        >
          <ArrowUpRight className="h-4 w-4 mr-1" />
          Escalate
        </Button>
      )}

      {/* Escalation Dialog */}
      <Dialog open={escalateOpen} onOpenChange={setEscalateOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Escalate {incidentNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Escalate To</Label>
              <Select value={escalateTo} onValueChange={setEscalateTo}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tier2">SOC Tier 2 — Senior Analyst</SelectItem>
                  <SelectItem value="tier3">SOC Tier 3 — Incident Commander</SelectItem>
                  <SelectItem value="manager">SOC Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                placeholder="Why is this incident being escalated?"
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                className="bg-secondary/50"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalateOpen(false)}>Cancel</Button>
            <Button onClick={handleEscalate} disabled={escalating} className="bg-warning text-warning-foreground">
              {escalating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowUpRight className="h-4 w-4 mr-2" />}
              Escalate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
