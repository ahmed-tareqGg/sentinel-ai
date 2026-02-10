import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, AlertTriangle, CheckCircle, XCircle, ExternalLink, Play, Filter, Download, Loader2, FileText, Ticket, Clock, CheckCheck } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { soarActions } from '@/lib/soarActions';
import jsPDF from 'jspdf';
import { normalizeIncidentContent, Incident as IIncident } from '@/lib/incidentContentUtils';
import { IncidentHeader } from '@/components/incidents/IncidentHeader';
import { IncidentDetails } from '@/components/incidents/IncidentDetails';
import { IncidentAssignment } from '@/components/incidents/IncidentAssignment';
import { AnalystNotes } from '@/components/incidents/AnalystNotes';
import { IncidentSLA } from '@/components/incidents/IncidentSLA';

interface TimelineEntry {
  id: string;
  stage: string;
  timestamp: string;
  details: string | null;
}

// Extend incident type for new fields
interface ExtendedIncident extends IIncident {
  incident_owner_id?: string | null;
  incident_owner_role?: string | null;
  assigned_at?: string | null;
  escalated_from?: string | null;
  escalated_to?: string | null;
  escalation_reason?: string | null;
  escalated_at?: string | null;
  closed_reason?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
}

export default function IncidentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, isDemoUser, canModifyData, profile } = useAuth();

  const canModifyIncidents = canModifyData && role && ['soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager', 'ciso', 'admin'].includes(role);
  const canCloseIncident = canModifyData && role && ['soc_tier_2', 'soc_tier_3', 'soc_manager', 'ciso', 'admin'].includes(role);
  const canRunPlaybook = canModifyData && role && ['soc_tier_2', 'soc_tier_3', 'soc_manager', 'ciso', 'admin'].includes(role);
  const canCreateTicket = canModifyData;

  const [incident, setIncident] = useState<ExtendedIncident | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [jiraTicketUrl, setJiraTicketUrl] = useState<string | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      fetchIncident();
      fetchTimeline();
      checkForJiraTicket();
      fetchPendingApprovals();
    }
  }, [id]);

  const fetchPendingApprovals = async () => {
    const { data } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('incident_id', id)
      .eq('status', 'pending');
    setPendingApprovals(data || []);
  };

  const checkForJiraTicket = async () => {
    const { data } = await supabase
      .from('incident_timeline')
      .select('details')
      .eq('incident_id', id)
      .ilike('stage', '%Jira%')
      .order('timestamp', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const match = data[0].details?.match(/Ticket (KAN-\d+)/);
      if (match) {
        setJiraTicketUrl(`https://socmind.atlassian.net/browse/${match[1]}`);
      }
    }
  };

  const fetchIncident = async () => {
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching incident:', error);
      toast.error('Failed to load incident');
    } else {
      const inc = data as ExtendedIncident;
      setIncident(inc);

      // Fetch owner email if assigned
      if (inc?.incident_owner_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', inc.incident_owner_id)
          .maybeSingle();
        if (profileData) setOwnerEmail(profileData.email);
      }
    }
    setLoading(false);
  };

  const fetchTimeline = async () => {
    const { data } = await supabase
      .from('incident_timeline')
      .select('*')
      .eq('incident_id', id)
      .order('timestamp', { ascending: true });

    if (data) setTimeline(data);
  };

  const updateStatus = async (newStatus: string) => {
    if (!incident) return;

    // Handle close/resolve with reason
    if (newStatus === 'Closed' || newStatus === 'Resolved') {
      setCloseDialogOpen(true);
      return;
    }

    setUpdating(true);

    const { data, error } = await supabase
      .from('incidents')
      .update({ status: newStatus })
      .eq('id', incident.id)
      .select('id,status')
      .maybeSingle();

    if (error || !data) {
      toast.error('Failed to update status');
      setUpdating(false);
      return;
    }

    setIncident((prev) => (prev ? { ...prev, status: data.status } : null));
    toast.success(`Status updated to ${data.status}`);

    await supabase.from('incident_timeline').insert({
      incident_id: incident.id,
      stage: `Status → ${data.status}`,
      details: `Changed by ${profile?.email || 'analyst'}`,
    });

    fetchTimeline();
    setUpdating(false);
  };

  const handleCloseResolve = async (targetStatus: 'Resolved' | 'Closed') => {
    if (!incident) return;
    setUpdating(true);

    const updates: Record<string, unknown> = {
      status: targetStatus,
      closed_reason: closeReason || undefined,
    };
    if (targetStatus === 'Resolved') updates.resolved_at = new Date().toISOString();
    if (targetStatus === 'Closed') updates.closed_at = new Date().toISOString();

    const { error } = await supabase
      .from('incidents')
      .update(updates)
      .eq('id', incident.id);

    if (error) {
      toast.error('Failed to update status');
      setUpdating(false);
      return;
    }

    await supabase.from('incident_timeline').insert({
      incident_id: incident.id,
      stage: `Status → ${targetStatus}`,
      details: closeReason ? `${closeReason} — by ${profile?.email}` : `${targetStatus} by ${profile?.email}`,
    });

    toast.success(`Incident ${targetStatus.toLowerCase()}`);
    setCloseDialogOpen(false);
    setCloseReason('');
    fetchIncident();
    fetchTimeline();
    setUpdating(false);
  };

  const executePlaybook = async () => {
    if (!incident) return;
    setUpdating(true);

    const invoke = async () => {
      const { data, error } = await supabase.functions.invoke('execute-playbook', {
        body: {
          incident_id: incident.id,
          risk_level: incident.risk_level,
          classification: incident.classification,
        },
      });
      if (error) throw error;
      return data;
    };

    try {
      const data = await invoke();
      toast.success(`Playbook executed: ${data.executed} actions`);
      fetchTimeline();
    } catch (error) {
      const status = (error as any)?.context?.status ?? (error as any)?.status;
      const message = String((error as any)?.message || '').toLowerCase();

      if (status === 401 || message.includes('jwt')) {
        const refreshed = await supabase.auth.refreshSession();
        if (!refreshed.data.session) {
          toast.error('Session expired. Please log in again.');
          navigate('/auth');
          return;
        }

        try {
          const data = await invoke();
          toast.success(`Playbook executed: ${data.executed} actions`);
          fetchTimeline();
          return;
        } catch (retryError) {
          console.error('Playbook retry error:', retryError);
        }
      }

      console.error('Playbook error:', error);
      toast.error('Failed to execute playbook');
    } finally {
      setUpdating(false);
    }
  };

  const runAnalysis = async () => {
    if (!incident) return;
    setUpdating(true);

    const invoke = async () => {
      const { data, error } = await supabase.functions.invoke('reanalyze-incident', {
        body: { incident_id: incident.id },
      });
      if (error) throw error;
      return data;
    };

    try {
      await invoke();
      await fetchIncident();
      await fetchTimeline();
      toast.success('Analysis completed');
    } catch (error) {
      const status = (error as any)?.context?.status ?? (error as any)?.status;
      const message = String((error as any)?.message || '').toLowerCase();

      if (status === 401 || message.includes('jwt')) {
        const refreshed = await supabase.auth.refreshSession();
        if (!refreshed.data.session) {
          toast.error('Session expired. Please log in again.');
          navigate('/auth');
          return;
        }

        try {
          await invoke();
          await fetchIncident();
          await fetchTimeline();
          toast.success('Analysis completed');
          return;
        } catch (retryError) {
          console.error('Run analysis retry error:', retryError);
        }
      }

      console.error('Run analysis error:', error);
      toast.error('Failed to run analysis');
    } finally {
      setUpdating(false);
    }
  };

  // High-risk actions that require approval
  const APPROVAL_REQUIRED_ACTIONS = ['blockip', 'isolatehost', 'disableuseraccount', 'killprocess'];

  const handleRecommendedAction = async (action: string) => {
    if (!incident) return;
    const actionKey = action.toLowerCase().replace(/\s+/g, '');

    // Check if this action requires approval
    if (APPROVAL_REQUIRED_ACTIONS.includes(actionKey)) {
      setExecutingAction(action);
      try {
        const actionType = actionKey === 'blockip' ? 'block_ip'
          : actionKey === 'isolatehost' ? 'isolate_host'
          : actionKey === 'disableuseraccount' ? 'disable_user'
          : actionKey === 'killprocess' ? 'kill_process'
          : actionKey;

        const { error } = await supabase.from('approval_requests').insert({
          incident_id: incident.id,
          action_type: actionType,
          action_params: {
            target: incident.src_ip || 'Unknown',
            risk_level: incident.risk_level || 'high',
            ai_confidence: incident.confidence || null,
            ai_recommendation: incident.confidence && incident.confidence >= 80 ? 'APPROVE' : 'REVIEW',
            blast_radius: incident.severity >= 4 ? 'High — may affect multiple systems' : 'Low — isolated target',
          },
          status: 'pending',
          requested_by: profile?.email || 'analyst',
          sla_deadline: new Date(Date.now() + 30 * 60000).toISOString(),
        });

        if (error) throw error;

        await supabase.from('incident_timeline').insert({
          incident_id: incident.id,
          stage: `Approval Requested: ${action}`,
          details: `Action requires manager approval before execution`,
        });

        toast.info(`⏳ ${action} requires approval. Request sent to SOC Manager.`);
        fetchTimeline();
        fetchPendingApprovals();
      } catch (error) {
        console.error('Approval request failed:', error);
        toast.error('Failed to create approval request');
      } finally {
        setExecutingAction(null);
      }
      return;
    }

    // Non-approval actions execute directly
    setExecutingAction(action);
    try {
      switch (actionKey) {
        case 'resetcredentials':
        case 'forcepasswordreset':
          await soarActions.resetCredentials(incident.id);
          break;
        case 'forensicanalysis':
          await soarActions.forensicAnalysis(incident.id);
          break;
        case 'geo-blockip':
        case 'geoblockip':
          await soarActions.geoBlockIp(incident.id, incident.src_ip || 'Unknown');
          break;
        case 'investigatedatacontent':
          await soarActions.investigateData(incident.id);
          break;
        case 'interviewuser':
          await soarActions.interviewUser(incident.id);
          break;
        case 'networkforensics':
          await soarActions.networkForensics(incident.id);
          break;
        default:
          await soarActions.createTicket(incident.id, incident.incident_number);
      }
      fetchTimeline();
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setExecutingAction(null);
    }
  };

  const exportIncident = () => {
    if (!incident) return;

    const exportData = {
      ...incident,
      timeline,
      exported_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${incident.incident_number}_export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Incident exported successfully');
  };

  const generateReport = async () => {
    if (!incident) return;
    setGeneratingReport(true);

    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      let y = 20;

      pdf.setFontSize(20);
      pdf.setTextColor(0, 100, 200);
      pdf.text('SOCMind INCIDENT REPORT', pageWidth / 2, y, { align: 'center' });
      y += 15;

      pdf.setDrawColor(0, 100, 200);
      pdf.line(20, y, pageWidth - 20, y);
      y += 15;

      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Incident: ${incident.incident_number}`, 20, y);
      y += 10;

      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, y);
      y += 15;

      pdf.setFontSize(14);
      pdf.setTextColor(0, 100, 200);
      pdf.text('EXECUTIVE SUMMARY', 20, y);
      y += 10;

      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      const summaryItems = [
        `Event Type: ${incident.event_type}`,
        `Severity: ${incident.severity}/5`,
        `Risk Level: ${incident.risk_level}`,
        `Classification: ${incident.classification}`,
        `AI Confidence: ${incident.confidence}%`,
        `Status: ${incident.status}`,
        `Owner: ${ownerEmail || 'Unassigned'}`,
      ];
      summaryItems.forEach(item => {
        pdf.text(item, 25, y);
        y += 7;
      });
      y += 5;

      if (incident.message) {
        pdf.setFontSize(14);
        pdf.setTextColor(0, 100, 200);
        pdf.text('DESCRIPTION', 20, y);
        y += 10;
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        const lines = pdf.splitTextToSize(incident.message, pageWidth - 50);
        pdf.text(lines, 25, y);
        y += lines.length * 5 + 10;
      }

      pdf.save(`Incident_Report_${incident.incident_number}.pdf`);
      toast.success('PDF Report downloaded');
    } catch (error) {
      console.error('Report generation failed:', error);
      toast.error('Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const createJiraTicket = async () => {
    if (!incident) return;
    setCreatingTicket(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-jira-ticket', {
        body: { incident_id: incident.id },
      });

      if (error) throw error;

      if (data?.jira_url) {
        setJiraTicketUrl(data.jira_url);
        toast.success(`Jira ticket ${data.jira_key} created`);
        fetchTimeline();
      }
    } catch (error) {
      console.error('Jira ticket creation failed:', error);
      toast.error('Failed to create Jira ticket');
    } finally {
      setCreatingTicket(false);
    }
  };

  const { headerSummary, bodyDescription } = incident ? normalizeIncidentContent(incident) : { headerSummary: null, bodyDescription: null };

  // Status color map
  const statusColors: Record<string, string> = {
    'New': 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    'Open': 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    'Assigned': 'bg-purple-500/10 text-purple-500 border-purple-500/30',
    'In Progress': 'bg-primary/10 text-primary border-primary/30',
    'Escalated': 'bg-warning/10 text-warning border-warning/30',
    'Resolved': 'bg-success/10 text-success border-success/30',
    'Closed': 'bg-muted text-muted-foreground border-border',
  };

  if (loading) {
    return (
      <AppLayout title="Loading...">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!incident) {
    return (
      <AppLayout title="Incident Not Found">
        <div className="flex flex-col items-center justify-center h-64">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Incident not found</p>
          <Button onClick={() => navigate('/incidents')} className="mt-4">
            Back to Incidents
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={incident.incident_number} subtitle={headerSummary || 'Security Incident'}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/incidents')}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Incidents
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {jiraTicketUrl ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(jiraTicketUrl, '_blank')}
              className="border-green-500/30 text-green-500 hover:bg-green-500/10"
            >
              <Ticket className="h-4 w-4 mr-2" />
              View Jira Ticket
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          ) : canCreateTicket ? (
            <Button
              variant="outline"
              size="sm"
              onClick={createJiraTicket}
              disabled={creatingTicket}
              className="border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
            >
              {creatingTicket ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Ticket className="h-4 w-4 mr-2" />
              )}
              Create Jira Ticket
            </Button>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            onClick={generateReport}
            disabled={generatingReport}
            className="border-purple-500/30 text-purple-500 hover:bg-purple-500/10"
          >
            {generatingReport ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Generate Report
          </Button>

          <Button variant="outline" size="sm" onClick={exportIncident}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 lg:p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <IncidentHeader incident={incident} summary={headerSummary} />

            {/* Status Badge + SLA */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Badge variant="outline" className={cn('text-xs', statusColors[incident.status] || '')}>
                {incident.status}
              </Badge>
              <IncidentSLA
                severity={incident.severity}
                createdAt={incident.created_at}
                status={incident.status}
                resolvedAt={incident.resolved_at}
              />
              {incident.escalated_to && (
                <Badge variant="outline" className="border-warning/30 text-warning bg-warning/5 text-xs">
                  Escalated → {incident.escalated_to}
                </Badge>
              )}
            </div>

            {/* Assignment */}
            <div className="mt-4">
              <IncidentAssignment
                incidentId={incident.id}
                incidentNumber={incident.incident_number}
                ownerId={incident.incident_owner_id || null}
                ownerRole={incident.incident_owner_role || null}
                ownerEmail={ownerEmail}
                assignedAt={incident.assigned_at || null}
                status={incident.status}
                onUpdate={() => { fetchIncident(); fetchTimeline(); }}
              />
            </div>

            {/* Actions */}
            {canModifyIncidents && (
              <div className="flex flex-wrap items-center gap-3 pt-4">
                <Select value={incident.status} onValueChange={updateStatus} disabled={updating}>
                  <SelectTrigger className="w-44 bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="Assigned">Assigned</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Escalated">Escalated</SelectItem>
                    {canCloseIncident && <SelectItem value="Resolved">Resolved</SelectItem>}
                    {canCloseIncident && <SelectItem value="Closed">Closed</SelectItem>}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={runAnalysis}
                    disabled={updating}
                    className="border-primary/30 text-primary hover:bg-primary/10"
                  >
                    {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                    <span className="hidden sm:inline">Run Analysis</span>
                    <span className="sm:hidden">Analyze</span>
                  </Button>
                  {canRunPlaybook && (
                    <Button
                      variant="outline"
                      onClick={executePlaybook}
                      disabled={updating}
                      className="border-primary/30 text-primary hover:bg-primary/10"
                    >
                      {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                      <span className="hidden sm:inline">Run Playbook</span>
                      <span className="sm:hidden">Playbook</span>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* AI Classification */}
          <div className={cn(
            'rounded-xl p-4 border min-w-[200px]',
            incident.classification === 'True Positive' ? 'bg-critical/5 border-critical/30' :
              incident.classification === 'False Positive' ? 'bg-success/5 border-success/30' :
                'bg-muted border-border'
          )}>
            <p className="text-xs font-medium text-muted-foreground mb-2">AI Classification</p>
            <div className="flex items-center gap-2">
              {incident.classification === 'True Positive' ? (
                <XCircle className="h-5 w-5 text-critical" />
              ) : incident.classification === 'False Positive' ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : (
                <Clock className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="font-semibold text-foreground">{incident.classification}</span>
            </div>
            {incident.confidence > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Confidence</span>
                  <span className="font-mono text-foreground">{incident.confidence}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      incident.confidence >= 80 ? 'bg-success' :
                        incident.confidence >= 50 ? 'bg-warning' : 'bg-destructive'
                    )}
                    style={{ width: `${incident.confidence}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <IncidentDetails description={bodyDescription} />
      </div>

      <Tabs defaultValue="analysis" className="space-y-6">
        <TabsList className="bg-secondary/50 flex-wrap">
          <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
          <TabsTrigger value="raw">Raw Log</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-6">
          {incident.evidence && incident.evidence.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Evidence Analysis
              </h3>
              <ul className="space-y-2">
                {incident.evidence.map((e, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {incident.ai_analysis && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">AI Analysis Details</h3>
              <pre className="bg-secondary/50 p-4 rounded-lg overflow-x-auto text-sm font-mono text-muted-foreground">
                {JSON.stringify(incident.ai_analysis, null, 2)}
              </pre>
            </div>
          )}

          {incident.recommended_actions && incident.recommended_actions.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Recommended Actions</h3>
              <div className="flex flex-wrap gap-2">
                {incident.recommended_actions.map((action, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="border-primary/30 text-primary hover:bg-primary/10"
                    disabled={executingAction === action}
                    onClick={() => handleRecommendedAction(action)}
                  >
                    {executingAction === action ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    {action}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="timeline">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Incident Timeline
              <Badge variant="secondary" className="ml-2">{timeline.length}</Badge>
            </h3>
            {timeline.length > 0 ? (
              <div className="relative border-l border-border ml-2 space-y-6">
                {timeline.map((entry) => {
                  const isEscalation = entry.stage.toLowerCase().includes('escalat');
                  const isAssignment = entry.stage.toLowerCase().includes('assign');
                  const isResolution = entry.stage.toLowerCase().includes('resolv') || entry.stage.toLowerCase().includes('close');

                  return (
                    <div key={entry.id} className="ml-4 relative">
                      <div className={cn(
                        'absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background',
                        isEscalation ? 'bg-warning' :
                        isAssignment ? 'bg-purple-500' :
                        isResolution ? 'bg-success' :
                        'bg-primary'
                      )} />
                      <div className="text-xs text-muted-foreground mb-1">
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                      <div className="text-sm font-medium text-foreground">{entry.stage}</div>
                      {entry.details && (
                        <div className="text-xs text-muted-foreground mt-1 bg-secondary/30 p-2 rounded">
                          {entry.details}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No timeline events yet</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notes">
          <AnalystNotes incidentId={incident.id} />
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          {/* Pending Approvals for this Incident */}
          {pendingApprovals.length > 0 && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                Pending Approvals
                <Badge className="bg-yellow-500/20 text-yellow-500 text-[10px]">
                  {pendingApprovals.length}
                </Badge>
              </h3>
              <div className="space-y-2">
                {pendingApprovals.map((apr: any) => (
                  <div key={apr.id} className="flex items-center justify-between p-3 rounded-lg border border-yellow-500/20 bg-card">
                    <div className="text-sm">
                      <span className="font-medium text-foreground">
                        {apr.action_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ⏳ Waiting for approval
                      </span>
                    </div>
                    <Badge variant="outline" className="border-yellow-500/30 text-yellow-500 text-[10px]">
                      Pending
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Containment Actions
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'blockip', label: '🚫 Block IP', icon: 'Block IP', needsApproval: true },
                { key: 'isolatehost', label: '🔒 Isolate Host', icon: 'Isolate Host', needsApproval: true },
                { key: 'disableuseraccount', label: '🛑 Disable User', icon: 'Disable User Account', needsApproval: true },
                { key: 'resetcredentials', label: '🔑 Reset Credentials', icon: 'Reset Credentials', needsApproval: false },
                { key: 'forensicanalysis', label: '🔬 Forensic Analysis', icon: 'Forensic Analysis', needsApproval: false },
                { key: 'networkforensics', label: '📡 Network Forensics', icon: 'Network Forensics', needsApproval: false },
                { key: 'geoblockip', label: '🌍 Geo-Block IP', icon: 'Geo-Block IP', needsApproval: false },
                { key: 'createticket', label: '📤 Create Ticket', icon: 'Create Ticket', needsApproval: false },
              ].map((action) => (
                <div key={action.key} className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canModifyData || executingAction === action.icon}
                    onClick={() => handleRecommendedAction(action.icon)}
                    className={cn("justify-start w-full", action.needsApproval && "border-warning/20")}
                  >
                    {executingAction === action.icon ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    {action.label}
                  </Button>
                  {action.needsApproval && (
                    <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-warning text-warning-foreground rounded px-1 font-medium">
                      APPROVAL
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sandbox">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Sandbox Execution Results</h3>
            {incident.sandbox_result ? (
              <pre className="bg-secondary/50 p-4 rounded-lg overflow-x-auto text-sm font-mono text-muted-foreground">
                {JSON.stringify(incident.sandbox_result, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground text-sm">No sandbox execution data available.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="raw">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Raw Log Data</h3>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono text-foreground whitespace-pre-wrap">
              {JSON.stringify(incident.raw_log, null, 2)}
            </pre>
          </div>
        </TabsContent>
      </Tabs>

      {/* Close/Resolve Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Close / Resolve {incident.incident_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="Why is this incident being closed/resolved?"
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                className="bg-secondary/50"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => handleCloseResolve('Resolved')} disabled={updating} className="bg-success text-success-foreground">
              {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCheck className="h-4 w-4 mr-2" />}
              Resolve
            </Button>
            <Button onClick={() => handleCloseResolve('Closed')} disabled={updating} variant="secondary">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
