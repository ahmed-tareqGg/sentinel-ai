import { Shield, Target, Zap, BarChart3, Server, Brain, Database, AlertTriangle, Play, Linkedin, Github, Mail, MessageCircle, Award, GraduationCap, BadgeCheck, Trophy, FileText, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import founderImage from '@/assets/founder-ahmed-tarek.png';

const achievements = [
  { icon: GraduationCap, title: 'Cybersecurity Specialist', description: 'Advanced certification in threat detection and incident response' },
  { icon: Award, title: 'SOC Automation Expert', description: 'Specialized in SOAR platform development and integration' },
  { icon: BadgeCheck, title: 'MITRE ATT&CK Certified', description: 'Proficient in adversary tactics and techniques mapping' },
  { icon: Trophy, title: 'Security Innovation', description: 'Building next-gen AI-driven security operations tools' },
];

const features = [
  { icon: Brain, title: 'AI-Driven Triage', description: 'Automated threat classification using advanced AI models' },
  { icon: Target, title: 'MITRE ATT&CK Aware', description: 'Full mapping to MITRE techniques and tactics' },
  { icon: Play, title: 'Automated Playbooks', description: 'SOAR playbooks that execute containment actions' },
  { icon: BarChart3, title: 'SOC-Ready Metrics', description: 'Real-time MTTR, MTTD, and performance KPIs' },
];

const architecture = [
  { icon: Server, title: 'Log Ingestion', description: 'Multi-source security log collection' },
  { icon: Brain, title: 'AI Analysis', description: 'Real-time threat detection and classification' },
  { icon: AlertTriangle, title: 'Threat Intelligence', description: 'IOC enrichment and context' },
  { icon: Database, title: 'Incident Management', description: 'Centralized incident tracking' },
  { icon: Play, title: 'SOAR Playbooks', description: 'Automated response orchestration' },
];

const socialLinks = [
  { icon: Mail, href: 'mailto:tarekaboya2019@gmail.com', label: 'Email' },
  { icon: Linkedin, href: 'https://www.linkedin.com/in/ah-m-ed-tareq-48069523b/', label: 'LinkedIn' },
  { icon: Github, href: 'https://github.com/Palestine-1', label: 'GitHub' },
  { icon: Shield, href: 'https://tryhackme.com/p/ahmedtareq', label: 'TryHackMe' },
  { icon: MessageCircle, href: 'https://wa.me/201559181558', label: 'WhatsApp' },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

export default function About() {
  return (
    <div className="bg-background">
      {/* Hero Section */}
      <section className="relative py-24 lg:py-36 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-primary/5 blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-accent/5 blur-3xl animate-float" style={{ animationDelay: '2s' }} />

        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
            >
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary font-medium">Enterprise Security Platform</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight tracking-tight"
            >
              Autonomous Security
              <br />
              <span className="text-gradient">Operations Center</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            >
              AI-driven detection, investigation, and response for modern security teams
            </motion.p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-24 px-6">
        <div className="container mx-auto">
          <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">Our Mission</h2>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl mx-auto">
              Our mission is to reduce SOC fatigue and accelerate incident response using intelligent automation. 
              We believe that security analysts should focus on strategic decisions, not repetitive tasks.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Why SOCMind */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-card/50" />
        <div className="container mx-auto px-6 relative">
          <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Why SOCMind?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Purpose-built for production SOC operations
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {features.map((feature, i) => (
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
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="py-24 px-6">
        <div className="container mx-auto">
          <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Architecture Overview</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              End-to-end autonomous pipeline from ingestion to response
            </p>
          </motion.div>
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {architecture.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="relative group"
                >
                  <div className="p-5 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all duration-300 text-center">
                    <div className="p-3 rounded-xl bg-primary/10 w-fit mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                      <item.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-semibold text-foreground text-sm mb-1">{item.title}</h4>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  {index < architecture.length - 1 && (
                    <div className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                      <Zap className="h-4 w-4 text-primary/50" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Founder Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-card/50" />
        <div className="absolute top-10 right-20 w-64 h-64 rounded-full bg-primary/5 blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="container mx-auto px-6 relative">
          <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Meet the Founder</h2>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto text-center"
          >
            <div className="w-40 h-40 rounded-full overflow-hidden border-2 border-primary/30 mx-auto mb-6 group cursor-pointer transition-all duration-500 hover:border-primary hover:shadow-[0_0_30px_hsl(187_100%_50%/0.3)] hover:scale-105">
              <img 
                src={founderImage} 
                alt="Ahmed Tarek - Founder" 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-2">Ahmed Tarek</h3>
            <p className="text-primary font-medium mb-2">Security Engineer & SOC Automation Architect</p>
            <div className="flex items-center gap-2 justify-center mb-4">
              <span className="px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-xs font-bold text-accent flex items-center gap-1">
                <Trophy className="h-3 w-3" /> Top 4% — TryHackMe
              </span>
            </div>
            <p className="text-muted-foreground max-w-lg mx-auto mb-6 leading-relaxed">
              Passionate about building intelligent security solutions that empower SOC teams to work smarter, not harder.
            </p>
            <div className="flex gap-3 justify-center mb-6">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl bg-card border border-border hover:border-primary/40 text-muted-foreground hover:text-primary transition-all duration-300"
                  aria-label={link.label}
                >
                  <link.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
            <Link
              to="/resume"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all duration-300 text-sm font-medium group"
            >
              <FileText className="h-4 w-4" /> View Full Resume
              <ExternalLink className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Achievements Section */}
      <section className="py-24 px-6">
        <div className="container mx-auto">
          <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Achievements & Certifications</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Continuous learning and professional development in cybersecurity
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {achievements.map((achievement, index) => (
              <motion.div
                key={achievement.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all duration-300"
              >
                <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                  <achievement.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{achievement.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{achievement.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
