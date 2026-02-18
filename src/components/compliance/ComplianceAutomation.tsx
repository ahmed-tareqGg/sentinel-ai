import { useState } from 'react';
import { supabase } from '@/integrations/backend/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Zap, CheckCircle2, Clock, AlertTriangle, 
  RefreshCw, Shield, FileText, Bot, ArrowRight, Play, Target
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface AutomationResult {
  controlId: string;
  controlCode: string;
  title: string;
  action: string;
  evidence: string;
  mapped: boolean;
}

const MITRE_TO_ISO_MAPPINGS: Record<string, string[]> = {
  'T1078': ['ISO27001_A.9.2', 'ISO27001_A.9.4'],
  'T1021': ['ISO27001_A.9.4', 'ISO27001_A.13.1'],
  'T1055': ['ISO27001_A.12.2', 'ISO27001_A.12.6'],
  'T1003': ['ISO27001_A.9.2', 'ISO27001_A.9.3'],
  'T1059': ['ISO27001_A.12.6', 'ISO27001_A.12.2'],
  'T1566': ['ISO27001_A.12.2', 'ISO27001_A.7.2'],
  'T1190': ['ISO27001_A.12.6', 'ISO27001_A.14.2'],
  'T1486': ['ISO27001_A.12.3', 'ISO27001_A.12.2'],
  'T1071': ['ISO27001_A.13.1', 'ISO27001_A.13.2'],
  'T1082': ['ISO27001_A.12.1', 'ISO27001_A.8.1'],
};

interface Props {
  onRefetch?: () => void;
}

