import { useMemo } from 'react';
import { Link2, GitBranch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Incident } from '@/hooks/useIncidents';

interface RelatedIncidentsBadgeProps {
  incident: Incident;
  allIncidents: Incident[];
}

export function RelatedIncidentsBadge({ incident, allIncidents }: RelatedIncidentsBadgeProps) {
  const related = useMemo(() => {
    const matches = allIncidents.filter(i => {
      if (i.id === incident.id) return false;
      // Same source IP
      if (incident.src_ip && i.src_ip === incident.src_ip) return true;
      // Same MITRE technique
      if (incident.mitre_technique && i.mitre_technique && 
          i.mitre_technique === incident.mitre_technique) return true;
      // Same destination IP
      if (incident.dst_ip && i.dst_ip === incident.dst_ip) return true;
      return false;
    });
    return matches;
  }, [incident, allIncidents]);

  if (related.length === 0) return null;

  const byIP = related.filter(r => r.src_ip === incident.src_ip || r.dst_ip === incident.dst_ip);
  const byTechnique = related.filter(r => r.mitre_technique === incident.mitre_technique);

  const tooltipLines: string[] = [];
  if (byIP.length > 0) tooltipLines.push(`${byIP.length} share same IP`);
  if (byTechnique.length > 0) tooltipLines.push(`${byTechnique.length} share same technique`);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className="gap-1 bg-violet-500/10 text-violet-400 border-violet-500/30 text-[10px] cursor-help"
        >
          <Link2 className="h-3 w-3" />
          {related.length}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-semibold mb-1">{related.length} Related Incident{related.length > 1 ? 's' : ''}</p>
        {tooltipLines.map((line, i) => (
          <p key={i} className="text-muted-foreground">{line}</p>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
