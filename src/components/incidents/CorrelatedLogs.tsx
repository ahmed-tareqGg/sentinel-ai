import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/backend/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Link2, Database, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface RawLog {
  id: string;
  log_type: string;
  severity: string | null;
  hostname: string | null;
  ip_address: string | null;
  parsed_message: string | null;
  processing_status: string | null;
  timestamp: string;
  mitre_technique: string | null;
  raw_payload: unknown;
}

interface RelatedIncident {
  id: string;
  incident_number: string;
  event_type: string;
  severity: number;
  risk_level: string;
  classification: string;
  status: string;
  created_at: string;
  message: string | null;
  src_ip: string | null;
}

interface CorrelatedLogsProps {
  incidentId: string;
  srcIp: string | null;
  eventType: string;
}

const severityColor: Record<string, string> = {
  critical: 'bg-critical/10 text-critical border-critical/30',
  high: 'bg-destructive/10 text-destructive border-destructive/30',
  medium: 'bg-warning/10 text-warning border-warning/30',
  low: 'bg-muted text-muted-foreground border-border',
  info: 'bg-muted text-muted-foreground border-border',
};

export function CorrelatedLogs({ incidentId, srcIp, eventType }: CorrelatedLogsProps) {
  const [linkedLogs, setLinkedLogs] = useState<RawLog[]>([]);
  const [relatedIncidents, setRelatedIncidents] = useState<RelatedIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [incidentId]);

  const fetchData = async () => {
    setLoading(true);

    const logsRes = await supabase
      .from('raw_logs')
      .select('id, log_type, severity, hostname, ip_address, parsed_message, processing_status, timestamp, mitre_technique, raw_payload')
      .eq('incident_id', incidentId)
      .order('timestamp', { ascending: false })
      .limit(100);

    setLinkedLogs((logsRes.data as RawLog[]) || []);

    if (srcIp) {
      const relRes = await supabase
        .from('incidents')
        .select('id, incident_number, event_type, severity, risk_level, classification, status, created_at, message, src_ip')
        .eq('src_ip', srcIp)
        .neq('id', incidentId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(20);
      setRelatedIncidents((relRes.data as RelatedIncident[]) || []);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Correlation Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{linkedLogs.length}</p>
              <p className="text-xs text-muted-foreground">Linked Raw Logs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Link2 className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{relatedIncidents.length}</p>
              <p className="text-xs text-muted-foreground">Related Incidents (same IP)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/50">
              <Clock className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {linkedLogs.length > 0 
                  ? `${Math.round((new Date(linkedLogs[linkedLogs.length - 1].timestamp).getTime() - new Date(linkedLogs[0].timestamp).getTime()) / 60000 * -1)}m`
                  : 'N/A'
                }
              </p>
              <p className="text-xs text-muted-foreground">Time Span</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Linked Raw Logs */}
      <Card className="bg-card border-border">
        <CardHeader className="py-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Correlated Raw Logs
            <Badge variant="secondary" className="ml-1">{linkedLogs.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-0">
          {linkedLogs.length > 0 ? (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {linkedLogs.map((log) => (
                <Collapsible
                  key={log.id}
                  open={expandedLog === log.id}
                  onOpenChange={(open) => setExpandedLog(open ? log.id : null)}
                >
                  <div className="rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors">
                    <CollapsibleTrigger className="w-full p-3 flex items-center gap-3 text-left">
                      <Badge variant="outline" className={cn('text-[10px] shrink-0', severityColor[log.severity || 'info'])}>
                        {log.severity || 'info'}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {log.log_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate flex-1">
                        {log.parsed_message || 'No message'}
                      </span>
                      {expandedLog === log.id ? (
                        <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3 pt-0">
                        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                          <div><span className="text-muted-foreground">Host:</span> <span className="text-foreground">{log.hostname || 'N/A'}</span></div>
                          <div><span className="text-muted-foreground">IP:</span> <span className="text-foreground">{log.ip_address || 'N/A'}</span></div>
                          {log.mitre_technique && (
                            <div><span className="text-muted-foreground">MITRE:</span> <span className="text-foreground">{log.mitre_technique}</span></div>
                          )}
                          <div><span className="text-muted-foreground">Status:</span> <span className="text-foreground">{log.processing_status}</span></div>
                        </div>
                        <pre className="bg-muted p-2 rounded text-[10px] font-mono text-muted-foreground overflow-x-auto max-h-40">
                          {JSON.stringify(log.raw_payload, null, 2)}
                        </pre>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No raw logs directly linked to this incident.</p>
          )}
        </CardContent>
      </Card>

      {/* Related Incidents */}
      {relatedIncidents.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Link2 className="h-4 w-4 text-warning" />
              Related Incidents (Same Source: {srcIp})
              <Badge variant="secondary" className="ml-1">{relatedIncidents.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            <div className="space-y-2">
              {relatedIncidents.map((ri) => (
                <a
                  key={ri.id}
                  href={`/incidents/${ri.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors"
                >
                  <Badge variant="outline" className={cn(
                    'text-[10px]',
                    ri.risk_level === 'Critical' ? 'bg-critical/10 text-critical border-critical/30' :
                    ri.risk_level === 'High' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                    'bg-muted text-muted-foreground border-border'
                  )}>
                    {ri.risk_level}
                  </Badge>
                  <span className="text-sm font-mono text-primary">{ri.incident_number}</span>
                  <span className="text-xs text-muted-foreground truncate flex-1">{ri.event_type}</span>
                  <Badge variant="outline" className="text-[10px]">{ri.classification}</Badge>
                  <Badge variant="outline" className="text-[10px]">{ri.status}</Badge>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
