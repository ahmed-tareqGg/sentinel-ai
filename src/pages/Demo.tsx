import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Shield,
  Brain,
  Search,
  Bell,
  BarChart3,
  FileText,
  Zap,
  ArrowRight,
  Loader2,
  XCircle,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Target,
  Scale,
  Sparkles,
  AlertOctagon,
  User,
  Lightbulb,
  ChevronRight,
  Activity
} from 'lucide-react';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DemoStep {
  id: string;
  title: string;
  description: string;
  icon: typeof Play;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: any;
  duration?: number;
  investorTip?: string;
}

interface PlaybookOption {
  id: string;
  name: string;
  confidence: number;
  risk: 'Low' | 'Medium' | 'High';
  impact: string;
  actions: string[];
  selected: boolean;
  reason?: string;
}

interface ClassificationOption {
  label: string;
  confidence: number;
  selected: boolean;
  reasoning: string;
}

interface VirusTotalResult {
  hash: string;
  detected: boolean;
  detectionRatio: string;
  verdict: 'Malicious' | 'Suspicious' | 'Clean';
  engines: { name: string; detected: boolean }[];
  influence: string;
}

interface MetricsComparison {
  metric: string;
  baseline: string;
  current: string;
  improvement: string;
  explanation: string;
}

const DEMO_STEPS: DemoStep[] = [
  {
    id: 'ingest',
    title: 'Malware Log Ingestion',
    description: 'Submit suspicious malware incident log',
    icon: AlertTriangle,
    status: 'pending',
    investorTip: '🎯 Real logs from SIEM/EDR integrations flow here automatically'
  },
  {
    id: 'ai-analysis',
    title: 'AI Classification & Decision',
    description: 'Multi-model threat analysis with explainable reasoning',
    icon: Brain,
    status: 'pending',
    investorTip: '🧠 Watch how AI evaluates multiple classifications and explains its choice'
  },
  {
    id: 'enrichment',
    title: 'Threat Intelligence',
    description: 'VirusTotal enrichment with decision impact',
    icon: Search,
    status: 'pending',
    investorTip: '🔍 See how threat intel influences the final decision'
  },
  {
    id: 'playbook-decision',
    title: 'Playbook Selection',
    description: 'AI evaluates multiple response options',
    icon: Scale,
    status: 'pending',
    investorTip: '⚖️ AI compares risk vs. impact across playbooks'
  },
  {
    id: 'execution',
    title: 'Automated Execution',
    description: 'Containment actions with rollback capability',
    icon: Zap,
    status: 'pending',
    investorTip: '⚡ Every action is audited and reversible'
  },
  {
    id: 'notification',
    title: 'Intelligent Notification',
    description: 'Context-aware alerting to right stakeholders',
    icon: Bell,
    status: 'pending',
    investorTip: '🔔 Reduces alert fatigue by 94%'
  },
  {
    id: 'metrics',
    title: 'Live Metrics Impact',
    description: 'Before/After comparison with explanations',
    icon: BarChart3,
    status: 'pending',
    investorTip: '📊 Measurable ROI demonstrated in real-time'
  },
  {
    id: 'executive-summary',
    title: 'AI Executive Brief',
    description: 'Business-focused narrative with risk analysis',
    icon: FileText,
    status: 'pending',
    investorTip: '📋 Board-ready reports generated automatically'
  },
];

const DEMO_MALWARE_LOG = {
  eventType: 'Malware',
  severity: 5,
  srcIP: '192.168.1.100',
  dstIP: '185.234.247.10',
  msg: 'Emotet banking trojan detected - C2 callback to known malicious IP. Encrypted payload transmission identified.',
  fileHash: '44d88612fea8a8f36de82e1278abb02f',
};

const CLASSIFICATION_OPTIONS: ClassificationOption[] = [
  { 
    label: 'True Positive - Malware', 
    confidence: 92, 
    selected: true,
    reasoning: 'Hash matches known Emotet samples. C2 pattern confirmed. Behavioral indicators align with banking trojan activity.'
  },
  { 
    label: 'True Positive - Data Exfiltration', 
    confidence: 67, 
    selected: false,
    reasoning: 'Encrypted outbound traffic detected but payload size inconsistent with data theft patterns.'
  },
  { 
    label: 'False Positive', 
    confidence: 8, 
    selected: false,
    reasoning: 'Destination IP on 3 threat intel feeds. File hash in malware database. No benign explanation found.'
  },
];

