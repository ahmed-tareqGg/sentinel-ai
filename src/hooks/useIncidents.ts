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

interface IncidentCounts {
  all: number;
  open: number;
  inProgress: number;
  closed: number;
}

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [counts, setCounts] = useState<IncidentCounts>({ all: 0, open: 0, inProgress: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCounts = async () => {
    try {
      // Fetch counts separately without row limit
      const [allCount, openCount, inProgressCount, closedCount] = await Promise.all([
        supabase.from('incidents').select('*', { count: 'exact', head: true }),
        supabase.from('incidents').select('*', { count: 'exact', head: true }).eq('status', 'Open'),
        supabase.from('incidents').select('*', { count: 'exact', head: true }).eq('status', 'In Progress'),
        supabase.from('incidents').select('*', { count: 'exact', head: true }).eq('status', 'Closed'),
      ]);

      setCounts({
        all: allCount.count || 0,
        open: openCount.count || 0,
        inProgress: inProgressCount.count || 0,
        closed: closedCount.count || 0,
      });
    } catch (err) {
      console.error('Failed to fetch counts:', err);
    }
  };

  const fetchIncidents = async () => {
    try {
      // Fetch all incidents without the 1000 limit
      const { data, error, count } = await supabase
        .from('incidents')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(0, 9999); // Extend range to avoid default 1000 limit

      if (error) throw error;
      setIncidents(data || []);
      
      // Also fetch accurate counts
      await fetchCounts();
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
            
            // Update counts
            setCounts(prev => ({
              ...prev,
              all: prev.all + 1,
              ...(newIncident.status === 'Open' && { open: prev.open + 1 }),
              ...(newIncident.status === 'In Progress' && { inProgress: prev.inProgress + 1 }),
              ...(newIncident.status === 'Closed' && { closed: prev.closed + 1 }),
            }));
            
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
            const updated = payload.new as Incident;
            const old = payload.old as Incident;
            
            setIncidents(prev =>
              prev.map(i => i.id === updated.id ? updated : i)
            );
            
            // Update counts if status changed
            if (old.status !== updated.status) {
              setCounts(prev => {
                const newCounts = { ...prev };
                // Decrement old status
                if (old.status === 'Open') newCounts.open--;
                else if (old.status === 'In Progress') newCounts.inProgress--;
                else if (old.status === 'Closed') newCounts.closed--;
                // Increment new status
                if (updated.status === 'Open') newCounts.open++;
                else if (updated.status === 'In Progress') newCounts.inProgress++;
                else if (updated.status === 'Closed') newCounts.closed++;
                return newCounts;
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as Incident;
            setIncidents(prev =>
              prev.filter(i => i.id !== deleted.id)
            );
            
            // Update counts
            setCounts(prev => ({
              ...prev,
              all: prev.all - 1,
              ...(deleted.status === 'Open' && { open: prev.open - 1 }),
              ...(deleted.status === 'In Progress' && { inProgress: prev.inProgress - 1 }),
              ...(deleted.status === 'Closed' && { closed: prev.closed - 1 }),
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { incidents, counts, loading, error, refetch: fetchIncidents };
}
