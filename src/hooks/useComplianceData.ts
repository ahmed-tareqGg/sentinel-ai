import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/backend/client';

export interface ComplianceControl {
  id: string;
  standard: string;
  control_code: string;
  title: string;
  description: string | null;
  category: string | null;
  control_category: string | null;
  status: string | null;
  owner: string | null;
  last_review: string | null;
  // New NIST-like fields
  applicable: string | null;
  justification: string | null;
  implemented: boolean | null;
  implementation_description: string | null;
  evidence_reference: string | null;
  risk_reference: string | null;
  comments: string | null;
  updated_at: string | null;
}

export interface ComplianceEvidence {
  id: string;
  control_id: string;
  evidence_type: string;
  source: string | null;
  reference_id: string | null;
  title: string;
  description: string | null;
  file_url: string | null;
  created_by: string | null;
  created_at: string;
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
  applicableControls: number;
  implementedControls: number;
}

interface StandardCoverage {
  standard: string;
  total: number;
  covered: number;
  percentage: number;
  applicable: number;
  implemented: number;
}

export function useComplianceData() {
  const [controls, setControls] = useState<ComplianceControl[]>([]);
  const [evidence, setEvidence] = useState<ControlEvidence[]>([]);
  const [complianceEvidence, setComplianceEvidence] = useState<ComplianceEvidence[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [controlsRes, evidenceRes, complianceEvidenceRes, logsRes] = await Promise.all([
        supabase.from('compliance_controls').select('*').order('control_code', { ascending: true }),
        supabase.from('control_evidence').select('*').order('created_at', { ascending: false }),
        supabase.from('compliance_evidence').select('*').order('created_at', { ascending: false }),
        supabase.from('compliance_audit_logs').select('*').order('timestamp', { ascending: false }).limit(500),
      ]);

      if (controlsRes.data) setControls(controlsRes.data as ComplianceControl[]);
      if (evidenceRes.data) setEvidence(evidenceRes.data);
      if (complianceEvidenceRes.data) setComplianceEvidence(complianceEvidenceRes.data as ComplianceEvidence[]);
      if (logsRes.data) setAuditLogs(logsRes.data as AuditLog[]);
    } catch (error) {
      console.error('Error fetching compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats with proper coverage based on applicable + implemented
  const stats: ComplianceStats = useMemo(() => {
    const applicableControls = controls.filter(c => c.applicable === 'yes' || c.applicable === null);
    const implementedControls = controls.filter(c => c.implemented === true);
    
    return {
      totalControls: controls.length,
      applicableControls: applicableControls.length,
      implementedControls: implementedControls.length,
      coveredControls: implementedControls.length,
      coveragePercentage: applicableControls.length > 0 
        ? Math.round((implementedControls.filter(c => applicableControls.some(a => a.id === c.id)).length / applicableControls.length) * 100) 
        : 0,
      totalEvents: auditLogs.length,
      successEvents: auditLogs.filter(l => l.result === 'success').length,
      failureEvents: auditLogs.filter(l => l.result === 'failure').length,
      userActions: auditLogs.filter(l => l.actor_type === 'user').length,
      systemActions: auditLogs.filter(l => l.actor_type === 'system').length,
      aiActions: auditLogs.filter(l => l.actor_type === 'ai').length,
      agentActions: auditLogs.filter(l => l.actor_type === 'agent').length,
    };
  }, [controls, auditLogs]);

  // Coverage by standard with proper calculation
  const standardCoverage: StandardCoverage[] = useMemo(() => {
    const standards = [...new Set(controls.map(c => c.standard))];
    
    return standards.map(standard => {
      const standardControls = controls.filter(c => c.standard === standard);
      const applicableControls = standardControls.filter(c => c.applicable === 'yes' || c.applicable === null);
      const implementedControls = standardControls.filter(c => c.implemented === true);
      
      return {
        standard,
        total: standardControls.length,
        applicable: applicableControls.length,
        implemented: implementedControls.length,
        covered: implementedControls.length,
        percentage: applicableControls.length > 0 
          ? Math.round((implementedControls.filter(c => applicableControls.some(a => a.id === c.id)).length / applicableControls.length) * 100) 
          : 0,
      };
    });
  }, [controls]);

  // Controls with coverage status and evidence count
  const controlsWithStatus = useMemo(() => {
    const evidenceByControl = new Map<string, ControlEvidence[]>();
    evidence.forEach(e => {
      const existing = evidenceByControl.get(e.control_id) || [];
      existing.push(e);
      evidenceByControl.set(e.control_id, existing);
    });

    const complianceEvidenceByControl = new Map<string, ComplianceEvidence[]>();
    complianceEvidence.forEach(e => {
      const existing = complianceEvidenceByControl.get(e.control_id) || [];
      existing.push(e);
      complianceEvidenceByControl.set(e.control_id, existing);
    });

    return controls.map(control => ({
      ...control,
      evidenceCount: (evidenceByControl.get(control.id)?.length || 0) + (complianceEvidenceByControl.get(control.id)?.length || 0),
      isCovered: control.implemented === true,
      latestEvidence: evidenceByControl.get(control.id)?.[0] || null,
      complianceEvidenceList: complianceEvidenceByControl.get(control.id) || [],
    }));
  }, [controls, evidence, complianceEvidence]);

  // Status stats for dashboard
  const statusStats = useMemo(() => {
    const implemented = controls.filter(c => c.implemented === true).length;
    const planned = controls.filter(c => c.status === 'planned').length;
    const notImplemented = controls.filter(c => c.implemented === false || c.implemented === null).length;
    const applicable = controls.filter(c => c.applicable === 'yes' || c.applicable === null).length;
    const notApplicable = controls.filter(c => c.applicable === 'no' || c.applicable === 'na').length;
    return { implemented, planned, notImplemented, applicable, notApplicable };
  }, [controls]);

  // Update control - full update with all fields
  const updateControl = async (
    controlId: string, 
    updates: Partial<ComplianceControl>
  ) => {
    const { error } = await supabase
      .from('compliance_controls')
      .update({
        ...updates,
        last_review: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', controlId);
    
    if (error) {
      console.error('Error updating control:', error);
      return false;
    }
    await fetchData();
    return true;
  };

  // Legacy method for backward compatibility
  const updateControlStatus = async (controlId: string, status: string, owner?: string) => {
    return updateControl(controlId, { 
      status, 
      owner: owner || null,
      implemented: status === 'implemented',
    });
  };

  // Add evidence to a control
  const addEvidence = async (
    controlId: string,
    evidenceData: Omit<ComplianceEvidence, 'id' | 'control_id' | 'created_at' | 'created_by'>
  ) => {
    const { data: userData } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('compliance_evidence')
      .insert({
        control_id: controlId,
        ...evidenceData,
        created_by: userData?.user?.id || null,
      });
    
    if (error) {
      console.error('Error adding evidence:', error);
      return false;
    }
    await fetchData();
    return true;
  };

  // Delete evidence
  const deleteEvidence = async (evidenceId: string) => {
    const { error } = await supabase
      .from('compliance_evidence')
      .delete()
      .eq('id', evidenceId);
    
    if (error) {
      console.error('Error deleting evidence:', error);
      return false;
    }
    await fetchData();
    return true;
  };

  // Get evidence for a specific control
  const getControlEvidence = (controlId: string) => {
    return complianceEvidence.filter(e => e.control_id === controlId);
  };

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
      
      const count = [...evidence, ...complianceEvidence].filter(e => 
        e.created_at.startsWith(dateStr)
      ).length;
      
      timeline.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count,
      });
    }
    
    return timeline;
  }, [evidence, complianceEvidence]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const categories = ['Organizational', 'People', 'Physical', 'Technological'];
    return categories.map(category => {
      const categoryControls = controls.filter(c => 
        (c.control_category || c.category) === category
      );
      const implemented = categoryControls.filter(c => c.implemented === true).length;
      return {
        category,
        total: categoryControls.length,
        implemented,
        percentage: categoryControls.length > 0 
          ? Math.round((implemented / categoryControls.length) * 100) 
          : 0,
      };
    });
  }, [controls]);

  return {
    controls,
    evidence,
    complianceEvidence,
    auditLogs,
    stats,
    statusStats,
    standardCoverage,
    controlsWithStatus,
    actionBreakdown,
    evidenceTimeline,
    categoryBreakdown,
    loading,
    refetch: fetchData,
    updateControlStatus,
    updateControl,
    addEvidence,
    deleteEvidence,
    getControlEvidence,
  };
}
