import { useState, useCallback } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import {
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
  Bell,
  Search,
  X,
  ChevronDown,
  Menu,
  Shield,
  MessageSquare,
  Sun,
  Moon,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROLE_METADATA, SOCRole, NAV_ACCESS } from '@/hooks/usePermissions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/backend/client';
import socmindLogo from '@/assets/socmind-logo.png';

const navGroups = [
  {
    label: 'Operations',
    icon: LayoutDashboard,
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
    icon: BarChart3,
    items: [
      { icon: BarChart3, label: 'Analytics', path: '/analytics' },
      { icon: Target, label: 'MITRE Coverage', path: '/mitre-coverage' },
      { icon: Shield, label: 'Threat Intel', path: '/threat-intel' },
      { icon: Activity, label: 'Threat Hunting', path: '/threat-hunting' },
      { icon: Zap, label: 'Playbooks', path: '/playbooks' },
      { icon: ClipboardCheck, label: 'Approvals', path: '/approvals' },
      { icon: MessageSquare, label: 'Team Chat', path: '/team-chat' },
    ],
  },
  {
    label: 'Management',
    icon: FileText,
    items: [
      { icon: FileText, label: 'Reports', path: '/reports' },
      { icon: FileCheck, label: 'Compliance', path: '/compliance' },
      { icon: Plug, label: 'Integrations', path: '/integrations' },
      { icon: ScrollText, label: 'Audit Logs', path: '/audit-logs' },
    ],
  },
  {
    label: 'System',
    icon: Settings,
    items: [
      { icon: Play, label: 'Demo', path: '/demo' },
      { icon: Settings, label: 'Settings', path: '/settings' },
      { icon: Cloud, label: 'Cloud Admin', path: '/admin/cloud' },
    ],
  },
];

// Old notification interface removed — now using NotificationCenter component

