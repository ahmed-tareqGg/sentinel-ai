import { HeroSection } from '@/components/landing/HeroSection';
import { AnimatedStats } from '@/components/landing/AnimatedStats';
import { FeaturesGrid } from '@/components/landing/FeaturesGrid';
import { TrustBadges } from '@/components/landing/TrustBadges';
import { PricingSection } from '@/components/landing/PricingSection';
import { CTASection } from '@/components/landing/CTASection';

export default function Landing() {
  return (
    <div className="bg-background">
      <HeroSection />
      <AnimatedStats />
      <TrustBadges />
      <FeaturesGrid />
      <PricingSection />
      <CTASection />
    </div>
  );
}
