import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { LiveThreatFeed } from '@/components/dashboard/LiveThreatFeed';
import { AIAutoTriage } from '@/components/incidents/AIAutoTriage';
import {
  Shield,
  Search,
  Globe,
  AlertTriangle,
  Activity,
  Eye,
  Loader2,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  Users,
  Database,
  Crosshair,
  Radio,
  Bot,
} from 'lucide-react';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';

interface TIResult {
  ioc_value: string;
  ioc_type: string;
  threat_score: number;
  confidence: number;
  providers: Record<string, any>;
}

interface ThreatIOC {
  id: string;
  ioc_type: string;
  value: string;
  threat_score: number;
  confidence: number;
  categories: string[];
  tags: string[];
  source: string;
  source_data: Record<string, any>;
  country_code: string | null;
  isp: string | null;
  is_whitelisted: boolean;
  created_at: string;
  updated_at: string;
}

interface ThreatActor {
  id: string;
  name: string;
  aliases: string[];
  description: string | null;
  motivation: string | null;
  sophistication: string | null;
  origin_country: string | null;
  target_sectors: string[];
  ttps: string[];
  last_activity: string | null;
}

const SCORE_COLORS: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  low: 'bg-success/10 text-success border-success/30',
  clean: 'bg-muted text-muted-foreground border-border',
};

function getScoreLevel(score: number): string {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  if (score > 0) return 'low';
  return 'clean';
}

function getScoreColor(score: number): string {
  return SCORE_COLORS[getScoreLevel(score)];
}

