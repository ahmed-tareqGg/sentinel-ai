import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertTriangle, Shield, Bell } from 'lucide-react';

export function useRealtimeNotifications() {
  useEffect(() => {
    const channel = supabase
      .channel('incident-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'incidents',
        },
        (payload) => {
          const incident = payload.new as any;
          const riskLevel = incident.risk_level || 'Medium';
          const isCritical = riskLevel === 'Critical' || riskLevel === 'High';

          if (isCritical) {
            toast.error(`🚨 ${riskLevel} Alert: ${incident.event_type}`, {
              description: `${incident.incident_number} — ${incident.message?.slice(0, 100) || 'New incident detected'}`,
              duration: 10000,
              action: {
                label: 'View',
                onClick: () => {
                  window.location.href = `/incidents/${incident.id}`;
                },
              },
            });
          } else {
            toast.info(`📋 New Incident: ${incident.event_type}`, {
              description: `${incident.incident_number} — Risk: ${riskLevel}`,
              duration: 5000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'approval_requests',
        },
        (payload) => {
          const approval = payload.new as any;
          toast.warning(`⏳ Approval Required: ${approval.action_type}`, {
            description: approval.reason || 'A new action requires your approval',
            duration: 8000,
            action: {
              label: 'Review',
              onClick: () => {
                window.location.href = '/approvals';
              },
            },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