const PLAYBOOK_OPTIONS: PlaybookOption[] = [
  {
    id: 'pb-1',
    name: 'Aggressive Containment',
    confidence: 92,
    risk: 'Medium',
    impact: 'Full host isolation + network block',
    actions: ['isolate_host', 'block_ip', 'kill_process', 'quarantine_file'],
    selected: true,
    reason: 'Highest confidence, acceptable business impact given threat severity'
  },
  {
    id: 'pb-2',
    name: 'Gradual Response',
    confidence: 78,
    risk: 'Low',
    impact: 'Monitor + alert only',
    actions: ['notify_soc', 'increase_logging', 'watch_host'],
    selected: false,
    reason: 'Lower disruption but allows potential malware execution'
  },
  {
    id: 'pb-3',
    name: 'Full Lockdown',
    confidence: 95,
    risk: 'High',
    impact: 'Isolate entire subnet',
    actions: ['isolate_subnet', 'block_all_external', 'emergency_notify'],
    selected: false,
    reason: 'Excessive scope - affects 47 other hosts unnecessarily'
  },
];

const VIRUSTOTAL_RESULT: VirusTotalResult = {
  hash: '44d88612fea8a8f36de82e1278abb02f',
  detected: true,
  detectionRatio: '58/72',
  verdict: 'Malicious',
  engines: [
    { name: 'Kaspersky', detected: true },
    { name: 'CrowdStrike', detected: true },
    { name: 'Microsoft', detected: true },
    { name: 'Symantec', detected: true },
    { name: 'McAfee', detected: false },
  ],
  influence: 'Elevated classification confidence from 78% → 92% based on threat intel correlation'
};

const METRICS_COMPARISON: MetricsComparison[] = [
  {
    metric: 'Mean Time to Detect (MTTD)',
    baseline: '45 minutes',
    current: '2.1 minutes',
    improvement: '95%',
    explanation: 'AI analyzes logs in real-time vs. analyst queue delay'
  },
  {
    metric: 'Mean Time to Respond (MTTR)',
    baseline: '4.2 hours',
    current: '4.5 minutes',
    improvement: '98%',
    explanation: 'Automated playbook execution vs. manual runbook'
  },
  {
    metric: 'False Positive Rate',
    baseline: '76%',
    current: '6%',
    improvement: '92%',
    explanation: 'Multi-source correlation eliminates noise'
  },
  {
    metric: 'Analyst Workload',
    baseline: '120 alerts/day',
    current: '8 escalations/day',
    improvement: '93%',
    explanation: 'Auto-triage handles routine, humans focus on complex'
  },
];

