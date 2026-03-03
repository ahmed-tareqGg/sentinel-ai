import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/backend/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Search, Download, Clock, User, Bot, Brain, Shield, ChevronLeft, ChevronRight,
  FileText, Radio, Pause, Play, Calendar, Eye, X, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

const ACTOR_ICONS: Record<string, typeof User> = { user: User, system: Shield, ai: Brain, agent: Bot };
const RESULT_STYLES: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  failure: 'bg-destructive/10 text-destructive border-destructive/20',
};
const PAGE_SIZE = 50;

interface AuditLog {
  id: string;
  timestamp: string;
  actor_type: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  result: string;
  execution_mode: string | null;
  details: any;
  ip_address: string | null;
}

export default function AuditLogs() {
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Realtime streaming
  const [streaming, setStreaming] = useState(true);
  const [newLogs, setNewLogs] = useState<AuditLog[]>([]);
  const streamRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', search, actorFilter, resultFilter, dateFrom, dateTo, page],
    queryFn: async () => {
      let query = supabase
        .from('compliance_audit_logs')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search) query = query.or(`action.ilike.%${search}%,resource_type.ilike.%${search}%,actor_email.ilike.%${search}%`);
      if (actorFilter !== 'all') query = query.eq('actor_type', actorFilter);
      if (resultFilter !== 'all') query = query.eq('result', resultFilter);
      if (dateFrom) query = query.gte('timestamp', new Date(dateFrom).toISOString());
      if (dateTo) query = query.lte('timestamp', new Date(dateTo + 'T23:59:59').toISOString());

      const { data, count, error } = await query;
      if (error) throw error;
      return { logs: (data || []) as AuditLog[], total: count || 0 };
    },
  });

  // Setup realtime subscription
  useEffect(() => {
    if (!streaming) { streamRef.current?.unsubscribe(); return; }

    const channel = supabase
      .channel('audit-logs-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'compliance_audit_logs' }, (payload) => {
        setNewLogs(prev => [payload.new as AuditLog, ...prev].slice(0, 20));
      })
      .subscribe();

    streamRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [streaming]);

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const allLogs = page === 0 ? [...newLogs.filter(nl => !logs.find(l => l.id === nl.id)), ...logs] : logs;

  const exportCSV = useCallback(() => {
    const source = allLogs.length ? allLogs : logs;
    if (!source.length) return;
    const headers = ['Timestamp', 'Actor Type', 'Email', 'Action', 'Resource Type', 'Resource ID', 'Result', 'Mode', 'IP'];
    const rows = source.map(l => [
      l.timestamp, l.actor_type, l.actor_email || '', l.action,
      l.resource_type, l.resource_id || '', l.result, l.execution_mode || '', l.ip_address || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  }, [allLogs, logs]);

  const exportPDF = useCallback(() => {
    const source = allLogs.length ? allLogs : logs;
    if (!source.length) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('SOCMind - Audit Log Report', 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')} | Total: ${source.length} entries`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Timestamp', 'Actor', 'Email', 'Action', 'Resource', 'Result', 'IP']],
      body: source.map(l => [
        format(new Date(l.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        l.actor_type, l.actor_email || '-', l.action,
        l.resource_type, l.result, l.ip_address || '-',
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [0, 188, 212] },
    });

    doc.save(`audit-logs-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`);
    toast.success('PDF exported successfully');
  }, [allLogs, logs]);

  const clearFilters = () => {
    setSearch(''); setActorFilter('all'); setResultFilter('all');
    setDateFrom(''); setDateTo(''); setPage(0);
  };

  const hasActiveFilters = search || actorFilter !== 'all' || resultFilter !== 'all' || dateFrom || dateTo;

  // Summary counts
  const successCount = logs.filter(l => l.result === 'success').length;
  const failureCount = logs.filter(l => l.result === 'failure').length;

  return (
    <AppLayout title="Audit Logs" subtitle="Compliance audit trail & real-time monitoring">
      <div className="space-y-4">
        {/* Header with summary */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-muted-foreground">{total.toLocaleString()} total entries</span>
              {newLogs.length > 0 && page === 0 && (
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary animate-pulse">
                  +{newLogs.length} new
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={streaming ? 'default' : 'outline'} size="sm" onClick={() => setStreaming(!streaming)} className="gap-1.5">
                  {streaming ? <><Radio className="h-3.5 w-3.5 animate-pulse" /> Live</> : <><Pause className="h-3.5 w-3.5" /> Paused</>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{streaming ? 'Receiving real-time events' : 'Real-time paused'}</TooltipContent>
            </Tooltip>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
          </div>
        </div>

        {/* Quick summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: total, icon: Clock, color: 'text-foreground' },
            { label: 'Success', value: successCount, icon: CheckCircle, color: 'text-emerald-400' },
            { label: 'Failure', value: failureCount, icon: AlertTriangle, color: 'text-destructive' },
            { label: 'Live Events', value: newLogs.length, icon: Radio, color: 'text-primary' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
              <s.icon className={cn('h-4 w-4', s.color)} />
              <div>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search actions, resources, emails..." value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
                </div>
                <Select value={actorFilter} onValueChange={(v) => { setActorFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Actor Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actors</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="ai">AI</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={resultFilter} onValueChange={(v) => { setResultFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Result" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Results</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failure">Failure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block">From</label>
                    <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block">To</label>
                    <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} />
                  </div>
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
                    <X className="h-3.5 w-3.5" /> Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : allLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No audit logs found</TableCell>
                    </TableRow>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {allLogs.map((log) => {
                        const ActorIcon = ACTOR_ICONS[log.actor_type] || User;
                        const isNew = newLogs.some(nl => nl.id === log.id);
                        return (
                          <motion.tr
                            key={log.id}
                            initial={isNew ? { backgroundColor: 'hsl(187 100% 50% / 0.1)' } : false}
                            animate={{ backgroundColor: 'transparent' }}
                            transition={{ duration: 2 }}
                            className="border-b border-border"
                          >
                            <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1.5 cursor-default">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <ActorIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                <div>
                                  <div className="text-xs font-medium capitalize">{log.actor_type}</div>
                                  {log.actor_email && <div className="text-[10px] text-muted-foreground">{log.actor_email}</div>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">{log.action}</code>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs">
                                <span className="text-foreground">{log.resource_type}</span>
                                {log.resource_id && <span className="text-muted-foreground ml-1 font-mono">#{log.resource_id.slice(0, 8)}</span>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={RESULT_STYLES[log.result] || ''}>{log.result}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground capitalize">{log.execution_mode || 'live'}</span>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedLog(log)}>
                                <Eye className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" /> Audit Log Detail
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3 text-sm">
              {[
                ['Timestamp', format(new Date(selectedLog.timestamp), 'yyyy-MM-dd HH:mm:ss.SSS')],
                ['Actor Type', selectedLog.actor_type],
                ['Actor Email', selectedLog.actor_email || '-'],
                ['Action', selectedLog.action],
                ['Resource Type', selectedLog.resource_type],
                ['Resource ID', selectedLog.resource_id || '-'],
                ['Result', selectedLog.result],
                ['Execution Mode', selectedLog.execution_mode || 'live'],
                ['IP Address', selectedLog.ip_address || '-'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground text-xs">{label}</span>
                  <span className="text-foreground text-xs font-medium font-mono">{value}</span>
                </div>
              ))}
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Details (JSON)</p>
                  <pre className="text-[10px] bg-secondary/50 p-3 rounded-lg overflow-auto max-h-48 text-foreground">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
