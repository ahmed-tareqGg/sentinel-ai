import { ReactNode } from 'react';
import { AppNavbar } from './AppNavbar';
import { GlobalFooter } from './GlobalFooter';
import { DemoBanner } from '@/components/demo/DemoBanner';
import { GuidedTour } from '@/components/demo/GuidedTour';
import { SOCChatWidget } from '@/components/chat/SOCChatWidget';
import { MobileBottomNav } from './MobileBottomNav';
import { SLABreachMonitor } from '@/components/notifications/SLABreachMonitor';
import { SmartAlertBanner } from '@/components/notifications/SmartAlertBanner';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  return (
    <div className="relative min-h-screen bg-background flex flex-col overflow-hidden">

      {/* Content layer */}
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



