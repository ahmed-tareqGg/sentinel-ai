import { ReactNode, Suspense, lazy } from 'react';
import { AppNavbar } from './AppNavbar';
import { GlobalFooter } from './GlobalFooter';
import { DemoBanner } from '@/components/demo/DemoBanner';
import { GuidedTour } from '@/components/demo/GuidedTour';
import { SOCChatWidget } from '@/components/chat/SOCChatWidget';
import { MobileBottomNav } from './MobileBottomNav';
import { SLABreachMonitor } from '@/components/notifications/SLABreachMonitor';
import { SmartAlertBanner } from '@/components/notifications/SmartAlertBanner';

const ParticleNetwork = lazy(() =>
  import('@/components/three/ParticleNetwork').then((m) => ({ default: m.ParticleNetwork }))
);

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  return (
    <div className="relative min-h-screen bg-background flex flex-col overflow-hidden">
      {/* 3D Background — loaded lazily so it never blocks the UI */}
      <Suspense fallback={null}>
        <ParticleNetwork />
      </Suspense>

      {/* Subtle radial vignette to focus content */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,hsl(var(--primary)/0.06)_0%,transparent_70%)]" />

      {/* Grid lines overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-grid opacity-30" />

      {/* Content layer — above the 3D canvas */}
      <div className="relative z-10 flex flex-col flex-1">
        <DemoBanner />
        <GuidedTour />
        <SLABreachMonitor />
        <SmartAlertBanner />
        <AppNavbar />
        <main className="p-4 lg:p-6 flex-1 pb-20 lg:pb-6">
          {children}
        </main>
        <GlobalFooter />
      </div>

      <SOCChatWidget />
      <MobileBottomNav />
    </div>
  );
}



