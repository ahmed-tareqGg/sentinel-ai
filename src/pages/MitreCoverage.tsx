import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Target,
  TrendingUp,
  RefreshCw,
  Loader2,
  Lightbulb,
  ExternalLink
} from 'lucide-react';
import { supabase, backendUrl, publishableKey } from '@/integrations/backend/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MitreTechnique {
  id: string;
  technique_id: string;
  technique_name: string;
  tactic: string;
  detection_count: number;
  last_detected: string | null;
  has_playbook: boolean;
  playbook_ids: string[] | null;
  coverage_status: string;
}

// MITRE ATT&CK Enterprise Tactics with IDs for linking
const TACTICS_DATA = [
  { id: 'TA0001', name: 'Initial Access' },
  { id: 'TA0002', name: 'Execution' },
  { id: 'TA0003', name: 'Persistence' },
  { id: 'TA0004', name: 'Privilege Escalation' },
  { id: 'TA0005', name: 'Defense Evasion' },
  { id: 'TA0006', name: 'Credential Access' },
  { id: 'TA0007', name: 'Discovery' },
  { id: 'TA0008', name: 'Lateral Movement' },
  { id: 'TA0009', name: 'Collection' },
  { id: 'TA0011', name: 'Command and Control' },
  { id: 'TA0010', name: 'Exfiltration' },
  { id: 'TA0040', name: 'Impact' },
];

// Technique map matching MitreHeatmap
const TECHNIQUE_MAP: Record<string, { id: string; name: string }[]> = {
  'Initial Access': [
    { id: 'T1133', name: 'External Remote Services' },
    { id: 'T1566', name: 'Phishing' },
    { id: 'T1190', name: 'Exploit Public-Facing Application' },
  ],
  'Execution': [
    { id: 'T1053', name: 'Scheduled Task/Job' },
    { id: 'T1204', name: 'User Execution' },
    { id: 'T1059', name: 'Command and Scripting Interpreter' },
    { id: 'T1203', name: 'Exploitation for Client Execution' },
  ],
  'Persistence': [
    { id: 'T1547', name: 'Boot or Logon Autostart Execution' },
  ],
  'Privilege Escalation': [
    { id: 'T1548', name: 'Abuse Elevation Control' },
    { id: 'T1134', name: 'Access Token Manipulation' },
  ],
  'Defense Evasion': [
    { id: 'T1078', name: 'Valid Accounts' },
    { id: 'T1140', name: 'Deobfuscate/Decode Files or Information' },
    { id: 'T1036', name: 'Masquerading' },
    { id: 'T1027', name: 'Obfuscated Files or Information' },
    { id: 'T1055', name: 'Process Injection' },
  ],
  'Credential Access': [
    { id: 'T1110', name: 'Brute Force' },
  ],
  'Discovery': [
    { id: 'T1082', name: 'System Information Discovery' },
    { id: 'T1046', name: 'Network Service Scanning' },
    { id: 'T1087', name: 'Account Discovery' },
  ],
  'Lateral Movement': [
    { id: 'T1021', name: 'Remote Services' },
    { id: 'T1091', name: 'Replication Through Removable Media' },
  ],
  'Collection': [
    { id: 'T1005', name: 'Data from Local System' },
    { id: 'T1114', name: 'Email Collection' },
  ],
  'Command and Control': [
    { id: 'T1105', name: 'Ingress Tool Transfer' },
    { id: 'T1071', name: 'Application Layer Protocol' },
    { id: 'T1132', name: 'Data Encoding' },
  ],
  'Exfiltration': [
    { id: 'T1567', name: 'Exfiltration Over Web Service' },
    { id: 'T1048', name: 'Exfiltration Over Alternative Protocol' },
    { id: 'T1041', name: 'Exfiltration Over C2 Channel' },
  ],
  'Impact': [
    { id: 'T1486', name: 'Data Encrypted for Impact' },
  ],
};

const TACTICS_ORDER = TACTICS_DATA.map(t => t.name);