export function ComplianceAutomation({ onRefetch }: Props) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<AutomationResult[]>([]);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [stats, setStats] = useState({ mapped: 0, incidents: 0, controls: 0 });

  const runAutomation = async () => {
    setRunning(true);
    setProgress(0);
    setResults([]);

    try {
      // Step 1: Fetch recent incidents with MITRE techniques
      setProgress(15);
      const { data: incidents } = await supabase
        .from('incidents')
        .select('id, incident_number, mitre_technique, event_type, risk_level, created_at')
        .not('mitre_technique', 'is', null)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

      setProgress(35);

      // Step 2: Fetch compliance controls
      const { data: controls } = await supabase
        .from('compliance_controls')
        .select('id, control_code, title, standard, implemented')
        .order('control_code');

      setProgress(55);

      const automationResults: AutomationResult[] = [];
      let totalMapped = 0;

      // Step 3: Auto-map incidents to controls via MITRE
      if (incidents && controls) {
        for (const incident of incidents.slice(0, 20)) {
          const technique = incident.mitre_technique;
          if (!technique) continue;

          // Find matching control codes
          const mappingKey = Object.keys(MITRE_TO_ISO_MAPPINGS).find(k => 
            technique.includes(k)
          );

          if (mappingKey) {
            const controlCodes = MITRE_TO_ISO_MAPPINGS[mappingKey];
            for (const code of controlCodes) {
              const matchingControl = controls.find(c => c.control_code.includes(code.replace('ISO27001_', '')));
              if (matchingControl) {
                // Insert compliance evidence
                const { error } = await supabase
                  .from('compliance_evidence')
                  .upsert({
                    control_id: matchingControl.id,
                    evidence_type: 'incident',
                    source: 'Auto-mapped',
                    reference_id: incident.id,
                    title: `Auto-mapped: ${incident.incident_number}`,
                    description: `${incident.event_type} | MITRE: ${technique} | Risk: ${incident.risk_level}`,
                  }, { onConflict: 'id' });

                if (!error) {
                  totalMapped++;
                  automationResults.push({
                    controlId: matchingControl.id,
                    controlCode: matchingControl.control_code,
                    title: matchingControl.title,
                    action: 'Evidence linked',
                    evidence: `${incident.incident_number} → MITRE ${technique}`,
                    mapped: true,
                  });
                }
              }
            }
          }
        }
      }

      setProgress(80);

      // Step 4: Log audit entry
      await supabase.from('compliance_audit_logs').insert({
        actor_type: 'ai',
        action: 'auto_map_compliance',
        resource_type: 'compliance_control',
        result: 'success',
        details: {
          incidents_processed: incidents?.length || 0,
          controls_mapped: totalMapped,
          timestamp: new Date().toISOString(),
        },
        execution_mode: 'autonomous',
      });

      setProgress(100);
      setResults(automationResults);
      setStats({
        mapped: totalMapped,
        incidents: incidents?.length || 0,
        controls: new Set(automationResults.map(r => r.controlId)).size,
      });
      setLastRun(new Date().toISOString());

      toast.success(`Compliance automation complete: ${totalMapped} evidence items mapped`);
      onRefetch?.();
    } catch (error) {
      toast.error('Automation failed');
      console.error(error);
    } finally {
      setRunning(false);
    }
  };

  const generateAuditReport = async () => {
    // Fetch all controls + evidence
    const { data: controls } = await supabase
      .from('compliance_controls')
      .select('*, compliance_evidence(*)')
      .order('standard, control_code');

    if (!controls) return;

    const report = {
      generated_at: new Date().toISOString(),
      generator: 'SOCMind Compliance Automation Engine',
      summary: {
        total_controls: controls.length,
        implemented: controls.filter((c: any) => c.implemented).length,
        with_evidence: controls.filter((c: any) => c.compliance_evidence?.length > 0).length,
      },
      controls: controls.map((c: any) => ({
        code: c.control_code,
        title: c.title,
        standard: c.standard,
        implemented: c.implemented,
        evidence_count: c.compliance_evidence?.length || 0,
        last_review: c.last_review,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Audit report generated');
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                Compliance Automation Engine
              </CardTitle>
              <CardDescription>
                Auto-map incidents to controls via MITRE ATT&CK, generate audit evidence, track remediation
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={generateAuditReport}
              >
                <FileText className="h-3.5 w-3.5" />
                Export Report
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={runAutomation}
                disabled={running}
              >
                {running ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {running ? 'Running...' : 'Run Automation'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {running && (
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Processing incidents and mapping to controls...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Stats */}
          {lastRun && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
                <p className="text-xl font-bold text-primary">{stats.incidents}</p>
                <p className="text-[11px] text-muted-foreground">Incidents Scanned</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
                <p className="text-xl font-bold text-success">{stats.mapped}</p>
                <p className="text-[11px] text-muted-foreground">Evidence Mapped</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
                <p className="text-xl font-bold text-foreground">{stats.controls}</p>
                <p className="text-[11px] text-muted-foreground">Controls Updated</p>
              </div>
            </div>
          )}

          {/* Pipeline Steps */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { icon: Shield, label: 'Scan Incidents', color: 'text-primary' },
              { icon: Target, label: 'Match MITRE', color: 'text-orange-400' },
              { icon: ArrowRight, label: '', color: 'text-muted-foreground' },
              { icon: CheckCircle2, label: 'Map to Controls', color: 'text-green-500' },
              { icon: ArrowRight, label: '', color: 'text-muted-foreground' },
              { icon: FileText, label: 'Generate Evidence', color: 'text-blue-400' },
              { icon: ArrowRight, label: '', color: 'text-muted-foreground' },
              { icon: Bot, label: 'Audit Log', color: 'text-purple-400' },
            ].map((step, i) => (
              step.label ? (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <step.icon className={`h-3.5 w-3.5 ${step.color}`} />
                  <span className="text-muted-foreground">{step.label}</span>
                </div>
              ) : (
                <step.icon key={i} className={`h-3 w-3 ${step.color}`} />
              )
            ))}
          </div>

          {lastRun && (
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last run: {new Date(lastRun).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Auto-Mapped Results ({results.length} items)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {results.map((result, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-start gap-3 p-2 rounded-lg bg-secondary border border-border"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] h-4 px-1 font-mono">
                            {result.controlCode}
                          </Badge>
                          <span className="text-xs text-foreground truncate">{result.title}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{result.evidence}</p>
                      </div>
                      <Badge className="text-[10px] bg-primary/10 text-primary border-primary/30 shrink-0">
                        {result.action}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
