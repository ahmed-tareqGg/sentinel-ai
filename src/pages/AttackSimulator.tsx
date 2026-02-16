import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AnimatedPage, AnimatedCard, AnimatedSection } from '@/components/ui/animated-card';
import { supabase } from '@/integrations/backend/client';
import { Swords, Play, CheckCircle, XCircle, Clock, AlertTriangle, Shield, Target, Brain, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface Scenario {
  id: string;
  name: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  mitreTechnique: string;
  category: string;
  timeLimit: number; // seconds
}

interface SimulationStep {
  id: number;
  title: string;
  description: string;
  options: { id: string; text: string; correct: boolean; explanation: string }[];
}

interface SimulationResult {
  score: number;
  totalSteps: number;
  correctAnswers: number;
  timeTaken: number;
  feedback: string;
}

const SCENARIOS: Scenario[] = [
  { id: 'phishing', name: 'Spear Phishing Campaign', description: 'A targeted phishing email has bypassed email filters and reached C-level executives. Analyze and respond.', difficulty: 'Medium', mitreTechnique: 'T1566.001', category: 'Initial Access', timeLimit: 300 },
  { id: 'ransomware', name: 'Ransomware Outbreak', description: 'Multiple endpoints are encrypting files simultaneously. Contain and eradicate the threat.', difficulty: 'Hard', mitreTechnique: 'T1486', category: 'Impact', timeLimit: 180 },
  { id: 'lateral', name: 'Lateral Movement Detection', description: 'Suspicious RDP sessions detected from a compromised workstation. Trace the attack path.', difficulty: 'Medium', mitreTechnique: 'T1021.001', category: 'Lateral Movement', timeLimit: 240 },
  { id: 'exfil', name: 'Data Exfiltration via DNS', description: 'Anomalous DNS queries detected with encoded data payloads. Investigate and block.', difficulty: 'Expert', mitreTechnique: 'T1048.003', category: 'Exfiltration', timeLimit: 360 },
  { id: 'brute', name: 'Brute Force Attack', description: 'Multiple failed authentication attempts from distributed IPs targeting VPN gateway.', difficulty: 'Easy', mitreTechnique: 'T1110', category: 'Credential Access', timeLimit: 240 },
  { id: 'supply', name: 'Supply Chain Compromise', description: 'A trusted vendor update contains a backdoor. Assess impact and remediate.', difficulty: 'Expert', mitreTechnique: 'T1195.002', category: 'Initial Access', timeLimit: 420 },
];

const difficultyColors: Record<string, string> = {
  Easy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Hard: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Expert: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function AttackSimulator() {
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [steps, setSteps] = useState<SimulationStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Map<number, string>>(new Map());
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showExplanation, setShowExplanation] = useState<string | null>(null);

  const startSimulation = async (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setAiGenerating(true);
    setCurrentStep(0);
    setAnswers(new Map());
    setResult(null);
    setShowExplanation(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-playbook-recommender', {
        body: {
          mode: 'attack_simulation',
          scenario: {
            name: scenario.name,
            description: scenario.description,
            mitreTechnique: scenario.mitreTechnique,
            category: scenario.category,
            difficulty: scenario.difficulty,
          },
        },
      });

      if (error) throw error;

      const generatedSteps: SimulationStep[] = data?.steps || generateFallbackSteps(scenario);
      setSteps(generatedSteps);
      setStartTime(Date.now());
    } catch (err) {
      console.error('AI generation failed, using fallback:', err);
      setSteps(generateFallbackSteps(scenario));
      setStartTime(Date.now());
    } finally {
      setAiGenerating(false);
    }
  };

  const selectAnswer = (stepIdx: number, optionId: string) => {
    const newAnswers = new Map(answers);
    newAnswers.set(stepIdx, optionId);
    setAnswers(newAnswers);

    const step = steps[stepIdx];
    const selected = step.options.find(o => o.id === optionId);
    setShowExplanation(selected?.explanation || null);
  };

  const nextStep = () => {
    setShowExplanation(null);
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      finishSimulation();
    }
  };

  const finishSimulation = () => {
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    let correct = 0;
    steps.forEach((step, idx) => {
      const answer = answers.get(idx);
      const correctOption = step.options.find(o => o.correct);
      if (answer === correctOption?.id) correct++;
    });

    const score = Math.round((correct / steps.length) * 100);
    let feedback = '';
    if (score >= 90) feedback = '🏆 Outstanding! You demonstrated expert-level incident response skills.';
    else if (score >= 70) feedback = '✅ Good performance. Keep refining your response procedures.';
    else if (score >= 50) feedback = '⚠️ Adequate, but review the areas where you made incorrect decisions.';
    else feedback = '❌ Needs improvement. Consider reviewing incident response playbooks.';

    setResult({ score, totalSteps: steps.length, correctAnswers: correct, timeTaken, feedback });
  };

  const resetSimulation = () => {
    setSelectedScenario(null);
    setSteps([]);
    setCurrentStep(0);
    setAnswers(new Map());
    setResult(null);
    setShowExplanation(null);
  };

  return (
    <AppLayout title="Attack Simulator" subtitle="AI-powered training scenarios to test team readiness">
      <AnimatedPage>
        {!selectedScenario ? (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-red-500/20">
                <Swords className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Choose a Scenario</h2>
                <p className="text-sm text-muted-foreground">Select an attack scenario to test your incident response skills</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SCENARIOS.map((s, idx) => (
                <AnimatedCard key={s.id} index={idx}>
                  <div className="rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition-all cursor-pointer group" onClick={() => startSimulation(s)}>
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant="outline" className={cn("text-xs", difficultyColors[s.difficulty])}>{s.difficulty}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{s.mitreTechnique}</span>
                    </div>
                    <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">{s.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{s.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{Math.floor(s.timeLimit / 60)} min</span>
                      <span className="flex items-center gap-1"><Target className="h-3 w-3" />{s.category}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full mt-3 group-hover:bg-primary/10">
                      <Play className="h-4 w-4 mr-2" /> Start Simulation
                    </Button>
                  </div>
                </AnimatedCard>
              ))}
            </div>
          </>
        ) : aiGenerating ? (
          <div className="flex flex-col items-center justify-center py-20">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
              <Brain className="h-12 w-12 text-primary" />
            </motion.div>
            <p className="mt-4 text-lg font-semibold text-foreground">AI is generating your scenario...</p>
            <p className="text-sm text-muted-foreground mt-1">Building realistic attack steps for "{selectedScenario.name}"</p>
          </div>
        ) : result ? (
          <AnimatedSection>
            <div className="max-w-2xl mx-auto">
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
                  {result.score >= 70 ? (
                    <div className="inline-flex p-4 rounded-full bg-emerald-500/20 mb-4">
                      <CheckCircle className="h-12 w-12 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="inline-flex p-4 rounded-full bg-orange-500/20 mb-4">
                      <AlertTriangle className="h-12 w-12 text-orange-400" />
                    </div>
                  )}
                </motion.div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Simulation Complete</h2>
                <p className="text-4xl font-black text-primary mb-1">{result.score}%</p>
                <p className="text-sm text-muted-foreground mb-4">{result.correctAnswers}/{result.totalSteps} correct • {Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s</p>
                <p className="text-sm text-foreground mb-6">{result.feedback}</p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={resetSimulation} variant="outline"><RotateCcw className="h-4 w-4 mr-2" /> Try Another</Button>
                  <Button onClick={() => startSimulation(selectedScenario)}><Play className="h-4 w-4 mr-2" /> Retry</Button>
                </div>
              </div>
            </div>
          </AnimatedSection>
        ) : (
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={cn(difficultyColors[selectedScenario.difficulty])}>{selectedScenario.difficulty}</Badge>
                <h2 className="font-semibold text-foreground">{selectedScenario.name}</h2>
              </div>
              <span className="text-sm text-muted-foreground">Step {currentStep + 1} of {steps.length}</span>
            </div>
            <Progress value={((currentStep + 1) / steps.length) * 100} className="mb-6" />

            <AnimatePresence mode="wait">
              {steps[currentStep] && (
                <motion.div key={currentStep} initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="rounded-xl border border-border bg-card p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-2">{steps[currentStep].title}</h3>
                  <p className="text-sm text-muted-foreground mb-5">{steps[currentStep].description}</p>

                  <div className="space-y-3">
                    {steps[currentStep].options.map(opt => {
                      const selected = answers.get(currentStep) === opt.id;
                      const answered = answers.has(currentStep);
                      const isCorrect = opt.correct;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => !answered && selectAnswer(currentStep, opt.id)}
                          disabled={answered}
                          className={cn(
                            "w-full text-left p-4 rounded-lg border transition-all",
                            !answered && "hover:border-primary/50 hover:bg-primary/5 cursor-pointer",
                            answered && selected && isCorrect && "border-emerald-500 bg-emerald-500/10",
                            answered && selected && !isCorrect && "border-red-500 bg-red-500/10",
                            answered && !selected && isCorrect && "border-emerald-500/50 bg-emerald-500/5",
                            answered && !selected && !isCorrect && "border-border opacity-50",
                            !answered && !selected && "border-border"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {answered && isCorrect && <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />}
                            {answered && selected && !isCorrect && <XCircle className="h-5 w-5 text-red-400 shrink-0" />}
                            <span className="text-sm text-foreground">{opt.text}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {showExplanation && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-sm text-foreground"><strong>Explanation:</strong> {showExplanation}</p>
                    </motion.div>
                  )}

                  {answers.has(currentStep) && (
                    <div className="mt-4 flex justify-end">
                      <Button onClick={nextStep}>
                        {currentStep < steps.length - 1 ? 'Next Step →' : 'Finish Simulation'}
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <Button variant="ghost" onClick={resetSimulation} className="mt-4 text-muted-foreground">← Back to Scenarios</Button>
          </div>
        )}
      </AnimatedPage>
    </AppLayout>
  );
}

function generateFallbackSteps(scenario: Scenario): SimulationStep[] {
  const stepSets: Record<string, SimulationStep[]> = {
    phishing: [
      { id: 1, title: 'Initial Triage', description: 'A VP reports receiving a suspicious email with an urgent wire transfer request. What is your first action?', options: [
        { id: 'a', text: 'Reply to ask if it\'s legitimate', correct: false, explanation: 'Never engage with a potentially spoofed sender.' },
        { id: 'b', text: 'Analyze email headers and check sender domain', correct: true, explanation: 'Correct — header analysis reveals spoofing indicators and true origin.' },
        { id: 'c', text: 'Delete the email immediately', correct: false, explanation: 'Evidence must be preserved for investigation.' },
        { id: 'd', text: 'Forward it to IT', correct: false, explanation: 'Direct SOC analysis is preferred over forwarding.' },
      ]},
      { id: 2, title: 'Containment', description: 'Headers confirm the email is malicious with a credential harvesting link. What next?', options: [
        { id: 'a', text: 'Block the sending domain and URL at the email gateway', correct: true, explanation: 'Correct — immediate blocking prevents further exposure across the organization.' },
        { id: 'b', text: 'Send a company-wide warning email', correct: false, explanation: 'Warning is important but containment comes first.' },
        { id: 'c', text: 'Disable the VP\'s email account', correct: false, explanation: 'Too aggressive — the account isn\'t confirmed compromised yet.' },
        { id: 'd', text: 'Monitor for more emails', correct: false, explanation: 'Passive monitoring allows further damage.' },
      ]},
      { id: 3, title: 'Investigation', description: 'Logs show 3 other executives received the same email. One clicked the link. What do you do?', options: [
        { id: 'a', text: 'Force password reset for the user who clicked and check for lateral movement', correct: true, explanation: 'Correct — credential compromise requires immediate reset and scope assessment.' },
        { id: 'b', text: 'Wait to see if credentials were actually entered', correct: false, explanation: 'Waiting increases risk. Assume compromise after a click on a harvesting page.' },
        { id: 'c', text: 'Quarantine all 4 executive laptops', correct: false, explanation: 'Excessive — only the compromised user needs immediate action.' },
        { id: 'd', text: 'Search for the email in all mailboxes', correct: false, explanation: 'Good secondary action but the clicked link is the priority.' },
      ]},
    ],
    default: [
      { id: 1, title: 'Detection', description: 'An alert has fired for the scenario. What is the first step in your response?', options: [
        { id: 'a', text: 'Verify the alert is not a false positive', correct: true, explanation: 'Correct — validation prevents wasted response on false alarms.' },
        { id: 'b', text: 'Immediately escalate to management', correct: false, explanation: 'Premature escalation without validation wastes time.' },
        { id: 'c', text: 'Start blocking all related IPs', correct: false, explanation: 'Blocking without verification may disrupt legitimate traffic.' },
        { id: 'd', text: 'Ignore and wait for more alerts', correct: false, explanation: 'Ignoring alerts violates SOC procedures.' },
      ]},
      { id: 2, title: 'Analysis', description: 'The alert is confirmed true positive. How do you proceed?', options: [
        { id: 'a', text: 'Document findings and begin containment', correct: true, explanation: 'Correct — documentation + containment follows standard IR procedures.' },
        { id: 'b', text: 'Immediately remediate', correct: false, explanation: 'Skipping analysis may miss the full scope of the incident.' },
        { id: 'c', text: 'Notify the affected user', correct: false, explanation: 'User notification comes after containment.' },
        { id: 'd', text: 'Run a full network scan', correct: false, explanation: 'Full scan is too broad at this stage.' },
      ]},
      { id: 3, title: 'Remediation', description: 'Containment is successful. What is the next priority?', options: [
        { id: 'a', text: 'Eradicate the threat and restore affected systems', correct: true, explanation: 'Correct — eradication + recovery is the standard next phase.' },
        { id: 'b', text: 'Close the incident', correct: false, explanation: 'Premature closure without eradication risks reinfection.' },
        { id: 'c', text: 'Send an all-clear notice', correct: false, explanation: 'All-clear before remediation is irresponsible.' },
        { id: 'd', text: 'Archive the evidence', correct: false, explanation: 'Evidence archiving happens after full remediation.' },
      ]},
    ],
  };

  return stepSets[scenario.id] || stepSets.default;
}
