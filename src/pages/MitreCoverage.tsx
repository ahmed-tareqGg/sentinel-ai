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
  Lightbulb
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

const TACTICS_ORDER = [
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Defense Evasion',
  'Credential Access',
  'Discovery',
  'Lateral Movement',
  'Collection',
  'Command and Control',
  'Exfiltration',
  'Impact',
];

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
      // Update coverage based on incidents
      const { data: incidents } = await supabase
        .from('incidents')
        .select('mitre_technique, mitre_tactic')
        .not('mitre_technique', 'is', null);
      
      if (incidents) {
        const techniqueCounts: Record<string, number> = {};
        incidents.forEach(inc => {
          if (inc.mitre_technique) {
            techniqueCounts[inc.mitre_technique] = (techniqueCounts[inc.mitre_technique] || 0) + 1;
          }
        });
        
        // Update detection counts
        for (const [technique, count] of Object.entries(techniqueCounts)) {
          await supabase
            .from('mitre_coverage')
            .update({ 
              detection_count: count,
              last_detected: new Date().toISOString(),
              coverage_status: count >= 3 ? 'covered' : 'partial',
            })
            .eq('technique_id', technique);
        }
      }
      
      // Check playbook coverage
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
            .update({ has_playbook: true })
            .eq('technique_id', technique);
        }
      }
      
      toast.success('Coverage analysis updated');
      fetchCoverage();
    } catch (error) {
      console.error('Error refreshing coverage:', error);
      toast.error('Failed to refresh coverage');
    } finally {
      setRefreshing(false);
    }
  };
  
  // Calculate stats
  const totalTechniques = techniques.length;
  const coveredTechniques = techniques.filter(t => t.coverage_status === 'covered').length;
  const partialTechniques = techniques.filter(t => t.coverage_status === 'partial').length;
  const notCoveredTechniques = techniques.filter(t => t.coverage_status === 'not_covered').length;
  const withPlaybooks = techniques.filter(t => t.has_playbook).length;
  
  const coveragePercent = totalTechniques > 0 ? Math.round(((coveredTechniques + partialTechniques * 0.5) / totalTechniques) * 100) : 0;
  const playbookPercent = totalTechniques > 0 ? Math.round((withPlaybooks / totalTechniques) * 100) : 0;
  
  // Group by tactic
  const byTactic = techniques.reduce((acc, t) => {
    if (!acc[t.tactic]) acc[t.tactic] = [];
    acc[t.tactic].push(t);
    return acc;
  }, {} as Record<string, MitreTechnique[]>);
  
  const getCoverageColor = (status: string) => {
    switch (status) {
      case 'covered': return 'bg-green-500';
      case 'partial': return 'bg-warning';
      default: return 'bg-muted';
    }
  };
  
  const getCoverageBadge = (status: string) => {
    switch (status) {
      case 'covered': 
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Covered</Badge>;
      case 'partial': 
        return <Badge className="bg-warning/20 text-warning border-warning/30">Partial</Badge>;
      default: 
        return <Badge variant="secondary">Not Covered</Badge>;
    }
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
                  <p className="text-2xl font-bold">{coveragePercent}%</p>
                  <p className="text-xs text-muted-foreground">Detection Coverage</p>
                </div>
              </div>
              <Progress value={coveragePercent} className="mt-3 h-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{playbookPercent}%</p>
                  <p className="text-xs text-muted-foreground">Playbook Coverage</p>
                </div>
              </div>
              <Progress value={playbookPercent} className="mt-3 h-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{coveredTechniques}</p>
                  <p className="text-xs text-muted-foreground">Fully Covered</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{notCoveredTechniques}</p>
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
                  
                  const tacticCovered = tacticTechniques.filter(t => t.coverage_status !== 'not_covered').length;
                  const tacticPercent = Math.round((tacticCovered / tacticTechniques.length) * 100);
                  
                  return (
                    <Card key={tactic}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{tactic}</CardTitle>
                          <Badge variant="outline">{tacticPercent}%</Badge>
                        </div>
                        <Progress value={tacticPercent} className="h-1" />
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-1">
                          {tacticTechniques.map(tech => (
                            <div 
                              key={tech.id}
                              className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
                            >
                              <div className="flex items-center gap-2">
                                <div className={cn("w-2 h-2 rounded-full", getCoverageColor(tech.coverage_status))} />
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
                  {techniques.filter(t => t.coverage_status !== 'covered').map(tech => (
                    <div 
                      key={tech.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/30"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{tech.technique_id}</span>
                          <span className="text-sm font-medium">{tech.technique_name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{tech.tactic}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {getCoverageBadge(tech.coverage_status)}
                        {!tech.has_playbook && (
                          <Badge variant="outline" className="text-xs">No Playbook</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {techniques.filter(t => t.coverage_status !== 'covered').length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p>All techniques are covered!</p>
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
                {notCoveredTechniques > 0 && (
                  <div className="p-4 rounded-lg border border-warning/30 bg-warning/10">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                      <div>
                        <h4 className="font-medium">Detection Rules Needed</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notCoveredTechniques} techniques have no detection coverage. Consider implementing detection rules for:
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {techniques.filter(t => t.coverage_status === 'not_covered').slice(0, 5).map(t => (
                            <Badge key={t.id} variant="outline">{t.technique_id}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {techniques.filter(t => !t.has_playbook && t.detection_count > 0).length > 0 && (
                  <div className="p-4 rounded-lg border border-primary/30 bg-primary/10">
                    <div className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h4 className="font-medium">Playbook Opportunities</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          These techniques are detected but lack automated response playbooks:
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {techniques.filter(t => !t.has_playbook && t.detection_count > 0).slice(0, 5).map(t => (
                            <Badge key={t.id} variant="secondary">{t.technique_id} ({t.detection_count} detections)</Badge>
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
                        Current detection coverage is at {coveragePercent}%. 
                        {coveragePercent < 50 && " Focus on high-impact techniques like T1071, T1059, and T1078."}
                        {coveragePercent >= 50 && coveragePercent < 80 && " Good progress! Continue expanding to lateral movement and exfiltration tactics."}
                        {coveragePercent >= 80 && " Excellent coverage! Consider advanced persistence and impact techniques next."}
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