export default function MitreCoverage() {
  const [techniques, setTechniques] = useState<MitreTechnique[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  useEffect(() => {
    fetchCoverage();
  }, []);
  
  const fetchCoverage = async () => {
    try {
      const { data, error } = await supabase
        .from('mitre_coverage')
        .select('*')
        .order('tactic');
      
      if (error) throw error;
      setTechniques(data || []);
    } catch (error) {
      console.error('Error fetching MITRE coverage:', error);
      toast.error('Failed to load MITRE coverage');
    } finally {
      setLoading(false);
    }
  };
  
  const refreshCoverage = async () => {
    setRefreshing(true);
    
    try {
      // Call MITRE enrichment edge function for backfill
      const response = await fetch(
        `${backendUrl}/functions/v1/mitre-enrichment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publishableKey}`,
          },
          body: JSON.stringify({ action: 'backfill' }),
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        toast.success(`Backfill complete: ${result.enriched} incidents mapped to ${result.techniques_found} techniques`);
      } else {
        throw new Error('Backfill failed');
      }
      
      // Also check playbook coverage
      const { data: playbooks } = await supabase
        .from('playbooks')
        .select('id, conditions')
        .eq('is_active', true);
      
      if (playbooks) {
        const coveredByPlaybook = new Set<string>();
        playbooks.forEach(pb => {
          const conditions = pb.conditions as any;
          if (conditions?.mitre_technique) {
            coveredByPlaybook.add(conditions.mitre_technique);
          }
        });
        
        // Update playbook coverage
        for (const technique of coveredByPlaybook) {
          await supabase
            .from('mitre_coverage')
            .update({ has_playbook: true, coverage_status: 'full' })
            .eq('technique_id', technique);
        }
      }
      
      fetchCoverage();
    } catch (error) {
      console.error('Error refreshing coverage:', error);
      toast.error('Failed to refresh coverage');
    } finally {
      setRefreshing(false);
    }
  };
  
  // Group by tactic from TECHNIQUE_MAP merged with DB data
  const byTactic = TACTICS_ORDER.reduce((acc, tacticName) => {
    const mapTechniques = TECHNIQUE_MAP[tacticName] || [];
    acc[tacticName] = mapTechniques.map(tech => {
      const dbData = techniques.find(t => t.technique_id === tech.id);
      return {
        id: dbData?.id || tech.id,
        technique_id: tech.id,
        technique_name: tech.name,
        tactic: tacticName,
        detection_count: dbData?.detection_count || 0,
        last_detected: dbData?.last_detected || null,
        has_playbook: dbData?.has_playbook || false,
        playbook_ids: dbData?.playbook_ids || null,
        coverage_status: dbData?.coverage_status || 'not_covered',
      };
    });
    return acc;
  }, {} as Record<string, MitreTechnique[]>);

  // Recalculate stats based on merged data
  const allTechniques = Object.values(byTactic).flat();
  const totalTechniquesCalc = allTechniques.length;
  const coveredTechniquesCalc = allTechniques.filter(t => t.detection_count > 0).length;
  const withPlaybooksCalc = allTechniques.filter(t => t.has_playbook).length;
  const notCoveredTechniquesCalc = allTechniques.filter(t => t.detection_count === 0).length;
  const coveragePercentCalc = totalTechniquesCalc > 0 ? Math.round((coveredTechniquesCalc / totalTechniquesCalc) * 100) : 0;
  const playbookPercentCalc = totalTechniquesCalc > 0 ? Math.round((withPlaybooksCalc / totalTechniquesCalc) * 100) : 0;
  
  const getCoverageColor = (count: number) => {
    if (count === 0) return 'bg-muted';
    if (count <= 2) return 'bg-cyan-500/50';
    if (count <= 5) return 'bg-cyan-500';
    if (count <= 10) return 'bg-orange-500';
    return 'bg-red-500';
  };
  
  const getCoverageBadge = (count: number) => {
    if (count > 0) {
      return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Detected</Badge>;
    }
    return <Badge variant="secondary">Not Detected</Badge>;
  };

  const openTacticPage = (tacticId: string) => {
    window.open(`https://attack.mitre.org/tactics/${tacticId}/`, '_blank');
  };

  const openTechniquePage = (techniqueId: string) => {
    const id = techniqueId.replace('.', '/');
    window.open(`https://attack.mitre.org/techniques/${id}/`, '_blank');
  };

  return (
    <AppLayout title="MITRE ATT&CK Coverage" subtitle="Gap analysis and detection coverage">
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Target className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{coveragePercentCalc}%</p>
                  <p className="text-xs text-muted-foreground">Detection Coverage</p>
                </div>
              </div>
              <Progress value={coveragePercentCalc} className="mt-3 h-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{playbookPercentCalc}%</p>
                  <p className="text-xs text-muted-foreground">Playbook Coverage</p>
                </div>
              </div>
              <Progress value={playbookPercentCalc} className="mt-3 h-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{coveredTechniquesCalc}</p>
                  <p className="text-xs text-muted-foreground">Detected Techniques</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{notCoveredTechniquesCalc}</p>
                  <p className="text-xs text-muted-foreground">Coverage Gaps</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Technique Coverage Matrix</h2>
            <p className="text-sm text-muted-foreground">MITRE ATT&CK techniques detected and covered by playbooks</p>
          </div>
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={refreshCoverage}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh Analysis
          </Button>
        </div>
        
        <Tabs defaultValue="matrix">
          <TabsList>
            <TabsTrigger value="matrix">Coverage Matrix</TabsTrigger>
            <TabsTrigger value="gaps">Gap Analysis</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>
          
          <TabsContent value="matrix" className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {TACTICS_ORDER.map(tactic => {
                  const tacticTechniques = byTactic[tactic] || [];
                  if (tacticTechniques.length === 0) return null;
                  
                  const tacticDetected = tacticTechniques.filter(t => t.detection_count > 0).length;
                  const tacticPercent = Math.round((tacticDetected / tacticTechniques.length) * 100);
                  const tacticData = TACTICS_DATA.find(td => td.name === tactic);
                  
                  return (
                    <Card key={tactic}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle 
                            className="text-sm flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
                            onClick={() => tacticData && openTacticPage(tacticData.id)}
                          >
                            {tactic}
                            <ExternalLink className="h-3 w-3 opacity-50" />
                          </CardTitle>
                          <Badge variant="outline">{tacticPercent}%</Badge>
                        </div>
                        <Progress value={tacticPercent} className="h-1" />
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-1">
                          {tacticTechniques.map(tech => (
                            <div 
                              key={tech.technique_id}
                              className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 cursor-pointer hover:bg-secondary/30 px-1 rounded transition-colors"
                              onClick={() => openTechniquePage(tech.technique_id)}
                            >
                              <div className="flex items-center gap-2">
                                <div className={cn("w-2 h-2 rounded-full", getCoverageColor(tech.detection_count))} />
                                <span className="text-xs">
                                  <span className="font-mono text-muted-foreground">{tech.technique_id}</span>
                                  {' '}{tech.technique_name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {tech.has_playbook && (
                                  <Shield className="h-3 w-3 text-primary" />
                                )}
                                {tech.detection_count > 0 && (
                                  <Badge variant="secondary" className="text-[10px] h-4">
                                    {tech.detection_count}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="gaps" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  Coverage Gaps
                </CardTitle>
                <CardDescription>
                  MITRE techniques with no or partial detection coverage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {allTechniques.filter(t => t.detection_count === 0).map(tech => (
                    <div 
                      key={tech.technique_id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors"
                      onClick={() => openTechniquePage(tech.technique_id)}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{tech.technique_id}</span>
                          <span className="text-sm font-medium">{tech.technique_name}</span>
                          <ExternalLink className="h-3 w-3 opacity-50" />
                        </div>
                        <p className="text-xs text-muted-foreground">{tech.tactic}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {getCoverageBadge(tech.detection_count)}
                        {!tech.has_playbook && (
                          <Badge variant="outline" className="text-xs">No Playbook</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {allTechniques.filter(t => t.detection_count === 0).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p>All techniques are detected!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="recommendations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-warning" />
                  Improvement Recommendations
                </CardTitle>
                <CardDescription>
                  Automated suggestions to improve MITRE coverage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {notCoveredTechniquesCalc > 0 && (
                  <div className="p-4 rounded-lg border border-warning/30 bg-warning/10">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                      <div>
                        <h4 className="font-medium">Detection Rules Needed</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notCoveredTechniquesCalc} techniques have no detection coverage. Consider implementing detection rules for:
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {allTechniques.filter(t => t.detection_count === 0).slice(0, 5).map(t => (
                            <Badge 
                              key={t.technique_id} 
                              variant="outline"
                              className="cursor-pointer hover:bg-secondary"
                              onClick={() => openTechniquePage(t.technique_id)}
                            >
                              {t.technique_id}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {allTechniques.filter(t => !t.has_playbook && t.detection_count > 0).length > 0 && (
                  <div className="p-4 rounded-lg border border-primary/30 bg-primary/10">
                    <div className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h4 className="font-medium">Playbook Opportunities</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          These techniques are detected but lack automated response playbooks:
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {allTechniques.filter(t => !t.has_playbook && t.detection_count > 0).slice(0, 5).map(t => (
                            <Badge 
                              key={t.technique_id} 
                              variant="secondary"
                              className="cursor-pointer hover:bg-secondary/80"
                              onClick={() => openTechniquePage(t.technique_id)}
                            >
                              {t.technique_id} ({t.detection_count} detections)
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/10">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Coverage Trend</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Current detection coverage is at {coveragePercentCalc}%. 
                        {coveragePercentCalc < 50 && " Focus on high-impact techniques like T1071, T1059, and T1078."}
                        {coveragePercentCalc >= 50 && coveragePercentCalc < 80 && " Good progress! Continue expanding to lateral movement and exfiltration tactics."}
                        {coveragePercentCalc >= 80 && " Excellent coverage! Consider advanced persistence and impact techniques next."}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
