import { motion } from 'framer-motion';
import { Shield, CheckCircle2, Lock, FileCheck } from 'lucide-react';

const badges = [
  { icon: Shield, label: 'SOC 2 Type II', description: 'Compliant' },
  { icon: Lock, label: 'ISO 27001', description: 'Certified' },
  { icon: FileCheck, label: 'GDPR', description: 'Compliant' },
  { icon: CheckCircle2, label: 'MITRE ATT&CK', description: 'Aligned' },
];

export function TrustBadges() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-6">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm text-muted-foreground mb-8 uppercase tracking-widest"
        >
          Trusted by enterprise security teams
        </motion.p>
        <div className="flex flex-wrap justify-center gap-8 md:gap-12">
          {badges.map((badge, i) => (
            <motion.div
              key={badge.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3 px-6 py-3 rounded-xl border border-border bg-card/50"
            >
              <badge.icon className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-semibold text-foreground">{badge.label}</div>
                <div className="text-xs text-muted-foreground">{badge.description}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
