import { motion } from 'framer-motion';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';

const stats = [
  { value: 99.9, suffix: '%', label: 'Detection Accuracy', decimals: 1 },
  { value: 1, prefix: '<', suffix: 's', label: 'Response Time', decimals: 0 },
  { value: 6, suffix: '+', label: 'AI Models', decimals: 0 },
  { value: 500, suffix: '+', label: 'MITRE Techniques', decimals: 0 },
];

function StatItem({ value, prefix, suffix, label, decimals, delay }: {
  value: number; prefix?: string; suffix?: string; label: string; decimals: number; delay: number;
}) {
  const count = useAnimatedCounter(value, 2000);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="text-center"
    >
      <div className="text-3xl md:text-5xl font-bold text-primary mb-2 font-mono">
        {prefix}{decimals > 0 ? count.toFixed(decimals) : Math.round(count)}{suffix}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </motion.div>
  );
}

export function AnimatedStats() {
  return (
    <section className="py-16 bg-card/50 border-y border-border">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <StatItem key={stat.label} {...stat} delay={i * 0.1} />
          ))}
        </div>
      </div>
    </section>
  );
}
