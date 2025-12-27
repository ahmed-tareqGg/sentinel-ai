import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Shield,
  Server,
  Ban,
  Users,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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

const ACTION_ICONS: Record<string, typeof Shield> = {
  isolate_host: Server,
  block_ip: Ban,
  disable_user: Users,
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  approved: 'bg-green-500/10 text-green-500 border-green-500/30',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
  expired: 'bg-muted text-muted-foreground border-border',
  auto_approved: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
};

export default function Approvals() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

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

  const handleApproval = async (request: ApprovalRequest, approved: boolean) => {
    setProcessing(request.id);
    try {
      const { error } = await supabase
        .from('approval_requests')
        .update({
          status: approved ? 'approved' : 'rejected',
          approved_at: new Date().toISOString(),
          approved_by: 'current_user', // In real app, get from auth
          reason: approved ? 'Approved by analyst' : 'Rejected by analyst',
        })
        .eq('id', request.id);

      if (error) throw error;

      // Log to compliance audit
      await supabase.from('compliance_audit_logs').insert({
        actor_type: 'user',
        action: approved ? 'approval_granted' : 'approval_rejected',
        resource_type: 'approval_request',
        resource_id: request.id,
        result: 'success',
        details: {
          action_type: request.action_type,
          incident_id: request.incident_id,
        },
      });

      toast.success(`Action ${approved ? 'approved' : 'rejected'}`);
      fetchRequests();
    } catch (error) {
      console.error('Error processing approval:', error);
      toast.error('Failed to process approval');
    } finally {
      setProcessing(null);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <AppLayout title="Approval Workflow" subtitle="Human-in-the-loop approval for high-risk actions">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-yellow-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{pendingRequests.length}</p>
                  <p className="text-xs text-muted-foreground">Pending Approval</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {requests.filter(r => r.status === 'approved').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">
                    {requests.filter(r => r.status === 'rejected').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {requests.filter(r => r.escalation_count > 0).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Escalated</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Approvals */}
        <Card className={pendingRequests.length > 0 ? "border-yellow-500/50" : ""}>
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
              <div className="space-y-4">
                {pendingRequests.map((request) => {
                  const ActionIcon = ACTION_ICONS[request.action_type] || Shield;
                  const isOverdue = request.sla_deadline && new Date(request.sla_deadline) < new Date();
                  
                  return (
                    <div
                      key={request.id}
                      className={cn(
                        "p-4 rounded-lg border",
                        isOverdue ? "border-destructive bg-destructive/5" : "border-yellow-500/30 bg-yellow-500/5"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "p-3 rounded-lg",
                            isOverdue ? "bg-destructive/20 text-destructive" : "bg-yellow-500/20 text-yellow-500"
                          )}>
                            <ActionIcon className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {request.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </p>
                              {isOverdue && (
                                <Badge variant="destructive">SLA Breached</Badge>
                              )}
                              {request.escalation_count > 0 && (
                                <Badge className="bg-orange-500/20 text-orange-500">
                                  Escalated x{request.escalation_count}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Incident: {request.incident_id.slice(0, 8)}...
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Requested {formatDistanceToNow(new Date(request.requested_at))} ago
                            </p>
                            {request.sla_deadline && (
                              <p className={cn(
                                "text-xs mt-1",
                                isOverdue ? "text-destructive" : "text-muted-foreground"
                              )}>
                                SLA Deadline: {format(new Date(request.sla_deadline), 'MMM dd, HH:mm')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => handleApproval(request, false)}
                            disabled={processing === request.id}
                          >
                            {processing === request.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-500 hover:bg-green-600"
                            onClick={() => handleApproval(request, true)}
                            disabled={processing === request.id}
                          >
                            {processing === request.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Processed Approvals */}
        <Card>
          <CardHeader>
            <CardTitle>Approval History</CardTitle>
            <CardDescription>Previously processed approval requests</CardDescription>
          </CardHeader>
          <CardContent>
            {processedRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No processed approvals yet</p>
            ) : (
              <div className="space-y-3">
                {processedRequests.slice(0, 20).map((request) => {
                  const ActionIcon = ACTION_ICONS[request.action_type] || Shield;
                  return (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30"
                    >
                      <div className="flex items-center gap-3">
                        <ActionIcon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">
                            {request.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {request.approved_at && format(new Date(request.approved_at), 'MMM dd, HH:mm')}
                            {request.approved_by && ` by ${request.approved_by}`}
                          </p>
                        </div>
                      </div>
                      <Badge className={cn("text-xs", STATUS_COLORS[request.status])}>
                        {request.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
