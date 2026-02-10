import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle } from 'lucide-react';

interface IncidentSLAProps {
  severity: number;
  createdAt: string;
  status: string;
  resolvedAt?: string | null;
}

const SLA_MINUTES: Record<number, number> = {
  5: 15,   // Critical: 15 min
  4: 30,   // High: 30 min
  3: 60,   // Medium: 1 hour
  2: 240,  // Low: 4 hours
  1: 480,  // Info: 8 hours
};

export function IncidentSLA({ severity, createdAt, status, resolvedAt }: IncidentSLAProps) {
  const [elapsed, setElapsed] = useState(0);

  const slaMinutes = SLA_MINUTES[severity] || 60;
  const isClosed = status === 'Closed' || status === 'Resolved';

  useEffect(() => {
    const calcElapsed = () => {
      const start = new Date(createdAt).getTime();
      const end = isClosed && resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
      return Math.floor((end - start) / 60000);
    };

    setElapsed(calcElapsed());

    if (isClosed) return;

    const timer = setInterval(() => setElapsed(calcElapsed()), 30000);
    return () => clearInterval(timer);
  }, [createdAt, status, resolvedAt]);

  const remaining = slaMinutes - elapsed;
  const isBreached = remaining <= 0;
  const isWarning = remaining > 0 && remaining <= slaMinutes * 0.25;

  const formatTime = (mins: number) => {
    const abs = Math.abs(mins);
    if (abs < 60) return `${abs}m`;
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  if (isClosed) {
    return (
      <Badge variant="outline" className={`gap-1 ${isBreached ? 'border-destructive/30 text-destructive' : 'border-success/30 text-success'}`}>
        <Clock className="h-3 w-3" />
        {isBreached ? `SLA Breached (+${formatTime(-remaining)})` : `Resolved in ${formatTime(elapsed)}`}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`gap-1 ${
        isBreached ? 'border-destructive/30 text-destructive bg-destructive/5 animate-pulse' :
        isWarning ? 'border-warning/30 text-warning bg-warning/5' :
        'border-muted-foreground/30 text-muted-foreground'
      }`}
    >
      {isBreached ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {isBreached
        ? `SLA BREACHED (+${formatTime(-remaining)})`
        : `⏱ SLA: ${formatTime(remaining)} remaining`
      }
    </Badge>
  );
}
