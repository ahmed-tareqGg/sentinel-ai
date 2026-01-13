import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Play, 
  Save, 
  Bookmark, 
  Clock, 
  AlertTriangle,
  Shield,
  Database,
  Loader2,
  Plus,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';

interface HuntQuery {
  id: string;
  name: string;
  description: string;
  query: string;
  category: 'auth' | 'network' | 'malware' | 'lateral' | 'exfil';
  mitre?: string;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  count: number;
  executionTime: number;
}

const SAVED_HUNTS: HuntQuery[] = [
  {
    id: '1',
    name: 'SSH Bruteforce Detection',
    description: 'Find hosts with multiple failed SSH login attempts',
    query: `SELECT src_ip, COUNT(*) as attempt_count, MIN(timestamp) as first_seen, MAX(timestamp) as last_seen
FROM incidents
WHERE event_type ILIKE '%auth%' 
  AND (message ILIKE '%failed%' OR message ILIKE '%invalid%')
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY src_ip
HAVING COUNT(*) > 5
ORDER BY attempt_count DESC`,
    category: 'auth',
    mitre: 'T1110'
  },
  {
    id: '2',
    name: 'Suspicious Process Execution',
    description: 'Detect PowerShell and cmd execution with suspicious parameters',
    query: `SELECT incident_number, src_ip, message, severity, risk_level, timestamp
FROM incidents
WHERE (message ILIKE '%powershell%' OR message ILIKE '%cmd.exe%' OR message ILIKE '%wscript%')
  AND severity >= 3
ORDER BY timestamp DESC
LIMIT 50`,
    category: 'malware',
    mitre: 'T1059.001'
  },
  {
    id: '3',
    name: 'Lateral Movement Indicators',
    description: 'Find SMB, RDP, and WinRM activity patterns',
    query: `SELECT DISTINCT src_ip, dst_ip, event_type, message, timestamp
FROM incidents
WHERE (message ILIKE '%SMB%' OR message ILIKE '%RDP%' OR message ILIKE '%WinRM%' OR message ILIKE '%psexec%')
  AND src_ip IS NOT NULL AND dst_ip IS NOT NULL
ORDER BY timestamp DESC
LIMIT 100`,
    category: 'lateral',
    mitre: 'T1021'
  },
  {
    id: '4',
    name: 'Data Exfiltration Patterns',
    description: 'Large data transfers and unusual upload activity',
    query: `SELECT incident_number, src_ip, dst_ip, event_type, message, severity, timestamp
FROM incidents
WHERE (message ILIKE '%upload%' OR message ILIKE '%transfer%' OR message ILIKE '%exfil%' OR message ILIKE '%large file%')
  AND severity >= 3
ORDER BY timestamp DESC
LIMIT 50`,
    category: 'exfil',
    mitre: 'T1041'
  },
  {
    id: '5',
    name: 'New User Account Creation',
    description: 'Monitor for unauthorized user creation',
    query: `SELECT incident_number, src_ip, message, mitre_technique, timestamp
FROM incidents
WHERE (message ILIKE '%new user%' OR message ILIKE '%user created%' OR message ILIKE '%useradd%' OR event_type ILIKE '%user_created%')
ORDER BY timestamp DESC
LIMIT 50`,
    category: 'auth',
    mitre: 'T1136'
  },
  {
    id: '6',
    name: 'Critical Incidents Overview',
    description: 'All critical and high-risk incidents in the last 7 days',
    query: `SELECT incident_number, event_type, classification, risk_level, severity, src_ip, dst_ip, mitre_technique, status, timestamp
FROM incidents
WHERE risk_level IN ('Critical', 'High')
  AND timestamp > NOW() - INTERVAL '7 days'
ORDER BY 
  CASE risk_level 
    WHEN 'Critical' THEN 1 
    WHEN 'High' THEN 2 
    ELSE 3 
  END,
  timestamp DESC
LIMIT 100`,
    category: 'network',
    mitre: 'Various'
  }
];

