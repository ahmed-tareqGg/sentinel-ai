import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Search, RefreshCw, Filter } from 'lucide-react';
import { supabase } from '@/integrations/backend/client';

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: any;
  created_at: string;
  ip_address: string | null;
}

interface ComplianceLog {
  id: string;
  actor_type: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  result: string;
  execution_mode: string | null;
  details: any;
  timestamp: string;
}

export function CloudLogs() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [complianceLogs, setComplianceLogs] = useState<ComplianceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logType, setLogType] = useState<'audit' | 'compliance'>('audit');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [logType]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      if (logType === 'audit') {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        setAuditLogs(data || []);
      } else {
        const { data, error } = await supabase
          .from('compliance_audit_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(100);

        if (error) throw error;
        setComplianceLogs(data || []);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    if (action.includes('delete') || action.includes('remove')) {
      return <Badge variant="destructive">{action}</Badge>;
    }
    if (action.includes('create') || action.includes('insert') || action.includes('add')) {
      return <Badge variant="outline" className="bg-success/10 text-success border-success/30">{action}</Badge>;
    }
    if (action.includes('update') || action.includes('edit') || action.includes('modify')) {
      return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">{action}</Badge>;
    }
    return <Badge variant="secondary">{action}</Badge>;
  };

  const getResultBadge = (result: string) => {
    switch (result.toLowerCase()) {
      case 'success':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/30">Success</Badge>;
      case 'failure':
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'blocked':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Blocked</Badge>;
      default:
        return <Badge variant="secondary">{result}</Badge>;
    }
  };

  const filteredAuditLogs = auditLogs.filter(log =>
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.resource_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.resource_id && log.resource_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredComplianceLogs = complianceLogs.filter(log =>
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.resource_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.actor_email && log.actor_email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-border">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={logType} onValueChange={(v) => setLogType(v as 'audit' | 'compliance')}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Log Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="audit">Audit Logs</SelectItem>
                <SelectItem value="compliance">Compliance Logs</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Button variant="outline" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {logType === 'audit' ? 'Audit Logs' : 'Compliance Logs'}
          </CardTitle>
          <CardDescription>
            {logType === 'audit' 
              ? 'System activity and admin actions' 
              : 'Compliance and security events'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
          ) : logType === 'audit' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Resource ID</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No audit logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAuditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell className="font-mono text-sm">{log.resource_type}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {log.resource_id ? log.resource_id.slice(0, 8) + '...' : 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.ip_address || 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Mode</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComplianceLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No compliance logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredComplianceLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.actor_email || log.actor_type}
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell className="font-mono text-sm">{log.resource_type}</TableCell>
                      <TableCell>{getResultBadge(log.result)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.execution_mode || 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
