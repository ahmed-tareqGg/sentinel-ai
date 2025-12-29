import { Link } from 'react-router-dom';
import { 
  Shield, 
  Brain, 
  Zap, 
  Target, 
  ArrowRight, 
  CheckCircle2,
  Activity,
  Lock,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Analysis',
    description: 'Advanced machine learning algorithms analyze threats in real-time with unprecedented accuracy.',
  },
  {
    icon: Zap,
    title: 'Autonomous Response',
    description: 'Automated playbook execution reduces response time from hours to seconds.',
  },
  {
    icon: Target,
    title: 'MITRE ATT&CK Mapping',
    description: 'Every threat is automatically mapped to MITRE ATT&CK framework for comprehensive coverage.',
  },
  {
    icon: Lock,
    title: 'Enterprise Security',
    description: 'Bank-grade encryption and compliance with SOC 2, GDPR, and ISO 27001 standards.',
  },
];

const stats = [
  { value: '99.9%', label: 'Detection Accuracy' },
  { value: '<1s', label: 'Response Time' },
  { value: '24/7', label: 'Autonomous Monitoring' },
  { value: '500+', label: 'MITRE Techniques Covered' },
];

export default function Landing() {
  return (
    <div className="bg-background">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        
        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary font-medium">Next-Gen SOC Platform</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
              Autonomous Security Operations{' '}
              <span className="text-primary">Powered by AI</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Transform your security operations with intelligent threat detection, 
              automated response, and comprehensive MITRE ATT&CK coverage.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/how-it-works">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  See How It Works
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-card/50 border-y border-border">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why Choose SOCMind?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built for modern security teams who demand speed, accuracy, and comprehensive threat coverage.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="p-6 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all group"
              >
                <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-card/30">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Security Operations, Reimagined
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                SOCMind combines cutting-edge AI with proven security frameworks 
                to deliver a platform that works autonomously while keeping you in control.
              </p>
              
              <ul className="space-y-4">
                {[
                  'Real-time threat detection and classification',
                  'Automated incident response with playbooks',
                  'Comprehensive MITRE ATT&CK coverage',
                  'Explainable AI decisions for full transparency',
                  'Continuous learning from analyst feedback',
                ].map((benefit, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="relative">
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 flex items-center justify-center">
                <div className="text-center p-8">
                  <BarChart3 className="h-24 w-24 text-primary mx-auto mb-6" />
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    Reduce Alert Fatigue by 80%
                  </h3>
                  <p className="text-muted-foreground">
                    AI-driven prioritization ensures your team focuses on what matters most.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Ready to Transform Your SOC?
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              Experience autonomous security operations with SOCMind
            </p>
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
