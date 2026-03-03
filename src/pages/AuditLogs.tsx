import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/backend/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, Filter, Clock, User, Bot, Brain, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const ACTOR_ICONS: Record<string, typeof User> = {
  user: User,
  system: Shield,
  ai: Brain,
  agent: Bot,
};

const RESULT_COLORS: Record<string, string> = {
  success: 'bg-success/10 text-success border-success/20',
  failure: 'bg-destructive/10 text-destructive border-destructive/20',
};

const PAGE_SIZE = 50;

export default function AuditLogs() {
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', search, actorFilter, resultFilter, page],
    queryFn: async () => {
      let query = supabase
        .from('compliance_audit_logs')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search) {
        query = query.or(`action.ilike.%${search}%,resource_type.ilike.%${search}%,actor_email.ilike.%${search}%`);
      }
      if (actorFilter !== 'all') query = query.eq('actor_type', actorFilter);
      if (resultFilter !== 'all') query = query.eq('result', resultFilter);

      const { data, count, error } = await query;
      if (error) throw error;
      return { logs: data || [], total: count || 0 };
    },
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const exportCSV = () => {
    if (!logs.length) return;
    const headers = ['Timestamp', 'Actor', 'Email', 'Action', 'Resource', 'Resource ID', 'Result', 'Mode'];
    const rows = logs.map((l) => [
      l.timestamp, l.actor_type, l.actor_email || '', l.action,
      l.resource_type, l.resource_id || '', l.result, l.execution_mode || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout title="Audit Logs" subtitle="Compliance audit trail">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
            <p className="text-sm text-muted-foreground">
              {total.toLocaleString()} total entries
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search actions, resources, emails..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9"
                />
              </div>
              <Select value={actorFilter} onValueChange={(v) => { setActorFilter(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Actor Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actors</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="ai">AI</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={resultFilter} onValueChange={(v) => { setResultFilter(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
                </SelectContent>
              </Select>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        No audit logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => {
                      const ActorIcon = ACTOR_ICONS[log.actor_type] || User;
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3" />
                              {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <ActorIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              <div>
                                <div className="text-xs font-medium capitalize">{log.actor_type}</div>
                                {log.actor_email && (
                                  <div className="text-[10px] text-muted-foreground">{log.actor_email}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">{log.action}</code>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <span className="text-foreground">{log.resource_type}</span>
                              {log.resource_id && (
                                <span className="text-muted-foreground ml-1 font-mono">#{log.resource_id.slice(0, 8)}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={RESULT_COLORS[log.result] || ''}>
                              {log.result}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground capitalize">
                              {log.execution_mode || 'live'}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
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
    </AppLayout>
  );
}
