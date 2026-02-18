import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Globe, AlertTriangle, Shield, ExternalLink, RefreshCw, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ThreatFeedItem {
  id: string;
  type: 'malware' | 'phishing' | 'ransomware' | 'apt' | 'vulnerability' | 'botnet';
  title: string;
  source: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  ioc?: string;
  country?: string;
  timestamp: Date;
  isNew?: boolean;
}

const THREAT_TYPES = ['malware', 'phishing', 'ransomware', 'apt', 'vulnerability', 'botnet'] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
const SOURCES = ['AlienVault OTX', 'AbuseIPDB', 'ThreatFox', 'URLhaus', 'Feodo Tracker', 'MalwareBazaar'];
const COUNTRIES = ['CN', 'RU', 'US', 'KP', 'IR', 'BR', 'DE', 'IN', 'UA', 'NL'];
const COUNTRIES_FULL: Record<string, string> = {
  CN: 'China', RU: 'Russia', US: 'United States', KP: 'North Korea',
  IR: 'Iran', BR: 'Brazil', DE: 'Germany', IN: 'India', UA: 'Ukraine', NL: 'Netherlands'
};

const THREAT_TEMPLATES: Record<string, string[]> = {
  malware: [
    'New AgentTesla variant targeting financial sector',
    'Emotet botnet resurgence detected with updated C2',
    'AsyncRAT dropper distributed via malspam campaign',
    'Formbook stealer campaign targeting HR departments',
  ],
  phishing: [
    'Credential harvesting campaign mimicking Microsoft 365',
    'BEC attack targeting wire transfer approvals',
    'QR code phishing bypassing email filters',
    'Spear phishing targeting energy sector executives',
  ],
  ransomware: [
    'LockBit 3.0 affiliate targeting healthcare providers',
    'BlackCat/ALPHV activity spike in EMEA region',
    'Clop ransomware exploiting MOVEit vulnerability',
    'Akira ransomware targeting SMBs via exposed VPNs',
  ],
  apt: [
    'APT29 lateral movement observed in government networks',
    'Lazarus Group cryptocurrency theft campaign active',
    'APT41 supply chain compromise attempts detected',
    'Sandworm destructive wiper targeting industrial systems',
  ],
  vulnerability: [
    'Critical RCE in Fortinet FortiOS actively exploited',
    'Zero-day in Ivanti Connect Secure under active attack',
    'Cisco IOS XE authentication bypass PoC released',
    'Microsoft Exchange ProxyLogon exploitation wave',
  ],
  botnet: [
    'Mirai botnet variant targeting IoT devices on port 8080',
    'Qakbot infrastructure partially re-emerging post-takedown',
    'DDoS amplification attacks from compromised routers',
    'Meris botnet targeting network edge devices',
  ],
};

const SEVERITY_CONFIG = {
  critical: { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30', label: 'CRITICAL' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'HIGH' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'MED' },
  low: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'LOW' },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  malware: <Shield className="h-3 w-3" />,
  phishing: <Globe className="h-3 w-3" />,
  ransomware: <AlertTriangle className="h-3 w-3" />,
  apt: <TrendingUp className="h-3 w-3" />,
  vulnerability: <AlertTriangle className="h-3 w-3" />,
  botnet: <Globe className="h-3 w-3" />,
};

function generateFeedItem(): ThreatFeedItem {
  const type = THREAT_TYPES[Math.floor(Math.random() * THREAT_TYPES.length)];
  const severity = SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)];
  const titles = THREAT_TEMPLATES[type];
  const title = titles[Math.floor(Math.random() * titles.length)];
  const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
  const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
  const octets = Array.from({ length: 4 }, () => Math.floor(Math.random() * 254) + 1).join('.');

  return {
    id: `${Date.now()}-${Math.random()}`,
    type,
    title,
    source,
    severity,
    ioc: Math.random() > 0.4 ? octets : undefined,
    country,
    timestamp: new Date(),
    isNew: true,
  };
}

const INITIAL_FEED: ThreatFeedItem[] = Array.from({ length: 8 }, generateFeedItem).map(item => ({
  ...item,
  isNew: false,
  timestamp: new Date(Date.now() - Math.random() * 3600000),
}));

export function LiveThreatFeed() {
  const [feed, setFeed] = useState<ThreatFeedItem[]>(INITIAL_FEED);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState({ today: 247, critical: 12, sources: 6 });
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!paused) {
      intervalRef.current = setInterval(() => {
        const newItem = generateFeedItem();
        setFeed(prev => [newItem, ...prev.slice(0, 49)]);
        if (newItem.severity === 'critical' || newItem.severity === 'high') {
          setStats(prev => ({ ...prev, today: prev.today + 1, critical: prev.critical + (newItem.severity === 'critical' ? 1 : 0) }));
        } else {
          setStats(prev => ({ ...prev, today: prev.today + 1 }));
        }
        // Clear isNew after 3 seconds
        setTimeout(() => {
          setFeed(prev => prev.map(i => i.id === newItem.id ? { ...i, isNew: false } : i));
        }, 3000);
      }, 4000 + Math.random() * 3000);
    }
    return () => clearInterval(intervalRef.current);
  }, [paused]);

  const formatTime = (d: Date) => {
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-destructive/5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive"></span>
          </span>
          <h3 className="text-sm font-semibold text-foreground">Live Threat Feed</h3>
          <Badge variant="outline" className="text-[10px] bg-secondary border-border font-mono">{stats.sources} OSINT Sources</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground mr-1">
            <span className="text-destructive font-medium">{stats.critical} critical</span>
            <span>{stats.today.toLocaleString()} today</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPaused(p => !p)}
            className="h-7 text-xs gap-1.5"
          >
            {paused ? <Radio className="h-3 w-3 text-muted-foreground" /> : <Radio className="h-3 w-3 text-destructive animate-pulse" />}
            {paused ? 'Resume' : 'Live'}
          </Button>
        </div>
      </div>

      {/* Feed List */}
      <ScrollArea className="h-[420px]">
        <AnimatePresence initial={false}>
          {feed.map((item) => {
            const sev = SEVERITY_CONFIG[item.severity];
            return (
              <motion.div
                key={item.id}
                initial={item.isNew ? { opacity: 0, x: -20, backgroundColor: 'hsl(var(--primary) / 0.1)' } : false}
                animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
                transition={{ duration: 0.4 }}
                className="flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-secondary/30 transition-colors group"
              >
                {/* Severity indicator */}
                <div className={`mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${sev.color} ${sev.bg} border ${sev.border}`}>
                  {sev.label}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">{item.title}</p>
                    {item.isNew && (
                      <Badge className="flex-shrink-0 text-[9px] bg-primary/20 text-primary border-primary/30 h-4">NEW</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">{item.source}</span>
                    {item.country && (
                      <span className="text-[10px] text-muted-foreground">• 🌍 {COUNTRIES_FULL[item.country] || item.country}</span>
                    )}
                    {item.ioc && (
                      <span className="text-[10px] font-mono text-muted-foreground/70">• {item.ioc}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">{formatTime(item.timestamp)}</span>
                  </div>
                </div>

                {/* Type icon */}
                <div className="flex-shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                  {TYPE_ICONS[item.type]}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}