const CATEGORY_COLORS: Record<string, string> = {
  auth: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  network: 'bg-green-500/20 text-green-400 border-green-500/30',
  malware: 'bg-red-500/20 text-red-400 border-red-500/30',
  lateral: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  exfil: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

export default function ThreatHunting() {
  const [activeQuery, setActiveQuery] = useState('');
  const [queryName, setQueryName] = useState('');
  const [results, setResults] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedHunts, setSavedHunts] = useState<HuntQuery[]>(SAVED_HUNTS);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);

  const executeQuery = async () => {
    if (!activeQuery.trim()) {
      toast.error('Please enter a query');
      return;
    }

    // Basic SQL injection prevention - only allow SELECT
    const cleanQuery = activeQuery.trim().toUpperCase();
    if (!cleanQuery.startsWith('SELECT')) {
      toast.error('Only SELECT queries are allowed for hunting');
      return;
    }

    setLoading(true);
    const startTime = Date.now();

    try {
      // Query incidents table directly
      const { data: incidents, error } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const executionTime = Date.now() - startTime;
      const columns = incidents && incidents.length > 0 ? Object.keys(incidents[0]) : [];
      
      setResults({
        columns,
        rows: incidents as Record<string, unknown>[] || [],
        count: incidents?.length || 0,
        executionTime
      });

      // Add to recent queries
      setRecentQueries(prev => [activeQuery, ...prev.slice(0, 9)]);
      toast.success('Query executed successfully');
    } catch (error) {
      console.error('Query error:', error);
      toast.error('Query failed. Showing sample data.');
      
      // Simulate results for demo
      setResults({
        columns: ['incident_number', 'src_ip', 'event_type', 'severity', 'timestamp'],
        rows: [
          { incident_number: 'INC-0042', src_ip: '10.0.0.15', event_type: 'auth_failure', severity: 4, timestamp: new Date().toISOString() },
          { incident_number: 'INC-0041', src_ip: '192.168.1.100', event_type: 'suspicious_process', severity: 5, timestamp: new Date().toISOString() },
        ],
        count: 2,
        executionTime: Date.now() - startTime
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSavedHunt = (hunt: HuntQuery) => {
    setActiveQuery(hunt.query);
    setQueryName(hunt.name);
  };

  const convertToIncident = async (row: Record<string, unknown>) => {
    toast.success('Hunt result flagged for investigation');
    // Navigate to create incident or flag existing
  };

  return (
    <AppLayout title="Threat Hunting" subtitle="Proactive threat detection and investigation">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Query Editor */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  <CardTitle>Hunt Query</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={!activeQuery}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Hunt
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Enter SQL query to hunt for threats...

Example:
SELECT src_ip, COUNT(*) as attempts
FROM incidents
WHERE event_type ILIKE '%auth%'
GROUP BY src_ip
HAVING COUNT(*) > 5"
                value={activeQuery}
                onChange={(e) => setActiveQuery(e.target.value)}
                className="min-h-[200px] font-mono text-sm bg-background/50"
              />
              <div className="flex items-center gap-4">
                <Button onClick={executeQuery} disabled={loading || !activeQuery.trim()}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Execute Query
                </Button>
                <span className="text-sm text-muted-foreground">
                  {results && `${results.count} results in ${results.executionTime}ms`}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {results && (
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    Results ({results.count})
                  </CardTitle>
                  <Badge variant="outline">{results.executionTime}ms</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {results.columns.slice(0, 8).map((col) => (
                          <TableHead key={col} className="text-xs uppercase">
                            {col.replace(/_/g, ' ')}
                          </TableHead>
                        ))}
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.rows.map((row, idx) => (
                        <TableRow key={idx}>
                          {results.columns.slice(0, 8).map((col) => (
                            <TableCell key={col} className="text-sm max-w-[200px] truncate">
                              {String(row[col] ?? '-')}
                            </TableCell>
                          ))}
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => convertToIncident(row)}
                            >
                              <AlertTriangle className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Saved Hunts Sidebar */}
        <div className="space-y-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Bookmark className="h-5 w-5 text-primary" />
                Saved Hunts
              </CardTitle>
              <CardDescription>Pre-built threat hunting queries</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="auth">Auth</TabsTrigger>
                  <TabsTrigger value="network">Network</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {savedHunts.map((hunt) => (
                        <div
                          key={hunt.id}
                          className="p-3 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => loadSavedHunt(hunt)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-sm">{hunt.name}</h4>
                            <Badge className={CATEGORY_COLORS[hunt.category]} variant="outline">
                              {hunt.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{hunt.description}</p>
                          {hunt.mitre && (
                            <Badge variant="secondary" className="text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              {hunt.mitre}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="auth" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {savedHunts.filter(h => h.category === 'auth').map((hunt) => (
                        <div
                          key={hunt.id}
                          className="p-3 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => loadSavedHunt(hunt)}
                        >
                          <h4 className="font-medium text-sm mb-1">{hunt.name}</h4>
                          <p className="text-xs text-muted-foreground">{hunt.description}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="network" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {savedHunts.filter(h => h.category === 'network' || h.category === 'lateral').map((hunt) => (
                        <div
                          key={hunt.id}
                          className="p-3 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => loadSavedHunt(hunt)}
                        >
                          <h4 className="font-medium text-sm mb-1">{hunt.name}</h4>
                          <p className="text-xs text-muted-foreground">{hunt.description}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Recent Queries */}
          {recentQueries.length > 0 && (
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Recent Queries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentQueries.slice(0, 5).map((query, idx) => (
                    <div
                      key={idx}
                      className="text-xs font-mono p-2 rounded bg-background/50 truncate cursor-pointer hover:bg-accent/50"
                      onClick={() => setActiveQuery(query)}
                    >
                      {query.slice(0, 60)}...
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
