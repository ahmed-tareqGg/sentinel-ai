import { useState } from 'react';
import { Play, Eye, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PlaybookAction {
  type: string;
  params?: Record<string, any>;
}

interface Playbook {
  id: string;
  name: string;
  description: string | null;
  conditions: Record<string, any>;
  actions: PlaybookAction[];
}

interface Incident {
  id: string;
  incident_number: string;
  event_type: string;
  severity: number;
  risk_level: string | null;
  classification: string | null;
  src_ip: string | null;
  message: string | null;
}

interface SimulationResult {
  action: string;
  wouldExecute: boolean;
  impact: string;
  details: string;
}

const ACTION_IMPACTS: Record<string, { severity: 'low' | 'medium' | 'high'; impact: string }> = {
  notify_slack: { severity: 'low', impact: 'Sends notification to Slack channel' },
  block_ip: { severity: 'high', impact: 'Blocks IP at firewall level - may affect legitimate traffic' },
  isolate_host: { severity: 'high', impact: 'Disconnects host from network - causes service disruption' },
  disable_user: { severity: 'high', impact: 'Disables user account - affects user access' },
  create_ticket: { severity: 'low', impact: 'Creates support ticket for tracking' },
  escalate: { severity: 'medium', impact: 'Notifies leadership team for immediate attention' },
};

interface SimulationModeProps {
  playbooks: Playbook[];
  incidents: Incident[];
}

export function SimulationMode({ playbooks, incidents }: SimulationModeProps) {
  const [open, setOpen] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState<string>('');
  const [selectedIncident, setSelectedIncident] = useState<string>('');
  const [simulating, setSimulating] = useState(false);
  const [results, setResults] = useState<SimulationResult[]>([]);

  const runSimulation = async () => {
    if (!selectedPlaybook || !selectedIncident) {
      toast.error('Please select both a playbook and an incident');
      return;
    }

    setSimulating(true);
    setResults([]);

    try {
      const playbook = playbooks.find(p => p.id === selectedPlaybook);
      const incident = incidents.find(i => i.id === selectedIncident);

      if (!playbook || !incident) {
        throw new Error('Playbook or incident not found');
      }

      // Check if conditions match
      let conditionsMet = true;
      const conditionChecks: string[] = [];

      if (playbook.conditions.risk_level && playbook.conditions.risk_level !== incident.risk_level) {
        conditionsMet = false;
        conditionChecks.push(`Risk level mismatch: requires ${playbook.conditions.risk_level}, got ${incident.risk_level}`);
      }
      if (playbook.conditions.classification && playbook.conditions.classification !== incident.classification) {
        conditionsMet = false;
        conditionChecks.push(`Classification mismatch: requires ${playbook.conditions.classification}, got ${incident.classification}`);
      }
      if (playbook.conditions.min_severity && incident.severity < playbook.conditions.min_severity) {
        conditionsMet = false;
        conditionChecks.push(`Severity too low: requires ${playbook.conditions.min_severity}+, got ${incident.severity}`);
      }
      if (playbook.conditions.event_type && !incident.event_type.toLowerCase().includes(playbook.conditions.event_type.toLowerCase())) {
        conditionsMet = false;
        conditionChecks.push(`Event type mismatch: requires "${playbook.conditions.event_type}", got "${incident.event_type}"`);
      }

      // Generate simulation results
      const simulatedResults: SimulationResult[] = playbook.actions.map(action => {
        const impactInfo = ACTION_IMPACTS[action.type] || { severity: 'medium', impact: 'Unknown action' };
        
        return {
          action: action.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          wouldExecute: conditionsMet,
          impact: impactInfo.impact,
          details: action.type === 'notify_slack' 
            ? `Message: "${action.params?.message || 'Default notification'}"`
            : action.type === 'block_ip'
            ? `Target IP: ${incident.src_ip || 'Unknown'}`
            : action.type === 'isolate_host'
            ? `Target Host: ${incident.src_ip || 'Unknown'}`
            : action.type === 'escalate'
            ? `Team: ${action.params?.team || 'SOC Leadership'}`
            : 'Standard execution',
        };
      });

      // Add condition check results
      if (!conditionsMet) {
        setResults([
          {
            action: 'Condition Check',
            wouldExecute: false,
            impact: 'Playbook conditions not met',
            details: conditionChecks.join('; '),
          },
          ...simulatedResults,
        ]);
      } else {
        setResults(simulatedResults);
      }

      toast.success('Simulation complete');
    } catch (error) {
      console.error('Simulation failed:', error);
      toast.error('Failed to run simulation');
    } finally {
      setSimulating(false);
    }
  };

  const getImpactColor = (action: string) => {
    const actionKey = action.toLowerCase().replace(/\s/g, '_');
    const impact = ACTION_IMPACTS[actionKey];
    if (!impact) return 'text-muted-foreground';
    switch (impact.severity) {
      case 'high': return 'text-destructive';
      case 'medium': return 'text-warning';
      default: return 'text-green-500';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Eye className="h-4 w-4" />
          Simulate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Playbook Simulation Mode</DialogTitle>
          <DialogDescription>
            Test playbook execution without taking real actions. See expected behavior and impact.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selection */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Select Playbook</Label>
              <Select value={selectedPlaybook} onValueChange={setSelectedPlaybook}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a playbook" />
                </SelectTrigger>
                <SelectContent>
                  {playbooks.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Select Incident</Label>
              <Select value={selectedIncident} onValueChange={setSelectedIncident}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an incident" />
                </SelectTrigger>
                <SelectContent>
                  {incidents.slice(0, 20).map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.incident_number} - {i.event_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={runSimulation}
            disabled={simulating || !selectedPlaybook || !selectedIncident}
            className="w-full"
          >
            {simulating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Simulation...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Simulation
              </>
            )}
          </Button>

          {/* Results */}
          {results.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Simulation Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.map((result, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border",
                      result.wouldExecute 
                        ? "border-green-500/30 bg-green-500/5" 
                        : "border-muted bg-secondary/30"
                    )}
                  >
                    <div className="mt-0.5">
                      {result.wouldExecute ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{result.action}</span>
                        <Badge variant={result.wouldExecute ? "default" : "secondary"} className="text-xs">
                          {result.wouldExecute ? 'Would Execute' : 'Skipped'}
                        </Badge>
                      </div>
                      <p className={cn("text-xs", getImpactColor(result.action))}>
                        {result.impact}
                      </p>
                      <p className="text-xs text-muted-foreground">{result.details}</p>
                    </div>
                  </div>
                ))}

                {results.some(r => r.wouldExecute) && (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                    <div className="flex items-center gap-2 text-warning">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Simulation Only</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      No actual actions were taken. This shows what would happen if the playbook were executed.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Legend */}
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <p className="text-sm font-medium mb-2">Impact Levels</p>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span>Low Impact</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-warning" />
                <span>Medium Impact</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                <span>High Impact</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
