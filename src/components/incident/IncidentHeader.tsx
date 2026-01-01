import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Shield, User, ExternalLink, AlertTriangle, CheckCircle, Smartphone, MoreHorizontal } from "lucide-react";
import { Incident } from "@/types/incident";
import { cn } from "@/lib/utils";

interface IncidentHeaderProps {
    incident: Incident;
    onAction: (action: string) => void;
}

export function IncidentHeader({ incident, onAction }: IncidentHeaderProps) {
    const severityColor = {
        'Critical': 'text-red-500 bg-red-500/10 border-red-500/20',
        'High': 'text-orange-500 bg-orange-500/10 border-orange-500/20',
        'Medium': 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
        'Low': 'text-green-500 bg-green-500/10 border-green-500/20',
    }[incident.severity];

    const statusColor = {
        'Open': 'text-blue-500',
        'In Progress': 'text-yellow-500',
        'Contained': 'text-purple-500',
        'Closed': 'text-green-500',
    }[incident.status];

    return (
        <header className="border-b border-border bg-card/50 backdrop-blur-sm p-4 sticky top-0 z-10">
            <div className="flex flex-col md:flex-row justify-between gap-4">
                {/* Left: Identity */}
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground">
                            {incident.incidentNumber}
                        </h1>
                        <Badge variant="outline" className={cn("uppercase text-xs font-bold", severityColor)}>
                            {incident.severity}
                        </Badge>
                        <Badge variant="outline" className="bg-secondary text-secondary-foreground">
                            {incident.status}
                        </Badge>
                    </div>
                    <h2 className="text-muted-foreground text-sm font-medium flex items-center gap-2">
                        {incident.title}
                    </h2>
                </div>

                {/* Center: Meta Stats */}
                <div className="flex items-center gap-6 text-sm text-muted-foreground hidden md:flex">
                    <div className="flex flex-col items-center">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground/70">Assigned To</span>
                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                            <User className="w-3.5 h-3.5" />
                            {incident.assignedTo}
                        </div>
                    </div>
                    <div className="h-8 w-px bg-border/50" />
                    <div className="flex flex-col items-center">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground/70">SLA Timer</span>
                        <div className="flex items-center gap-1.5 text-foreground font-medium font-mono">
                            <Clock className="w-3.5 h-3.5" />
                            {(() => {
                                const diff = Math.max(0, Date.now() - new Date(incident.createdAt).getTime());
                                const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
                                const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
                                const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
                                return `${hours}:${minutes}:${seconds}`;
                            })()}
                        </div>
                    </div>
                    <div className="h-8 w-px bg-border/50" />
                    {incident.ticket && (
                        <div className="flex flex-col items-center">
                            <span className="text-xs uppercase tracking-wider text-muted-foreground/70">Ticket</span>
                            <a href="#" className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors font-medium">
                                <ExternalLink className="w-3.5 h-3.5" />
                                {incident.ticket.id}
                            </a>
                        </div>
                    )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => onAction('assign')}>
                        Assign
                    </Button>
                    <Button variant="outline" size="sm" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20" onClick={() => onAction('escalate')}>
                        Escalate
                    </Button>
                    <Button variant="default" size="sm" onClick={() => onAction('close')}>
                        Close Incident
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </header>
    );
}
