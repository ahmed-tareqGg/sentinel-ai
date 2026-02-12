import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, AlertTriangle, BarChart3, Settings, Activity, FileText,
  Zap, Plug, ClipboardCheck, FileCheck, Target, Server, ScrollText, Shield,
  MessageSquare, Play, Cloud, Search,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

const pages = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: AlertTriangle, label: 'Incidents', path: '/incidents' },
  { icon: ScrollText, label: 'Live Logs', path: '/live-logs' },
  { icon: Server, label: 'Data Sources', path: '/data-sources' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Target, label: 'MITRE Coverage', path: '/mitre-coverage' },
  { icon: Shield, label: 'Threat Intel', path: '/threat-intel' },
  { icon: Activity, label: 'Threat Hunting', path: '/threat-hunting' },
  { icon: Zap, label: 'Playbooks', path: '/playbooks' },
  { icon: ClipboardCheck, label: 'Approvals', path: '/approvals' },
  { icon: MessageSquare, label: 'Team Chat', path: '/team-chat' },
  { icon: FileText, label: 'Reports', path: '/reports' },
  { icon: FileCheck, label: 'Compliance', path: '/compliance' },
  { icon: Plug, label: 'Integrations', path: '/integrations' },
  { icon: Play, label: 'Demo', path: '/demo' },
  { icon: Settings, label: 'Settings', path: '/settings' },
  { icon: Cloud, label: 'Cloud Admin', path: '/admin/cloud' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

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

  const handleSelect = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages... (type to filter)" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {pages.map((page) => (
            <CommandItem
              key={page.path}
              value={page.label}
              onSelect={() => handleSelect(page.path)}
              className="cursor-pointer"
            >
              <page.icon className="mr-2 h-4 w-4" />
              {page.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
