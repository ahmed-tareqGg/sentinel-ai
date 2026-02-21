import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, AlertTriangle, BarChart3, Settings, Activity, FileText,
  Zap, Plug, ClipboardCheck, FileCheck, Target, Server, ScrollText, Shield,
  MessageSquare, Play, Cloud, Search, Bot, User, LogOut,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useAuth } from '@/hooks/useAuth';

const pages = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', keywords: 'home overview' },
  { icon: AlertTriangle, label: 'Incidents', path: '/incidents', keywords: 'alerts events' },
  { icon: ScrollText, label: 'Live Logs', path: '/live-logs', keywords: 'stream realtime' },
  { icon: Server, label: 'Data Sources', path: '/data-sources', keywords: 'agents collectors' },
  { icon: Bot, label: 'Agent Platform', path: '/agent-platform', keywords: 'agents deploy' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics', keywords: 'charts metrics' },
  { icon: Target, label: 'MITRE Coverage', path: '/mitre-coverage', keywords: 'att&ck framework' },
  { icon: Shield, label: 'Threat Intel', path: '/threat-intel', keywords: 'ioc threat feeds' },
  { icon: Activity, label: 'Threat Hunting', path: '/threat-hunting', keywords: 'hunt search' },
  { icon: Zap, label: 'Playbooks', path: '/playbooks', keywords: 'soar automation' },
  { icon: ClipboardCheck, label: 'Approvals', path: '/approvals', keywords: 'approve reject' },
  { icon: MessageSquare, label: 'Team Chat', path: '/team-chat', keywords: 'chat message' },
  { icon: FileText, label: 'Reports', path: '/reports', keywords: 'generate export' },
  { icon: FileCheck, label: 'Compliance', path: '/compliance', keywords: 'iso nist grc' },
  { icon: Plug, label: 'Integrations', path: '/integrations', keywords: 'connect api' },
  { icon: Play, label: 'Demo', path: '/demo', keywords: 'demo tour' },
  { icon: Settings, label: 'Settings', path: '/settings', keywords: 'config preferences' },
  { icon: Cloud, label: 'Cloud Admin', path: '/admin/cloud', keywords: 'admin panel' },
];

const actions = [
  { icon: Search, label: 'Search Incidents', action: 'search-incidents', keywords: 'find lookup' },
  { icon: MessageSquare, label: 'Open AI Copilot', action: 'open-copilot', keywords: 'ai chat ask' },
  { icon: User, label: 'View Profile', action: 'profile', keywords: 'account user' },
  { icon: LogOut, label: 'Sign Out', action: 'signout', keywords: 'logout exit' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = useCallback((path: string) => {
    setOpen(false);
    navigate(path);
  }, [navigate]);

  const handleAction = useCallback((action: string) => {
    setOpen(false);
    switch (action) {
      case 'search-incidents':
        navigate('/incidents');
        break;
      case 'open-copilot':
        window.dispatchEvent(new Event('open-soc-chat'));
        break;
      case 'profile':
        navigate('/profile');
        break;
      case 'signout':
        signOut().then(() => navigate('/auth'));
        break;
    }
  }, [navigate, signOut]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages & actions... (⌘K)" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {pages.map((page) => (
            <CommandItem
              key={page.path}
              value={`${page.label} ${page.keywords}`}
              onSelect={() => handleSelect(page.path)}
              className="cursor-pointer"
            >
              <page.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              {page.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          {actions.map((action) => (
            <CommandItem
              key={action.action}
              value={`${action.label} ${action.keywords}`}
              onSelect={() => handleAction(action.action)}
              className="cursor-pointer"
            >
              <action.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
