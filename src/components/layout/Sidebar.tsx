import { Link, useLocation } from 'react-router-dom';
import {
  Bot,
  LayoutDashboard,
  AlertTriangle,
  BarChart3,
  Settings,
  Activity,
  FileText,
  LogOut,
  User,
  Zap,
  Play,
  Cloud,
  Plug,
  ClipboardCheck,
  FileCheck,
  Target,
  Server,
  ScrollText,
  ChevronRight,
  MessageSquare,
  Swords,
  Trophy,
  PieChart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { ROLE_METADATA, SOCRole, NAV_ACCESS } from '@/hooks/usePermissions';
import socmindLogo from '@/assets/socmind-logo.png';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

const navGroups = [
  {
    label: 'Operations',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: AlertTriangle, label: 'Incidents', path: '/incidents' },
      { icon: ScrollText, label: 'Live Logs', path: '/live-logs' },
      { icon: Server, label: 'Data Sources', path: '/data-sources' },
      { icon: Bot, label: 'Agent Platform', path: '/agent-platform' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { icon: BarChart3, label: 'Analytics', path: '/analytics' },
      { icon: PieChart, label: 'Executive Dashboard', path: '/executive' },
      { icon: Target, label: 'MITRE Coverage', path: '/mitre-coverage' },
      { icon: Zap, label: 'Playbooks', path: '/playbooks' },
      { icon: Swords, label: 'Attack Simulator', path: '/attack-simulator' },
      { icon: ClipboardCheck, label: 'Approvals', path: '/approvals' },
      { icon: MessageSquare, label: 'Team Chat', path: '/team-chat' },
    ],
  },
  {
    label: 'Management',
    items: [
      { icon: FileText, label: 'Reports', path: '/reports' },
      { icon: FileCheck, label: 'Compliance', path: '/compliance' },
      { icon: Plug, label: 'Integrations', path: '/integrations' },
    ],
  },
  {
    label: 'System',
    items: [
      { icon: Play, label: 'Demo', path: '/demo' },
      { icon: Settings, label: 'Settings', path: '/settings' },
      { icon: Cloud, label: 'Cloud Admin', path: '/admin/cloud' },
    ],
  },
];

export function Sidebar() {
  const location = useLocation();
  const { profile, role, signOut } = useAuth();

  const roleMeta = role ? ROLE_METADATA[role as SOCRole] : null;

  const isItemAllowed = (path: string) => {
    const allowedRoles = NAV_ACCESS[path];
    if (!allowedRoles) return true;
    return role ? allowedRoles.includes(role as SOCRole) : false;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border/50 bg-sidebar hidden lg:block">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <img src={socmindLogo} alt="SOCMind" className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground">SOCMind</h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Security Operations</p>
            </div>
          </div>

          {/* User Card */}
          <div className="mx-3 mb-2 rounded-lg bg-secondary/30 border border-border/30 p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 text-primary ring-1 ring-primary/20">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate leading-tight">
                  {profile?.full_name || profile?.email?.split('@')[0]}
                </p>
                {roleMeta && (
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 mt-0.5 h-4', roleMeta.badgeClass)}>
                    {roleMeta.label}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Groups */}
          <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-4 scrollbar-thin">
            {navGroups.map((group) => {
              const visibleItems = group.items.filter(item => isItemAllowed(item.path));
              if (visibleItems.length === 0) return null;

              return (
                <div key={group.label}>
                  <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={cn(
                            'group flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-all duration-150',
                            isActive
                              ? 'bg-primary/10 text-primary shadow-sm shadow-primary/5'
                              : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                          )}
                        >
                          <item.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
                          <span className="flex-1">{item.label}</span>
                          {isActive && (
                            <ChevronRight className="h-3 w-3 text-primary/50" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-border/30 p-3 space-y-2">
            {/* System Status */}
            <div className="flex items-center gap-2.5 rounded-md bg-success/5 border border-success/10 px-3 py-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <div className="flex-1">
                <p className="text-[11px] font-medium text-foreground leading-tight">System Active</p>
                <p className="text-[10px] text-muted-foreground/60">All services running</p>
              </div>
            </div>

            {/* Sign Out */}
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
