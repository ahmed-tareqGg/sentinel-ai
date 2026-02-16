import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Shield, TrendingUp, TrendingDown, Minus, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface HealthMetric {
  label: string;
  score: number;
  weight: number;
  status: 'good' | 'warning' | 'critical';
}

interface SOCHealthScoreProps {
  mttd: number;
  mttr: number;
  slaCompliance: number;
  falsePositiveRate: number;
  automationRate: number;
  openIncidents: number;
  criticalIncidents: number;
}

export function SOCHealthScore({
  mttd, mttr, slaCompliance, falsePositiveRate, automationRate, openIncidents, criticalIncidents,
}: SOCHealthScoreProps) {
  const { overallScore, metrics, grade, gradeColor } = useMemo(() => {
    const metrics: HealthMetric[] = [
      {
        label: 'Detection Speed',
        score: mttd <= 1 ? 100 : mttd <= 5 ? 85 : mttd <= 15 ? 60 : 30,
        weight: 0.2,
        status: mttd <= 5 ? 'good' : mttd <= 15 ? 'warning' : 'critical',
      },
      {
        label: 'Response Time',
        score: mttr <= 10 ? 100 : mttr <= 30 ? 80 : mttr <= 60 ? 55 : 25,
        weight: 0.2,
        status: mttr <= 30 ? 'good' : mttr <= 60 ? 'warning' : 'critical',
      },
      {
        label: 'SLA Compliance',
        score: slaCompliance,
        weight: 0.2,
        status: slaCompliance >= 90 ? 'good' : slaCompliance >= 70 ? 'warning' : 'critical',
      },
      {
        label: 'AI Accuracy',
        score: Math.max(0, 100 - falsePositiveRate * 2),
        weight: 0.15,
        status: falsePositiveRate <= 20 ? 'good' : falsePositiveRate <= 40 ? 'warning' : 'critical',
      },
      {
        label: 'Automation',
        score: automationRate,
        weight: 0.15,
        status: automationRate >= 70 ? 'good' : automationRate >= 40 ? 'warning' : 'critical',
      },
      {
        label: 'Threat Posture',
        score: criticalIncidents === 0 ? 100 : criticalIncidents <= 2 ? 60 : 20,
        weight: 0.1,
        status: criticalIncidents === 0 ? 'good' : criticalIncidents <= 2 ? 'warning' : 'critical',
      },
    ];

    const overallScore = Math.round(
      metrics.reduce((sum, m) => sum + m.score * m.weight, 0)
    );

    const grade = overallScore >= 90 ? 'A+' : overallScore >= 80 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 60 ? 'C' : 'D';
    const gradeColor = overallScore >= 80 ? 'text-green-400' : overallScore >= 60 ? 'text-amber-400' : 'text-red-400';

    return { overallScore, metrics, grade, gradeColor };
  }, [mttd, mttr, slaCompliance, falsePositiveRate, automationRate, openIncidents, criticalIncidents]);

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;
  const scoreColor = overallScore >= 80 ? '#22c55e' : overallScore >= 60 ? '#f59e0b' : '#ef4444';

  const statusIcons = {
    good: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />,
    warning: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
    critical: <XCircle className="h-3.5 w-3.5 text-red-400" />,
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">SOC Health Score</h3>
      </div>

      <div className="flex items-center gap-6">
        {/* Circular gauge */}
        <div className="relative flex-shrink-0">
          <svg width="120" height="120" viewBox="0 0 120 120">
            {/* Background circle */}
            <circle cx="60" cy="60" r="45" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
            {/* Score arc */}
            <motion.circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke={scoreColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              transform="rotate(-90 60 60)"
            />
            {/* Glow */}
            <motion.circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke={scoreColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              opacity="0.3"
              filter="blur(4px)"
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className="text-2xl font-bold text-foreground tabular-nums"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {overallScore}
            </motion.span>
            <span className={`text-xs font-bold ${gradeColor}`}>{grade}</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex-1 space-y-2">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
            >
              {statusIcons[m.status]}
              <span className="text-xs text-muted-foreground flex-1">{m.label}</span>
              <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: m.status === 'good' ? '#22c55e' : m.status === 'warning' ? '#f59e0b' : '#ef4444' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${m.score}%` }}
                  transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                />
              </div>
              <span className="text-xs font-mono text-muted-foreground w-8 text-right">{m.score}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