export default function ThreatIntel() {
  const [searchValue, setSearchValue] = useState('');
  const [searchType, setSearchType] = useState('ip');
  const [loading, setLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<TIResult | null>(null);
  const [iocs, setIocs] = useState<ThreatIOC[]>([]);
  const [actors, setActors] = useState<ThreatActor[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, critical: 0, countries: 0 });

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setDashboardLoading(true);
    try {
      const [iocRes, actorRes] = await Promise.all([
        supabase.from('threat_intel_iocs').select('*').order('threat_score', { ascending: false }).limit(50),
        supabase.from('threat_actors').select('*').order('created_at', { ascending: false }).limit(20),
      ]);
      setIocs((iocRes.data || []) as unknown as ThreatIOC[]);
      setActors(actorRes.data || []);
      const allIocs = iocRes.data || [];
      setStats({
        total: allIocs.length,
        critical: allIocs.filter(i => i.threat_score >= 70).length,
        countries: new Set(allIocs.map(i => i.country_code).filter(Boolean)).size,
      });
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setDashboardLoading(false);
    }
  };

  const performLookup = async () => {
    if (!searchValue.trim()) {
      toast.error('Enter an IOC value to lookup');
      return;
    }
    setLoading(true);
    setLookupResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('threat-intel-lookup', {
        body: { action: 'lookup', ioc_value: searchValue.trim(), ioc_type: searchType },
      });
      if (error) throw error;
      setLookupResult(data);
      toast.success(`Lookup complete — Threat Score: ${data.threat_score}/100`);
      fetchDashboard();
    } catch (err) {
      console.error('Lookup error:', err);
      toast.error('Lookup failed. Check API keys.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout title="Threat Intelligence" subtitle="IOC enrichment, threat feeds & actor tracking">
      <div className="space-y-6">
        {/* IOC Lookup */}
        <Card className="border-primary/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-primary" />
              IOC Lookup
            </CardTitle>
            <CardDescription>Search IP, domain, hash, or URL across VirusTotal, AbuseIPDB & AlienVault OTX</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={searchType} onValueChange={setSearchType}>
                <SelectTrigger className="w-full sm:w-36 bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ip">IP Address</SelectItem>
                  <SelectItem value="domain">Domain</SelectItem>
                  <SelectItem value="file_hash">File Hash</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder={searchType === 'ip' ? '8.8.8.8' : searchType === 'domain' ? 'example.com' : searchType === 'file_hash' ? 'SHA256 hash...' : 'https://...'}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="flex-1 bg-secondary/50"
                onKeyDown={(e) => e.key === 'Enter' && performLookup()}
              />
              <Button onClick={performLookup} disabled={loading} className="shrink-0">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Lookup
              </Button>
            </div>

            {/* Lookup Result */}
            {lookupResult && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${lookupResult.threat_score >= 70 ? 'text-destructive' : lookupResult.threat_score >= 30 ? 'text-warning' : 'text-success'}`}>
                      {lookupResult.threat_score}
                    </div>
                    <p className="text-xs text-muted-foreground">Threat Score</p>
                  </div>
                  <div className="flex-1">
                    <Progress value={lookupResult.threat_score} className="h-3" />
                  </div>
                  <Badge variant="outline" className={getScoreColor(lookupResult.threat_score)}>
                    {getScoreLevel(lookupResult.threat_score).toUpperCase()}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* VirusTotal */}
                  {lookupResult.providers.virustotal && !lookupResult.providers.virustotal.error && (
                    <Card className="border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          VirusTotal
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs space-y-1">
                        <div className="flex justify-between"><span className="text-muted-foreground">Malicious</span><span className="text-destructive font-mono">{lookupResult.providers.virustotal.malicious}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Suspicious</span><span className="text-warning font-mono">{lookupResult.providers.virustotal.suspicious}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Harmless</span><span className="text-success font-mono">{lookupResult.providers.virustotal.harmless}</span></div>
                        {lookupResult.providers.virustotal.country && (
                          <div className="flex justify-between"><span className="text-muted-foreground">Country</span><span>{lookupResult.providers.virustotal.country}</span></div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* AbuseIPDB */}
                  {lookupResult.providers.abuseipdb && !lookupResult.providers.abuseipdb.error && (
                    <Card className="border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          AbuseIPDB
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs space-y-1">
                        <div className="flex justify-between"><span className="text-muted-foreground">Abuse Score</span><span className="font-mono">{lookupResult.providers.abuseipdb.abuse_confidence_score}%</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Reports</span><span className="font-mono">{lookupResult.providers.abuseipdb.total_reports}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">ISP</span><span className="truncate max-w-[120px]">{lookupResult.providers.abuseipdb.isp}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Country</span><span>{lookupResult.providers.abuseipdb.country_code}</span></div>
                        {lookupResult.providers.abuseipdb.is_tor && <Badge variant="destructive" className="text-[10px]">TOR Node</Badge>}
                      </CardContent>
                    </Card>
                  )}

                  {/* AlienVault OTX */}
                  {lookupResult.providers.alienvault && !lookupResult.providers.alienvault.error && (
                    <Card className="border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Eye className="h-4 w-4 text-accent-foreground" />
                          AlienVault OTX
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs space-y-1">
                        <div className="flex justify-between"><span className="text-muted-foreground">Pulses</span><span className="font-mono">{lookupResult.providers.alienvault.pulse_count}</span></div>
                        {lookupResult.providers.alienvault.pulses?.slice(0, 2).map((p: any, i: number) => (
                          <div key={i} className="p-1.5 bg-secondary/50 rounded text-[10px]">
                            <p className="font-medium truncate">{p.name}</p>
                            {p.adversary && <Badge variant="outline" className="text-[9px] mt-1">{p.adversary}</Badge>}
                          </div>
                        ))}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {lookupResult.providers.alienvault.tags?.slice(0, 4).map((t: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-[9px]">{t}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total IOCs</CardTitle>
              <Database className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Critical IOCs</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.critical}</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Countries</CardTitle>
              <Globe className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.countries}</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Threat Actors</CardTitle>
              <Users className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{actors.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="iocs">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="iocs" className="text-xs">IOC Database</TabsTrigger>
            <TabsTrigger value="actors" className="text-xs">Threat Actors</TabsTrigger>
            <TabsTrigger value="enrichments" className="text-xs">Enrichment Log</TabsTrigger>
            <TabsTrigger value="live-feed" className="text-xs gap-1.5">
              <Radio className="h-3 w-3 text-destructive" /> Live Feed
            </TabsTrigger>
            <TabsTrigger value="auto-triage" className="text-xs gap-1.5">
              <Bot className="h-3 w-3 text-primary" /> AI Auto-Triage
            </TabsTrigger>
          </TabsList>

          <TabsContent value="iocs" className="mt-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Enriched IOCs</CardTitle>
                  <Button variant="outline" size="sm" onClick={fetchDashboard}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {dashboardLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : iocs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No IOCs enriched yet. Use the lookup above to start.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead className="text-center">Score</TableHead>
                          <TableHead>Country</TableHead>
                          <TableHead>ISP</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Last Seen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {iocs.map((ioc) => (
                          <TableRow
                            key={ioc.id}
                            className="cursor-pointer hover:bg-secondary/50"
                            onClick={() => {
                              setSearchValue(ioc.value);
                              setSearchType(ioc.ioc_type);
                            }}
                          >
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-mono">{ioc.ioc_type.toUpperCase()}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm max-w-[200px] truncate">{ioc.value}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={getScoreColor(ioc.threat_score)}>
                                {ioc.threat_score}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{ioc.country_code || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{ioc.isp || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{ioc.source}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {ioc.updated_at ? new Date(ioc.updated_at).toLocaleDateString() : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actors" className="mt-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Known Threat Actors</CardTitle>
              </CardHeader>
              <CardContent>
                {actors.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No threat actors tracked yet. Actors will be populated from OTX pulse data.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {actors.map((actor) => (
                      <Card key={actor.id} className="border-border/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-sm">{actor.name}</h4>
                            {actor.sophistication && (
                              <Badge variant="outline" className="text-[10px]">{actor.sophistication}</Badge>
                            )}
                          </div>
                          {actor.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{actor.description}</p>}
                          <div className="flex flex-wrap gap-1">
                            {actor.motivation && <Badge variant="secondary" className="text-[10px]">{actor.motivation}</Badge>}
                            {actor.origin_country && <Badge variant="outline" className="text-[10px]">{actor.origin_country}</Badge>}
                            {actor.ttps?.slice(0, 3).map((t, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] font-mono">{t}</Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="enrichments" className="mt-4">
            <EnrichmentLogTab />
          </TabsContent>

          <TabsContent value="live-feed" className="mt-4">
            <LiveThreatFeed />
          </TabsContent>

          <TabsContent value="auto-triage" className="mt-4">
            <AIAutoTriage />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function EnrichmentLogTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase
        .from('ti_enrichment_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setLogs(data || []);
      setLoading(false);
    };
    fetchLogs();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Enrichment History</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">No enrichments yet</p>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IOC</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm max-w-[180px] truncate">{log.ioc_value}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{log.ioc_type?.toUpperCase()}</Badge></TableCell>
                    <TableCell className="text-sm capitalize">{log.provider}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge
                          variant="outline"
                          className={log.request_status === 'success' ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'}
                        >
                          {log.request_status}
                        </Badge>
                        {log.request_status !== 'success' && log.error_message && (
                          <p className="text-[10px] text-destructive max-w-[200px] truncate" title={log.error_message}>
                            {log.error_message}
                          </p>
                        )}
                        {log.request_status !== 'success' && !log.error_message && log.response_data?.error && (
                          <p className="text-[10px] text-destructive max-w-[200px] truncate" title={String(log.response_data.error)}>
                            {String(log.response_data.error)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
