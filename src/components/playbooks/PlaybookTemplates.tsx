import { useState } from 'react';
import { Copy, Shield, Lock, Database, UserX, AlertTriangle, Sparkles, Loader2, Search, FileX } from 'lucide-react';
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
  category: 'containment' | 'investigation' | 'escalation' | 'auto-close';
  conditions: Record<string, any>;
  actions: Array<{ type: string; params?: Record<string, any> }>;
}

const PLAYBOOK_TEMPLATES: PlaybookTemplate[] = [
  // 1. Malware Containment Playbook
  {
    id: 'malware-containment',
    name: 'Malware Containment',
    description: 'Auto-isolate infected hosts and block malicious IPs when malware is detected with high confidence',
    icon: Shield,
    color: 'text-red-500',
    category: 'containment',
    conditions: {
      classification: 'True Positive',
      event_type: 'malware',
      min_severity: 4,
    },
    actions: [
      { type: 'isolate_host' },
      { type: 'block_ip' },
      { type: 'notify_slack', params: { message: '🚨 MALWARE CONTAINMENT: Host isolated, malicious IP blocked' } },
      { type: 'create_ticket' },
    ],
  },
  // 2. Brute Force Attack Response
  {
    id: 'brute-force-response',
    name: 'Brute Force Attack Response',
    description: 'Disable compromised accounts and alert SOC when brute force attacks are detected',
    icon: Lock,
    color: 'text-orange-500',
    category: 'containment',
    conditions: {
      event_type: 'authentication',
      min_severity: 4,
    },
    actions: [
      { type: 'disable_user' },
      { type: 'notify_slack', params: { message: '🔐 BRUTE FORCE: User account temporarily disabled' } },
      { type: 'escalate', params: { team: 'SOC Analysts' } },
    ],
  },
  // 3. Data Exfiltration Response
  {
    id: 'data-exfiltration',
    name: 'Data Exfiltration Response',
    description: 'Immediate response to data theft with IP blocking and executive escalation',
    icon: Database,
    color: 'text-purple-500',
    category: 'escalation',
    conditions: {
      risk_level: 'Critical',
      event_type: 'exfiltration',
    },
    actions: [
      { type: 'block_ip' },
      { type: 'notify_slack', params: { message: '⚠️ DATA EXFILTRATION ALERT: External IP blocked, executive notified' } },
      { type: 'escalate', params: { team: 'SOC Lead & CISO' } },
    ],
  },
  // 4. Suspicious Activity Investigation
  {
    id: 'suspicious-investigation',
    name: 'Suspicious Activity Investigation',
    description: 'Create investigation task without auto-containment for suspicious but unconfirmed threats',
    icon: Search,
    color: 'text-yellow-500',
    category: 'investigation',
    conditions: {
      classification: 'Pending',
      min_severity: 3,
    },
    actions: [
      { type: 'create_ticket' },
      { type: 'notify_slack', params: { message: '🔍 INVESTIGATION NEEDED: Suspicious activity requires analyst review' } },
    ],
  },
  // 5. False Positive Auto-Close
  {
    id: 'false-positive-autoclose',
    name: 'False Positive Auto-Close',
    description: 'Automatically close incidents classified as false positives with high confidence',
    icon: FileX,
    color: 'text-green-500',
    category: 'auto-close',
    conditions: {
      classification: 'False Positive',
    },
    actions: [
      { type: 'create_ticket' },
    ],
  },
  // Additional Enterprise Templates
  {
    id: 'critical-escalation',
    name: 'Critical Incident Escalation',
    description: 'Full escalation chain for critical severity incidents',
    icon: AlertTriangle,
    color: 'text-red-600',
    category: 'escalation',
    conditions: {
      risk_level: 'Critical',
      classification: 'True Positive',
    },
    actions: [
      { type: 'notify_slack', params: { message: '🚨 CRITICAL INCIDENT: Immediate response required' } },
      { type: 'isolate_host' },
      { type: 'block_ip' },
      { type: 'escalate', params: { team: 'Incident Response Team & CISO' } },
      { type: 'create_ticket' },
    ],
  },
  {
    id: 'ransomware-response',
    name: 'Ransomware Emergency Response',
    description: 'Emergency containment for ransomware attacks with immediate isolation',
    icon: Shield,
    color: 'text-red-700',
    category: 'containment',
    conditions: {
      risk_level: 'Critical',
      event_type: 'ransomware',
      min_severity: 5,
    },
    actions: [
      { type: 'isolate_host' },
      { type: 'block_ip' },
      { type: 'disable_user' },
      { type: 'notify_slack', params: { message: '🔴 RANSOMWARE EMERGENCY: All containment measures activated' } },
      { type: 'escalate', params: { team: 'Executive Team & Legal' } },
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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredTemplates = selectedCategory === 'all' 
    ? PLAYBOOK_TEMPLATES 
    : PLAYBOOK_TEMPLATES.filter(t => t.category === selectedCategory);

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

  const applyAllTemplates = async () => {
    setApplying('all');
    try {
      const playbooks = PLAYBOOK_TEMPLATES.map(template => ({
        name: template.name,
        description: template.description,
        is_active: true,
        conditions: template.conditions,
        actions: template.actions,
      }));

      const { error } = await supabase.from('playbooks').insert(playbooks as any);

      if (error) throw error;

      toast.success(`Created ${PLAYBOOK_TEMPLATES.length} playbooks`);
      onTemplateApplied?.();
      setOpen(false);
    } catch (error) {
      console.error('Failed to apply templates:', error);
      toast.error('Failed to create playbooks');
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
        category: 'containment',
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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'containment': return 'bg-red-500/10 text-red-500';
      case 'investigation': return 'bg-yellow-500/10 text-yellow-500';
      case 'escalation': return 'bg-purple-500/10 text-purple-500';
      case 'auto-close': return 'bg-green-500/10 text-green-500';
      default: return 'bg-muted text-muted-foreground';
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
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>SOAR Playbook Templates</DialogTitle>
          <DialogDescription>
            Choose from pre-built enterprise scenarios or generate custom playbooks with AI
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="templates" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="templates" className="flex-1">Pre-built Scenarios</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1">
              <Sparkles className="h-4 w-4 mr-2" />
              AI Generator
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="mt-4 space-y-4">
            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                onClick={() => setSelectedCategory('all')}
              >
                All ({PLAYBOOK_TEMPLATES.length})
              </Button>
              <Button
                size="sm"
                variant={selectedCategory === 'containment' ? 'default' : 'outline'}
                onClick={() => setSelectedCategory('containment')}
              >
                Containment
              </Button>
              <Button
                size="sm"
                variant={selectedCategory === 'investigation' ? 'default' : 'outline'}
                onClick={() => setSelectedCategory('investigation')}
              >
                Investigation
              </Button>
              <Button
                size="sm"
                variant={selectedCategory === 'escalation' ? 'default' : 'outline'}
                onClick={() => setSelectedCategory('escalation')}
              >
                Escalation
              </Button>
              <Button
                size="sm"
                variant={selectedCategory === 'auto-close' ? 'default' : 'outline'}
                onClick={() => setSelectedCategory('auto-close')}
              >
                Auto-Close
              </Button>
            </div>

            {/* Apply All Button */}
            <Button 
              onClick={applyAllTemplates} 
              disabled={applying === 'all'}
              className="w-full"
              variant="secondary"
            >
              {applying === 'all' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating All Playbooks...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Create All {PLAYBOOK_TEMPLATES.length} Playbooks
                </>
              )}
            </Button>

            <div className="grid gap-4 md:grid-cols-2">
              {filteredTemplates.map((template) => {
                const Icon = template.icon;
                return (
                  <Card key={template.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded-lg bg-secondary", template.color)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            <Badge className={cn("text-xs", getCategoryColor(template.category))}>
                              {template.category}
                            </Badge>
                          </div>
                          <CardDescription className="text-xs mt-1">
                            {template.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">TRIGGERS</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(template.conditions).map(([key, value]) => (
                            <Badge key={key} variant="outline" className="text-xs">
                              {key.replace(/_/g, ' ')}: {value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">ACTIONS ({template.actions.length})</p>
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
                placeholder="Example: If ransomware is detected on a server with critical data, immediately isolate the host, block the source IP, disable affected user accounts, and notify the incident response team and CISO via Slack. Create an emergency ticket and escalate to executives."
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
              <p className="text-sm font-medium mb-2">💡 AI Generation Tips</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Specify trigger conditions: risk level, severity, event type</li>
                <li>• List desired actions: isolate, block, notify, escalate</li>
                <li>• Mention who should be notified (SOC, CISO, executives)</li>
                <li>• Describe the threat scenario clearly</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
