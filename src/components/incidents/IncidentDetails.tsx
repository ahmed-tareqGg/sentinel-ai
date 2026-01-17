import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp, FileText, AlignLeft } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface IncidentDetailsProps {
    description: string | null;
}

export function IncidentDetails({ description }: IncidentDetailsProps) {
    const [isOpen, setIsOpen] = useState(true);

    if (!description) return null;

    return (
        <Card className="bg-card border-border overflow-hidden">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="py-4 px-6 flex flex-row items-center justify-between space-y-0 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setIsOpen(!isOpen)}>
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                        <AlignLeft className="h-4 w-4 text-primary" />
                        Incident Description & Context
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="w-9 p-0">
                        {isOpen ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="sr-only">Toggle description</span>
                    </Button>
                </CardHeader>

                <CollapsibleContent>
                    <CardContent className="px-6 pb-6 pt-0">
                        <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-line border-l-2 border-primary/20 pl-4">
                            {description}
                        </div>
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}
