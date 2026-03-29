import { Link } from 'react-router-dom';
import { ArrowRight, Activity, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export function HeroSection() {
  return (
    <section className="relative py-24 lg:py-40 overflow-hidden">
      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      
      {/* Floating accent orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-primary/5 blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-accent/5 blur-3xl animate-float" style={{ animationDelay: '2s' }} />

      <div className="container mx-auto px-6 relative">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
          >
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary font-medium">Autonomous SOC Platform — v4.0</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-7xl font-bold text-foreground mb-4 leading-tight tracking-tight"
          >
            Security Operations
            <br />
            <span className="text-gradient">Redefined by AI</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mb-8"
          >
            <span className="text-lg md:text-2xl font-semibold tracking-widest uppercase bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
              Next-Generation Autonomous SOC
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            Multi-model AI orchestration, real-time SOAR engine, and full MITRE ATT&CK coverage
            — all in one autonomous platform built for enterprise security teams.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link to="/demo-landing">
              <Button size="lg" className="gap-2 w-full sm:w-auto text-base px-8 py-6 glow-primary">
                Try Live Demo <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 py-6">
                Get Started
              </Button>
            </Link>
          </motion.div>

          {/* Mini dashboard preview */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-16 relative mx-auto max-w-4xl"
          >
            <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-2xl shadow-primary/5">
              <div className="flex items-center gap-2 mb-4 px-2">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <div className="w-3 h-3 rounded-full bg-warning/60" />
                <div className="w-3 h-3 rounded-full bg-success/60" />
                <span className="text-xs text-muted-foreground ml-2 font-mono">SOCMind Dashboard</span>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Active Incidents', value: '12', color: 'text-destructive' },
                  { label: 'AI Analyzed', value: '847', color: 'text-primary' },
                  { label: 'SOAR Actions', value: '156', color: 'text-success' },
                  { label: 'MITRE Coverage', value: '94%', color: 'text-accent' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg bg-secondary/50 p-3 text-center">
                    <div className={`text-xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 rounded-lg bg-secondary/30 h-32 flex items-center justify-center">
                  <div className="flex gap-1 items-end h-16">
                    {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 95, 50].map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ duration: 0.5, delay: 0.8 + i * 0.05 }}
                        className="w-3 rounded-sm bg-primary/60"
                      />
                    ))}
                  </div>
                </div>
                <div className="rounded-lg bg-secondary/30 h-32 flex items-center justify-center">
                  <Shield className="h-12 w-12 text-primary/40" />
                </div>
              </div>
            </div>
            {/* Gradient glow under preview */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-primary/10 blur-3xl rounded-full" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
