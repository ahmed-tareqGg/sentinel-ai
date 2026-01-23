import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/backend/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { toast } from 'sonner';

export interface Incident {
  id: string;
  incident_number: string;
  timestamp: string;
  src_ip: string | null;
  dst_ip: string | null;
  severity: number;
  event_type: string;
  classification: string;
  confidence: number;
  status: string;
  risk_level: string;
  message: string | null;
  file_hash: string | null;
  mitre_technique: string | null;
  mitre_tactic: string | null;
  assigned_to: string | null;
  raw_log: unknown;
  ai_analysis: unknown;
  sandbox_result: unknown;
  evidence: string[] | null;
  recommended_actions: string[] | null;
  created_at: string;
  updated_at: string;
}

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIncidents = async () => {
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIncidents(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch incidents'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('incidents-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incidents',
        },
        (payload: RealtimePostgresChangesPayload<Incident>) => {
          console.log('Realtime incident update:', payload);

          if (payload.eventType === 'INSERT') {
            const newIncident = payload.new as Incident;
            setIncidents(prev => [newIncident, ...prev]);
            
            // Show notification for critical incidents
            if (newIncident.risk_level === 'Critical') {
              toast.error(`🚨 Critical Incident: ${newIncident.incident_number}`, {
                description: newIncident.message || newIncident.event_type,
                duration: 10000,
              });
            } else if (newIncident.risk_level === 'High') {
              toast.warning(`⚠️ High Risk: ${newIncident.incident_number}`, {
                description: newIncident.message || newIncident.event_type,
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            setIncidents(prev =>
              prev.map(i => i.id === (payload.new as Incident).id ? payload.new as Incident : i)
            );
          } else if (payload.eventType === 'DELETE') {
            setIncidents(prev =>
              prev.filter(i => i.id !== (payload.old as Incident).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { incidents, loading, error, refetch: fetchIncidents };
}
