import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Shield, AlertTriangle, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { mockIncidents } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const incident = mockIncidents.find(i => i.id === id);

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
    <AppLayout title={incident.id} subtitle={incident.message}>
      {/* Back button */}
      <Button 
        variant="ghost" 
        onClick={() => navigate('/incidents')} 
        className="mb-6 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Incidents
      </Button>

      {/* Header Card */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground font-mono">{incident.id}</h1>
              <Badge variant="outline" className={cn(riskColors[incident.riskLevel])}>
                {incident.riskLevel}
              </Badge>
              <Badge variant="outline" className={cn(severityColors[incident.severity])}>
                Severity {incident.severity}
              </Badge>
            </div>
            <p className="text-muted-foreground max-w-2xl">{incident.message}</p>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {new Date(incident.timestamp).toLocaleString()}
              </span>
              <span className="font-mono">{incident.srcIP} → {incident.dstIP}</span>
              {incident.mitreTechnique && (
                <span className="text-primary">{incident.mitreTechnique} - {incident.mitreTactic}</span>
              )}
            </div>
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
          {incident.evidence && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Evidence (Explainable AI)
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

          {/* Recommended Actions */}
          {incident.recommendedActions && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Recommended Actions</h3>
              <div className="flex flex-wrap gap-2">
                {incident.recommendedActions.map((action, idx) => (
                  <Button key={idx} variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10">
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
            {incident.timeline ? (
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-6">
                  {incident.timeline.map((event, idx) => (
                    <div key={idx} className="flex items-start gap-4 relative">
                      <div className="relative z-10 h-6 w-6 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{event.stage}</p>
                        <p className="text-sm text-muted-foreground font-mono">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
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
            {incident.sandboxResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Vendor:</span>
                  <Badge variant="outline">{incident.sandboxResult.vendor}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-critical/10 border border-critical/30 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Malicious Detections</p>
                    <p className="text-2xl font-bold text-critical">{incident.sandboxResult.malicious}</p>
                  </div>
                  <div className="rounded-lg bg-warning/10 border border-warning/30 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Suspicious Detections</p>
                    <p className="text-2xl font-bold text-warning">{incident.sandboxResult.suspicious}</p>
                  </div>
                </div>
                {incident.fileHash && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">File Hash:</span>
                    <code className="text-sm font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                      {incident.fileHash}
                    </code>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
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
              {JSON.stringify(incident, null, 2)}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