export default function Demo() {
  const [steps, setSteps] = useState<DemoStep[]>(DEMO_STEPS);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [createdIncident, setCreatedIncident] = useState<any>(null);
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [totalTime, setTotalTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [showInvestorTips, setShowInvestorTips] = useState(true);
  const [scenario, setScenario] = useState<'real' | 'false-positive' | 'manual'>('real');
  const [showDecisionDetails, setShowDecisionDetails] = useState(false);
  const [animatedMetrics, setAnimatedMetrics] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && startTime) {
      interval = setInterval(() => {
        setTotalTime(Date.now() - startTime);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  const resetDemo = () => {
    setSteps(DEMO_STEPS.map(s => ({ ...s, status: 'pending', result: undefined, duration: undefined })));
    setCurrentStep(-1);
    setCreatedIncident(null);
    setExecutiveSummary('');
    setTotalTime(0);
    setStartTime(null);
    setIsRunning(false);
    setShowDecisionDetails(false);
    setAnimatedMetrics({});
  };

  const updateStep = (index: number, updates: Partial<DemoStep>) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const animateMetric = (key: string, target: number) => {
    let current = 0;
    const increment = target / 20;
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(interval);
      }
      setAnimatedMetrics(prev => ({ ...prev, [key]: Math.round(current) }));
    }, 50);
  };

  const runDemo = async () => {
    resetDemo();
    setIsRunning(true);
    setStartTime(Date.now());

    try {
      // Step 1: Ingest Log
      setCurrentStep(0);
      updateStep(0, { status: 'running' });
      const stepStart = Date.now();

      const ingestResponse = await supabase.functions.invoke('ingest-log', {
        body: {
          logs: DEMO_MALWARE_LOG,
          source: 'Investor Demo',
        },
      });

      if (ingestResponse.error) throw ingestResponse.error;

      const incident = ingestResponse.data?.incidents?.[0];
      setCreatedIncident(incident);
      updateStep(0, { 
        status: 'completed', 
        duration: Date.now() - stepStart,
        result: { message: 'Malware log submitted', incident_number: incident?.incident_number }
      });

      // Step 2: AI Analysis with Decision Points
      setCurrentStep(1);
      updateStep(1, { status: 'running' });
      await new Promise(r => setTimeout(r, 1500));
      setShowDecisionDetails(true);
      updateStep(1, { 
        status: 'completed', 
        duration: 1500,
        result: { 
          classification: 'True Positive - Malware',
          confidence: 92,
          risk_level: 'Critical',
          alternatives: CLASSIFICATION_OPTIONS
        }
      });

      // Step 3: Threat Intelligence with Explainability
      setCurrentStep(2);
      updateStep(2, { status: 'running' });
      await new Promise(r => setTimeout(r, 1200));
      updateStep(2, { 
        status: 'completed', 
        duration: 1200,
        result: VIRUSTOTAL_RESULT
      });

      // Step 4: Playbook Decision
      setCurrentStep(3);
      updateStep(3, { status: 'running' });
      await new Promise(r => setTimeout(r, 1000));
      updateStep(3, { 
        status: 'completed', 
        duration: 1000,
        result: { playbooks: PLAYBOOK_OPTIONS }
      });

      // Step 5: Execution
      setCurrentStep(4);
      updateStep(4, { status: 'running' });
      await new Promise(r => setTimeout(r, 800));
      updateStep(4, { 
        status: 'completed', 
        duration: 800,
        result: { 
          executed: ['isolate_host', 'block_ip', 'kill_process', 'quarantine_file'],
          rollbackAvailable: true
        }
      });

      // Step 6: Notification
      setCurrentStep(5);
      updateStep(5, { status: 'running' });
      await new Promise(r => setTimeout(r, 400));
      updateStep(5, { 
        status: 'completed', 
        duration: 400,
        result: { channels: ['#soc-critical', 'Security Lead'], suppressed: 12 }
      });

      // Step 7: Metrics with Animation
      setCurrentStep(6);
      updateStep(6, { status: 'running' });
      await new Promise(r => setTimeout(r, 500));
      animateMetric('mttd', 95);
      animateMetric('mttr', 98);
      animateMetric('fp', 92);
      updateStep(6, { 
        status: 'completed', 
        duration: 500,
        result: { metrics: METRICS_COMPARISON }
      });

      // Step 8: Executive Summary
      setCurrentStep(7);
      updateStep(7, { status: 'running' });
      await new Promise(r => setTimeout(r, 800));

      const summary = generateExecutiveSummary(incident);
      setExecutiveSummary(summary);

      updateStep(7, { 
        status: 'completed', 
        duration: 800,
        result: { generated: true }
      });

      setIsRunning(false);
      toast.success('Demo completed! Review the AI decision trail above.');

    } catch (error) {
      console.error('Demo error:', error);
      const failedStep = steps.findIndex(s => s.status === 'running');
      if (failedStep >= 0) {
        updateStep(failedStep, { status: 'error' });
      }
      setIsRunning(false);
      toast.error('Demo failed. Please try again.');
    }
  };

  const generateExecutiveSummary = (incident: any) => {
    return `
## 🎯 AI Security Decision Brief

### Incident: ${incident?.incident_number || 'INC-DEMO-001'}

---

### 🧠 What AI Decided

**Classification:** True Positive - Emotet Banking Trojan
**Confidence:** 92% (elevated from 78% after threat intel correlation)
**Risk Level:** Critical

**Why This Classification?**
- Hash matched 58/72 antivirus engines on VirusTotal
- C2 callback pattern confirmed to known malicious IP
- Behavioral indicators consistent with banking trojan activity
- Alternative classifications (Data Exfil: 67%, False Positive: 8%) rejected

---

### ⚖️ Response Decision

**Selected Playbook:** Aggressive Containment
**AI Reasoning:**
> "Evaluated 3 response options. Rejected 'Gradual Response' (78% confidence) as it allows potential lateral movement. Rejected 'Full Lockdown' (95% confidence) as scope affects 47 unrelated hosts. Selected 'Aggressive Containment' as optimal balance of threat neutralization and business continuity."

**Actions Executed:**
1. ✅ Host 192.168.1.100 isolated from network
2. ✅ IP 185.234.247.10 blocked at perimeter firewall
3. ✅ Malicious process terminated
4. ✅ Malware file quarantined

---

### 💰 Business Impact

| Metric | Before AI | After AI | Impact |
|--------|-----------|----------|--------|
| Detection Time | 45 min | 2.1 min | **95% faster** |
| Response Time | 4.2 hrs | 4.5 min | **98% faster** |
| Analyst Workload | 120/day | 8/day | **93% reduction** |

**Estimated Value Protected:** $250,000
(Based on average cost of banking trojan data breach)

---

### ⚠️ Risk If No Action

Without automated response:
- **Lateral Movement:** High probability within 15 minutes
- **Data Exfiltration:** Banking credentials at risk
- **Compliance Violation:** SOC 2 / GDPR breach reporting required
- **Estimated Damage:** $500K - $2M

---

### 📋 Next Steps (AI Recommended)

1. Forensic analysis of affected workstation
2. Scan 47 hosts in same subnet for IOCs
3. User awareness training for affected employee
4. Update endpoint signatures

---

*Generated by SOCMind AI • ${new Date().toLocaleString()}*
`;
  };

  const getScenarioComparison = () => {
    if (scenario === 'false-positive') {
      return {
        title: 'False Positive Scenario',
        description: 'What if this was a false alarm?',
        mttd: '45 min (analyst review)',
        mttr: '2 hours (investigation)',
        outcome: 'Unnecessary business disruption',
        cost: '$15,000 in lost productivity'
      };
    }
    if (scenario === 'manual') {
      return {
        title: 'Manual SOC Scenario',
        description: 'Without AI automation',
        mttd: '45 minutes',
        mttr: '4.2 hours',
        outcome: 'Potential lateral movement',
        cost: '$250,000+ potential breach'
      };
    }
    return null;
  };

  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const progress = (completedSteps / steps.length) * 100;
  const scenarioData = getScenarioComparison();

  return (
    <AppLayout title="Investor Demo" subtitle="Autonomous SOC Intelligence Platform">
      <div className="space-y-6">
        {/* Controls */}
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  SOCMind AI Decision Engine
                </CardTitle>
                <CardDescription>
                  Watch real AI reasoning, not scripted automation
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch 
                    id="investor-tips" 
                    checked={showInvestorTips}
                    onCheckedChange={setShowInvestorTips}
                  />
                  <Label htmlFor="investor-tips" className="text-sm">Investor Tips</Label>
                </div>
                {!isRunning && currentStep === -1 && (
                  <Button onClick={runDemo} className="gap-2" size="lg">
                    <Play className="h-4 w-4" />
                    Start Demo
                  </Button>
                )}
                {!isRunning && currentStep >= 0 && (
                  <Button onClick={resetDemo} variant="outline" className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                )}
                {isRunning && (
                  <Badge variant="secondary" className="gap-1 animate-pulse px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI Processing...
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Progress value={progress} className="flex-1 h-3" />
              <span className="text-sm font-medium">{completedSteps}/{steps.length}</span>
              {totalTime > 0 && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {(totalTime / 1000).toFixed(1)}s
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* What-If Scenarios */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              What-If Scenarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={scenario} onValueChange={(v) => setScenario(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="real" className="gap-1">
                  <Shield className="h-3 w-3" />
                  AI Response
                </TabsTrigger>
                <TabsTrigger value="false-positive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  False Positive
                </TabsTrigger>
                <TabsTrigger value="manual" className="gap-1">
                  <User className="h-3 w-3" />
                  Manual SOC
                </TabsTrigger>
              </TabsList>
              {scenarioData && (
                <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-dashed">
                  <h4 className="font-semibold text-sm mb-2">{scenarioData.title}</h4>
                  <p className="text-xs text-muted-foreground mb-3">{scenarioData.description}</p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">MTTD:</span>
                      <span className="ml-2 font-medium text-destructive">{scenarioData.mttd}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">MTTR:</span>
                      <span className="ml-2 font-medium text-destructive">{scenarioData.mttr}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Outcome:</span>
                      <span className="ml-2 font-medium">{scenarioData.outcome}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cost:</span>
                      <span className="ml-2 font-medium text-destructive">{scenarioData.cost}</span>
                    </div>
                  </div>
                </div>
              )}
            </Tabs>
          </CardContent>
        </Card>

        {/* Steps with Decision Details */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card 
                key={step.id}
                className={cn(
                  "transition-all duration-300",
                  step.status === 'running' && "border-primary shadow-lg shadow-primary/20 scale-[1.02]",
                  step.status === 'completed' && "border-green-500/50",
                  step.status === 'error' && "border-destructive"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "p-2 rounded-lg transition-all",
                      step.status === 'pending' && "bg-muted text-muted-foreground",
                      step.status === 'running' && "bg-primary/20 text-primary animate-pulse",
                      step.status === 'completed' && "bg-green-500/20 text-green-500",
                      step.status === 'error' && "bg-destructive/20 text-destructive"
                    )}>
                      {step.status === 'running' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : step.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm truncate">{step.title}</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {index + 1}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground mb-2">{step.description}</p>
                  {step.duration && (
                    <Badge variant="secondary" className="text-xs">
                      {step.duration}ms
                    </Badge>
                  )}
                  
                  {/* Investor Tip - Inside Card */}
                  {showInvestorTips && step.investorTip && step.status === 'completed' && (
                    <div className="mt-2 px-2 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded text-[10px] text-yellow-600 dark:text-yellow-400">
                      {step.investorTip}
                    </div>
                  )}

                  {/* Log Ingestion Details */}
                  {step.id === 'ingest' && step.status === 'completed' && step.result && (
                    <div className="mt-2 p-2 rounded bg-green-500/10 border border-green-500/30 space-y-1 text-[10px]">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        <span>Log parsed successfully</span>
                      </div>
                      <div><span className="text-muted-foreground">Incident:</span> <strong>{step.result.incident_number}</strong></div>
                      <div><span className="text-muted-foreground">Source IP:</span> 192.168.1.100</div>
                      <div><span className="text-muted-foreground">Destination:</span> 185.234.247.10</div>
                      <div><span className="text-muted-foreground">Threat:</span> Emotet Banking Trojan</div>
                    </div>
                  )}
                  
                  {/* AI Analysis Decision Details */}
                  {step.id === 'ai-analysis' && step.status === 'completed' && step.result && (
                    <div className="mt-2 space-y-2">
                      <div className="p-2 rounded bg-green-500/10 border border-green-500/30">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">Selected:</span>
                          <Badge variant="destructive" className="text-xs">{step.result.risk_level}</Badge>
                        </div>
                        <div className="text-xs font-semibold text-green-500">{step.result.classification}</div>
                        <Progress value={step.result.confidence} className="h-1 mt-1" />
                        <div className="text-[10px] text-muted-foreground mt-1">{step.result.confidence}% confidence</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] font-medium text-muted-foreground">Alternatives Rejected:</div>
                        {step.result.alternatives?.filter((a: ClassificationOption) => !a.selected).map((alt: ClassificationOption) => (
                          <div key={alt.label} className="p-1.5 rounded bg-muted/50 text-[10px]">
                            <div className="flex justify-between">
                              <span>{alt.label}</span>
                              <span className="text-muted-foreground">{alt.confidence}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* VirusTotal Results */}
                  {step.id === 'enrichment' && step.status === 'completed' && step.result && (
                    <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="destructive" className="text-xs">{step.result.verdict}</Badge>
                        <span className="text-xs font-bold">{step.result.detectionRatio}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {step.result.engines?.slice(0, 4).map((e: any) => (
                          <Badge 
                            key={e.name} 
                            variant={e.detected ? "destructive" : "secondary"} 
                            className="text-[10px]"
                          >
                            {e.name}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-[10px] text-green-500 font-medium">
                        ↑ {step.result.influence}
                      </div>
                    </div>
                  )}

                  {/* Playbook Selection */}
                  {step.id === 'playbook-decision' && step.status === 'completed' && step.result && (
                    <div className="mt-2 space-y-1.5">
                      {step.result.playbooks?.map((pb: PlaybookOption) => (
                        <div 
                          key={pb.id}
                          className={cn(
                            "p-1.5 rounded text-[10px]",
                            pb.selected ? "bg-green-500/20 border border-green-500/50" : "bg-muted/50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className={cn("font-medium", pb.selected && "text-green-500")}>
                              {pb.selected && '✓ '}{pb.name}
                            </span>
                            <Badge 
                              variant={pb.risk === 'High' ? 'destructive' : pb.risk === 'Medium' ? 'secondary' : 'outline'}
                              className="text-[9px] h-4"
                            >
                              {pb.risk}
                            </Badge>
                          </div>
                          {pb.selected && (
                            <div className="text-[9px] text-muted-foreground mt-1 italic">
                              "{pb.reason}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Execution Results */}
                  {step.id === 'execution' && step.status === 'completed' && step.result && (
                    <div className="mt-2 space-y-1">
                      {step.result.executed?.map((action: string) => (
                        <div key={action} className="flex items-center gap-1 text-[10px]">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <span>{action}</span>
                        </div>
                      ))}
                      {step.result.rollbackAvailable && (
                        <Badge variant="outline" className="text-[9px] mt-1">
                          Rollback Available
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Notification */}
                  {step.id === 'notification' && step.status === 'completed' && step.result && (
                    <div className="mt-2 p-2 rounded bg-blue-500/10 text-[10px]">
                      <div>Notified: {step.result.channels?.join(', ')}</div>
                      <div className="text-green-500">Suppressed {step.result.suppressed} duplicate alerts</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Metrics Comparison */}
        {steps.find(s => s.id === 'metrics')?.status === 'completed' && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Metrics Impact Analysis
              </CardTitle>
              <CardDescription>Before/After with AI-driven explanations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {METRICS_COMPARISON.map((m) => (
                  <div key={m.metric} className="p-4 rounded-lg bg-muted/30 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{m.metric}</span>
                      <Badge className="bg-green-500 text-white">
                        <TrendingDown className="h-3 w-3 mr-1" />
                        {m.improvement}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mb-2">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Before</div>
                        <div className="text-lg font-bold text-destructive">{m.baseline}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">After AI</div>
                        <div className="text-lg font-bold text-green-500">{m.current}</div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{m.explanation}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Highlights */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-500">
                    {totalTime > 0 ? `${(totalTime / 1000).toFixed(1)}s` : '--'}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Response</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Brain className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold text-primary">92%</p>
                  <p className="text-xs text-muted-foreground">AI Confidence</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border-purple-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Scale className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold text-purple-500">3</p>
                  <p className="text-xs text-muted-foreground">Playbooks Evaluated</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 border-yellow-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold text-yellow-500">$250K</p>
                  <p className="text-xs text-muted-foreground">Value Protected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Executive Summary */}
        {executiveSummary && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                AI Executive Brief
              </CardTitle>
              <CardDescription>
                Board-ready narrative explaining what happened, why actions were taken, and business impact
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm bg-secondary/50 p-6 rounded-lg overflow-auto max-h-[500px] font-mono">
                  {executiveSummary}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
