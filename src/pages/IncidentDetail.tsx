import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Shield, AlertTriangle, CheckCircle, XCircle, ExternalLink, Play, Filter, Download, Loader2, FileText, Ticket } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { soarActions } from '@/lib/soarActions';

interface Incident {
  id: string;
  incident_number: string;
  timestamp: string;
  src_ip: string | null;
  dst_ip: string | null;
  severity: number;
  event_type: string;
  classification: string;
  confidence: number;
  status: string;
  risk_level: string;
  message: string | null;
  file_hash: string | null;
  mitre_technique: string | null;
  mitre_tactic: string | null;
  assigned_to: string | null;
  raw_log: unknown;
  ai_analysis: unknown;
  sandbox_result: unknown;
  evidence: string[] | null;
  recommended_actions: string[] | null;
  created_at: string;
  updated_at: string;
}

interface TimelineEntry {
  id: string;
  stage: string;
  timestamp: string;
  details: string | null;
}

const severityColors: Record<number, string> = {
  1: 'bg-success/20 text-success border-success/30',
  2: 'bg-success/20 text-success border-success/30',
  3: 'bg-primary/20 text-primary border-primary/30',
  4: 'bg-warning/20 text-warning border-warning/30',
  5: 'bg-critical/20 text-critical border-critical/30',
};

const riskColors: Record<string, string> = {
  'Critical': 'bg-critical/20 text-critical border-critical/30',
  'High': 'bg-warning/20 text-warning border-warning/30',
  'Medium': 'bg-primary/20 text-primary border-primary/30',
  'Low': 'bg-success/20 text-success border-success/30',
};

