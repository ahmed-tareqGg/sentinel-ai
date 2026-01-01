import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Ticket, Send, Paperclip, MessageSquare } from "lucide-react";
import { Incident } from "@/types/incident";
import { useState } from "react";

interface TicketingPanelProps {
    incident: Incident;
}

export function TicketingPanel({ incident }: TicketingPanelProps) {
    const [comments, setComments] = useState([
        { id: 1, author: "ServiceNow System", text: "Incident ticket created automatically by SOCMind.", time: "10:32 AM" },
        { id: 2, author: "L1 Analyst", text: "Acknowledged. Analysis in progress.", time: "10:35 AM" }
    ]);
    const [newComment, setNewComment] = useState("");

    const handleSend = () => {
        if (!newComment.trim()) return;
        setComments([...comments, {
            id: comments.length + 1,
            author: "Start Analyst", // Mock current user
            text: newComment,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        setNewComment("");
    };

    return (
        <div className="h-full flex flex-col bg-card/30 border-l border-border/50">
            {/* Header */}
            <div className="p-4 border-b border-border/50 bg-secondary/20">
                <div className="flex items-center gap-2 mb-2">
                    <Ticket className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">ServiceNow Ticket</h3>
                </div>

                {incident.ticket ? (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-lg font-bold text-foreground">{incident.ticket.id}</span>
                            <Badge variant={incident.ticket.status === 'Open' ? 'default' : 'secondary'}>
                                {incident.ticket.status}
                            </Badge>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Priority: <span className="font-medium text-foreground">{incident.ticket.priority}</span></span>
                            <a href={incident.ticket.url} className="text-primary hover:underline" target="_blank">View in SNOW</a>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-4 border border-dashed border-border rounded-lg">
                        <span className="text-sm text-muted-foreground">No ticket linked</span>
                        <Button variant="link" size="sm">Create Ticket</Button>
                    </div>
                )}
            </div>

            {/* Connection Status */}
            <div className="bg-emerald-500/10 px-4 py-1.5 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">Live Sync Active</span>
            </div>

            {/* Activity Feed */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                    {comments.map(comment => (
                        <div key={comment.id} className="flex gap-3">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                                {comment.author.charAt(0)}
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-foreground">{comment.author}</span>
                                    <span className="text-[10px] text-muted-foreground">{comment.time}</span>
                                </div>
                                <p className="text-sm text-foreground/90 bg-muted/40 p-2 rounded-br-lg rounded-bl-lg rounded-tr-lg">
                                    {comment.text}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t border-border/50 bg-background/50">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <Paperclip className="w-4 h-4" />
                    </Button>
                    <Input
                        placeholder="Add internal note..."
                        className="h-9 bg-muted/50 border-transparent focus-visible:bg-background"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <Button size="icon" className="h-9 w-9" onClick={handleSend}>
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
