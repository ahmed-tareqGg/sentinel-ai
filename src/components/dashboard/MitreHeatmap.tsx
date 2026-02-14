import { useState, useEffect, useMemo } from 'react';
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

interface MitreCoverageRow {
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
      technique_name?: string;
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

// Normalize tactic names for matching
const normalizeTactic = (tactic: string): string => {
  const map: Record<string, string> = {
    'reconnaissance': 'Reconnaissance',
    'resource development': 'Resource Development',
    'initial access': 'Initial Access',
    'initial-access': 'Initial Access',
    'execution': 'Execution',
    'persistence': 'Persistence',
    'privilege escalation': 'Privilege Escalation',
    'privilege-escalation': 'Privilege Escalation',
    'defense evasion': 'Defense Evasion',
    'defense-evasion': 'Defense Evasion',
    'credential access': 'Credential Access',
    'credential-access': 'Credential Access',
    'discovery': 'Discovery',
    'lateral movement': 'Lateral Movement',
    'lateral-movement': 'Lateral Movement',
    'collection': 'Collection',
    'command and control': 'Command and Control',
    'command-and-control': 'Command and Control',
    'exfiltration': 'Exfiltration',
    'impact': 'Impact',
  };
  return map[tactic.toLowerCase()] || tactic;
};

interface TechniqueData {
  id: string;
  name: string;
  count: number;
  hasPlaybook: boolean;
}

export function MitreHeatmap({ incidents = [], showTitle = true, compact = false }: MitreHeatmapProps) {
  const [coverage, setCoverage] = useState<MitreCoverageRow[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [hoveredTactic, setHoveredTactic] = useState<string | null>(null);

  useEffect(() => {
    const fetchCoverage = async () => {
      const { data } = await supabase
        .from('mitre_coverage')
        .select('*');
      if (data) setCoverage(data as MitreCoverageRow[]);
    };
    fetchCoverage();
  }, []);

  // Build dynamic technique map from coverage DB + incidents
  const techniquesByTactic = useMemo(() => {
    const map: Record<string, Map<string, TechniqueData>> = {};
    TACTICS.forEach(t => { map[t.name] = new Map(); });

    // 1. Add from mitre_coverage table
    coverage.forEach(row => {
      const tactic = normalizeTactic(row.tactic);
      if (!map[tactic]) return;
      const existing = map[tactic].get(row.technique_id);
      if (existing) {
        existing.count = Math.max(existing.count, row.detection_count || 0);
        existing.hasPlaybook = existing.hasPlaybook || row.has_playbook;
        if (row.technique_name && row.technique_name !== 'Unknown') existing.name = row.technique_name;
      } else {
        map[tactic].set(row.technique_id, {
          id: row.technique_id,
          name: row.technique_name || row.technique_id,
          count: row.detection_count || 0,
          hasPlaybook: row.has_playbook || false,
        });
      }
    });

    // 2. Merge from incidents
    incidents.forEach(inc => {
      // Primary technique
      if (inc.mitre_technique) {
        const tactic = normalizeTactic(inc.mitre_tactic || 'Unknown');
        if (map[tactic]) {
          const existing = map[tactic].get(inc.mitre_technique);
          if (existing) {
            existing.count++;
          } else {
            map[tactic].set(inc.mitre_technique, {
              id: inc.mitre_technique,
              name: inc.mitre_technique,
              count: 1,
              hasPlaybook: false,
            });
          }
        }
      }
      // AI analysis techniques
      inc.ai_analysis?.mitre_techniques?.forEach(t => {
        const tactic = normalizeTactic(t.tactic || 'Unknown');
        if (!map[tactic]) return;
        const existing = map[tactic].get(t.technique_id);
        if (existing) {
          existing.count++;
          if (t.technique_name && t.technique_name !== 'Unknown') existing.name = t.technique_name;
        } else {
          map[tactic].set(t.technique_id, {
            id: t.technique_id,
            name: t.technique_name || t.technique_id,
            count: 1,
            hasPlaybook: false,
          });
        }
      });
    });

    // Convert to sorted arrays
    const result: Record<string, TechniqueData[]> = {};
    TACTICS.forEach(t => {
      result[t.name] = Array.from(map[t.name].values()).sort((a, b) => b.count - a.count);
    });
    return result;
  }, [coverage, incidents]);

  const getTacticCount = (tacticName: string): number => {
    return (techniquesByTactic[tacticName] || []).reduce((sum, t) => sum + t.count, 0);
  };

  const getHeatColor = (count: number): string => {
    if (count === 0) return 'bg-muted/30';
    if (count <= 2) return 'bg-cyan-500/30';
    if (count <= 5) return 'bg-cyan-500/50';
    if (count <= 10) return 'bg-orange-500/50';
    return 'bg-red-500/60';
  };

  const getTextColor = (count: number): string => {
    if (count === 0) return 'text-muted-foreground';
    if (count <= 5) return 'text-cyan-400';
    if (count <= 10) return 'text-orange-400';
    return 'text-red-400';
  };

  const getTacticHeaderColor = (count: number): string => {
    if (count === 0) return 'bg-muted/30';
    if (count <= 10) return 'bg-cyan-600/30 border-cyan-500/40';
    if (count <= 30) return 'bg-cyan-600/40 border-cyan-500/50';
    if (count <= 60) return 'bg-orange-600/30 border-orange-500/40';
    return 'bg-red-600/30 border-red-500/40';
  };

  const getTacticTextColor = (count: number): string => {
    if (count === 0) return 'text-muted-foreground';
    if (count <= 30) return 'text-cyan-400';
    if (count <= 60) return 'text-orange-400';
    return 'text-red-400';
  };

  const openMitrePage = (techniqueId: string) => {
    const id = techniqueId.replace('.', '/');
    window.open(`https://attack.mitre.org/techniques/${id}/`, '_blank');
  };

  const totalDetections = TACTICS.reduce((sum, tactic) => sum + getTacticCount(tactic.name), 0);
  const coveredTactics = TACTICS.filter(t => getTacticCount(t.name) > 0).length;

  // Max techniques in any single tactic (for grid alignment)
  const maxTechniques = Math.max(...TACTICS.map(t => (techniquesByTactic[t.name] || []).length), 0);

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
              const techniques = techniquesByTactic[tactic.name] || [];

              return (
                <div 
                  key={tactic.id}
                  className={cn(
                    "flex flex-col shrink-0",
                    expanded ? "w-28" : "w-20"
                  )}
                  onMouseEnter={() => setHoveredTactic(tactic.name)}
                  onMouseLeave={() => setHoveredTactic(null)}
                >
                  {/* Tactic Header */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        "text-center p-2 rounded-t-lg border transition-all cursor-pointer",
                        getTacticHeaderColor(count),
                        count === 0 ? "border-border" : "",
                        hoveredTactic === tactic.name ? "ring-2 ring-primary" : ""
                      )}>
                        <div className={cn(
                          "text-[10px] font-semibold truncate",
                          count > 0 ? getTacticTextColor(count) : "text-muted-foreground"
                        )}>
                          {expanded ? tactic.name : tactic.shortName}
                        </div>
                        <div className={cn(
                          "text-lg font-bold mt-1",
                          getTacticTextColor(count)
                        )}>
                          {count}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-semibold">{tactic.name}</p>
                      <p className="text-xs text-muted-foreground">{count} detections · {techniques.length} techniques</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Techniques */}
                  <div className="space-y-0.5 mt-1">
                    {techniques.map((tech) => (
                      <Tooltip key={tech.id}>
                        <TooltipTrigger asChild>
                          <div 
                            className={cn(
                              "p-1.5 rounded border border-transparent transition-all cursor-pointer",
                              getHeatColor(tech.count),
                              tech.count > 0 ? "hover:border-primary" : "hover:border-border",
                              tech.hasPlaybook ? "ring-1 ring-green-500/30" : ""
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
                            {tech.count > 0 && (
                              <div className={cn(
                                "text-[10px] font-bold text-center mt-0.5",
                                getTextColor(tech.count)
                              )}>
                                {tech.count}
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="font-semibold">{tech.id} - {tech.name}</p>
                          <p className="text-xs text-muted-foreground">{tech.count} detections</p>
                          {tech.hasPlaybook && (
                            <Badge className="mt-1 bg-green-500/20 text-green-400 text-[10px]">
                              Has Playbook
                            </Badge>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    ))}
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

      {expanded && (
        <div 
          className="fixed inset-0 bg-background/80 -z-10"
          onClick={() => setExpanded(false)}
        />
      )}
    </div>
  );
}
