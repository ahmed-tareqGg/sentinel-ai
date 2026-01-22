import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/backend/client';

interface ComplianceControl {
  id: string;
  standard: string;
  control_code: string;
  title: string;
  description: string | null;
  category: string | null;
}

interface ControlEvidence {
  id: string;
  control_id: string;
  compliance_audit_log_id: string | null;
  status: string;
  created_at: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  actor_type: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  result: string;
  execution_mode: string | null;
  details: unknown;
}

interface ComplianceStats {
  totalControls: number;
  coveredControls: number;
  coveragePercentage: number;
  totalEvents: number;
  successEvents: number;
  failureEvents: number;
  userActions: number;
  systemActions: number;
  aiActions: number;
  agentActions: number;
}

interface StandardCoverage {
  standard: string;
  total: number;
  covered: number;
  percentage: number;
}

export function useComplianceData() {
  const [controls, setControls] = useState<ComplianceControl[]>([]);
  const [evidence, setEvidence] = useState<ControlEvidence[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [controlsRes, evidenceRes, logsRes] = await Promise.all([
        supabase.from('compliance_controls').select('*').order('standard', { ascending: true }),
        supabase.from('control_evidence').select('*').order('created_at', { ascending: false }),
        supabase.from('compliance_audit_logs').select('*').order('timestamp', { ascending: false }).limit(500),
      ]);

      if (controlsRes.data) setControls(controlsRes.data);
      if (evidenceRes.data) setEvidence(evidenceRes.data);
      if (logsRes.data) setAuditLogs(logsRes.data as AuditLog[]);
    } catch (error) {
      console.error('Error fetching compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const stats: ComplianceStats = useMemo(() => {
    const coveredControlIds = new Set(evidence.map(e => e.control_id));
    
    return {
      totalControls: controls.length,
      coveredControls: coveredControlIds.size,
      coveragePercentage: controls.length > 0 
        ? Math.round((coveredControlIds.size / controls.length) * 100) 
        : 0,
      totalEvents: auditLogs.length,
      successEvents: auditLogs.filter(l => l.result === 'success').length,
      failureEvents: auditLogs.filter(l => l.result === 'failure').length,
      userActions: auditLogs.filter(l => l.actor_type === 'user').length,
      systemActions: auditLogs.filter(l => l.actor_type === 'system').length,
      aiActions: auditLogs.filter(l => l.actor_type === 'ai').length,
      agentActions: auditLogs.filter(l => l.actor_type === 'agent').length,
    };
  }, [controls, evidence, auditLogs]);

  // Coverage by standard
  const standardCoverage: StandardCoverage[] = useMemo(() => {
    const standards = [...new Set(controls.map(c => c.standard))];
    const coveredControlIds = new Set(evidence.map(e => e.control_id));
    
    return standards.map(standard => {
      const standardControls = controls.filter(c => c.standard === standard);
      const covered = standardControls.filter(c => coveredControlIds.has(c.id)).length;
      
      return {
        standard,
        total: standardControls.length,
        covered,
        percentage: standardControls.length > 0 
          ? Math.round((covered / standardControls.length) * 100) 
          : 0,
      };
    });
  }, [controls, evidence]);

  // Controls with coverage status
  const controlsWithStatus = useMemo(() => {
    const evidenceByControl = new Map<string, ControlEvidence[]>();
    evidence.forEach(e => {
      const existing = evidenceByControl.get(e.control_id) || [];
      existing.push(e);
      evidenceByControl.set(e.control_id, existing);
    });

    return controls.map(control => ({
      ...control,
      evidenceCount: evidenceByControl.get(control.id)?.length || 0,
      isCovered: evidenceByControl.has(control.id),
      latestEvidence: evidenceByControl.get(control.id)?.[0] || null,
    }));
  }, [controls, evidence]);

  // Action breakdown
  const actionBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    auditLogs.forEach(log => {
      counts.set(log.action, (counts.get(log.action) || 0) + 1);
    });
    
    return Array.from(counts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [auditLogs]);

  // Evidence over time (last 7 days)
  const evidenceTimeline = useMemo(() => {
    const days = 7;
    const timeline: { date: string; count: number }[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const count = evidence.filter(e => 
        e.created_at.startsWith(dateStr)
      ).length;
      
      timeline.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count,
      });
    }
    
    return timeline;
  }, [evidence]);

  return {
    controls,
    evidence,
    auditLogs,
    stats,
    standardCoverage,
    controlsWithStatus,
    actionBreakdown,
    evidenceTimeline,
    loading,
    refetch: fetchData,
  };
}
