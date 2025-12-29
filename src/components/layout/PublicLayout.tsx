import { Outlet } from 'react-router-dom';
import { PublicNavbar } from './PublicNavbar';
import { GlobalFooter } from './GlobalFooter';

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicNavbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <GlobalFooter />
    </div>
  );
}
