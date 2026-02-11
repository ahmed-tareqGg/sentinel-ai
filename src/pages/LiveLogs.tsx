import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  RefreshCw,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Zap,
  Server,
  FileJson2,
  ArrowUpDown,
  Pause,
  Play,
  ShieldAlert
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/backend/client';
import { format } from 'date-fns';
import { useLiveLogsPauseState } from '@/hooks/useLiveLogsPauseState';
import { toast } from '@/hooks/use-toast';

interface RawLog {
  id: string;
  data_source_id: string | null;
  timestamp: string;
  received_at: string;
  log_type: string;
  severity: string;
  hostname: string | null;
  ip_address: string | null;
  raw_payload: Record<string, unknown>;
  parsed_message: string | null;
  processing_status: string;
  incident_id: string | null;
  mitre_technique: string | null;
  analyzed_at: string | null;
  error_message: string | null;
  data_sources?: {
    name: string;
    type: string;
  };
}

const SEVERITY_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  critical: { color: 'bg-red-500', icon: <AlertTriangle className="h-3 w-3" /> },
  high: { color: 'bg-orange-500', icon: <AlertTriangle className="h-3 w-3" /> },
  medium: { color: 'bg-yellow-500', icon: <AlertTriangle className="h-3 w-3" /> },
  low: { color: 'bg-blue-500', icon: <Activity className="h-3 w-3" /> },
  info: { color: 'bg-gray-500', icon: <Activity className="h-3 w-3" /> },
};

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: 'bg-yellow-500', icon: <Clock className="h-3 w-3" />, label: 'Pending' },
  analyzed: { color: 'bg-blue-500', icon: <Zap className="h-3 w-3" />, label: 'Analyzed' },
  incident_created: { color: 'bg-green-500', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Incident Created' },
  ignored: { color: 'bg-gray-500', icon: <XCircle className="h-3 w-3" />, label: 'Ignored' },
  error: { color: 'bg-red-500', icon: <XCircle className="h-3 w-3" />, label: 'Error' },
};

