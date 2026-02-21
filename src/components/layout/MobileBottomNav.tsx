import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, AlertTriangle, BarChart3, 
  MessageSquare, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const MOBILE_NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: AlertTriangle, label: 'Incidents', path: '/incidents' },
  { icon: Zap, label: 'Playbooks', path: '/playbooks' },
  { icon: MessageSquare, label: 'Chat', path: '/team-chat' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
];

export function MobileBottomNav() {
  const location = useLocation();
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border lg:hidden">
      <div className="flex items-center justify-around h-14 px-1">
        {MOBILE_NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-0 flex-1',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground active:text-foreground'
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
              <item.icon className={cn('h-5 w-5 transition-colors', isActive && 'text-primary')} />
              <span className={cn(
                'text-[9px] font-semibold truncate transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* Safe area for iOS */}
      <div className="pb-safe" />
    </nav>
  );
}
