import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  Download, 
  Search,
  User,
  Bot,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Server
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useComplianceData } from '@/hooks/useComplianceData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';

const ACTOR_ICONS: Record<string, typeof User> = {
  user: User,
  system: Shield,
  ai: Bot,
  agent: Server,
};

const RESULT_COLORS: Record<string, string> = {
  success: 'bg-green-500/10 text-green-500 border-green-500/30',
  failure: 'bg-destructive/10 text-destructive border-destructive/30',
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
};

const STANDARD_COLORS: Record<string, string> = {
  ISO27001: 'hsl(var(--primary))',
  SOC2: 'hsl(142, 71%, 45%)',
  GDPR: 'hsl(262, 83%, 58%)',
};

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(142, 71%, 45%)', 'hsl(262, 83%, 58%)', 'hsl(25, 95%, 53%)'];

export default function Compliance() {
  const {
    auditLogs,
    stats,
    standardCoverage,
    controlsWithStatus,
    actionBreakdown,
    evidenceTimeline,
    loading,
    refetch,
  } = useComplianceData();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterResult, setFilterResult] = useState<string>('all');
  const [filterActor, setFilterActor] = useState<string>('all');
  const [filterStandard, setFilterStandard] = useState<string>('all');

  const filteredLogs = auditLogs.filter(log => {
    if (searchTerm && !JSON.stringify(log).toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    if (filterResult !== 'all' && log.result !== filterResult) return false;
    if (filterActor !== 'all' && log.actor_type !== filterActor) return false;
    return true;
  });

  const filteredControls = controlsWithStatus.filter(control => {
    if (filterStandard !== 'all' && control.standard !== filterStandard) return false;
    if (searchTerm && !control.title.toLowerCase().includes(searchTerm.toLowerCase()) 
        && !control.control_code.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  const uniqueActions = [...new Set(auditLogs.map(l => l.action))];

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Actor Type', 'Actor Email', 'Action', 'Resource Type', 'Resource ID', 'Result', 'Execution Mode'].join(','),
      ...filteredLogs.map(log => [
        log.timestamp,
        log.actor_type,
        log.actor_email || '',
        log.action,
        log.resource_type,
        log.resource_id || '',
        log.result,
        log.execution_mode || '',
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

  const exportComplianceReport = () => {
    const report = {
      generated_at: new Date().toISOString(),
      summary: stats,
      coverage_by_standard: standardCoverage,
      controls: controlsWithStatus.map(c => ({
        standard: c.standard,
        code: c.control_code,
        title: c.title,
        status: c.isCovered ? 'Covered' : 'Not Covered',
        evidence_count: c.evidenceCount,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Compliance report exported');
  };

  // Prepare chart data
  const actorDistribution = [
    { name: 'User', value: stats.userActions, color: PIE_COLORS[0] },
    { name: 'System', value: stats.systemActions, color: PIE_COLORS[1] },
    { name: 'AI', value: stats.aiActions, color: PIE_COLORS[2] },
    { name: 'Agent', value: stats.agentActions, color: PIE_COLORS[3] },
  ].filter(d => d.value > 0);

  return (
    <AppLayout title="Compliance & Audit" subtitle="SOC2 / ISO 27001 / GDPR audit trail and compliance dashboard">
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="audit-trail">Audit Trail</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Shield className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{stats.totalControls}</p>
                    <p className="text-xs text-muted-foreground">Total Controls</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.coveredControls}</p>
                    <p className="text-xs text-muted-foreground">Covered</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.totalControls - stats.coveredControls}</p>
                    <p className="text-xs text-muted-foreground">Missing</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{stats.coveragePercentage}%</p>
                    <p className="text-xs text-muted-foreground">Coverage</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.totalEvents}</p>
                    <p className="text-xs text-muted-foreground">Audit Events</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coverage by Standard */}
          <div className="grid gap-6 md:grid-cols-3">
            {standardCoverage.map(standard => (
              <Card key={standard.standard}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" style={{ color: STANDARD_COLORS[standard.standard] }} />
                    {standard.standard}
                  </CardTitle>
                  <CardDescription>
                    {standard.covered} of {standard.total} controls covered
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Coverage</span>
                      <span className="font-medium">{standard.percentage}%</span>
                    </div>
                    <Progress value={standard.percentage} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Action Breakdown Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Top Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  {actionBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={actionBreakdown} layout="vertical">
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="action" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No audit events yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actor Distribution Pie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Actor Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  {actorDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={actorDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {actorDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No audit events yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Evidence Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Evidence Collection (Last 7 Days)
              </CardTitle>
              <CardDescription>Compliance evidence generated over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evidenceTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      name="Evidence Items"
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Export Buttons */}
          <div className="flex gap-4">
            <Button onClick={exportComplianceReport}>
              <Download className="h-4 w-4 mr-2" />
              Export Compliance Report
            </Button>
            <Button variant="outline" onClick={refetch} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh Data
            </Button>
          </div>
        </TabsContent>

        {/* Controls Tab */}
        <TabsContent value="controls" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search controls..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={filterStandard} onValueChange={setFilterStandard}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Standard" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Standards</SelectItem>
                    <SelectItem value="ISO27001">ISO 27001</SelectItem>
                    <SelectItem value="SOC2">SOC 2</SelectItem>
                    <SelectItem value="GDPR">GDPR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Controls Table */}
          <Card>
            <CardHeader>
              <CardTitle>Compliance Controls</CardTitle>
              <CardDescription>
                Control coverage status across all compliance standards
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">Loading controls...</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/50">
                        <TableHead>Standard</TableHead>
                        <TableHead>Control</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Evidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredControls.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No controls found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredControls.map((control) => (
                          <TableRow key={control.id}>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                style={{ 
                                  borderColor: STANDARD_COLORS[control.standard],
                                  color: STANDARD_COLORS[control.standard]
                                }}
                              >
                                {control.standard}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {control.control_code}
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              <div className="font-medium text-sm">{control.title}</div>
                              {control.description && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {control.description}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {control.category || '-'}
                            </TableCell>
                            <TableCell>
                              {control.isCovered ? (
                                <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Covered
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Not Covered
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">{control.evidenceCount}</span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit-trail" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-xl font-bold">{stats.totalEvents}</p>
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
                    <p className="text-xl font-bold">{stats.successEvents}</p>
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
                    <p className="text-xl font-bold">{stats.failureEvents}</p>
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
                    <SelectItem value="agent">Agent</SelectItem>
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
                  <p className="text-xs text-muted-foreground mt-2">
                    Audit events will appear here as actions are performed in the system
                  </p>
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
                                    log.execution_mode === 'live' && "text-green-500",
                                    log.execution_mode === 'simulated' && "text-yellow-500"
                                  )}
                                >
                                  {log.execution_mode}
                                </Badge>
                              )}
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
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
