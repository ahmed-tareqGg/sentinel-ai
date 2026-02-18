import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const SLA_LIMITS: Record<string, number> = {
  Critical: 15,
  High: 30,
  Medium: 60,
  Low: 240,
  Info: 480,
};

export function SLABreachMonitor() {
  const { user } = useAuth();
  const checkedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const checkSLABreaches = async () => {
      const { data } = await supabase
        .from('incidents')
        .select('id, incident_number, risk_level, event_type, created_at, status')
        .in('status', ['open', 'investigating'])
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!data) return;

      const now = new Date();
      data.forEach((incident: any) => {
        const slaMinutes = SLA_LIMITS[incident.risk_level] || 60;
        const created = new Date(incident.created_at);
        const elapsedMinutes = (now.getTime() - created.getTime()) / 60000;
        
        // Breached = elapsed > SLA limit
        if (elapsedMinutes > slaMinutes && !checkedRef.current.has(incident.id)) {
          checkedRef.current.add(incident.id);
          const overBy = Math.round(elapsedMinutes - slaMinutes);
          toast.error(`⏰ SLA Breached: ${incident.incident_number}`, {
            description: `${incident.risk_level} incident exceeded ${slaMinutes}min SLA by ${overBy} min`,
            duration: 12000,
            action: {
              label: 'View',
              onClick: () => { window.location.href = `/incidents/${incident.id}`; },
            },
          });
        }
        // Warning at 80% of SLA
        else if (elapsedMinutes > slaMinutes * 0.8 && !checkedRef.current.has(`warn_${incident.id}`)) {
          checkedRef.current.add(`warn_${incident.id}`);
          const remaining = Math.round(slaMinutes - elapsedMinutes);
          if (remaining > 0) {
            toast.warning(`⚠️ SLA Warning: ${incident.incident_number}`, {
              description: `${incident.risk_level} — ${remaining} min remaining to meet SLA`,
              duration: 8000,
              action: {
                label: 'View',
                onClick: () => { window.location.href = `/incidents/${incident.id}`; },
              },
            });
          }
        }
      });
    };

    // Check immediately and then every 2 minutes
    checkSLABreaches();
    const interval = setInterval(checkSLABreaches, 120000);
    return () => clearInterval(interval);
  }, [user]);

  return null;
}
