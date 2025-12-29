import { Link } from 'react-router-dom';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { GlobalFooter } from '@/components/layout/GlobalFooter';
import { Server, Brain, AlertTriangle, Database, Play, BarChart3, ChevronRight } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Server,
    title: 'Log Ingestion',
    description: 'Security logs are ingested from multiple sources including firewalls, endpoints, cloud services, and SIEM systems.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    number: '02',
    icon: Brain,
    title: 'AI Analysis',
    description: 'AI classifies threats, assigns risk levels, and detects MITRE ATT&CK techniques automatically.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    number: '03',
    icon: AlertTriangle,
    title: 'Threat Enrichment',
    description: 'Indicators are enriched using threat intelligence feeds for additional context and severity.',
    color: 'from-orange-500 to-red-500',
  },
  {
    number: '04',
    icon: Database,
    title: 'Incident Creation',
    description: 'Incidents are automatically created with full context, evidence, and recommended actions.',
    color: 'from-green-500 to-emerald-500',
  },
  {
    number: '05',
    icon: Play,
    title: 'Automated Response',
    description: 'SOAR playbooks execute containment, notification, and remediation actions automatically.',
    color: 'from-yellow-500 to-orange-500',
  },
  {
    number: '06',
    icon: BarChart3,
    title: 'Reporting & Metrics',
    description: 'SOC KPIs including MTTR, MTTD, and detection coverage are updated in real-time.',
    color: 'from-cyan-500 to-blue-500',
  },
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      {/* Hero */}
      <section className="py-24 px-6 text-center bg-gradient-to-b from-primary/10 to-background">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
          How SOCMind Works
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          From log ingestion to automated response in seconds, not hours
        </p>
      </section>

      {/* Steps Timeline */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-12">
            {steps.map((step, index) => (
              <div 
                key={step.number}
                className="relative flex gap-6 items-start group"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Timeline line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-8 top-20 w-0.5 h-24 bg-gradient-to-b from-primary/50 to-transparent" />
                )}

                {/* Step number and icon */}
                <div className={`relative flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                  <step.icon className="h-7 w-7 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1 pb-8">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                      STEP {step.number}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Arrow */}
                {index < steps.length - 1 && (
                  <ChevronRight className="absolute -bottom-2 left-7 h-5 w-5 text-primary/50 rotate-90" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-card/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-6">
            Ready to Transform Your SOC?
          </h2>
          <p className="text-muted-foreground mb-8">
            Experience autonomous security operations with SOCMind
          </p>
          <Link 
            to="/auth" 
            className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Get Started
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <GlobalFooter />
    </div>
  );
}
