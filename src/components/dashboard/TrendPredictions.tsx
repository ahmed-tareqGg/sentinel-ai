import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Brain, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface TrendPredictionsProps {
  incidentsPerDay: { date: string; incidents: number; truePositive: number }[];
}

export function TrendPredictions({ incidentsPerDay }: TrendPredictionsProps) {
  const { predictedData, trend, trendPct, summary } = useMemo(() => {
    if (incidentsPerDay.length < 3) {
      return {
        predictedData: incidentsPerDay,
        trend: 'stable' as const,
        trendPct: 0,
        summary: 'Insufficient data for predictions',
      };
    }

    // Simple linear regression for prediction
    const n = incidentsPerDay.length;
    const xVals = incidentsPerDay.map((_, i) => i);
    const yVals = incidentsPerDay.map(d => d.incidents);
    const xMean = xVals.reduce((a, b) => a + b, 0) / n;
    const yMean = yVals.reduce((a, b) => a + b, 0) / n;

    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xVals[i] - xMean) * (yVals[i] - yMean);
      den += (xVals[i] - xMean) ** 2;
    }
    const slope = den !== 0 ? num / den : 0;
    const intercept = yMean - slope * xMean;

    // Generate 3 predicted days
    const predictions = [];
    for (let i = 1; i <= 3; i++) {
      const predictedVal = Math.max(0, Math.round(intercept + slope * (n + i - 1)));
      predictions.push({
        date: `Day +${i}`,
        incidents: 0,
        truePositive: 0,
        predicted: predictedVal,
      });
    }

    const combined = [
      ...incidentsPerDay.map(d => ({ ...d, predicted: undefined as number | undefined })),
      ...predictions,
    ];

    // Trend analysis
    const firstHalf = yVals.slice(0, Math.floor(n / 2));
    const secondHalf = yVals.slice(Math.floor(n / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const changePct = firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;
    const trendDir = changePct > 10 ? 'up' : changePct < -10 ? 'down' : 'stable';

    const summaryText = trendDir === 'up'
      ? `⚠️ Incident volume trending up ${changePct}% — consider increasing monitoring capacity`
      : trendDir === 'down'
      ? `✅ Incident volume decreasing ${Math.abs(changePct)}% — security posture improving`
      : `➡️ Incident volume stable — maintain current operations`;

    return { predictedData: combined, trend: trendDir, trendPct: changePct, summary: summaryText };
  }, [incidentsPerDay]);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-green-400' : 'text-amber-400';

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">AI Trend Predictions</h3>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          {Math.abs(trendPct)}% {trend === 'stable' ? 'Stable' : trend === 'up' ? 'Increase' : 'Decrease'}
        </div>
      </div>

      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={predictedData}>
            <defs>
              <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(187, 100%, 50%)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(187, 100%, 50%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="predictedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" stroke="hsl(215, 20%, 40%)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(215, 20%, 40%)" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(222, 47%, 8%)',
                border: '1px solid hsl(222, 30%, 18%)',
                borderRadius: '8px',
                fontSize: '11px',
                color: 'hsl(210, 40%, 96%)',
              }}
            />
            <Area type="monotone" dataKey="incidents" stroke="#22d3ee" strokeWidth={2} fill="url(#actualGrad)" dot={{ r: 2, fill: '#22d3ee' }} />
            <Area type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" fill="url(#predictedGrad)" dot={{ r: 2, fill: '#f59e0b' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <motion.p
        className="text-xs text-muted-foreground mt-3 p-2 rounded-lg bg-primary/5 border border-primary/10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {summary}
      </motion.p>
    </div>
  );
}