export function AppNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, role, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  const roleMeta = role ? ROLE_METADATA[role as SOCRole] : null;

  const isItemAllowed = (path: string) => {
    const allowedRoles = NAV_ACCESS[path];
    if (!allowedRoles) return true;
    return role ? allowedRoles.includes(role as SOCRole) : false;
  };

  const isGroupActive = (items: { path: string }[]) =>
    items.some((item) => location.pathname === item.path);

  // Search logic
  const debounce = useCallback((func: Function, delay: number) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }, []);

  const performSearch = useCallback(
    (query: string) => {
      if (query.trim()) {
        navigate(`/incidents?search=${encodeURIComponent(query.trim())}`, {
          replace: location.pathname === '/incidents',
        });
      } else if (location.pathname === '/incidents') {
        navigate('/incidents', { replace: true });
      }
    },
    [navigate, location.pathname]
  );

  const debouncedSearch = useCallback(debounce(performSearch, 300), [performSearch]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    debouncedSearch(value);
  };

  const clearSearch = () => {
    setSearchQuery('');
    if (location.pathname === '/incidents') {
      navigate('/incidents', { replace: true });
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  const allNavItems = navGroups.flatMap((g) => g.items).filter((item) => isItemAllowed(item.path));

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background shadow-sm shadow-black/20">
      <div className="flex h-11 items-center gap-2 px-3 lg:px-5">

        {/* Mobile menu trigger */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden shrink-0 h-8 w-8 hover:bg-secondary">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 bg-background border-border">
            <div className="flex h-full flex-col">
              <div className="flex h-14 items-center gap-3 border-b border-border px-4 bg-secondary/30">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 border border-primary/25 shadow-sm">
                  <img src={socmindLogo} alt="SOCMind" className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-foreground text-sm leading-none">SOCMind</span>
                  <span className="text-[10px] text-muted-foreground leading-none mt-0.5">Security Operations</span>
                </div>
              </div>
              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {navGroups.map((group) => {
                  const visibleItems = group.items.filter((item) => isItemAllowed(item.path));
                  if (visibleItems.length === 0) return null;
                  return (
                    <div key={group.label} className="mb-4">
                      <p className="px-3 mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40">
                        {group.label}
                      </p>
                      {visibleItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                              isActive
                                ? 'bg-primary/10 text-primary border border-primary/15'
                                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </nav>
              <div className="border-t border-border p-3">
                <button
                  onClick={() => { signOut(); setMobileOpen(false); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2 shrink-0 group">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/12 border border-primary/20 shadow-sm group-hover:bg-primary/18 group-hover:border-primary/30 transition-all duration-200">
            <img src={socmindLogo} alt="SOCMind" className="h-4.5 w-4.5" />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-bold text-foreground text-[13px] tracking-tight">SOCMind</span>
          </div>
        </Link>

        {/* Divider */}
        <div className="hidden lg:block h-5 w-px bg-border/60 mx-1" />

        {/* Desktop Nav Groups */}
        <nav className="hidden lg:flex items-center gap-0.5">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => isItemAllowed(item.path));
            if (visibleItems.length === 0) return null;
            const active = isGroupActive(visibleItems);
            const isOpen = hoveredGroup === group.label;

            return (
              <div
                key={group.label}
                className="relative"
                onMouseEnter={() => setHoveredGroup(group.label)}
                onMouseLeave={() => setHoveredGroup(null)}
              >
                <button
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150 outline-none tracking-wide',
                    active
                      ? 'bg-primary/12 text-primary border border-primary/15'
                      : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground border border-transparent'
                  )}
                >
                  <group.icon className="h-3.5 w-3.5" />
                  {group.label}
                  <ChevronDown className={cn('h-3 w-3 opacity-50 transition-transform duration-150', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                  <>
                    <div className="absolute top-full left-0 w-full h-2" />
                    <div className="absolute top-full left-0 z-50 mt-1.5 min-w-[190px] rounded-xl border border-border/60 bg-popover p-1.5 shadow-lg shadow-black/10 animate-in fade-in-0 zoom-in-95 slide-in-from-top-1">
                      {visibleItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setHoveredGroup(null)}
                            className={cn(
                              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition-all duration-100 cursor-pointer',
                              isActive
                                ? 'bg-primary/10 text-primary'
                                : 'text-popover-foreground hover:bg-accent hover:text-accent-foreground'
                            )}
                          >
                            <item.icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side controls */}
        <div className="flex items-center gap-1">

          {/* System status */}
          <div className="hidden md:flex items-center gap-1.5 bg-success/8 border border-success/20 rounded-full px-2.5 py-1 mr-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            <span className="text-[10px] font-semibold text-success/80 tracking-wide">Active</span>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="relative hidden md:block">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              placeholder="Search..."
              className="w-36 lg:w-44 h-7 bg-secondary/40 border-border/50 pl-7 pr-7 text-[11px] rounded-lg focus:bg-secondary focus:border-primary/30 transition-all"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>

          {/* Mobile Search */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 rounded-lg hover:bg-secondary">
                <Search className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="end">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search incidents..."
                  className="w-full bg-secondary/50 border-border pl-8 pr-8 text-xs rounded-lg"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  autoFocus
                />
              </form>
            </PopoverContent>
          </Popover>

          {/* Notifications */}
          <NotificationCenter />

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg hover:bg-secondary transition-colors"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          >
            {theme === 'dark'
              ? <Sun className="h-3.5 w-3.5 text-muted-foreground" />
              : <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
          </Button>

          {/* Divider */}
          <div className="h-5 w-px bg-border/60 mx-0.5" />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 h-7 px-1.5 rounded-lg hover:bg-secondary transition-colors">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 border border-primary/25 text-primary shadow-sm">
                  <User className="h-3 w-3" />
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl border-border/60 shadow-lg shadow-black/10">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{profile?.full_name || 'User'}</span>
                  <span className="text-xs text-muted-foreground font-normal">{profile?.email}</span>
                  {roleMeta && (
                    <Badge variant="outline" className={cn('mt-1 w-fit text-[10px]', roleMeta.badgeClass)}>
                      {roleMeta.label}
                    </Badge>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate('/profile')} className="cursor-pointer text-xs rounded-lg">
                <User className="h-3.5 w-3.5 mr-2" />
                Profile
              </DropdownMenuItem>
              {(role === 'ciso' || role === 'soc_manager') && (
                <DropdownMenuItem onSelect={() => navigate('/settings')} className="cursor-pointer text-xs rounded-lg">
                  <Settings className="h-3.5 w-3.5 mr-2" />
                  Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={async () => { await signOut(); navigate('/auth'); }}
                className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 text-xs rounded-lg"
              >
                <LogOut className="h-3.5 w-3.5 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
