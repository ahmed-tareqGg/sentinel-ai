import { Shield, Lock, Target, FileText, Users, CheckCircle2 } from 'lucide-react';

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

export default function Trust() {
  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="py-24 px-6 bg-gradient-to-b from-primary/10 to-background">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 p-3 rounded-full bg-primary/10 mb-6">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Trust & Security
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Security isn't just a feature—it's the foundation of everything we build
          </p>
        </div>
      </section>

      {/* Trust Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {trustFeatures.map((feature) => (
              <div 
                key={feature.title}
                className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all"
              >
                <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground text-sm mb-4">{feature.description}</p>
                <ul className="space-y-2">
                  {feature.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-20 px-6 bg-card/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-6">Compliance & Standards</h2>
          <p className="text-muted-foreground mb-12">
            Built to meet the most demanding security and compliance requirements
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {['SOC 2', 'ISO 27001', 'GDPR', 'MITRE ATT&CK', 'NIST CSF'].map((cert) => (
              <div 
                key={cert}
                className="px-6 py-3 rounded-lg bg-card border border-border text-foreground font-medium"
              >
                {cert}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-6">
            Questions About Security?
          </h2>
          <p className="text-muted-foreground mb-8">
            We're happy to discuss our security practices in detail
          </p>
          <a 
            href="mailto:tarekaboya2019@gmail.com"
            className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Contact Security Team
          </a>
        </div>
      </section>
    </div>
  );
}