export default function LiveLogs() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hostFilter, setHostFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<RawLog | null>(null);
  const { isLive, isLoading: isPauseStateLoading, toggleLive } = useLiveLogsPauseState();
  const [logs, setLogs] = useState<RawLog[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [limit, setLimit] = useState<number>(100);
  const [page, setPage] = useState<number>(1);
  const [creatingIncidentId, setCreatingIncidentId] = useState<string | null>(null);

  // Fetch logs
  const { data: fetchedLogs, isLoading, refetch } = useQuery({
    queryKey: ['raw-logs', logTypeFilter, severityFilter, statusFilter, hostFilter, limit, page],
    queryFn: async () => {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('raw_logs')
        .select('*, data_sources(name, type)', { count: 'exact' })
        .order('received_at', { ascending: false })
        .range(from, to);

      if (logTypeFilter !== 'all') {
        query = query.eq('log_type', logTypeFilter);
      }
      if (severityFilter !== 'all') {
        query = query.eq('severity', severityFilter);
      }
      if (statusFilter !== 'all') {
        query = query.eq('processing_status', statusFilter);
      }
      if (hostFilter !== 'all') {
        query = query.eq('hostname', hostFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { logs: data as RawLog[], count };
    },
    refetchInterval: isLive ? 5000 : false,
    refetchOnWindowFocus: isLive,
  });

  // Update local logs when fetched
  useEffect(() => {
    if (fetchedLogs) {
      setLogs(fetchedLogs.logs);
      setTotalCount(fetchedLogs.count || 0);
    }
  }, [fetchedLogs]);

  // Realtime subscription
  useEffect(() => {
    if (!isLive) return;

    const channel = supabase
      .channel('raw-logs-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'raw_logs',
        },
        (payload) => {
          setLogs((prev) => [payload.new as RawLog, ...prev].slice(0, limit));
          setTotalCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLive]);

  // Get unique values for filters
  const uniqueHosts = [...new Set(logs?.map(l => l.hostname).filter(Boolean) || [])];
  const uniqueLogTypes = [...new Set(logs?.map(l => l.log_type) || [])];

  // Filter logs by search (Client-side filtering for current page)
  const filteredLogs = logs?.filter(log => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      log.id.toLowerCase().includes(searchLower) ||
      log.parsed_message?.toLowerCase().includes(searchLower) ||
      log.hostname?.toLowerCase().includes(searchLower) ||
      log.ip_address?.toLowerCase().includes(searchLower) ||
      log.log_type?.toLowerCase().includes(searchLower) ||
      JSON.stringify(log.raw_payload).toLowerCase().includes(searchLower)
    );
  }) || [];

  const handleCreateIncident = async (log: RawLog, e: React.MouseEvent) => {
    e.stopPropagation();
    setCreatingIncidentId(log.id);
    try {
      const payload = log.raw_payload || {};
      const severity = log.severity === 'critical' ? 5 : log.severity === 'high' ? 4 : log.severity === 'medium' ? 3 : log.severity === 'low' ? 2 : 1;
      const riskLevel = severity >= 5 ? 'Critical' : severity >= 4 ? 'High' : severity >= 3 ? 'Medium' : 'Low';

      const { data, error } = await supabase
        .from('incidents')
        .insert({
          incident_number: 'TEMP',
          event_type: log.log_type || 'Unknown',
          severity,
          src_ip: log.ip_address || (payload as any).srcIP || (payload as any).srcip || null,
          dst_ip: (payload as any).dstIP || (payload as any).dstip || null,
          message: log.parsed_message || JSON.stringify(payload).slice(0, 500),
          classification: 'Pending',
          risk_level: riskLevel,
          confidence: 0,
          mitre_technique: log.mitre_technique || null,
          raw_log: payload as any,
          ai_analysis: null,
          evidence: [],
          recommended_actions: [],
        } as any)
        .select('id, incident_number')
        .single();

      if (error) throw error;

      // Link raw log to incident
      await supabase
        .from('raw_logs')
        .update({ processing_status: 'incident_created', incident_id: data.id })
        .eq('id', log.id);

      toast({ title: `✅ ${data.incident_number} created`, description: 'Running AI analysis...' });
      refetch();

      // Navigate immediately
      navigate(`/incidents/${data.id}`);

      // Trigger AI analysis in background and update the incident
      supabase.functions.invoke('analyze-log', {
        body: {
          log: {
            eventType: log.log_type,
            severity,
            srcIP: log.ip_address,
            dstIP: (payload as any).dstIP || (payload as any).dstip || null,
            msg: log.parsed_message,
          },
          internal: true,
        },
      }).then(async (resp) => {
        if (resp.error || !resp.data) return;
        const analysis = resp.data as any;
        const classification = (() => {
          const c = (analysis.classification || '').toLowerCase();
          if (c === 'true positive' || c === 'malicious' || c === 'suspicious') return 'True Positive';
          if (c === 'false positive' || c === 'benign' || c === 'informational') return 'False Positive';
          return 'Pending';
        })();
        await supabase
          .from('incidents')
          .update({
            classification,
            confidence: analysis.confidence || 0,
            risk_level: analysis.risk_level || riskLevel,
            ai_analysis: analysis.ai_analysis || analysis,
            mitre_technique: analysis.mitre_technique || null,
            mitre_tactic: analysis.mitre_tactic || null,
            recommended_actions: analysis.recommended_actions || [],
          })
          .eq('id', data.id);
      }).catch(() => {});
    } catch (err: any) {
      console.error('Create incident failed:', err);
      toast({ title: 'Error', description: err?.message || 'Failed to create incident', variant: 'destructive' });
    } finally {
      setCreatingIncidentId(null);
    }
  };

  const { data: dbStats } = useQuery({
    queryKey: ['raw-logs-stats'],
    queryFn: async () => {
      // Get counts for each status
      const { count: totalCount } = await supabase
        .from('raw_logs')
        .select('*', { count: 'exact', head: true });
      
      const { count: pendingCount } = await supabase
        .from('raw_logs')
        .select('*', { count: 'exact', head: true })
        .eq('processing_status', 'pending');
      
      const { count: analyzedCount } = await supabase
        .from('raw_logs')
        .select('*', { count: 'exact', head: true })
        .eq('processing_status', 'analyzed');
      
      const { count: incidentCount } = await supabase
        .from('raw_logs')
        .select('*', { count: 'exact', head: true })
        .eq('processing_status', 'incident_created');

      return {
        total: totalCount || 0,
        pending: pendingCount || 0,
        analyzed: analyzedCount || 0,
        incidents: incidentCount || 0,
      };
    },
    refetchInterval: isLive ? 5000 : 30000,
  });

  // Stats
  const stats = {
    total: dbStats?.total || totalCount || logs?.length || 0,
    pending: dbStats?.pending || logs?.filter(l => l.processing_status === 'pending').length || 0,
    analyzed: dbStats?.analyzed || logs?.filter(l => l.processing_status === 'analyzed').length || 0,
    incidents: dbStats?.incidents || logs?.filter(l => l.processing_status === 'incident_created').length || 0,
  };

  return (
    <AppLayout title="Live Logs" subtitle="Real-time view of all incoming raw logs before incident creation">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Logs</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Activity className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Analysis</p>
                <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Analyzed</p>
                <p className="text-2xl font-bold text-blue-500">{stats.analyzed}</p>
              </div>
              <Zap className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Incidents Created</p>
                <p className="text-2xl font-bold text-green-500">{stats.incidents}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="mb-6 bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={logTypeFilter} onValueChange={setLogTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Log Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueLogTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="analyzed">Analyzed</SelectItem>
                <SelectItem value="incident_created">Incident Created</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>

            <Select value={hostFilter} onValueChange={setHostFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Host" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Hosts</SelectItem>
                {uniqueHosts.map(host => (
                  <SelectItem key={host} value={host!}>{host}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={limit.toString()} onValueChange={(val) => setLimit(Number(val))}>
              <SelectTrigger className="w-[110px]">
                <SelectValue placeholder="Limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 rows</SelectItem>
                <SelectItem value="100">100 rows</SelectItem>
                <SelectItem value="200">200 rows</SelectItem>
                <SelectItem value="500">500 rows</SelectItem>
                <SelectItem value="1000">1000 rows</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/10"
                onClick={async () => {
                  const { count } = await supabase
                    .from('raw_logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('processing_status', 'error');
                  if (!count || count === 0) {
                    toast({ title: 'No failed logs', description: 'All logs are processed successfully.' });
                    return;
                  }
                  await supabase
                    .from('raw_logs')
                    .update({ processing_status: 'pending', error_message: null, analyzed_at: null })
                    .eq('processing_status', 'error');
                  toast({ title: 'Retry queued', description: `${count} failed logs reset for re-analysis.` });
                  refetch();
                }}
              >
                <AlertTriangle className="h-4 w-4" />
                Retry Failed
              </Button>
              <Button
                variant={isLive ? "default" : "outline"}
                size="sm"
                onClick={toggleLive}
                disabled={isPauseStateLoading}
                className="gap-2"
              >
                {isLive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isLive ? 'Pause' : 'Live'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Raw Log Events
              {isLive && (
                <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30 animate-pulse">
                  LIVE
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Showing {filteredLogs.length} of {totalCount || logs?.length || 0} logs
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[100px]">Log ID</TableHead>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="w-[100px]">Severity</TableHead>
                  <TableHead>Message</TableHead>
                   <TableHead className="w-[140px]">Status</TableHead>
                   <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <div className="h-8 bg-muted/50 animate-pulse rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No logs found</p>
                      <p className="text-sm text-muted-foreground">
                        Connect an agent to start receiving logs
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow
                      key={log.id}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedLog(log)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {format(new Date(log.received_at || log.timestamp), 'MMM dd, HH:mm:ss.SSS')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{log.hostname || log.ip_address || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.log_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${SEVERITY_CONFIG[log.severity]?.color || 'bg-gray-500'} bg-opacity-20 border-0 text-white text-xs`}
                        >
                          <span className="flex items-center gap-1">
                            {SEVERITY_CONFIG[log.severity]?.icon}
                            {log.severity}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="text-sm truncate">
                          {log.parsed_message || JSON.stringify(log.raw_payload).slice(0, 100) + '...'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${STATUS_CONFIG[log.processing_status]?.color || 'bg-gray-500'} bg-opacity-20 border-0 text-white text-xs`}
                        >
                          <span className="flex items-center gap-1">
                            {STATUS_CONFIG[log.processing_status]?.icon}
                            {STATUS_CONFIG[log.processing_status]?.label || log.processing_status}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {log.processing_status !== 'incident_created' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleCreateIncident(log, e)}
                              disabled={creatingIncidentId === log.id}
                              title="Create Incident"
                              className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                            >
                              <ShieldAlert className="h-4 w-4" />
                            </Button>
                          )}
                          {log.processing_status === 'incident_created' && log.incident_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/incidents/${log.incident_id}`);
                              }}
                              title="View Incident"
                              className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>


          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground mr-4">
              Page {page} of {Math.ceil((totalCount || 0) / limit) || 1}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page * limit >= (totalCount || 0) || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson2 className="h-5 w-5 text-primary" />
              Log Details
              {selectedLog && (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${STATUS_CONFIG[selectedLog.processing_status]?.color || 'bg-gray-500'} bg-opacity-20 border-0 text-white ml-2`}
                >
                  {STATUS_CONFIG[selectedLog.processing_status]?.label || selectedLog.processing_status}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              View raw log payload and metadata details
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6 pr-4">
                {/* Metadata */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Timestamp</p>
                    <p className="text-sm font-medium">
                      {format(new Date(selectedLog.timestamp), 'yyyy-MM-dd HH:mm:ss.SSS')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Source</p>
                    <p className="text-sm font-medium">{selectedLog.hostname || selectedLog.ip_address || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Log Type</p>
                    <Badge variant="outline">{selectedLog.log_type}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Severity</p>
                    <Badge
                      variant="outline"
                      className={`${SEVERITY_CONFIG[selectedLog.severity]?.color || 'bg-gray-500'} bg-opacity-20 border-0 text-white`}
                    >
                      {selectedLog.severity}
                    </Badge>
                  </div>
                </div>

                {/* Parsed Message */}
                {selectedLog.parsed_message && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Parsed Message</p>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm">{selectedLog.parsed_message}</p>
                    </div>
                  </div>
                )}

                {/* MITRE Info */}
                {selectedLog.mitre_technique && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">MITRE ATT&CK</p>
                    <Badge variant="secondary" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                      {selectedLog.mitre_technique}
                    </Badge>
                  </div>
                )}

                {/* Incident Link */}
                {selectedLog.incident_id && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Created Incident</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `/incidents/${selectedLog.incident_id}`}
                    >
                      View Incident →
                    </Button>
                  </div>
                )}

                {/* Error - Obfuscated for security */}
                {selectedLog.error_message && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Status Details</p>
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-sm text-red-400 font-mono">
                        [ERR:0x{btoa(selectedLog.error_message).slice(0, 8).toUpperCase()}] Processing exception occurred
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Reference: SM-{Date.now().toString(36).toUpperCase()}-{selectedLog.id.slice(0, 4).toUpperCase()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Raw Payload */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Raw JSON Payload</p>
                  <div className="p-4 bg-muted rounded-lg overflow-x-auto">
                    <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.raw_payload, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout >
  );
}
