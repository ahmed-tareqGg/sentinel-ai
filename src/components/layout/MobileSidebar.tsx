import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User, LogOut, Activity } from 'lucide-react';
import {
  LayoutDashboard,
  AlertTriangle,
  BarChart3,
  Settings,
  FileText,
  Zap,
  Play,
  Cloud,
  Plug,
  ClipboardCheck,
  FileCheck,
  Target,
  Server,
  ScrollText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { ROLE_METADATA, SOCRole, NAV_ACCESS } from '@/hooks/usePermissions';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import socmindLogo from '@/assets/socmind-logo.png';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: AlertTriangle, label: 'Incidents', path: '/incidents' },
  { icon: Server, label: 'Data Sources', path: '/data-sources' },
  { icon: ScrollText, label: 'Live Logs', path: '/live-logs' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: FileText, label: 'Reports', path: '/reports' },
  { icon: Zap, label: 'Playbooks', path: '/playbooks' },
  { icon: ClipboardCheck, label: 'Approvals', path: '/approvals' },
  { icon: Plug, label: 'Integrations', path: '/integrations' },
  { icon: FileCheck, label: 'Compliance', path: '/compliance' },
  { icon: Target, label: 'MITRE Coverage', path: '/mitre-coverage' },
  { icon: Play, label: 'Demo', path: '/demo' },
  { icon: Settings, label: 'Settings', path: '/settings' },
  { icon: Cloud, label: 'Cloud Admin', path: '/admin/cloud' },
];

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { profile, role, signOut } = useAuth();

  const filteredNavItems = navItems.filter(item => {
    const allowedRoles = NAV_ACCESS[item.path];
    if (!allowedRoles) return true;
    return role ? allowedRoles.includes(role as SOCRole) : false;
  });

  const roleMeta = role ? ROLE_METADATA[role as SOCRole] : null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="lg:hidden fixed top-3 left-3 z-50 bg-card/80 backdrop-blur-sm border border-border"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 bg-sidebar border-border">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 border-b border-border px-4">
            <img src={socmindLogo} alt="SOCMind" className="h-9 w-9 rounded-lg" />
            <div>
              <h1 className="text-lg font-bold text-foreground">SOCMind</h1>
              <p className="text-xs text-muted-foreground">Security Operations</p>
            </div>
          </div>

          {/* User Info */}
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {profile?.full_name || profile?.email?.split('@')[0]}
                </p>
                {roleMeta && (
                  <Badge variant="outline" className={cn('text-xs mt-1', roleMeta.badgeClass)}>
                    {roleMeta.label}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Status & Logout */}
          <div className="border-t border-border p-4 space-y-3">
            <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
              <div className="relative">
                <Activity className="h-5 w-5 text-success" />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-success animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">System Active</p>
                <p className="text-xs text-muted-foreground">All services running</p>
              </div>
            </div>

            <button
              onClick={() => { signOut(); setOpen(false); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
