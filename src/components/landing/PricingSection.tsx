import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const plans = [
  {
    name: 'Community',
    price: 'Free',
    description: 'For small teams getting started',
    features: [
      'Up to 5 analysts',
      'Basic incident management',
      'AI-powered analysis',
      'MITRE ATT&CK mapping',
      'Community support',
    ],
    cta: 'Get Started',
    variant: 'outline' as const,
  },
  {
    name: 'Professional',
    price: '$49',
    period: '/analyst/mo',
    description: 'For growing SOC teams',
    features: [
      'Unlimited analysts',
      'SOAR automation engine',
      'Correlation rules engine',
      'War Room collaboration',
      'Executive dashboard',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    variant: 'default' as const,
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large-scale deployments',
    features: [
      'Everything in Professional',
      'Multi-tenant architecture',
      'Custom AI model integration',
      'Dedicated agent fleet',
      'On-premise deployment',
      '24/7 dedicated support',
    ],
    cta: 'Contact Sales',
    variant: 'outline' as const,
  },
];

export function PricingSection() {
  return (
    <section className="py-24 bg-card/30">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Start free. Scale as your security operations grow.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl border p-8 flex flex-col ${
                plan.popular
                  ? 'border-primary bg-card shadow-lg shadow-primary/10'
                  : 'border-border bg-card/50'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  Most Popular
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-foreground mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                {plan.period && <span className="text-muted-foreground text-sm">{plan.period}</span>}
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/auth">
                <Button variant={plan.variant} className="w-full gap-2">
                  {plan.cta} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
