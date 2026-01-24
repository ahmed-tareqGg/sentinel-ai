import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { MobileSidebar } from './MobileSidebar';
import { Header } from './Header';
import { GlobalFooter } from './GlobalFooter';
import { DemoBanner } from '@/components/demo/DemoBanner';
import { GuidedTour } from '@/components/demo/GuidedTour';

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
      <Sidebar />
      <MobileSidebar />
      <div className="lg:ml-64 flex flex-col flex-1">
        <Header title={title} subtitle={subtitle} />
        <main className="p-4 lg:p-6 flex-1">
          {children}
        </main>
        <GlobalFooter />
      </div>
    </div>
  );
}
