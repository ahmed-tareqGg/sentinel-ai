import { useState } from 'react';
import { Copy, Shield, Lock, Database, UserX, AlertTriangle, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PlaybookTemplate {
  id: string;
  name: string;
  description: string;
  icon: typeof Shield;
  color: string;
  conditions: Record<string, any>;
  actions: Array<{ type: string; params?: Record<string, any> }>;
}

const PLAYBOOK_TEMPLATES: PlaybookTemplate[] = [
  {
    id: 'malware-containment',
    name: 'Malware Containment',
    description: 'Automatically isolate infected hosts and block malicious IPs when malware is detected',
    icon: Shield,
    color: 'text-red-500',
    conditions: {
      classification: 'True Positive',
      risk_level: 'Critical',
      event_type: 'malware',
    },
    actions: [
      { type: 'notify_slack', params: { message: '🚨 MALWARE DETECTED: Immediate containment initiated' } },
      { type: 'isolate_host' },
      { type: 'block_ip' },
      { type: 'create_ticket' },
      { type: 'escalate', params: { team: 'Incident Response Team' } },
    ],
  },
  {
    id: 'brute-force-response',
    name: 'Brute Force Response',
    description: 'Block attacking IPs and notify security team when brute force attacks are detected',
    icon: Lock,
    color: 'text-orange-500',
    conditions: {
      min_severity: 4,
      event_type: 'authentication',
    },
    actions: [
      { type: 'block_ip' },
      { type: 'notify_slack', params: { message: '🔐 Brute force attack detected and blocked' } },
      { type: 'create_ticket' },
    ],
  },
  {
    id: 'data-exfiltration',
    name: 'Data Exfiltration Response',
    description: 'Immediate response to potential data theft with host isolation and forensic analysis',
    icon: Database,
    color: 'text-purple-500',
    conditions: {
      risk_level: 'Critical',
      event_type: 'exfiltration',
    },
    actions: [
      { type: 'notify_slack', params: { message: '⚠️ DATA EXFILTRATION ALERT: Immediate investigation required' } },
      { type: 'isolate_host' },
      { type: 'block_ip' },
      { type: 'escalate', params: { team: 'Data Security Team' } },
    ],
  },
  {
    id: 'suspicious-login',
    name: 'Suspicious Login Investigation',
    description: 'Investigate and respond to suspicious login attempts from unusual locations',
    icon: UserX,
    color: 'text-yellow-500',
    conditions: {
      min_severity: 3,
      classification: 'True Positive',
      event_type: 'login',
    },
    actions: [
      { type: 'notify_slack', params: { message: '🔍 Suspicious login detected - investigation initiated' } },
      { type: 'disable_user' },
      { type: 'create_ticket' },
    ],
  },
  {
    id: 'false-positive-autoclose',
    name: 'False Positive Auto-Close',
    description: 'Automatically close and document incidents classified as false positives',
    icon: AlertTriangle,
    color: 'text-green-500',
    conditions: {
      classification: 'False Positive',
    },
    actions: [
      { type: 'create_ticket' },
    ],
  },
];

interface PlaybookTemplatesProps {
  onTemplateApplied?: () => void;
}

export function PlaybookTemplates({ onTemplateApplied }: PlaybookTemplatesProps) {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedPlaybook, setGeneratedPlaybook] = useState<PlaybookTemplate | null>(null);

  const applyTemplate = async (template: PlaybookTemplate) => {
    setApplying(template.id);
    try {
      const { error } = await supabase.from('playbooks').insert({
        name: template.name,
        description: template.description,
        is_active: true,
        conditions: template.conditions,
        actions: template.actions,
      } as any);

      if (error) throw error;

      toast.success(`Created playbook: ${template.name}`);
      onTemplateApplied?.();
      setOpen(false);
    } catch (error) {
      console.error('Failed to apply template:', error);
      toast.error('Failed to create playbook from template');
    } finally {
      setApplying(null);
    }
  };

  const generateAIPlaybook = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please describe the playbook you want to create');
      return;
    }

    setGenerating(true);
    setGeneratedPlaybook(null);

    try {
      const response = await supabase.functions.invoke('generate-playbook', {
        body: { prompt: aiPrompt },
      });

      if (response.error) throw response.error;

      const generated = response.data;
      setGeneratedPlaybook({
        id: 'ai-generated',
        name: generated.name || 'AI Generated Playbook',
        description: generated.description || aiPrompt,
        icon: Sparkles,
        color: 'text-primary',
        conditions: generated.conditions || {},
        actions: generated.actions || [],
      });

      toast.success('Playbook generated successfully!');
    } catch (error) {
      console.error('AI generation failed:', error);
      toast.error('Failed to generate playbook. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Copy className="h-4 w-4" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Playbook Templates</DialogTitle>
          <DialogDescription>
            Choose from pre-built templates or generate a custom playbook with AI
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="templates" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="templates" className="flex-1">Pre-built Templates</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1">
              <Sparkles className="h-4 w-4 mr-2" />
              AI Generator
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {PLAYBOOK_TEMPLATES.map((template) => {
                const Icon = template.icon;
                return (
                  <Card key={template.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded-lg bg-secondary", template.color)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {template.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">CONDITIONS</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(template.conditions).map(([key, value]) => (
                            <Badge key={key} variant="outline" className="text-xs">
                              {key}: {value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">ACTIONS</p>
                        <div className="flex flex-wrap gap-1">
                          {template.actions.map((action, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {action.type.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        onClick={() => applyTemplate(template)}
                        disabled={applying === template.id}
                        className="w-full mt-2"
                        size="sm"
                      >
                        {applying === template.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Use Template
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="ai" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Describe your playbook in natural language</Label>
              <Textarea
                placeholder="Example: If malware is detected with high confidence on a server, isolate the host immediately, block the source IP, create a ticket, and notify the incident response team via Slack."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="min-h-[120px]"
              />
              <Button
                onClick={generateAIPlaybook}
                disabled={generating || !aiPrompt.trim()}
                className="w-full"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Playbook
                  </>
                )}
              </Button>
            </div>

            {generatedPlaybook && (
              <Card className="border-primary/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{generatedPlaybook.name}</CardTitle>
                  </div>
                  <CardDescription>{generatedPlaybook.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">CONDITIONS</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(generatedPlaybook.conditions).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="text-xs">
                          {key}: {String(value)}
                        </Badge>
                      ))}
                      {Object.keys(generatedPlaybook.conditions).length === 0 && (
                        <span className="text-xs text-muted-foreground">No specific conditions</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">ACTIONS</p>
                    <div className="flex flex-wrap gap-1">
                      {generatedPlaybook.actions.map((action, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {action.type.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={() => applyTemplate(generatedPlaybook)}
                    disabled={applying === 'ai-generated'}
                    className="w-full"
                  >
                    {applying === 'ai-generated' ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create This Playbook'
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-sm font-medium mb-2">💡 Tips for AI Generation</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Be specific about trigger conditions (risk level, severity, event type)</li>
                <li>• Mention specific actions you want (block IP, isolate host, notify Slack)</li>
                <li>• Include who should be notified or escalated to</li>
                <li>• Describe the scenario clearly (malware, brute force, data theft, etc.)</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
