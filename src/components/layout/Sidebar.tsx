import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  BarChart3, 
  Settings, 
  Shield,
  Activity,
  FileText,
  LogOut,
  User,
  Zap,
  Play,
  Plug,
  ClipboardCheck,
  FileCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['admin', 'soc_analyst', 'viewer'] },
  { icon: AlertTriangle, label: 'Incidents', path: '/incidents', roles: ['admin', 'soc_analyst', 'viewer'] },
  { icon: BarChart3, label: 'Analytics', path: '/analytics', roles: ['admin', 'soc_analyst', 'viewer'] },
  { icon: FileText, label: 'Reports', path: '/reports', roles: ['admin', 'soc_analyst'] },
  { icon: Zap, label: 'Playbooks', path: '/playbooks', roles: ['admin'] },
  { icon: ClipboardCheck, label: 'Approvals', path: '/approvals', roles: ['admin', 'soc_analyst'] },
  { icon: Plug, label: 'Integrations', path: '/integrations', roles: ['admin'] },
  { icon: FileCheck, label: 'Compliance', path: '/compliance', roles: ['admin'] },
  { icon: Play, label: 'Demo', path: '/demo', roles: ['admin', 'soc_analyst', 'viewer'] },
  { icon: Settings, label: 'Settings', path: '/settings', roles: ['admin'] },
];

const roleColors = {
  admin: 'bg-destructive/20 text-destructive border-destructive/30',
  soc_analyst: 'bg-warning/20 text-warning border-warning/30',
  viewer: 'bg-muted text-muted-foreground border-border',
};

const roleLabels = {
  admin: 'Admin',
  soc_analyst: 'Analyst',
  viewer: 'Viewer',
};

export function Sidebar() {
  const location = useLocation();
  const { profile, role, signOut } = useAuth();

  const filteredNavItems = navItems.filter(item => 
    role && item.roles.includes(role)
  );

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-sidebar">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 glow-primary">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">SOCMind</h1>
            <p className="text-xs text-muted-foreground">AI-Powered SOC</p>
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
              <Badge variant="outline" className={cn('text-xs mt-1', roleColors[role || 'viewer'])}>
                {roleLabels[role || 'viewer']}
              </Badge>
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
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary glow-primary'
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
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
