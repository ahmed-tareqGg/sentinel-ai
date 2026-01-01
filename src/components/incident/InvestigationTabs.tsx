import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Activity,
    Zap,
    ShieldAlert,
    Globe,
    Hash,
    File,
    Eye,
    Terminal,
    Box
} from "lucide-react";
import { Incident } from "@/types/incident";
import { cn } from "@/lib/utils";

interface InvestigationTabsProps {
    incident: Incident;
}

export function InvestigationTabs({ incident }: InvestigationTabsProps) {
    return (
        <div className="h-full flex flex-col bg-card/30 border-r border-border/50">
            <Tabs defaultValue="ai-analysis" className="flex-1 flex flex-col w-full h-full">
                <div className="px-4 pt-4">
                    <TabsList className="w-full grid grid-cols-4 bg-secondary/50">
                        <TabsTrigger value="ai-analysis">AI</TabsTrigger>
                        <TabsTrigger value="timeline">Time</TabsTrigger>
                        <TabsTrigger value="evidence">IOCs</TabsTrigger>
                        <TabsTrigger value="raw">Raw</TabsTrigger>
                    </TabsList>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                        {/* AI Analysis Tab */}
                        <TabsContent value="ai-analysis" className="mt-0 space-y-6 animate-in fade-in-50 duration-300">

                            {/* AI Summary Card */}
                            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 relative overflow-hidden">
                                <div className="flex items-center gap-2 mb-3 text-primary font-semibold">
                                    <Zap className="w-4 h-4" />
                                    <h3>AI Investigation Summary</h3>
                                </div>
                                <p className="text-sm text-foreground/90 leading-relaxed">
                                    {incident.aiSummary}
                                </p>
                                <div className="mt-4 flex gap-4">
                                    <div className="space-y-1">
                                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Confidence</div>
                                        <div className="text-xl font-bold font-mono text-primary">{incident.confidence}%</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Risk Score</div>
                                        <div className={cn("text-xl font-bold font-mono", incident.riskScore > 80 ? "text-red-500" : "text-yellow-500")}>
                                            {incident.riskScore}/100
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* MITRE Matrix */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <ShieldAlert className="w-3.5 h-3.5" />
                                    MITRE ATT&CK Detected
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {incident.mitreTechniques.map(tech => (
                                        <Badge key={tech.id} variant="outline" className="bg-background/50 hover:bg-background transition-colors gap-1.5 py-1.5">
                                            <span className="text-muted-foreground border-r border-border pr-1.5 mr-0.5">{tech.id}</span>
                                            <span className="font-medium">{tech.name}</span>
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            {/* Recommended Actions */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <ShieldAlert className="w-3.5 h-3.5" />
                                    Recommended Actions
                                </h4>
                                <div className="grid gap-2">
                                    {incident.recommendedActions && incident.recommendedActions.length > 0 ? (
                                        incident.recommendedActions.map((action, idx) => (
                                            <div key={idx} className="flex items-start gap-3 p-3 bg-secondary/30 border border-border/50 rounded-lg text-sm text-foreground/90">
                                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary ring-1 ring-primary/30">
                                                    {idx + 1}
                                                </span>
                                                {action}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">No automated actions recommended.</p>
                                    )}
                                </div>
                            </div>

                            {/* JSON Details (Dynamic) */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Activity className="w-3.5 h-3.5" />
                                    Analysis Details
                                </h4>
                                <pre className="bg-muted/50 p-4 rounded-lg text-[10px] font-mono whitespace-pre-wrap break-all border border-border/50">
                                    {JSON.stringify({
                                        reason: incident.analysis?.reason,
                                        evidence: incident.analysis?.evidence,
                                        confidence: incident.confidence,
                                        risk_level: incident.severity,
                                        classification: incident.analysis?.classification,
                                        mitre_techniques: incident.mitreTechniques,
                                        kill_chain_phase: incident.analysis?.killChainPhase
                                    }, null, 2)}
                                </pre>
                            </div>
                        </TabsContent>

                        {/* Timeline Tab */}
                        <TabsContent value="timeline" className="mt-0 h-full">
                            <div className="relative pl-4 border-l border-border/50 ml-2 space-y-8 py-2">
                                {incident.timeline.map((event, idx) => (
                                    <div key={event.id} className="relative">
                                        <span className={cn(
                                            "absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-background",
                                            event.actor === 'AI' ? "bg-purple-500" :
                                                event.actor === 'User' ? "bg-blue-500" : "bg-zinc-500"
                                        )} />
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="font-mono">{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                                                    {event.actor}
                                                </Badge>
                                            </div>
                                            <p className="text-sm font-medium text-foreground">{event.action}</p>
                                            {event.details && (
                                                <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-border/50 mt-1">
                                                    {event.details}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>

                        {/* Evidence Tab */}
                        <TabsContent value="evidence" className="mt-0 space-y-3">
                            {incident.evidence.map(item => (
                                <div key={item.id} className="group flex items-center justify-between p-3 rounded-lg border border-border bg-card/50 hover:bg-card hover:border-primary/20 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "p-2 rounded-md bg-secondary text-secondary-foreground",
                                            item.verdict === 'Malicious' && "bg-red-500/10 text-red-500",
                                            item.verdict === 'Suspicious' && "bg-orange-500/10 text-orange-500"
                                        )}>
                                            {item.type === 'IP' && <Globe className="w-4 h-4" />}
                                            {item.type === 'Hash' && <Hash className="w-4 h-4" />}
                                            {item.type === 'File' && <File className="w-4 h-4" />}
                                        </div>
                                        <div className="space-y-0.5">
                                            <div className="font-mono text-sm font-medium">{item.value}</div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className={cn(
                                                    "font-medium",
                                                    item.verdict === 'Malicious' ? "text-red-500" :
                                                        item.verdict === 'Suspicious' ? "text-orange-500" : "text-green-500"
                                                )}>{item.verdict}</span>
                                                <span className="text-muted-foreground">•</span>
                                                <span className="text-muted-foreground">Rep: {item.reputationScore}/100</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Eye className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </TabsContent>

                        {/* Raw Logs Tab */}
                        <TabsContent value="raw" className="mt-0 space-y-4">
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Terminal className="w-3.5 h-3.5" />
                                    Raw Log Event
                                </h4>
                                <pre className="bg-black/80 p-3 rounded-lg text-[10px] font-mono text-green-400 overflow-auto max-h-[300px] border border-green-900/30">
                                    {JSON.stringify({
                                        timestamp: incident.createdAt,
                                        source_ip: "192.168.1.55",
                                        dest_port: 443,
                                        protocol: "TCP",
                                        payload_signature: "COBALT_STRIKE_BEACON_V4"
                                    }, null, 2)}
                                </pre>
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Box className="w-3.5 h-3.5" />
                                    Sandbox Analysis
                                </h4>
                                <div className="p-3 bg-muted/30 rounded border border-dashed border-border text-xs text-muted-foreground text-center">
                                    Sandbox execution completed. No behavioral anomalies in secondary stages.
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </ScrollArea>
            </Tabs>
        </div>
    );
}
