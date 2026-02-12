import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'critical';
}

const variantStyles = {
  default: 'border-border',
  primary: 'border-primary/30 bg-primary/5',
  success: 'border-success/30 bg-success/5',
  warning: 'border-warning/30 bg-warning/5',
  critical: 'border-critical/30 bg-critical/5',
};

const iconStyles = {
  default: 'bg-secondary text-muted-foreground',
  primary: 'bg-primary/20 text-primary',
  success: 'bg-success/20 text-success',
  warning: 'bg-warning/20 text-warning',
  critical: 'bg-critical/20 text-critical',
};

function extractNumber(val: string | number): { num: number; prefix: string; suffix: string } {
  if (typeof val === 'number') return { num: val, prefix: '', suffix: '' };
  const match = String(val).match(/^([^0-9]*)(\d+)(.*)$/);
  if (match) return { num: parseInt(match[2], 10), prefix: match[1], suffix: match[3] };
  return { num: 0, prefix: '', suffix: String(val) };
}

export function StatCard({ title, value, subtitle, icon, trend, variant = 'default' }: StatCardProps) {
  const { num, prefix, suffix } = extractNumber(value);
  const animatedNum = useAnimatedCounter(num);
  const displayValue = num > 0 ? `${prefix}${animatedNum}${suffix}` : value;

  return (
    <div className={cn(
      'rounded-xl border bg-card p-5 transition-all duration-300 hover:scale-[1.02] animate-fade-in',
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground tabular-nums">{displayValue}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <p className={cn(
              'mt-2 text-sm font-medium',
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% from yesterday
            </p>
          )}
        </div>
        <div className={cn('rounded-lg p-3', iconStyles[variant])}>
          {icon}
        </div>
      </div>
    </div>
  );
}
