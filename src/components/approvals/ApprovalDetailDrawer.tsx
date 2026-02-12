import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ExternalLink,
  FileText,
  Search,
  MessageSquare,
  Paperclip,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/backend/client';

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
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const [escalateTo, setEscalateTo] = useState('ciso');
  const [incident, setIncident] = useState<any>(null);
  const [analystNotes, setAnalystNotes] = useState<any[]>([]);
  const [iocs, setIocs] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);

  // Fetch incident context when drawer opens
  useEffect(() => {
    if (open && request?.incident_id) {
      fetchIncidentContext(request.incident_id);
    }
  }, [open, request?.incident_id]);

  const fetchIncidentContext = async (incidentId: string) => {
    setLoadingContext(true);
    try {
      const [incidentRes, notesRes, iocsRes, evidenceRes, timelineRes] = await Promise.all([
        supabase.from('incidents').select('*').eq('id', incidentId).single(),
        supabase.from('analyst_notes').select('*').eq('incident_id', incidentId).order('created_at', { ascending: false }).limit(10),
        supabase.from('incident_iocs').select('*').eq('incident_id', incidentId).order('created_at', { ascending: false }).limit(20),
        supabase.from('incident_evidence').select('*').eq('incident_id', incidentId).order('created_at', { ascending: false }).limit(10),
        supabase.from('incident_timeline').select('*').eq('incident_id', incidentId).order('timestamp', { ascending: false }).limit(15),
      ]);

      setIncident(incidentRes.data);
      setAnalystNotes(notesRes.data || []);
      setIocs(iocsRes.data || []);
      setEvidence(evidenceRes.data || []);
      setTimeline(timelineRes.data || []);
    } catch (e) {
      console.error('Failed to fetch incident context:', e);
    } finally {
      setLoadingContext(false);
    }
  };

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

  const goToIncident = () => {
    onClose();
    navigate(`/incidents/${request.incident_id}`);
  };

  const severityLabel = (sev: number) => {
    if (sev >= 5) return { label: 'Critical', color: 'text-destructive' };
    if (sev >= 4) return { label: 'High', color: 'text-orange-500' };
    if (sev >= 3) return { label: 'Medium', color: 'text-yellow-500' };
    return { label: 'Low', color: 'text-green-500' };
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden bg-card border-border p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
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
            </div>
            {incident && (
              <Button variant="outline" size="sm" onClick={goToIncident} className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                {incident.incident_number}
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-5">
            {/* Status + SLA */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn(
                isOverdue ? 'border-destructive/30 text-destructive' : 'border-yellow-500/30 text-yellow-500'
              )}>
                {isOverdue ? 'SLA Breached' : request.status === 'pending' ? 'Pending' : request.status}
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

            {/* Incident Summary Card */}
            {incident && (
              <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Incident Overview
                  </h4>
                  <Badge className={cn('text-xs', severityLabel(incident.severity).color)}>
                    {severityLabel(incident.severity).label} (Sev {incident.severity})
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-background/50 rounded p-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Event Type</p>
                    <p className="font-medium text-foreground truncate">{incident.event_type}</p>
                  </div>
                  <div className="bg-background/50 rounded p-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Classification</p>
                    <p className="font-medium text-foreground">{incident.classification || 'Pending'}</p>
                  </div>
                  <div className="bg-background/50 rounded p-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Source IP</p>
                    <p className="font-mono text-foreground text-xs">{incident.src_ip || 'N/A'}</p>
                  </div>
                  <div className="bg-background/50 rounded p-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Destination IP</p>
                    <p className="font-mono text-foreground text-xs">{incident.dst_ip || 'N/A'}</p>
                  </div>
                  {incident.mitre_technique && (
                    <div className="bg-background/50 rounded p-2 col-span-2">
                      <p className="text-[10px] text-muted-foreground uppercase">MITRE ATT&CK</p>
                      <p className="font-medium text-foreground">{incident.mitre_technique} — {incident.mitre_tactic}</p>
                    </div>
                  )}
                </div>
                {incident.message && (
                  <p className="text-xs text-muted-foreground bg-background/50 rounded p-2 line-clamp-3">{incident.message}</p>
                )}
              </div>
            )}

            {/* Tabbed Investigation Context */}
            {!loadingContext && (analystNotes.length > 0 || iocs.length > 0 || evidence.length > 0 || timeline.length > 0) && (
              <Tabs defaultValue="notes" className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-8">
                  <TabsTrigger value="notes" className="text-xs gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Notes ({analystNotes.length})
                  </TabsTrigger>
                  <TabsTrigger value="iocs" className="text-xs gap-1">
                    <Target className="h-3 w-3" />
                    IOCs ({iocs.length})
                  </TabsTrigger>
                  <TabsTrigger value="evidence" className="text-xs gap-1">
                    <Paperclip className="h-3 w-3" />
                    Evidence ({evidence.length})
                  </TabsTrigger>
                  <TabsTrigger value="timeline" className="text-xs gap-1">
                    <Clock className="h-3 w-3" />
                    Timeline
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="notes" className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {analystNotes.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No analyst notes</p>
                  ) : analystNotes.map((note) => (
                    <div key={note.id} className="rounded border border-border bg-secondary/30 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground">{note.author_email || 'Analyst'}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(note.created_at), 'MMM dd, HH:mm')}
                        </span>
                      </div>
                      {note.note_type && (
                        <Badge variant="outline" className="text-[10px] mb-1">{note.note_type}</Badge>
                      )}
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="iocs" className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
                  {iocs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No IOCs recorded</p>
                  ) : iocs.map((ioc) => (
                    <div key={ioc.id} className="flex items-center justify-between rounded border border-border bg-secondary/30 p-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] shrink-0">{ioc.ioc_type}</Badge>
                          <span className="text-xs font-mono text-foreground truncate">{ioc.value}</span>
                        </div>
                        {ioc.notes && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{ioc.notes}</p>}
                      </div>
                      {ioc.confidence && (
                        <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                          {ioc.confidence}
                        </Badge>
                      )}
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="evidence" className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
                  {evidence.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No evidence attached</p>
                  ) : evidence.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-2 rounded border border-border bg-secondary/30 p-2.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{ev.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {ev.evidence_type} • {ev.added_by_email || 'System'} • {format(new Date(ev.created_at), 'MMM dd, HH:mm')}
                        </p>
                      </div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="timeline" className="mt-3 max-h-48 overflow-y-auto">
                  <div className="space-y-1">
                    {timeline.map((entry) => (
                      <div key={entry.id} className="flex gap-2 text-xs py-1.5 border-b border-border/50 last:border-0">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                          {format(new Date(entry.timestamp), 'HH:mm')}
                        </span>
                        <div className="min-w-0">
                          <span className="font-medium text-foreground">{entry.stage}</span>
                          {entry.details && (
                            <p className="text-muted-foreground truncate">{entry.details}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            )}

            {loadingContext && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground ml-2">Loading investigation data...</span>
              </div>
            )}

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

            {/* Recommended Actions from incident */}
            {incident?.recommended_actions?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Recommended Actions</h4>
                <ul className="space-y-1">
                  {incident.recommended_actions.map((action: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                      {action}
                    </li>
                  ))}
                </ul>
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
                request.status === 'approved' || request.status === 'auto_approved'
                  ? 'bg-green-500/5 border-green-500/30'
                  : 'bg-destructive/5 border-destructive/30'
              )}>
                <p className="font-medium text-foreground">
                  {request.status === 'approved' || request.status === 'auto_approved' ? '✅ Approved' : '❌ Rejected'}
                  {request.status === 'auto_approved' && ' (Autonomous)'}
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
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}