import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Shield,
  Server,
  Ban,
  Users,
  Loader2,
  AlertTriangle,
  Clock,
  Brain,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

interface ApprovalRequest {
  id: string;
  incident_id: string;
  playbook_id: string | null;
  action_type: string;
  action_params: any;
  status: string;
  requested_at: string;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  sla_deadline: string | null;
  escalated_to: string | null;
  escalation_count: number;
  reason: string | null;
}

interface ApprovalDetailDrawerProps {
  request: ApprovalRequest | null;
  open: boolean;
  onClose: () => void;
  onApprove: (request: ApprovalRequest, approved: boolean, reason: string) => Promise<void>;
  onEscalate: (request: ApprovalRequest, escalateTo: string) => Promise<void>;
  processing: boolean;
}

const ACTION_ICONS: Record<string, typeof Shield> = {
  isolate_host: Server,
  block_ip: Ban,
  disable_user: Users,
  kill_process: Zap,
};

const RISK_COLORS: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  low: 'bg-green-500/10 text-green-500 border-green-500/30',
};

export function ApprovalDetailDrawer({
  request,
  open,
  onClose,
  onApprove,
  onEscalate,
  processing,
}: ApprovalDetailDrawerProps) {
  const [reason, setReason] = useState('');
  const [escalateTo, setEscalateTo] = useState('ciso');

  if (!request) return null;

  const ActionIcon = ACTION_ICONS[request.action_type] || Shield;
  const isOverdue = request.sla_deadline && new Date(request.sla_deadline) < new Date();
  const riskLevel = (request.action_params as any)?.risk_level || 'high';
  const target = (request.action_params as any)?.target || 'N/A';
  const aiConfidence = (request.action_params as any)?.ai_confidence;
  const aiRecommendation = (request.action_params as any)?.ai_recommendation;
  const blastRadius = (request.action_params as any)?.blast_radius;

  const handleApprove = async () => {
    await onApprove(request, true, reason);
    setReason('');
  };

  const handleReject = async () => {
    await onApprove(request, false, reason);
    setReason('');
  };

  const handleEscalate = async () => {
    await onEscalate(request, escalateTo);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card border-border">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              isOverdue ? 'bg-destructive/20 text-destructive' : 'bg-yellow-500/20 text-yellow-500'
            )}>
              <ActionIcon className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-foreground">
                {request.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                {request.id.slice(0, 8)}
              </span>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          {/* Status + SLA */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn(
              isOverdue ? 'border-destructive/30 text-destructive' : 'border-yellow-500/30 text-yellow-500'
            )}>
              {isOverdue ? 'SLA Breached' : 'Pending'}
            </Badge>
            <Badge variant="outline" className={cn(RISK_COLORS[riskLevel])}>
              Risk: {riskLevel.toUpperCase()}
            </Badge>
            {request.escalation_count > 0 && (
              <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">
                Escalated x{request.escalation_count}
              </Badge>
            )}
          </div>

          {/* Context */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Context</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Incident</p>
                <p className="font-mono text-foreground">{request.incident_id.slice(0, 8)}...</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Target</p>
                <p className="font-mono text-foreground">{target}</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Requested By</p>
                <p className="text-foreground">{request.requested_by || 'System'}</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Time Waiting</p>
                <p className="text-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(request.requested_at))}
                </p>
              </div>
            </div>
            {request.sla_deadline && (
              <div className={cn(
                'rounded-lg p-3 text-sm',
                isOverdue ? 'bg-destructive/10 border border-destructive/30' : 'bg-secondary/30'
              )}>
                <p className="text-xs text-muted-foreground">SLA Deadline</p>
                <p className={cn('font-medium', isOverdue ? 'text-destructive' : 'text-foreground')}>
                  {format(new Date(request.sla_deadline), 'MMM dd, HH:mm')}
                  {isOverdue && ' — BREACHED'}
                </p>
              </div>
            )}
          </div>

          {/* AI Recommendation */}
          {(aiConfidence || aiRecommendation) && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                AI Assessment
              </h4>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                {aiRecommendation && (
                  <div className="flex items-center gap-2">
                    <Badge className={cn(
                      aiRecommendation === 'APPROVE'
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-destructive/20 text-destructive'
                    )}>
                      AI Recommends: {aiRecommendation}
                    </Badge>
                    {aiConfidence && (
                      <span className="text-sm text-muted-foreground">({aiConfidence}%)</span>
                    )}
                  </div>
                )}
                {blastRadius && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Blast Radius:</span> {blastRadius}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Impact Warning */}
          <div className="bg-warning/5 border border-warning/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Impact Warning</p>
                <p className="text-muted-foreground mt-1">
                  Approving this action will execute <strong>{request.action_type.replace(/_/g, ' ')}</strong> on the target.
                  This action will be logged in the compliance audit trail.
                </p>
              </div>
            </div>
          </div>

          {/* Reason */}
          {request.status === 'pending' && (
            <div className="space-y-2">
              <Label>Decision Reason</Label>
              <Textarea
                placeholder="Provide reasoning for your decision..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="bg-secondary/50"
                rows={3}
              />
            </div>
          )}

          {/* Action Buttons */}
          {request.status === 'pending' && (
            <div className="space-y-3 pt-2">
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  onClick={handleApprove}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Approve & Execute
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={handleReject}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Reject
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Select value={escalateTo} onValueChange={setEscalateTo}>
                  <SelectTrigger className="bg-secondary/50 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soc_manager">SOC Manager</SelectItem>
                    <SelectItem value="ciso">CISO</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="border-warning/30 text-warning hover:bg-warning/10"
                  onClick={handleEscalate}
                  disabled={processing}
                >
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                  Escalate
                </Button>
              </div>
            </div>
          )}

          {/* Processed Status */}
          {request.status !== 'pending' && (
            <div className={cn(
              'rounded-lg p-4 border text-sm',
              request.status === 'approved'
                ? 'bg-green-500/5 border-green-500/30'
                : 'bg-destructive/5 border-destructive/30'
            )}>
              <p className="font-medium text-foreground">
                {request.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
              </p>
              {request.approved_at && (
                <p className="text-muted-foreground mt-1">
                  {format(new Date(request.approved_at), 'MMM dd, HH:mm')} by {request.approved_by || 'System'}
                </p>
              )}
              {request.reason && (
                <p className="text-muted-foreground mt-1 italic">"{request.reason}"</p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
