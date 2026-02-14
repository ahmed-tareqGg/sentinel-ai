import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, XCircle, Zap, Clock, DollarSign, Shield, Brain, 
  TrendingUp, ArrowRight, Crown, Star
} from 'lucide-react';

interface CompetitorData {
  name: string;
  mttd: string;
  mttr: string;
  aiNative: boolean;
  autonomousResponse: boolean;
  pricing: string;
  deployment: string;
  highlight?: string;
}

const competitors: CompetitorData[] = [
  {
    name: 'Splunk SOAR',
    mttd: '~30 min',
    mttr: '~2 hrs',
    aiNative: false,
    autonomousResponse: false,
    pricing: '$75K+/yr',
    deployment: '6-12 weeks',
  },
  {
    name: 'Palo Alto XSOAR',
    mttd: '~25 min',
    mttr: '~1.5 hrs',
    aiNative: false,
    autonomousResponse: false,
    pricing: '$100K+/yr',
    deployment: '8-16 weeks',
  },
  {
    name: 'IBM QRadar SOAR',
    mttd: '~35 min',
    mttr: '~3 hrs',
    aiNative: false,
    autonomousResponse: false,
    pricing: '$60K+/yr',
    deployment: '10-20 weeks',
  },
];

interface Props {
  mttd: string;
  mttr: string;
}

export function DemoCompetitiveSection({ mttd, mttr }: Props) {
  const features = [
    { label: 'AI-Native Detection', key: 'aiNative' },
    { label: 'Autonomous Response', key: 'autonomousResponse' },
  ];

  return (
    <div className="space-y-6">
      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-muted-foreground font-medium">Feature</th>
              <th className="text-center py-3 px-4">
                <div className="flex items-center justify-center gap-1.5">
                  <Crown className="h-4 w-4 text-primary" />
                  <span className="font-bold text-primary">SOCMind</span>
                </div>
              </th>
              {competitors.map(c => (
                <th key={c.name} className="text-center py-3 px-4 text-muted-foreground font-medium">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="py-3 px-4 font-medium">MTTD</td>
              <td className="py-3 px-4 text-center">
                <Badge className="bg-green-500/10 text-green-500 border-green-500/30">{mttd}</Badge>
              </td>
              {competitors.map(c => (
                <td key={c.name} className="py-3 px-4 text-center text-muted-foreground">{c.mttd}</td>
              ))}
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium">MTTR</td>
              <td className="py-3 px-4 text-center">
                <Badge className="bg-green-500/10 text-green-500 border-green-500/30">{mttr}</Badge>
              </td>
              {competitors.map(c => (
                <td key={c.name} className="py-3 px-4 text-center text-muted-foreground">{c.mttr}</td>
              ))}
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium">AI-Native Detection</td>
              <td className="py-3 px-4 text-center">
                <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
              </td>
              {competitors.map(c => (
                <td key={c.name} className="py-3 px-4 text-center">
                  <XCircle className="h-5 w-5 text-destructive/50 mx-auto" />
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium">Autonomous Response</td>
              <td className="py-3 px-4 text-center">
                <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
              </td>
              {competitors.map(c => (
                <td key={c.name} className="py-3 px-4 text-center">
                  <XCircle className="h-5 w-5 text-destructive/50 mx-auto" />
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium">Pricing</td>
              <td className="py-3 px-4 text-center">
                <Badge className="bg-primary/10 text-primary border-primary/30">Usage-based</Badge>
              </td>
              {competitors.map(c => (
                <td key={c.name} className="py-3 px-4 text-center text-muted-foreground">{c.pricing}</td>
              ))}
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium">Deployment Time</td>
              <td className="py-3 px-4 text-center">
                <Badge className="bg-green-500/10 text-green-500 border-green-500/30">Minutes</Badge>
              </td>
              {competitors.map(c => (
                <td key={c.name} className="py-3 px-4 text-center text-muted-foreground">{c.deployment}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Key Differentiators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <Brain className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="font-semibold text-sm">AI-First Architecture</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Built with AI at the core, not bolted on as an afterthought
            </p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="p-4 text-center">
            <Zap className="h-6 w-6 text-green-500 mx-auto mb-2" />
            <p className="font-semibold text-sm">Zero-Touch Response</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Autonomous containment with human-in-the-loop safeguards
            </p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <DollarSign className="h-6 w-6 text-amber-500 mx-auto mb-2" />
            <p className="font-semibold text-sm">10x Lower TCO</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              No per-seat licensing, no hardware, pay for what you use
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
