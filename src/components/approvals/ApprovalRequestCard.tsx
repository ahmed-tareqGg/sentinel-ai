import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  Shield,
  Server,
  Ban,
  Users,
  Loader2,
  Zap,
  Eye,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';

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

interface ApprovalRequestCardProps {
  request: ApprovalRequest;
  onApprove: (request: ApprovalRequest, approved: boolean) => void;
  onViewDetails: (request: ApprovalRequest) => void;
  processing: string | null;
}

const ACTION_ICONS: Record<string, typeof Shield> = {
  isolate_host: Server,
  block_ip: Ban,
  disable_user: Users,
  kill_process: Zap,
};

export function ApprovalRequestCard({ request, onApprove, onViewDetails, processing }: ApprovalRequestCardProps) {
  const ActionIcon = ACTION_ICONS[request.action_type] || Shield;
  const isOverdue = request.sla_deadline && new Date(request.sla_deadline) < new Date();
  const target = (request.action_params as any)?.target || '';
  const riskLevel = (request.action_params as any)?.risk_level || '';
  const aiConfidence = (request.action_params as any)?.ai_confidence;
  const isProcessing = processing === request.id;

  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-all hover:shadow-md cursor-pointer',
        isOverdue ? 'border-destructive bg-destructive/5' : 'border-yellow-500/30 bg-yellow-500/5'
      )}
      onClick={() => onViewDetails(request)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={cn(
            'p-2.5 rounded-lg shrink-0',
            isOverdue ? 'bg-destructive/20 text-destructive' : 'bg-yellow-500/20 text-yellow-500'
          )}>
            <ActionIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-foreground">
                {request.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </p>
              {isOverdue && <Badge variant="destructive" className="text-[10px]">SLA Breached</Badge>}
              {request.escalation_count > 0 && (
                <Badge className="bg-orange-500/20 text-orange-500 text-[10px]">
                  Escalated x{request.escalation_count}
                </Badge>
              )}
              {riskLevel && (
                <Badge variant="outline" className="text-[10px]">
                  {riskLevel.toUpperCase()}
                </Badge>
              )}
              {aiConfidence && (
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                  AI: {aiConfidence}%
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>Incident: {request.incident_id.slice(0, 8)}...</span>
              {target && <span>Target: {target}</span>}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(request.requested_at))} ago
              </span>
              <span>by {request.requested_by || 'System'}</span>
              {request.sla_deadline && (
                <span className={cn(isOverdue && 'text-destructive font-medium')}>
                  SLA: {format(new Date(request.sla_deadline), 'HH:mm')}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewDetails(request)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => onApprove(request, false)}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          </Button>
          <Button
            size="sm"
            className="bg-green-500 hover:bg-green-600 text-white"
            onClick={() => onApprove(request, true)}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
