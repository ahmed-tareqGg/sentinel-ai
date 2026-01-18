import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Clock, Shield, ExternalLink } from 'lucide-react';
import { Incident } from '@/lib/incidentContentUtils';

interface IncidentHeaderProps {
    incident: Incident;
    summary: string | null;
}

const severityColors: Record<number, string> = {
    1: 'bg-success/20 text-success border-success/30',
    2: 'bg-success/20 text-success border-success/30',
    3: 'bg-primary/20 text-primary border-primary/30',
    4: 'bg-warning/20 text-warning border-warning/30',
    5: 'bg-critical/20 text-critical border-critical/30',
};

const riskColors: Record<string, string> = {
    'Critical': 'bg-critical/20 text-critical border-critical/30',
    'High': 'bg-warning/20 text-warning border-warning/30',
    'Medium': 'bg-primary/20 text-primary border-primary/30',
    'Low': 'bg-success/20 text-success border-success/30',
};

export function IncidentHeader({ incident, summary }: IncidentHeaderProps) {
    return (
        <div className="space-y-3">
            {/* Title & Badges */}
            <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground font-mono">
                    {incident.incident_number}
                </h1>

                <Badge variant="outline" className={cn(riskColors[incident.risk_level])}>
                    {incident.risk_level}
                </Badge>

                <Badge variant="outline" className={cn(severityColors[incident.severity])}>
                    Severity {incident.severity}
                </Badge>

                {(() => {
                    const ai = incident.ai_analysis as any;
                    const technique = incident.mitre_technique ||
                        ai?.mitre_technique ||
                        ai?.technique ||
                        ai?.mitre_techniques?.[0]?.technique_id ||
                        ai?.mitre_techniques?.[0]?.technique;

                    const tactic = incident.mitre_tactic ||
                        ai?.mitre_tactic ||
                        ai?.tactic ||
                        ai?.mitre_techniques?.[0]?.tactic;

                    if (!technique) return null;

                    // Extract technique ID and convert sub-technique format: T1069.001 -> T1069/001
                    const techniqueIdRaw = technique.match(/(T\d+(\.\d+)?)/)?.[0] || technique;
                    const techniqueUrlPath = techniqueIdRaw.replace('.', '/');

                    return (
                        <a
                            href={`https://attack.mitre.org/techniques/${techniqueUrlPath}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:opacity-80 transition-opacity"
                            title="View on MITRE ATT&CK"
                        >
                            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 gap-1 hover:bg-primary/10 cursor-pointer">
                                {technique} {tactic ? `- ${tactic}` : ''}
                                <ExternalLink className="h-3 w-3" />
                            </Badge>
                        </a>
                    );
                })()}
            </div>

            {/* Summary (Only shown if provided) */}
            {summary && (
                <p className="text-muted-foreground max-w-2xl text-lg font-medium leading-relaxed">
                    {summary}
                </p>
            )}

            {/* Metadata Row */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {new Date(incident.created_at).toLocaleString()}
                </span>

                {(incident.src_ip || incident.dst_ip) && (
                    <span className="font-mono flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        {incident.src_ip || 'N/A'} → {incident.dst_ip || 'N/A'}
                    </span>
                )}
            </div>
        </div>
    );
}
