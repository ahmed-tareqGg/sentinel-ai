import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ExternalLink } from 'lucide-react';

interface Incident {
  mitre_technique?: string | null;
  mitre_tactic?: string | null;
}

interface MitreChartProps {
  incidents?: Incident[];
}

export function MitreChart({ incidents = [] }: MitreChartProps) {
  // Group incidents by MITRE technique
  const techniqueCounts = incidents.reduce((acc, incident) => {
    if (incident.mitre_technique) {
      const technique = incident.mitre_technique;
      const tactic = incident.mitre_tactic || 'Unknown';
      acc[technique] = {
        count: (acc[technique]?.count || 0) + 1,
        tactic
      };
    }
    return acc;
  }, {} as Record<string, { count: number; tactic: string }>);

  // Convert to array and sort by count
  const data = Object.entries(techniqueCounts)
    .map(([technique, { count, tactic }]) => ({ 
      technique, 
      count, 
      tactic,
      label: `${technique} - ${tactic}`
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5

  const hasData = data.length > 0;

  // Open MITRE ATT&CK page for technique
  const openMitrePage = (techniqueId: string) => {
    // Extract technique ID (e.g., T1110 from "T1110")
    const id = techniqueId.replace('.', '/');
    const url = `https://attack.mitre.org/techniques/${id}/`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Top MITRE ATT&CK Techniques</h3>
        <a 
          href="https://attack.mitre.org/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-cyan-400 flex items-center gap-1 transition-colors"
        >
          MITRE ATT&CK <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      
      {hasData ? (
        <div className="space-y-3">
          {data.map((item, index) => (
            <div 
              key={item.technique}
              onClick={() => openMitrePage(item.technique)}
              className="group cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">
                    {item.technique}
                  </span>
                  <span className="text-xs text-muted-foreground">{item.tactic}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{item.count}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all group-hover:from-cyan-400 group-hover:to-cyan-300"
                  style={{ width: `${(item.count / data[0].count) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          No MITRE ATT&CK data yet
        </div>
      )}
    </div>
  );
}
