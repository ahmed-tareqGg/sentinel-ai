import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { GlobalFooter } from '@/components/layout/GlobalFooter';
import { Shield, Target, Zap, BarChart3, Server, Brain, Database, AlertTriangle, Play, Linkedin, Github, Mail, MessageCircle, Award, GraduationCap, BadgeCheck, Trophy } from 'lucide-react';
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
  { icon: MessageCircle, href: 'https://wa.me/201559181558', label: 'WhatsApp' },
];

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      {/* Hero Section */}
      <section className="relative py-24 px-6 bg-gradient-to-b from-primary/10 to-background">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary font-medium">Enterprise Security Platform</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Autonomous Security<br />Operations Center
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            AI-driven detection, investigation, and response for modern security teams
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-6">Our Mission</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Our mission is to reduce SOC fatigue and accelerate incident response using intelligent automation. 
            We believe that security analysts should focus on strategic decisions, not repetitive tasks.
          </p>
        </div>
      </section>

      {/* Why SOCMind */}
      <section className="py-20 px-6 bg-card/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">Why SOCMind?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all">
                <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">Architecture Overview</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {architecture.map((item, index) => (
              <div key={item.title} className="flex items-center gap-4">
                <div className="p-4 rounded-xl bg-card border border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{item.title}</h4>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </div>
                {index < architecture.length - 1 && (
                  <Zap className="h-5 w-5 text-primary hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founder Section */}
      <section className="py-20 px-6 bg-card/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-12">Meet the Founder</h2>
          <div className="flex flex-col items-center">
            <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-primary/30 mb-6 group cursor-pointer transition-all duration-500 hover:border-primary hover:shadow-[0_0_30px_hsl(var(--primary)/0.4)] hover:scale-110">
              <img 
                src={founderImage} 
                alt="Ahmed Tarek - Founder" 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-2">Ahmed Tarek</h3>
            <p className="text-primary font-medium mb-4">Security Engineer & SOC Automation Architect</p>
            <p className="text-muted-foreground max-w-lg mb-6">
              Passionate about building intelligent security solutions that empower SOC teams to work smarter, not harder.
            </p>
            <div className="flex gap-3">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-lg bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all"
                  aria-label={link.label}
                >
                  <link.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Achievements Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-foreground text-center mb-4">Achievements & Certifications</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Continuous learning and professional development in cybersecurity
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {achievements.map((achievement, index) => (
              <div 
                key={achievement.title} 
                className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 group"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                  <achievement.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{achievement.title}</h3>
                <p className="text-sm text-muted-foreground">{achievement.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <GlobalFooter />
    </div>
  );
}
