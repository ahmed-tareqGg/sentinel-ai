import { ReactNode } from 'react';
import { AppNavbar } from './AppNavbar';
import { GlobalFooter } from './GlobalFooter';
import { DemoBanner } from '@/components/demo/DemoBanner';
import { GuidedTour } from '@/components/demo/GuidedTour';
import { SOCChatWidget } from '@/components/chat/SOCChatWidget';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background bg-grid flex flex-col">
      <DemoBanner />
      <GuidedTour />
      <AppNavbar />
      <main className="p-4 lg:p-6 flex-1">
        {children}
      </main>
      <GlobalFooter />
      <SOCChatWidget />
    </div>
  );
}
