import { Shield, Lock, Target, FileText, Users, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const trustFeatures = [
  {
    icon: Shield,
    title: 'Security by Design',
    description: 'Built from the ground up with security-first architecture. Every component undergoes rigorous security review.',
    items: ['Secure SDLC practices', 'Regular penetration testing', 'Vulnerability management', 'Security code reviews'],
  },
  {
    icon: CheckCircle2,
    title: 'SOC 2 Ready',
    description: 'Designed to meet SOC 2 Type II requirements with comprehensive security controls.',
    items: ['Access controls', 'Encryption at rest & transit', 'Incident response procedures', 'Change management'],
  },
  {
    icon: Target,
    title: 'MITRE ATT&CK Aligned',
    description: 'Full alignment with the MITRE ATT&CK framework for comprehensive threat coverage.',
    items: ['14 Tactics coverage', '200+ Techniques mapped', 'Detection rules alignment', 'Response playbooks'],
  },
  {
    icon: FileText,
    title: 'Comprehensive Audit Logs',
    description: 'Every action is logged with tamper-evident audit trails for compliance and forensics.',
    items: ['User activity logging', 'System event tracking', 'API access logs', 'Data export capabilities'],
  },
  {
    icon: Users,
    title: 'Role-Based Access Control',
    description: 'Granular permissions ensure users only access what they need.',
    items: ['Admin role', 'SOC Analyst role', 'Viewer role', 'Custom role support'],
  },
  {
    icon: Lock,
    title: 'Data Protection',
    description: 'Enterprise-grade encryption and data handling practices.',
    items: ['AES-256 encryption', 'TLS 1.3 in transit', 'Key management', 'Data residency options'],
  },
];

const certifications = ['SOC 2', 'ISO 27001', 'GDPR', 'MITRE ATT&CK', 'NIST CSF'];

export default function Trust() {
  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="relative py-24 lg:py-36 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-primary/5 blur-3xl animate-float" />
        <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full bg-accent/5 blur-3xl animate-float" style={{ animationDelay: '2s' }} />

        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
            >
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary font-medium">Enterprise-Grade Security</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight tracking-tight"
            >
              Trust &
              <br />
              <span className="text-gradient">Security</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            >
              Security isn't just a feature — it's the foundation of everything we build
            </motion.p>
          </div>
        </div>
      </section>

      {/* Trust Features */}
      <section className="py-24 px-6">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Security Framework</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Multi-layered security controls protecting your data at every level
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {trustFeatures.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/40 transition-all duration-300"
              >
                <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{feature.description}</p>
                <ul className="space-y-2">
                  {feature.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-card/50" />
        <div className="container mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Compliance & Standards</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built to meet the most demanding security and compliance requirements
            </p>
          </motion.div>
          <div className="flex flex-wrap justify-center gap-4">
            {certifications.map((cert, i) => (
              <motion.div
                key={cert}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 px-6 py-3 rounded-xl border border-border bg-card/50 hover:border-primary/40 transition-all duration-300"
              >
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-semibold text-foreground">{cert}</div>
                  <div className="text-xs text-muted-foreground">Compliant</div>
                </div>
              </motion.div>
            ))}
          </div>
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
              Questions About Security?
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              We're happy to discuss our security practices in detail
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="mailto:tarekaboya2019@gmail.com">
                <Button size="lg" className="gap-2 px-8 py-6 text-base glow-primary">
                  Contact Security Team <ArrowRight className="h-5 w-5" />
                </Button>
              </a>
              <Link to="/demo-landing">
                <Button size="lg" variant="outline" className="px-8 py-6 text-base">
                  Try Live Demo
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
