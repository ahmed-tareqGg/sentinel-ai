import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  CheckCircle2, 
  Loader2,
  Shield,
} from 'lucide-react';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { logUserAction, AUDIT_ACTIONS } from '@/lib/auditLogger';
import { ApprovalMetrics } from '@/components/approvals/ApprovalMetrics';
import { ApprovalRequestCard } from '@/components/approvals/ApprovalRequestCard';
import { ApprovalDetailDrawer } from '@/components/approvals/ApprovalDetailDrawer';

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

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  approved: 'bg-green-500/10 text-green-500 border-green-500/30',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
  expired: 'bg-muted text-muted-foreground border-border',
  auto_approved: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
};

const ACTION_ICONS: Record<string, typeof Shield> = {};

export default function Approvals() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('approval_requests')
        .select('*')
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching approval requests:', error);
      toast.error('Failed to load approval requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (request: ApprovalRequest, approved: boolean, reason?: string) => {
    setProcessing(request.id);
    try {
      // Step 1: Update approval status
      const { error } = await supabase
        .from('approval_requests')
        .update({
          status: approved ? 'approved' : 'rejected',
          approved_at: new Date().toISOString(),
          approved_by: 'current_user',
          reason: reason || (approved ? 'Approved by analyst' : 'Rejected by analyst'),
        })
        .eq('id', request.id);

      if (error) throw error;

      // Step 2: If approved, execute the action
      if (approved) {
        try {
          await supabase.functions.invoke('execute-playbook', {
            body: {
              incident_id: request.incident_id,
              specific_action: {
                type: request.action_type,
                params: request.action_params,
              },
              approval_id: request.id,
            },
          });

          // Log execution in timeline
          await supabase.from('incident_timeline').insert({
            incident_id: request.incident_id,
            stage: `Action Executed: ${request.action_type.replace(/_/g, ' ')}`,
            details: `Approved and executed. Approval ID: ${request.id.slice(0, 8)}`,
          });
        } catch (execErr) {
          console.error('Execution after approval failed:', execErr);
          toast.error('Approved but execution failed. Check logs.');
        }
      }

      // Step 3: Audit trail
      await logUserAction(
        approved ? 'approval_granted' : 'approval_rejected',
        'approval_request',
        request.id,
        'success',
        {
          action_type: request.action_type,
          incident_id: request.incident_id,
        }
      );

      toast.success(`Action ${approved ? 'approved & executed' : 'rejected'}`);
      setDrawerOpen(false);
      fetchRequests();
    } catch (error) {
      console.error('Error processing approval:', error);
      toast.error('Failed to process approval');
    } finally {
      setProcessing(null);
    }
  };

  const handleEscalate = async (request: ApprovalRequest, escalateTo: string) => {
    setProcessing(request.id);
    try {
      const { error } = await supabase
        .from('approval_requests')
        .update({
          escalated_to: escalateTo,
          escalation_count: (request.escalation_count || 0) + 1,
        })
        .eq('id', request.id);

      if (error) throw error;

      await logUserAction(
        'approval_escalated',
        'approval_request',
        request.id,
        'success',
        { escalated_to: escalateTo, action_type: request.action_type }
      );

      toast.success(`Escalated to ${escalateTo.replace(/_/g, ' ').toUpperCase()}`);
      setDrawerOpen(false);
      fetchRequests();
    } catch (error) {
      console.error('Error escalating:', error);
      toast.error('Failed to escalate');
    } finally {
      setProcessing(null);
    }
  };

  const handleQuickApproval = (request: ApprovalRequest, approved: boolean) => {
    handleApproval(request, approved);
  };

  const openDetails = (request: ApprovalRequest) => {
    setSelectedRequest(request);
    setDrawerOpen(true);
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <AppLayout title="Approval Workflow" subtitle="Human-in-the-loop control for high-risk actions">
      <div className="space-y-6">
        {/* Metrics */}
        <ApprovalMetrics requests={requests} />

        {/* Pending Approvals */}
        <Card className={pendingRequests.length > 0 ? 'border-yellow-500/50' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              Pending Approvals
              {pendingRequests.length > 0 && (
                <Badge className="bg-yellow-500/20 text-yellow-500">
                  {pendingRequests.length} waiting
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              High-risk actions requiring analyst approval before execution
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                <p className="text-lg font-medium">No pending approvals</p>
                <p className="text-sm text-muted-foreground">All high-risk actions have been processed</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <ApprovalRequestCard
                    key={request.id}
                    request={request}
                    onApprove={handleQuickApproval}
                    onViewDetails={openDetails}
                    processing={processing}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle>Approval History</CardTitle>
            <CardDescription>Previously processed approval requests</CardDescription>
          </CardHeader>
          <CardContent>
            {processedRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No processed approvals yet</p>
            ) : (
              <div className="space-y-2">
                {processedRequests.slice(0, 30).map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors"
                    onClick={() => openDetails(request)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {request.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {request.approved_at && format(new Date(request.approved_at), 'MMM dd, HH:mm')}
                          {request.approved_by && ` by ${request.approved_by}`}
                        </p>
                      </div>
                    </div>
                    <Badge className={cn('text-xs shrink-0', STATUS_COLORS[request.status])}>
                      {request.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Drawer */}
        <ApprovalDetailDrawer
          request={selectedRequest}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onApprove={handleApproval}
          onEscalate={handleEscalate}
          processing={!!processing}
        />
      </div>
    </AppLayout>
  );
}
