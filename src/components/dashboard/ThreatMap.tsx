import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, MapPin, AlertTriangle } from 'lucide-react';
import { Incident } from '@/hooks/useIncidents';

interface ThreatPoint {
  id: string;
  x: number;
  y: number;
  severity: string;
  label: string;
  ip: string;
  country: string;
}

// Approximate geo positions on SVG map (percentage-based)
const IP_GEO_MAP: Record<string, { x: number; y: number; country: string }> = {
  '192.168': { x: 25, y: 35, country: 'US (Internal)' },
  '10.': { x: 28, y: 40, country: 'US (Private)' },
  '172.': { x: 48, y: 30, country: 'EU' },
  '203.': { x: 78, y: 45, country: 'Asia Pacific' },
  '45.': { x: 50, y: 28, country: 'Europe' },
  '91.': { x: 55, y: 25, country: 'Eastern Europe' },
  '185.': { x: 52, y: 32, country: 'Russia' },
  '103.': { x: 72, y: 50, country: 'India' },
  '1.': { x: 82, y: 42, country: 'Australia' },
  '41.': { x: 52, y: 55, country: 'Africa' },
  '177.': { x: 32, y: 62, country: 'South America' },
  '62.': { x: 58, y: 30, country: 'Middle East' },
};

function geoFromIp(ip: string | null): { x: number; y: number; country: string } {
  if (!ip) return { x: 50 + Math.random() * 10 - 5, y: 35 + Math.random() * 10 - 5, country: 'Unknown' };
  for (const [prefix, geo] of Object.entries(IP_GEO_MAP)) {
    if (ip.startsWith(prefix)) {
      return {
        x: geo.x + Math.random() * 6 - 3,
        y: geo.y + Math.random() * 6 - 3,
        country: geo.country,
      };
    }
  }
  return { x: 30 + Math.random() * 40, y: 25 + Math.random() * 30, country: 'Unknown' };
}

const severityColors: Record<string, string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#22d3ee',
  Low: '#22c55e',
};

export function ThreatMap({ incidents }: { incidents: Incident[] }) {
  const [activePoint, setActivePoint] = useState<ThreatPoint | null>(null);
  const [pulseKey, setPulseKey] = useState(0);

  // Animate periodic pulse
  useEffect(() => {
    const timer = setInterval(() => setPulseKey(k => k + 1), 3000);
    return () => clearInterval(timer);
  }, []);

  const threatPoints: ThreatPoint[] = useMemo(() => {
    const recent = incidents
      .filter(i => i.src_ip && i.status === 'Open')
      .slice(0, 20);
    
    return recent.map(i => {
      const geo = geoFromIp(i.src_ip);
      return {
        id: i.id,
        x: geo.x,
        y: geo.y,
        severity: i.risk_level || 'Medium',
        label: i.event_type,
        ip: i.src_ip || 'N/A',
        country: geo.country,
      };
    });
  }, [incidents]);

  const stats = useMemo(() => ({
    total: threatPoints.length,
    critical: threatPoints.filter(p => p.severity === 'Critical').length,
    countries: new Set(threatPoints.map(p => p.country)).size,
  }), [threatPoints]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Live Threat Map</h3>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            {stats.critical} Critical
          </span>
          <span>{stats.total} Active Threats</span>
          <span>{stats.countries} Regions</span>
        </div>
      </div>

      <div className="relative aspect-[2.2/1] bg-background/50 overflow-hidden">
        {/* World map outline using SVG */}
        <svg viewBox="0 0 100 60" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* Simplified continent outlines */}
          <g opacity="0.15" stroke="currentColor" strokeWidth="0.3" fill="none" className="text-primary">
            {/* North America */}
            <path d="M12,12 L28,8 L32,14 L30,22 L24,28 L18,26 L14,18 Z" />
            {/* South America */}
            <path d="M24,38 L30,34 L34,40 L32,52 L26,56 L22,48 Z" />
            {/* Europe */}
            <path d="M44,12 L56,10 L58,18 L52,22 L46,20 Z" />
            {/* Africa */}
            <path d="M46,28 L56,26 L60,36 L56,50 L48,48 L44,38 Z" />
            {/* Asia */}
            <path d="M58,8 L82,6 L86,16 L80,28 L70,30 L62,22 Z" />
            {/* Australia */}
            <path d="M76,42 L86,40 L88,48 L82,52 L76,48 Z" />
          </g>

          {/* Grid lines */}
          <g opacity="0.05" stroke="currentColor" strokeWidth="0.2" className="text-primary">
            {[15, 30, 45].map(y => <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} />)}
            {[20, 40, 60, 80].map(x => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="60" />)}
          </g>

          {/* Attack connection lines */}
          <AnimatePresence>
            {threatPoints.map((point, i) => (
              <motion.line
                key={`line-${point.id}`}
                x1={50}
                y1={30}
                x2={point.x}
                y2={point.y}
                stroke={severityColors[point.severity]}
                strokeWidth="0.15"
                opacity={0.3}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, delay: i * 0.1 }}
              />
            ))}
          </AnimatePresence>

          {/* Threat points */}
          {threatPoints.map((point, i) => (
            <g key={point.id} onMouseEnter={() => setActivePoint(point)} onMouseLeave={() => setActivePoint(null)}>
              {/* Pulse ring */}
              <motion.circle
                cx={point.x}
                cy={point.y}
                r={point.severity === 'Critical' ? 2.5 : 1.5}
                fill="none"
                stroke={severityColors[point.severity]}
                strokeWidth="0.2"
                initial={{ r: 0.5, opacity: 0.8 }}
                animate={{ r: point.severity === 'Critical' ? 3 : 2, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
              />
              {/* Core dot */}
              <motion.circle
                cx={point.x}
                cy={point.y}
                r={point.severity === 'Critical' ? 1 : 0.6}
                fill={severityColors[point.severity]}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="cursor-pointer"
              />
            </g>
          ))}

          {/* SOC Center */}
          <circle cx="50" cy="30" r="1.2" fill="hsl(var(--primary))" opacity="0.8" />
          <motion.circle
            cx="50"
            cy="30"
            r="2.5"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="0.2"
            animate={{ r: [2, 4, 2], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {activePoint && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute z-10 bg-card border border-border rounded-lg p-3 shadow-xl text-xs pointer-events-none"
              style={{ left: `${activePoint.x}%`, top: `${activePoint.y}%`, transform: 'translate(-50%, -120%)' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: severityColors[activePoint.severity] }} />
                <span className="font-semibold text-foreground">{activePoint.severity}</span>
              </div>
              <p className="text-muted-foreground">{activePoint.label}</p>
              <p className="text-muted-foreground font-mono">{activePoint.ip}</p>
              <p className="text-primary">{activePoint.country}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scan line animation */}
        <motion.div
          key={pulseKey}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, hsl(var(--primary) / 0.03) 50%, transparent 100%)',
          }}
          initial={{ y: '-100%' }}
          animate={{ y: '100%' }}
          transition={{ duration: 3, ease: 'linear' }}
        />
      </div>
    </div>
  );
}
