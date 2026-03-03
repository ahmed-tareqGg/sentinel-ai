import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/backend/client';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ArrowRight, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface AlertItem {
  id: string;
  incident_number: string;
  risk_level: string;
  event_type: string;
  message: string | null;
  src_ip: string | null;
  mitre_technique: string | null;
  receivedAt: number;
}

const ALERT_DURATION = 12000; // auto-dismiss after 12s

export function SmartAlertBanner() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const navigate = useNavigate();

  const playAlertSound = useCallback((critical: boolean) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.setValueAtTime(critical ? 880 : 660, ctx.currentTime);
      oscillator.frequency.setValueAtTime(critical ? 1100 : 880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch { /* ignore audio errors */ }
  }, [soundEnabled]);

  const dismiss = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('smart-alerts-banner')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, (payload) => {
        const inc = payload.new as any;
        if (inc.risk_level === 'Critical' || inc.risk_level === 'High') {
          const alert: AlertItem = {
            id: inc.id,
            incident_number: inc.incident_number,
            risk_level: inc.risk_level,
            event_type: inc.event_type,
            message: inc.message,
            receivedAt: Date.now(),
          };
          setAlerts(prev => [alert, ...prev].slice(0, 3));
          playAlertSound(inc.risk_level === 'Critical');

          // auto dismiss
          setTimeout(() => dismiss(inc.id), ALERT_DURATION);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [playAlertSound, dismiss]);

  return (
    <>
      {/* Sound toggle */}
      {alerts.length > 0 && (
        <button
          onClick={() => setSoundEnabled(s => !s)}
          className="fixed bottom-24 right-4 z-50 p-2 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground transition-colors shadow-lg"
          title={soundEnabled ? 'Mute alerts' : 'Unmute alerts'}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
      )}

      {/* Alert stack */}
      <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2rem)]">
        <AnimatePresence>
          {alerts.map((alert) => {
            const isCritical = alert.risk_level === 'Critical';
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: 60, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={cn(
                  'rounded-xl border shadow-2xl overflow-hidden cursor-pointer group',
                  isCritical
                    ? 'bg-destructive/10 border-destructive/40'
                    : 'bg-orange-500/10 border-orange-500/40'
                )}
                onClick={() => { navigate(`/incidents/${alert.id}`); dismiss(alert.id); }}
              >
                {/* Progress bar */}
                <motion.div
                  className={cn('h-0.5', isCritical ? 'bg-destructive' : 'bg-orange-500')}
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: ALERT_DURATION / 1000, ease: 'linear' }}
                />

                <div className="p-3 flex items-start gap-3">
                  <div className={cn(
                    'flex-shrink-0 p-1.5 rounded-lg mt-0.5',
                    isCritical ? 'bg-destructive/20' : 'bg-orange-500/20'
                  )}>
                    <AlertTriangle className={cn('h-4 w-4', isCritical ? 'text-destructive' : 'text-orange-400')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                        isCritical ? 'bg-destructive/20 text-destructive' : 'bg-orange-500/20 text-orange-400'
                      )}>
                        {alert.risk_level}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">{alert.incident_number}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground mt-1 truncate">{alert.event_type}</p>
                    {alert.message && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{alert.message}</p>
                    )}
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>View incident</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); dismiss(alert.id); }}
                    className="flex-shrink-0 p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}
