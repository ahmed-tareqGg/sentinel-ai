import { Link } from 'react-router-dom';
import { Server, Brain, AlertTriangle, Database, Play, BarChart3, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const steps = [
  {
    number: '01',
    icon: Server,
    title: 'Log Ingestion',
    description: 'Security logs are ingested from multiple sources including firewalls, endpoints, cloud services, and SIEM systems.',
  },
  {
    number: '02',
    icon: Brain,
    title: 'AI Analysis',
    description: 'AI classifies threats, assigns risk levels, and detects MITRE ATT&CK techniques automatically.',
  },
  {
    number: '03',
    icon: AlertTriangle,
    title: 'Threat Enrichment',
    description: 'Indicators are enriched using threat intelligence feeds for additional context and severity.',
  },
  {
    number: '04',
    icon: Database,
    title: 'Incident Creation',
    description: 'Incidents are automatically created with full context, evidence, and recommended actions.',
  },
  {
    number: '05',
    icon: Play,
    title: 'Automated Response',
    description: 'SOAR playbooks execute containment, notification, and remediation actions automatically.',
  },
  {
    number: '06',
    icon: BarChart3,
    title: 'Reporting & Metrics',
    description: 'SOC KPIs including MTTR, MTTD, and detection coverage are updated in real-time.',
  },
];

export default function HowItWorks() {
  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="relative py-24 lg:py-36 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-20 right-10 w-72 h-72 rounded-full bg-primary/5 blur-3xl animate-float" />
        <div className="absolute bottom-10 left-10 w-80 h-80 rounded-full bg-accent/5 blur-3xl animate-float" style={{ animationDelay: '2s' }} />

        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
            >
              <Play className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary font-medium">6-Step Autonomous Pipeline</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight tracking-tight"
            >
              How SOCMind
              <br />
              <span className="text-gradient">Works</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            >
              From log ingestion to automated response in seconds, not hours
            </motion.p>
          </div>
        </div>
      </section>

      {/* Steps Timeline */}
      <section className="py-24 px-6">
        <div className="container mx-auto">
          <div className="max-w-4xl mx-auto space-y-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative flex gap-6 items-start group"
              >
                {/* Timeline connector */}
                {index < steps.length - 1 && (
                  <div className="absolute left-8 top-20 w-px h-16 bg-gradient-to-b from-primary/40 to-transparent" />
                )}

                {/* Step icon */}
                <div className="relative flex-shrink-0 w-16 h-16 rounded-2xl bg-card border border-border group-hover:border-primary/40 flex items-center justify-center transition-all duration-300 group-hover:shadow-[0_0_20px_hsl(187_100%_50%/0.15)]">
                  <step.icon className="h-7 w-7 text-primary" />
                </div>

                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold font-mono text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                      STEP {step.number}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Visual Pipeline */}
      <section className="py-16 px-6">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="max-w-5xl mx-auto rounded-2xl border border-border bg-card/80 p-6 shadow-2xl shadow-primary/5"
          >
            <div className="flex items-center gap-2 mb-6 px-2">
              <div className="w-3 h-3 rounded-full bg-destructive/60" />
              <div className="w-3 h-3 rounded-full bg-warning/60" />
              <div className="w-3 h-3 rounded-full bg-success/60" />
              <span className="text-xs text-muted-foreground ml-2 font-mono">SOCMind Pipeline</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {steps.map((step, i) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="rounded-xl bg-secondary/50 p-4 text-center border border-border/50"
                >
                  <step.icon className="h-5 w-5 text-primary mx-auto mb-2" />
                  <div className="text-xs font-semibold text-foreground">{step.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 font-mono">Step {step.number}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative max-w-4xl mx-auto text-center rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-12 md:p-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to Transform Your SOC?
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              Experience autonomous security operations with SOCMind
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/demo-landing">
                <Button size="lg" className="gap-2 px-8 py-6 text-base glow-primary">
                  Try Live Demo <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="px-8 py-6 text-base">
                  Get Started Free
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
