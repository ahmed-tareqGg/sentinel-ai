import { motion } from 'framer-motion';
import {
  Brain, Zap, Target, Lock, BarChart3, Users,
  Radio, Gamepad2
} from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'Multi-Model AI',
    description: 'Smart routing across GPT-5, Gemini 2.5/3, with automatic quality guards and confidence scoring.',
  },
  {
    icon: Zap,
    title: 'Real-Time SOAR Engine',
    description: 'Atomic action claiming with PostgreSQL FOR UPDATE SKIP LOCKED, auto-timeout, and retry logic.',
  },
  {
    icon: Target,
    title: 'Full MITRE ATT&CK',
    description: '500+ techniques mapped with heatmap visualization, gap detection, and playbook coverage tracking.',
  },
  {
    icon: Lock,
    title: 'Enterprise GRC',
    description: 'ISO 27001, SOC 2, GDPR compliance automation with auto-evidence collection and gap analysis.',
  },
  {
    icon: Radio,
    title: 'Correlation Engine',
    description: 'Custom detection rules with time-window thresholds, field matching, and auto-incident creation.',
  },
  {
    icon: Users,
    title: 'War Room Collaboration',
    description: 'Per-incident workspace with real-time chat, task management, IOC tracking, and shared timeline.',
  },
  {
    icon: Gamepad2,
    title: 'Attack Simulator',
    description: 'AI-powered MITRE-aligned training scenarios with difficulty levels and analyst scoring.',
  },
  {
    icon: BarChart3,
    title: 'Executive Dashboard',
    description: 'CISO-level KPIs, risk posture charts, financial impact metrics, and analyst leaderboard.',
  },
];

export function FeaturesGrid() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Enterprise-Grade Capabilities
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Every feature built for production SOC operations — not demos.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/40 transition-all duration-300"
            >
              <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
