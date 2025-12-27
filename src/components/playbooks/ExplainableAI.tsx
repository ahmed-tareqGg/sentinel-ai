import { useState } from 'react';
import { Brain, Info, AlertTriangle, Shield, Search, Target, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface DecisionFactor {
  factor: string;
  weight: number;
  value: string;
  contribution: 'positive' | 'negative' | 'neutral';
  icon?: typeof Brain;
}

interface AIExplanation {
  summary: string;
  confidence: number;
  decision: 'auto' | 'approval' | 'dry-run';
  factors: DecisionFactor[];
  historicalContext?: string;
  threatIntelligence?: string;
}

interface ExplainableAIProps {
  incident: {
    id?: string;
    event_type?: string;
    severity?: number;
    risk_level?: string | null;
    classification?: string | null;
    confidence?: number | null;
    mitre_tactic?: string | null;
    mitre_technique?: string | null;
    src_ip?: string | null;
    sandbox_result?: any;
  };
  playbook?: {
    name: string;
    conditions?: Record<string, any>;
  };
  className?: string;
}

export function ExplainableAI({ incident, playbook, className }: ExplainableAIProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Generate AI explanation based on incident data
  const generateExplanation = (): AIExplanation => {
    const factors: DecisionFactor[] = [];
    let totalScore = 0;
    let maxScore = 0;
    
    // Factor 1: Classification
    if (incident.classification) {
      const isTP = incident.classification === 'True Positive';
      factors.push({
        factor: 'AI Classification',
        weight: 30,
        value: incident.classification,
        contribution: isTP ? 'positive' : incident.classification === 'False Positive' ? 'negative' : 'neutral',
        icon: Brain,
      });
      totalScore += isTP ? 30 : 0;
      maxScore += 30;
    }
    
    // Factor 2: Confidence Score
    if (incident.confidence) {
      const confLevel = incident.confidence >= 85 ? 'High' : incident.confidence >= 60 ? 'Medium' : 'Low';
      factors.push({
        factor: 'Confidence Score',
        weight: 25,
        value: `${incident.confidence}% (${confLevel})`,
        contribution: incident.confidence >= 85 ? 'positive' : incident.confidence >= 60 ? 'neutral' : 'negative',
        icon: Target,
      });
      totalScore += (incident.confidence / 100) * 25;
      maxScore += 25;
    }
    
    // Factor 3: Risk Level
    if (incident.risk_level) {
      const riskScore = incident.risk_level === 'Critical' ? 20 : 
                       incident.risk_level === 'High' ? 15 : 
                       incident.risk_level === 'Medium' ? 10 : 5;
      factors.push({
        factor: 'Risk Level',
        weight: 20,
        value: incident.risk_level,
        contribution: incident.risk_level === 'Critical' || incident.risk_level === 'High' ? 'positive' : 'neutral',
        icon: AlertTriangle,
      });
      totalScore += riskScore;
      maxScore += 20;
    }
    
    // Factor 4: MITRE ATT&CK
    if (incident.mitre_technique) {
      factors.push({
        factor: 'MITRE ATT&CK',
        weight: 15,
        value: `${incident.mitre_technique}${incident.mitre_tactic ? ` (${incident.mitre_tactic})` : ''}`,
        contribution: 'positive',
        icon: Shield,
      });
      totalScore += 15;
      maxScore += 15;
    }
    
    // Factor 5: Threat Intelligence
    const sandboxResult = incident.sandbox_result;
    if (sandboxResult) {
      const isMalicious = sandboxResult.malicious || sandboxResult.positives > 5;
      factors.push({
        factor: 'VirusTotal Analysis',
        weight: 10,
        value: isMalicious ? `Malicious (${sandboxResult.positives || 0} detections)` : 'Clean/Unknown',
        contribution: isMalicious ? 'positive' : 'neutral',
        icon: Search,
      });
      totalScore += isMalicious ? 10 : 0;
      maxScore += 10;
    }
    
    // Determine decision
    const confidence = incident.confidence || 0;
    const isTP = incident.classification === 'True Positive';
    const isCritical = incident.risk_level === 'Critical';
    
    let decision: 'auto' | 'approval' | 'dry-run' = 'dry-run';
    if (confidence >= 85 && isTP && isCritical) {
      decision = 'auto';
    } else if (confidence >= 60 && isTP) {
      decision = 'approval';
    }
    
    // Generate summary
    const summaryParts: string[] = [];
    if (incident.classification) {
      summaryParts.push(`classified as **${incident.classification}**`);
    }
    if (incident.confidence) {
      summaryParts.push(`with **${incident.confidence}%** confidence`);
    }
    if (incident.mitre_technique) {
      summaryParts.push(`mapped to MITRE **${incident.mitre_technique}**`);
    }
    if (sandboxResult?.malicious) {
      summaryParts.push(`confirmed malicious by threat intelligence`);
    }
    
    const playbookPart = playbook ? ` Matched playbook "${playbook.name}" ` : '';
    const summary = `This incident is ${summaryParts.join(', ')}.${playbookPart} Decision: ${
      decision === 'auto' ? 'Auto-execute containment' :
      decision === 'approval' ? 'Requires analyst approval' :
      'Dry-run mode (manual review needed)'
    }.`;
    
    return {
      summary,
      confidence: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      decision,
      factors,
      historicalContext: incident.src_ip ? `Source IP ${incident.src_ip} checked against historical incidents` : undefined,
      threatIntelligence: sandboxResult ? 'VirusTotal enrichment applied' : undefined,
    };
  };
  
  const explanation = generateExplanation();
  
  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case 'auto': return 'bg-green-500/20 text-green-500 border-green-500/30';
      case 'approval': return 'bg-warning/20 text-warning border-warning/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };
  
  const getContributionIcon = (contribution: string) => {
    switch (contribution) {
      case 'positive': return <TrendingUp className="h-3 w-3 text-green-500" />;
      case 'negative': return <TrendingUp className="h-3 w-3 text-destructive rotate-180" />;
      default: return <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />;
    }
  };

  return (
    <Card className={cn("border-primary/20", className)}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">AI Decision Explanation</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={cn("text-xs", getDecisionColor(explanation.decision))}>
                {explanation.decision === 'auto' ? 'Auto-Execute' : 
                 explanation.decision === 'approval' ? 'Needs Approval' : 'Manual Review'}
              </Badge>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {/* Summary */}
          <p className="text-sm text-muted-foreground mb-4">{explanation.summary}</p>
          
          {/* Confidence Meter */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-medium">Decision Confidence:</span>
            <Progress value={explanation.confidence} className="flex-1 h-2" />
            <span className="text-sm font-bold">{explanation.confidence}%</span>
          </div>
          
          <CollapsibleContent className="space-y-4">
            {/* Decision Factors */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4" />
                Decision Factors
              </h4>
              <div className="space-y-2">
                {explanation.factors.map((factor, idx) => {
                  const Icon = factor.icon || Brain;
                  return (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-secondary/50"
                    >
                      <div className="flex items-center gap-2">
                        {getContributionIcon(factor.contribution)}
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{factor.factor}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{factor.value}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Weight: {factor.weight}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Additional Context */}
            {(explanation.historicalContext || explanation.threatIntelligence) && (
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 space-y-1">
                <h4 className="text-sm font-medium">Additional Intelligence</h4>
                {explanation.historicalContext && (
                  <p className="text-xs text-muted-foreground">• {explanation.historicalContext}</p>
                )}
                {explanation.threatIntelligence && (
                  <p className="text-xs text-muted-foreground">• {explanation.threatIntelligence}</p>
                )}
              </div>
            )}
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