export default function IncidentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canModifyIncidents } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [jiraTicketUrl, setJiraTicketUrl] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchIncident();
      fetchTimeline();
      checkForJiraTicket();
    }
  }, [id]);

  const checkForJiraTicket = async () => {
    // Check timeline for Jira ticket creation
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
      setIncident(data);
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
    setUpdating(true);
    
    const { error } = await supabase
      .from('incidents')
      .update({ status: newStatus })
      .eq('id', incident.id);

    if (error) {
      toast.error('Failed to update status');
    } else {
      setIncident(prev => prev ? { ...prev, status: newStatus } : null);
      toast.success(`Status updated to ${newStatus}`);
      
      await supabase.from('incident_timeline').insert({
        incident_id: incident.id,
        stage: `Status Changed to ${newStatus}`,
        details: 'Manual status update by analyst',
      });
      fetchTimeline();
    }
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

      // Retry once if the session/JWT is stale
      if (status === 401 || message.includes('jwt')) {
        const refreshed = await supabase.auth.refreshSession();
        if (!refreshed.data.session) {
          toast.error('جلسة الدخول انتهت. سجّل دخول مرة أخرى.');
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
          toast.error('جلسة الدخول انتهت. سجّل دخول مرة أخرى.');
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


  const handleRecommendedAction = async (action: string) => {
    if (!incident) return;
    setExecutingAction(action);
    
    const actionKey = action.toLowerCase().replace(/\s+/g, '');
    
    try {
      switch (actionKey) {
        case 'isolatehost':
          await soarActions.isolateHost(incident.id, incident.src_ip || 'Unknown');
          break;
        case 'blockip':
          await soarActions.blockIp(incident.id, incident.src_ip || 'Unknown');
          break;
        case 'resetcredentials':
        case 'forcepasswordreset':
          await soarActions.resetCredentials(incident.id);
          break;
        case 'forensicanalysis':
          await soarActions.forensicAnalysis(incident.id);
          break;
        case 'disableuseraccount':
          await soarActions.disableUser(incident.id);
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
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: {
          type: 'incident',
          incident_id: incident.id,
        },
      });
      
      if (error) throw error;
      
      // If PDF is returned, download it
      if (data?.pdf_base64) {
        const pdfBytes = Uint8Array.from(atob(data.pdf_base64), c => c.charCodeAt(0));
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Incident_Report_${incident.incident_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Report downloaded');
      } else {
        // Fallback: download as JSON
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Incident_Report_${incident.incident_number}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Report generated');
      }
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
        body: {
          incident_id: incident.id,
        },
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
    <AppLayout title={incident.incident_number} subtitle={incident.message || 'Security Incident'}>
      {/* Back button & Actions */}
      <div className="flex items-center justify-between mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/incidents')} 
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Incidents
        </Button>
        <div className="flex items-center gap-2">
          {/* Jira Ticket Button */}
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
          ) : (
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
          )}
          
          {/* Generate Report Button */}
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
          
          <Button variant="outline" size="sm" onClick={() => toast.info('Advanced filtering coming soon')}>
            <Filter className="h-4 w-4 mr-2" />
            Advanced Filter
          </Button>
          <Button variant="outline" size="sm" onClick={exportIncident}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Header Card */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground font-mono">{incident.incident_number}</h1>
              <Badge variant="outline" className={cn(riskColors[incident.risk_level])}>
                {incident.risk_level}
              </Badge>
              <Badge variant="outline" className={cn(severityColors[incident.severity])}>
                Severity {incident.severity}
              </Badge>
            </div>
            <p className="text-muted-foreground max-w-2xl">{incident.message}</p>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {new Date(incident.created_at).toLocaleString()}
              </span>
              <span className="font-mono">{incident.src_ip} → {incident.dst_ip}</span>
              {incident.mitre_technique && (
                <span className="text-primary">{incident.mitre_technique} - {incident.mitre_tactic}</span>
              )}
            </div>

            {/* Actions */}
            {canModifyIncidents && (
              <div className="flex items-center gap-3 pt-2">
                <Select value={incident.status} onValueChange={updateStatus} disabled={updating}>
                  <SelectTrigger className="w-40 bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    onClick={runAnalysis} 
                    disabled={updating}
                    className="border-primary/30 text-primary hover:bg-primary/10"
                  >
                    {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                    Run Analysis
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={executePlaybook} 
                    disabled={updating}
                    className="border-primary/30 text-primary hover:bg-primary/10"
                  >
                    {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                    Run Playbook
                  </Button>
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

      {/* Tabs */}
      <Tabs defaultValue="analysis" className="space-y-6">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="sandbox">Sandbox Results</TabsTrigger>
          <TabsTrigger value="raw">Raw Log</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-6">
          {/* Evidence */}
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

          {/* AI Analysis Details */}
          {incident.ai_analysis && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">AI Analysis Details</h3>
              <pre className="bg-secondary/50 p-4 rounded-lg overflow-x-auto text-sm font-mono text-muted-foreground">
                {JSON.stringify(incident.ai_analysis, null, 2)}
              </pre>
            </div>
          )}

          {/* Recommended Actions */}
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
            <h3 className="text-sm font-semibold text-foreground mb-4">Incident Timeline</h3>
            {timeline.length > 0 ? (
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-6">
                  {timeline.map((event) => (
                    <div key={event.id} className="flex items-start gap-4 relative">
                      <div className="relative z-10 h-6 w-6 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{event.stage}</p>
                        <p className="text-sm text-muted-foreground font-mono">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                        {event.details && (
                          <p className="text-sm text-muted-foreground mt-1">{event.details}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No timeline data available</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sandbox">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Sandbox Analysis</h3>
            {incident.sandbox_result ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Vendor:</span>
                  <Badge variant="outline">{(incident.sandbox_result as any).vendor}</Badge>
                </div>
                {(incident.sandbox_result as any).malicious !== undefined && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-critical/10 border border-critical/30 p-4">
                      <p className="text-xs text-muted-foreground mb-1">Malicious Detections</p>
                      <p className="text-2xl font-bold text-critical">{(incident.sandbox_result as any).malicious}</p>
                    </div>
                    <div className="rounded-lg bg-warning/10 border border-warning/30 p-4">
                      <p className="text-xs text-muted-foreground mb-1">Suspicious Detections</p>
                      <p className="text-2xl font-bold text-warning">{(incident.sandbox_result as any).suspicious}</p>
                    </div>
                  </div>
                )}
                {incident.file_hash && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">File Hash:</span>
                    <code className="text-sm font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                      {incident.file_hash}
                    </code>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`https://www.virustotal.com/gui/file/${incident.file_hash}`} target="_blank" rel="noopener">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No sandbox results available</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="raw">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Raw Log Data</h3>
            <pre className="bg-secondary/50 p-4 rounded-lg overflow-x-auto text-sm font-mono text-muted-foreground">
              {JSON.stringify(incident.raw_log || incident, null, 2)}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
