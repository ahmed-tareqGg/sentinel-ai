import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Incident } from "@/types/incident";
import { AlertCircle, Ban, Play, Lock, UserX, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ActionsPanelProps {
    incident: Incident;
}

export function ActionsPanel({ incident }: ActionsPanelProps) {
    const [simulationMode, setSimulationMode] = useState(true);
    const [role, setRole] = useState<'Tier 1' | 'Tier 2' | 'Tier 3'>('Tier 2'); // Mock role switcher

    const handleAction = (actionName: string, impact: string) => {
        if (simulationMode) {
            toast.info(`SIMULATION: ${actionName}`, {
                description: `Expected Impact: ${impact}`,
                icon: <Play className="w-4 h-4 text-blue-500" />
            });
        } else {
            toast.error("Action Blocked", {
                description: "Real execution is disabled in this demo.",
            });
        }
    };

    return (
        <div className="bg-card border-t border-border p-4">
            {/* Controls Bar */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-secondary/50 p-1.5 rounded-lg border border-border/50">
                        <span className="text-xs font-medium px-2 text-muted-foreground">View As:</span>
                        <select
                            className="bg-transparent text-sm font-bold outline-none cursor-pointer"
                            value={role}
                            onChange={(e) => setRole(e.target.value as any)}
                        >
                            <option>Tier 1</option>
                            <option>Tier 2</option>
                            <option>Tier 3</option>
                        </select>
                    </div>

                    <div className="h-6 w-px bg-border" />

                    <div className="flex items-center gap-2">
                        <Switch
                            id="simulation-mode"
                            checked={simulationMode}
                            onCheckedChange={setSimulationMode}
                        />
                        <label htmlFor="simulation-mode" className="text-sm font-medium cursor-pointer select-none">
                            Simulation Mode
                        </label>
                        {simulationMode && (
                            <span className="text-[10px] text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20">
                                SAFE
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Buttons Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {/* Tier 1 Actions */}
                {(role === 'Tier 1' || role === 'Tier 2' || role === 'Tier 3') && (
                    <>
                        <Button variant="outline" className="justify-start" onClick={() => handleAction("Add Note", "Adds an entry to the timeline")}>
                            <FileText className="w-4 h-4 mr-2" />
                            Add Note
                        </Button>
                        <Button variant="outline" className="justify-start text-red-500 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleAction("Escalate", "Flags incident for Tier 2 review")}>
                            <AlertCircle className="w-4 h-4 mr-2" />
                            Escalate
                        </Button>
                    </>
                )}

                {/* Tier 2 Actions */}
                {(role === 'Tier 2' || role === 'Tier 3') && (
                    <>
                        <Button variant="outline" className="justify-start" onClick={() => handleAction("Block IP", "Adds Source IP to Firewall Blacklist")}>
                            <Ban className="w-4 h-4 mr-2" />
                            Block IP
                        </Button>
                        <Button variant="outline" className="justify-start" onClick={() => handleAction("Isolate Host", "Disconnects endpoint from network")}>
                            <Lock className="w-4 h-4 mr-2" />
                            Isolate Host
                        </Button>
                        <Button variant="outline" className="justify-start" onClick={() => handleAction("Disable User", "Suspends Active Directory account")}>
                            <UserX className="w-4 h-4 mr-2" />
                            Disable User
                        </Button>
                    </>
                )}

                {/* Tier 3 Actions */}
                {role === 'Tier 3' && (
                    <Button variant="default" className="justify-start bg-primary/90 hover:bg-primary" onClick={() => handleAction("Approve Remediation", "Executes full cleanup playbook")}>
                        <Play className="w-4 h-4 mr-2" />
                        Approve Remediation
                    </Button>
                )}
            </div>
        </div>
    );
}
