import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Incident } from "@/types/incident";
import { CheckSquare, Type, Save } from "lucide-react";
import { useState } from "react";

interface InvestigationWorkspaceProps {
    incident: Incident;
}

export function InvestigationWorkspace({ incident }: InvestigationWorkspaceProps) {
    const [items, setItems] = useState(incident.checklist || []);
    const [notes, setNotes] = useState(incident.notes || "");

    const toggleItem = (id: string) => {
        setItems(items.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
    };

    return (
        <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">

            {/* Investigation Notes */}
            <div className="space-y-3 flex-1 min-h-[300px]">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Type className="w-4 h-4 text-primary" />
                        Manual Investigation
                    </h3>
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                        <Save className="w-3.5 h-3.5 mr-1.5" />
                        Auto-saved
                    </Button>
                </div>
                <div className="h-full relative font-mono text-sm">
                    <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full h-full min-h-[300px] resize-none bg-background/50 leading-relaxed p-4"
                        placeholder="# Investigation Hypothesis\n\n- [ ] Observed unusual outbound traffic\n- [ ] Verified source IP reputation..."
                    />
                </div>
            </div>

            {/* Checklist */}
            <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-primary" />
                    Response Checklist
                </h3>
                <div className="grid grid-cols-1 gap-2 bg-card/40 p-4 rounded-lg border border-border/50">
                    {items.map(item => (
                        <div key={item.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded transition-colors group">
                            <Checkbox
                                id={item.id}
                                checked={item.checked}
                                onCheckedChange={() => toggleItem(item.id)}
                            />
                            <label
                                htmlFor={item.id}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer w-full"
                            >
                                {item.label}
                            </label>
                        </div>
                    ))}
                    {items.length === 0 && (
                        <p className="text-sm text-muted-foreground italic">No checklist items defined for this incident type.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
