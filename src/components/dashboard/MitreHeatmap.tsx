import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/backend/client';
import { cn } from '@/lib/utils';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Maximize2, Minimize2 } from 'lucide-react';

interface MitreTechnique {
  technique_id: string;
  technique_name: string;
  tactic: string;
  detection_count: number;
  has_playbook: boolean;
  coverage_status: string;
}

interface Incident {
  mitre_technique?: string | null;
  mitre_tactic?: string | null;
  ai_analysis?: {
    mitre_techniques?: Array<{
      technique_id: string;
      tactic: string;
    }>;
  } | null;
}

interface MitreHeatmapProps {
  incidents?: Incident[];
  showTitle?: boolean;
  compact?: boolean;
}

// MITRE ATT&CK Enterprise Tactics in kill-chain order
const TACTICS = [
  { id: 'TA0043', name: 'Reconnaissance', shortName: 'Recon' },
  { id: 'TA0042', name: 'Resource Development', shortName: 'Resources' },
  { id: 'TA0001', name: 'Initial Access', shortName: 'Initial' },
  { id: 'TA0002', name: 'Execution', shortName: 'Execution' },
  { id: 'TA0003', name: 'Persistence', shortName: 'Persist' },
  { id: 'TA0004', name: 'Privilege Escalation', shortName: 'PrivEsc' },
  { id: 'TA0005', name: 'Defense Evasion', shortName: 'Evasion' },
  { id: 'TA0006', name: 'Credential Access', shortName: 'Creds' },
  { id: 'TA0007', name: 'Discovery', shortName: 'Discovery' },
  { id: 'TA0008', name: 'Lateral Movement', shortName: 'Lateral' },
  { id: 'TA0009', name: 'Collection', shortName: 'Collect' },
  { id: 'TA0011', name: 'Command and Control', shortName: 'C2' },
  { id: 'TA0010', name: 'Exfiltration', shortName: 'Exfil' },
  { id: 'TA0040', name: 'Impact', shortName: 'Impact' },
];

// Sample techniques per tactic (common ones)
const TECHNIQUE_MAP: Record<string, { id: string; name: string }[]> = {
  'Reconnaissance': [
    { id: 'T1595', name: 'Active Scanning' },
    { id: 'T1592', name: 'Gather Victim Host Info' },
  ],
  'Initial Access': [
    { id: 'T1566', name: 'Phishing' },
    { id: 'T1190', name: 'Exploit Public-Facing App' },
    { id: 'T1189', name: 'Drive-by Compromise' },
  ],
  'Execution': [
    { id: 'T1059', name: 'Command & Scripting' },
    { id: 'T1204', name: 'User Execution' },
    { id: 'T1053', name: 'Scheduled Task' },
  ],
  'Persistence': [
    { id: 'T1547', name: 'Boot Autostart' },
    { id: 'T1543', name: 'Create System Process' },
    { id: 'T1136', name: 'Create Account' },
  ],
  'Privilege Escalation': [
    { id: 'T1548', name: 'Abuse Elevation' },
    { id: 'T1134', name: 'Access Token Manipulation' },
  ],
  'Defense Evasion': [
    { id: 'T1027', name: 'Obfuscated Files' },
    { id: 'T1070', name: 'Indicator Removal' },
    { id: 'T1562', name: 'Impair Defenses' },
  ],
  'Credential Access': [
    { id: 'T1110', name: 'Brute Force' },
    { id: 'T1003', name: 'OS Credential Dumping' },
    { id: 'T1555', name: 'Credentials from Stores' },
  ],
  'Discovery': [
    { id: 'T1082', name: 'System Info Discovery' },
    { id: 'T1046', name: 'Network Service Scan' },
    { id: 'T1087', name: 'Account Discovery' },
  ],
  'Lateral Movement': [
    { id: 'T1021', name: 'Remote Services' },
    { id: 'T1091', name: 'Replication via Media' },
  ],
  'Collection': [
    { id: 'T1005', name: 'Local Data Collection' },
    { id: 'T1114', name: 'Email Collection' },
  ],
  'Command and Control': [
    { id: 'T1071', name: 'Application Layer Protocol' },
    { id: 'T1105', name: 'Ingress Tool Transfer' },
    { id: 'T1132', name: 'Data Encoding' },
  ],
  'Exfiltration': [
    { id: 'T1041', name: 'Exfil Over C2' },
    { id: 'T1048', name: 'Exfil Over Alt Protocol' },
  ],
  'Impact': [
    { id: 'T1486', name: 'Data Encrypted' },
    { id: 'T1485', name: 'Data Destruction' },
    { id: 'T1499', name: 'Endpoint DoS' },
  ],
};

