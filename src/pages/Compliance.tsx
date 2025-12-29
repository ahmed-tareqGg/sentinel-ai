import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  FileText, 
  Download, 
  Filter, 
  Search,
  User,
  Bot,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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
  details: any;
  execution_mode: string | null;
  tenant_id: string;
  ip_address: string | null;
}

const ACTOR_ICONS: Record<string, typeof User> = {
  user: User,
  system: Shield,
  ai: Bot,
};

const RESULT_COLORS: Record<string, string> = {
  success: 'bg-green-500/10 text-green-500 border-green-500/30',
  failure: 'bg-destructive/10 text-destructive border-destructive/30',
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
};

export default function Compliance() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterResult, setFilterResult] = useState<string>('all');
  const [filterActor, setFilterActor] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('compliance_audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (searchTerm && !JSON.stringify(log).toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    if (filterResult !== 'all' && log.result !== filterResult) return false;
    if (filterActor !== 'all' && log.actor_type !== filterActor) return false;
    return true;
  });

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Actor Type', 'Actor Email', 'Action', 'Resource Type', 'Resource ID', 'Result', 'Execution Mode', 'Details'].join(','),
      ...filteredLogs.map(log => [
        log.timestamp,
        log.actor_type,
        log.actor_email || '',
        log.action,
        log.resource_type,
        log.resource_id || '',
        log.result,
        log.execution_mode || '',
        JSON.stringify(log.details || {}).replace(/,/g, ';'),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Audit logs exported');
  };

  const uniqueActions = [...new Set(logs.map(l => l.action))];

  const stats = {
    total: logs.length,
    success: logs.filter(l => l.result === 'success').length,
    failure: logs.filter(l => l.result === 'failure').length,
    userActions: logs.filter(l => l.actor_type === 'user').length,
    systemActions: logs.filter(l => l.actor_type === 'system').length,
    aiActions: logs.filter(l => l.actor_type === 'ai').length,
  };

  return (
    <AppLayout title="Compliance & Audit" subtitle="SOC2 / ISO 27001 audit trail and compliance logs">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Events</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <div>
                  <p className="text-xl font-bold">{stats.success}</p>
                  <p className="text-xs text-muted-foreground">Success</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <XCircle className="h-6 w-6 text-destructive" />
                <div>
                  <p className="text-xl font-bold">{stats.failure}</p>
                  <p className="text-xs text-muted-foreground">Failures</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <User className="h-6 w-6 text-blue-500" />
                <div>
                  <p className="text-xl font-bold">{stats.userActions}</p>
                  <p className="text-xs text-muted-foreground">User Actions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Shield className="h-6 w-6 text-purple-500" />
                <div>
                  <p className="text-xl font-bold">{stats.systemActions}</p>
                  <p className="text-xs text-muted-foreground">System</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Bot className="h-6 w-6 text-orange-500" />
                <div>
                  <p className="text-xl font-bold">{stats.aiActions}</p>
                  <p className="text-xs text-muted-foreground">AI Actions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {uniqueActions.map(action => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterResult} onValueChange={setFilterResult}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterActor} onValueChange={setFilterActor}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Actor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actors</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="ai">AI</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={exportLogs}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Audit Log Table */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Trail</CardTitle>
            <CardDescription>
              Immutable log of all security-relevant actions for compliance auditing
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading audit logs...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No audit logs found</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.slice(0, 100).map((log) => {
                      const ActorIcon = ACTOR_ICONS[log.actor_type] || User;
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <ActorIcon className="h-4 w-4 text-muted-foreground" />
                              <div className="text-xs">
                                <div className="font-medium capitalize">{log.actor_type}</div>
                                {log.actor_email && (
                                  <div className="text-muted-foreground">{log.actor_email}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div>{log.resource_type}</div>
                            {log.resource_id && (
                              <div className="text-muted-foreground truncate max-w-[100px]">
                                {log.resource_id.slice(0, 8)}...
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-xs", RESULT_COLORS[log.result])}>
                              {log.result}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {log.execution_mode && (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs",
                                  log.execution_mode === 'real' && "text-green-500",
                                  log.execution_mode === 'simulated' && "text-yellow-500"
                                )}
                              >
                                {log.execution_mode}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {log.details && Object.keys(log.details).length > 0 
                              ? JSON.stringify(log.details).slice(0, 50) + '...'
                              : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {filteredLogs.length > 100 && (
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Showing 100 of {filteredLogs.length} logs. Export for full data.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Compliance Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance Standards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-start gap-3 p-4 rounded-lg border border-border">
                <Shield className="h-6 w-6 text-blue-500" />
                <div>
                  <p className="font-medium">SOC 2 Type II</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Security, availability, and confidentiality controls with immutable audit trail.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg border border-border">
                <Shield className="h-6 w-6 text-green-500" />
                <div>
                  <p className="font-medium">ISO 27001</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Information security management with event logging and access control.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg border border-border">
                <Shield className="h-6 w-6 text-purple-500" />
                <div>
                  <p className="font-medium">GDPR</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Data protection with audit trails for all processing activities.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
