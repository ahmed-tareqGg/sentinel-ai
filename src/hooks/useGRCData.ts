import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/backend/client';

// Types
export interface RiskRegister {
  id: string;
  control_id: string | null;
  risk_id: string;
  risk_title: string;
  risk_description: string | null;
  risk_category: string | null;
  likelihood: 'rare' | 'unlikely' | 'possible' | 'likely' | 'almost_certain';
  impact: 'negligible' | 'minor' | 'moderate' | 'major' | 'catastrophic';
  inherent_risk_score: number;
  residual_likelihood: 'rare' | 'unlikely' | 'possible' | 'likely' | 'almost_certain' | null;
  residual_impact: 'negligible' | 'minor' | 'moderate' | 'major' | 'catastrophic' | null;
  residual_risk_score: number;
  mitigation_strategy: string | null;
  mitigation_status: string;
  risk_owner: string | null;
  treatment_option: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ControlGap {
  id: string;
  control_id: string;
  gap_status: string;
  gap_severity: string;
  gap_description: string | null;
  identified_at: string;
  identified_by: string | null;
  remediation_plan: string | null;
  remediation_owner: string | null;
  target_date: string | null;
  closed_at: string | null;
  closed_by: string | null;
  // Joined control data
  control_code?: string;
  control_title?: string;
}

export interface GRCAuditEntry {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  old_value: unknown;
  new_value: unknown;
  change_summary: string | null;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
}

export interface ControlMappingRule {
  id: string;
  control_id: string;
  source_type: string;
  match_field: string;
  match_operator: string;
  match_value: string;
  evidence_type: string;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

export interface CoverageStats {
  total_controls: number;
  applicable_controls: number;
  implemented_controls: number;
  partially_implemented: number;
  planned_controls: number;
  not_implemented: number;
  coverage_percentage: number;
  gap_count: number;
}

export interface RiskStats {
  totalRisks: number;
  openRisks: number;
  mitigatedRisks: number;
  criticalRisks: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;
  avgRiskScore: number;
}

export interface GapStats {
  totalGaps: number;
  openGaps: number;
  closedGaps: number;
  criticalGaps: number;
  highGaps: number;
  overdueGaps: number;
}

export function useGRCData() {
  const [risks, setRisks] = useState<RiskRegister[]>([]);
  const [gaps, setGaps] = useState<ControlGap[]>([]);
  const [auditTrail, setAuditTrail] = useState<GRCAuditEntry[]>([]);
  const [mappingRules, setMappingRules] = useState<ControlMappingRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [risksRes, gapsRes, auditRes, rulesRes] = await Promise.all([
        supabase.from('risk_register').select('*').order('created_at', { ascending: false }),
        supabase.from('control_gaps').select(`
          *,
          compliance_controls (control_code, title)
        `).order('identified_at', { ascending: false }),
        supabase.from('grc_audit_trail').select('*').order('timestamp', { ascending: false }).limit(200),
        supabase.from('control_mapping_rules').select('*').order('created_at', { ascending: false }),
      ]);

      if (risksRes.data) setRisks(risksRes.data as RiskRegister[]);
      if (gapsRes.data) {
        setGaps(gapsRes.data.map((g: any) => ({
          ...g,
          control_code: g.compliance_controls?.control_code,
          control_title: g.compliance_controls?.title,
        })));
      }
      if (auditRes.data) setAuditTrail(auditRes.data as GRCAuditEntry[]);
      if (rulesRes.data) setMappingRules(rulesRes.data as ControlMappingRule[]);
    } catch (error) {
      console.error('Error fetching GRC data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Risk Statistics
  const riskStats: RiskStats = useMemo(() => {
    const openRisks = risks.filter(r => r.mitigation_status !== 'closed');
    const criticalRisks = risks.filter(r => r.inherent_risk_score >= 20);
    const highRisks = risks.filter(r => r.inherent_risk_score >= 12 && r.inherent_risk_score < 20);
    const mediumRisks = risks.filter(r => r.inherent_risk_score >= 6 && r.inherent_risk_score < 12);
    const lowRisks = risks.filter(r => r.inherent_risk_score < 6);
    const avgScore = risks.length > 0 
      ? Math.round(risks.reduce((acc, r) => acc + r.inherent_risk_score, 0) / risks.length) 
      : 0;

    return {
      totalRisks: risks.length,
      openRisks: openRisks.length,
      mitigatedRisks: risks.filter(r => r.mitigation_status === 'mitigated' || r.mitigation_status === 'closed').length,
      criticalRisks: criticalRisks.length,
      highRisks: highRisks.length,
      mediumRisks: mediumRisks.length,
      lowRisks: lowRisks.length,
      avgRiskScore: avgScore,
    };
  }, [risks]);

  // Gap Statistics
  const gapStats: GapStats = useMemo(() => {
    const openGaps = gaps.filter(g => g.gap_status === 'open');
    const closedGaps = gaps.filter(g => g.gap_status === 'closed');
    const criticalGaps = gaps.filter(g => g.gap_severity === 'critical');
    const highGaps = gaps.filter(g => g.gap_severity === 'high');
    const overdueGaps = gaps.filter(g => 
      g.target_date && new Date(g.target_date) < new Date() && g.gap_status !== 'closed'
    );

    return {
      totalGaps: gaps.length,
      openGaps: openGaps.length,
      closedGaps: closedGaps.length,
      criticalGaps: criticalGaps.length,
      highGaps: highGaps.length,
      overdueGaps: overdueGaps.length,
    };
  }, [gaps]);

  // Risk by Category
  const riskByCategory = useMemo(() => {
    const categories = new Map<string, number>();
    risks.forEach(r => {
      const cat = r.risk_category || 'Uncategorized';
      categories.set(cat, (categories.get(cat) || 0) + 1);
    });
    return Array.from(categories.entries()).map(([category, count]) => ({ category, count }));
  }, [risks]);

  // Risk Heatmap Data
  const riskHeatmapData = useMemo(() => {
    const likelihoods = ['rare', 'unlikely', 'possible', 'likely', 'almost_certain'];
    const impacts = ['negligible', 'minor', 'moderate', 'major', 'catastrophic'];
    
    const heatmap: { likelihood: string; impact: string; count: number; score: number }[] = [];
    
    likelihoods.forEach((l, li) => {
      impacts.forEach((i, ii) => {
        const count = risks.filter(r => r.likelihood === l && r.impact === i).length;
        heatmap.push({
          likelihood: l,
          impact: i,
          count,
          score: (li + 1) * (ii + 1),
        });
      });
    });
    
    return heatmap;
  }, [risks]);

  // CRUD Operations
  const addRisk = async (risk: Omit<RiskRegister, 'id' | 'created_at' | 'updated_at' | 'inherent_risk_score' | 'residual_risk_score'>) => {
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from('risk_register').insert({
      ...risk,
      created_by: user?.user?.id,
    });
    if (error) {
      console.error('Error adding risk:', error);
      return false;
    }
    await fetchData();
    return true;
  };

  const updateRisk = async (riskId: string, updates: Partial<RiskRegister>) => {
    const { error } = await supabase.from('risk_register').update({
      ...updates,
      updated_at: new Date().toISOString(),
    }).eq('id', riskId);
    if (error) {
      console.error('Error updating risk:', error);
      return false;
    }
    await fetchData();
    return true;
  };

  const deleteRisk = async (riskId: string) => {
    const { error } = await supabase.from('risk_register').delete().eq('id', riskId);
    if (error) {
      console.error('Error deleting risk:', error);
      return false;
    }
    await fetchData();
    return true;
  };

  const updateGap = async (gapId: string, updates: Partial<ControlGap>) => {
    const { error } = await supabase.from('control_gaps').update(updates).eq('id', gapId);
    if (error) {
      console.error('Error updating gap:', error);
      return false;
    }
    await fetchData();
    return true;
  };

  const closeGap = async (gapId: string) => {
    const { data: user } = await supabase.auth.getUser();
    return updateGap(gapId, {
      gap_status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: user?.user?.id,
    });
  };

  const identifyGaps = async () => {
    const { data, error } = await supabase.rpc('identify_control_gaps');
    if (error) {
      console.error('Error identifying gaps:', error);
      return 0;
    }
    await fetchData();
    return data || 0;
  };

  const addMappingRule = async (rule: Omit<ControlMappingRule, 'id' | 'created_at' | 'created_by'>) => {
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from('control_mapping_rules').insert({
      ...rule,
      created_by: user?.user?.id,
    });
    if (error) {
      console.error('Error adding mapping rule:', error);
      return false;
    }
    await fetchData();
    return true;
  };

  const deleteMappingRule = async (ruleId: string) => {
    const { error } = await supabase.from('control_mapping_rules').delete().eq('id', ruleId);
    if (error) {
      console.error('Error deleting mapping rule:', error);
      return false;
    }
    await fetchData();
    return true;
  };

  return {
    // Data
    risks,
    gaps,
    auditTrail,
    mappingRules,
    loading,
    
    // Stats
    riskStats,
    gapStats,
    riskByCategory,
    riskHeatmapData,
    
    // Actions
    refetch: fetchData,
    addRisk,
    updateRisk,
    deleteRisk,
    updateGap,
    closeGap,
    identifyGaps,
    addMappingRule,
    deleteMappingRule,
  };
}