export function MitreHeatmap({ incidents = [], showTitle = true, compact = false }: MitreHeatmapProps) {
  const [coverage, setCoverage] = useState<MitreTechnique[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [hoveredTactic, setHoveredTactic] = useState<string | null>(null);

  useEffect(() => {
    fetchCoverage();
  }, []);

  const fetchCoverage = async () => {
    const { data } = await supabase
      .from('mitre_coverage')
      .select('*');
    if (data) setCoverage(data);
  };

  // Count detections per technique from incidents
  const getDetectionCount = (techniqueId: string): number => {
    // First check coverage table
    const coverageData = coverage.find(c => c.technique_id === techniqueId);
    if (coverageData?.detection_count) return coverageData.detection_count;
    
    // Then count from incidents
    let count = 0;
    incidents.forEach(inc => {
      if (inc.mitre_technique?.includes(techniqueId)) count++;
      inc.ai_analysis?.mitre_techniques?.forEach(t => {
        if (t.technique_id?.includes(techniqueId)) count++;
      });
    });
    return count;
  };

  // Get tactic detection count
  const getTacticCount = (tacticName: string): number => {
    const techniques = TECHNIQUE_MAP[tacticName] || [];
    return techniques.reduce((sum, tech) => sum + getDetectionCount(tech.id), 0);
  };

  // Get heat color based on count
  const getHeatColor = (count: number): string => {
    if (count === 0) return 'bg-muted/30';
    if (count <= 2) return 'bg-cyan-500/30';
    if (count <= 5) return 'bg-cyan-500/50';
    if (count <= 10) return 'bg-orange-500/50';
    return 'bg-red-500/60';
  };

  // Get text color based on count
  const getTextColor = (count: number): string => {
    if (count === 0) return 'text-muted-foreground';
    if (count <= 5) return 'text-cyan-400';
    if (count <= 10) return 'text-orange-400';
    return 'text-red-400';
  };

  // Check if has playbook
  const hasPlaybook = (techniqueId: string): boolean => {
    return coverage.find(c => c.technique_id === techniqueId)?.has_playbook || false;
  };

  // Open MITRE page
  const openMitrePage = (techniqueId: string) => {
    const id = techniqueId.replace('.', '/');
    window.open(`https://attack.mitre.org/techniques/${id}/`, '_blank');
  };

  const totalDetections = TACTICS.reduce((sum, tactic) => sum + getTacticCount(tactic.name), 0);
  const coveredTactics = TACTICS.filter(t => getTacticCount(t.name) > 0).length;

  return (
    <div className={cn(
      "rounded-xl border border-border bg-card overflow-hidden",
      expanded ? "fixed inset-4 z-50" : ""
    )}>
      {showTitle && (
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              MITRE ATT&CK Heatmap
              <Badge variant="secondary" className="text-[10px]">
                {totalDetections} detections
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {coveredTactics}/{TACTICS.length} tactics with activity
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href="https://attack.mitre.org/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-cyan-400 flex items-center gap-1"
            >
              ATT&CK <ExternalLink className="h-3 w-3" />
            </a>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      <TooltipProvider>
        <div className={cn(
          "p-4 overflow-x-auto",
          expanded ? "h-[calc(100%-60px)]" : compact ? "max-h-[250px]" : "max-h-[400px]"
        )}>
          {/* Tactic Headers */}
          <div className="flex gap-1 min-w-max">
            {TACTICS.map((tactic) => {
              const count = getTacticCount(tactic.name);
              return (
                <div 
                  key={tactic.id}
                  className={cn(
                    "flex flex-col w-20 shrink-0",
                    expanded ? "w-28" : ""
                  )}
                  onMouseEnter={() => setHoveredTactic(tactic.name)}
                  onMouseLeave={() => setHoveredTactic(null)}
                >
                  {/* Tactic Header */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        "text-center p-2 rounded-t-lg border border-border transition-all cursor-pointer",
                        count > 0 ? "bg-primary/20 border-primary/30" : "bg-muted/30",
                        hoveredTactic === tactic.name ? "ring-2 ring-primary" : ""
                      )}>
                        <div className={cn(
                          "text-[10px] font-semibold truncate",
                          count > 0 ? "text-primary" : "text-muted-foreground"
                        )}>
                          {expanded ? tactic.name : tactic.shortName}
                        </div>
                        <div className={cn(
                          "text-lg font-bold mt-1",
                          getTextColor(count)
                        )}>
                          {count}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-semibold">{tactic.name}</p>
                      <p className="text-xs text-muted-foreground">{count} detections</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Techniques */}
                  <div className="space-y-0.5 mt-1">
                    {(TECHNIQUE_MAP[tactic.name] || []).map((tech) => {
                      const techCount = getDetectionCount(tech.id);
                      const hasPb = hasPlaybook(tech.id);
                      
                      return (
                        <Tooltip key={tech.id}>
                          <TooltipTrigger asChild>
                            <div 
                              className={cn(
                                "p-1.5 rounded border border-transparent transition-all cursor-pointer",
                                getHeatColor(techCount),
                                techCount > 0 ? "hover:border-primary" : "hover:border-border",
                                hasPb ? "ring-1 ring-green-500/30" : ""
                              )}
                              onClick={() => openMitrePage(tech.id)}
                            >
                              <div className="text-[9px] font-mono text-center truncate">
                                {tech.id}
                              </div>
                              {expanded && (
                                <div className="text-[8px] text-center truncate text-muted-foreground mt-0.5">
                                  {tech.name}
                                </div>
                              )}
                              {techCount > 0 && (
                                <div className={cn(
                                  "text-[10px] font-bold text-center mt-0.5",
                                  getTextColor(techCount)
                                )}>
                                  {techCount}
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="font-semibold">{tech.id} - {tech.name}</p>
                            <p className="text-xs text-muted-foreground">{techCount} detections</p>
                            {hasPb && (
                              <Badge className="mt-1 bg-green-500/20 text-green-400 text-[10px]">
                                Has Playbook
                              </Badge>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-4 h-4 rounded bg-muted/30" />
              <span className="text-muted-foreground">0</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-4 h-4 rounded bg-cyan-500/30" />
              <span className="text-muted-foreground">1-2</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-4 h-4 rounded bg-cyan-500/50" />
              <span className="text-muted-foreground">3-5</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-4 h-4 rounded bg-orange-500/50" />
              <span className="text-muted-foreground">6-10</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-4 h-4 rounded bg-red-500/60" />
              <span className="text-muted-foreground">10+</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs ml-4">
              <div className="w-4 h-4 rounded ring-1 ring-green-500/50 bg-muted/30" />
              <span className="text-muted-foreground">Has Playbook</span>
            </div>
          </div>
        </div>
      </TooltipProvider>

      {/* Expanded overlay backdrop */}
      {expanded && (
        <div 
          className="fixed inset-0 bg-background/80 -z-10"
          onClick={() => setExpanded(false)}
        />
      )}
    </div>
  );
}
