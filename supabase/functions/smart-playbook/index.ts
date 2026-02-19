import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaybookAction {
  type: string;
  params?: Record<string, unknown>;
}

interface SmartDecision {
  shouldExecute: boolean;
  mode: 'auto' | 'approval' | 'dry-run';
  reason: string;
  confidence: number;
  chainedPlaybooks: string[];
}

// Smart decision engine based on AI confidence, reputation, and history
async function makeSmartDecision(
  incident: Record<string, unknown>,
  playbook: Record<string, unknown>,
  historicalData: any[],
  supabase: any
): Promise<SmartDecision> {
  const aiAnalysis = incident.ai_analysis as any || {};
  const confidence = (incident.confidence as number) || 0;
  const riskLevel = incident.risk_level as string;
  const classification = incident.classification as string;
  const srcIp = incident.src_ip as string;

  // Check historical incidents from same IP
  const { data: previousIncidents } = await supabase
    .from('incidents')
    .select('id, classification, risk_level')
    .eq('src_ip', srcIp)
    .neq('id', incident.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const recurrentAttacks = previousIncidents?.filter(
    (i: any) => i.classification === 'True Positive'
  ).length || 0;

  const decision: SmartDecision = {
    shouldExecute: false,
    mode: 'dry-run',
    reason: '',
    confidence: 0,
    chainedPlaybooks: [],
  };

  // High confidence True Positive with Critical risk = Auto execute
  if (confidence >= 85 && classification === 'True Positive' && riskLevel === 'Critical') {
    decision.shouldExecute = true;
    decision.mode = 'auto';
    decision.reason = `High confidence (${confidence}%) critical threat - auto-executing containment`;
    decision.confidence = confidence;
    
    // Chain escalation playbook for critical incidents
    decision.chainedPlaybooks.push('escalation');
  }
  // Moderate confidence with recurrent attacks = Auto execute with lower threshold
  else if (confidence >= 70 && recurrentAttacks >= 2) {
    decision.shouldExecute = true;
    decision.mode = 'auto';
    decision.reason = `Recurrent attacker (${recurrentAttacks} previous incidents) - auto-executing`;
    decision.confidence = Math.min(confidence + 10, 100);
  }
  // Moderate confidence True Positive = Require approval
  else if (confidence >= 60 && classification === 'True Positive') {
    decision.shouldExecute = true;
    decision.mode = 'approval';
    decision.reason = `Moderate confidence (${confidence}%) - requires analyst approval`;
    decision.confidence = confidence;
  }
  // Low confidence or pending = Dry run only
  else if (confidence >= 40) {
    decision.shouldExecute = false;
    decision.mode = 'dry-run';
    decision.reason = `Low confidence (${confidence}%) - dry-run mode only`;
    decision.confidence = confidence;
  }
  // Very low confidence = Skip
  else {
    decision.shouldExecute = false;
    decision.mode = 'dry-run';
    decision.reason = `Very low confidence (${confidence}%) - manual review required`;
    decision.confidence = confidence;
  }

  // Check sandbox/VirusTotal reputation
  const sandboxResult = incident.sandbox_result as any;
  if (sandboxResult?.malicious === true || sandboxResult?.positives > 5) {
    decision.confidence = Math.min(decision.confidence + 15, 100);
    decision.reason += '; Malicious hash confirmed by threat intel';
    if (decision.mode === 'approval') {
      decision.mode = 'auto';
    }
  }

  return decision;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: service role or authenticated user with SOC role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${serviceKey}`) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: roleData } = await authClient.from('user_roles').select('role').eq('user_id', user.id).single();
      const allowedRoles = ['admin', 'soc_analyst', 'soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager', 'grc_engineer', 'ciso'];
      if (!roleData || !allowedRoles.includes(roleData.role)) {
        return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const body = await req.json();
    const { incident_id, simulation = false } = body;

    if (!incident_id) {
      return new Response(JSON.stringify({ error: 'incident_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get incident
    const { data: incident, error: incidentError } = await supabase
      .from('incidents')
      .select('*')
      .eq('id', incident_id)
      .single();

    if (incidentError || !incident) {
      throw new Error(`Incident not found: ${incident_id}`);
    }

    console.log(`Smart playbook evaluation for incident ${incident.incident_number}`);

    // Get all active playbooks
    const { data: playbooks } = await supabase
      .from('playbooks')
      .select('*')
      .eq('is_active', true);

    if (!playbooks || playbooks.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No active playbooks',
        decisions: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const decisions: any[] = [];
    const executedPlaybooks: string[] = [];

    // Extract MITRE techniques from incident
    const incidentMitreTechnique = incident.mitre_technique;
    const incidentMitreTactic = incident.mitre_tactic;
    const aiMitreTechniques = (incident.ai_analysis as any)?.mitre_techniques || [];
    
    console.log(`🎯 MITRE Techniques detected: ${incidentMitreTechnique}, AI detected: ${aiMitreTechniques.length}`);

    // Evaluate each playbook
    for (const playbook of playbooks) {
      const conditions = playbook.conditions || {};
      let matches = true;
      let matchReason = '';

      // 🔥 NEW: MITRE-based matching (highest priority)
      if (conditions.mitre_technique) {
        const conditionTechnique = conditions.mitre_technique.toLowerCase();
        const matchesPrimary = incidentMitreTechnique?.toLowerCase().includes(conditionTechnique);
        const matchesAI = aiMitreTechniques.some((t: any) => 
          t.technique_id?.toLowerCase().includes(conditionTechnique)
        );
        
        if (matchesPrimary || matchesAI) {
          matches = true;
          matchReason = `MITRE technique match: ${conditions.mitre_technique}`;
          console.log(`✅ Playbook "${playbook.name}" matches MITRE technique ${conditions.mitre_technique}`);
        } else {
          matches = false;
        }
      }

      // MITRE Tactic matching
      if (matches && conditions.mitre_tactic) {
        const conditionTactic = conditions.mitre_tactic.toLowerCase();
        const matchesTactic = incidentMitreTactic?.toLowerCase().includes(conditionTactic) ||
          aiMitreTechniques.some((t: any) => 
            t.tactic?.toLowerCase().includes(conditionTactic)
          );
        
        if (!matchesTactic) {
          matches = false;
        } else {
          matchReason += matchReason ? ` + Tactic: ${conditions.mitre_tactic}` : `MITRE tactic match: ${conditions.mitre_tactic}`;
        }
      }

      // Standard condition matching
      if (conditions.risk_level && conditions.risk_level !== incident.risk_level) {
        matches = false;
      }
      if (conditions.classification && conditions.classification !== incident.classification) {
        matches = false;
      }
      if (conditions.min_severity && incident.severity < conditions.min_severity) {
        matches = false;
      }
      if (conditions.event_type && !incident.event_type.toLowerCase().includes(conditions.event_type.toLowerCase())) {
        matches = false;
      }

      if (!matches) continue;

      // Make smart decision for matching playbooks
      const decision = await makeSmartDecision(incident, playbook, [], supabase);

      decisions.push({
        playbook_id: playbook.id,
        playbook_name: playbook.name,
        ...decision,
        actions: playbook.actions,
      });

      // Execute if auto mode and not simulation
      if (decision.shouldExecute && decision.mode === 'auto' && !simulation) {
        executedPlaybooks.push(playbook.id);

        // Call the regular execute-playbook function
        await fetch(`${supabaseUrl}/functions/v1/execute-playbook`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            incident_id: incident.id,
            playbook_id: playbook.id,
            risk_level: incident.risk_level,
            classification: incident.classification,
            internal: true,
          }),
        });

        // Add timeline entry
        await supabase.from('incident_timeline').insert({
          incident_id: incident.id,
          stage: 'Smart Playbook',
          details: `Auto-executed "${playbook.name}" - ${decision.reason}`,
        });
      }

      // Execute chained playbooks
      for (const chainedType of decision.chainedPlaybooks) {
        const chainedPlaybook = playbooks.find(p => 
          p.name.toLowerCase().includes(chainedType)
        );
        
        if (chainedPlaybook && !executedPlaybooks.includes(chainedPlaybook.id)) {
          decisions.push({
            playbook_id: chainedPlaybook.id,
            playbook_name: chainedPlaybook.name,
            shouldExecute: true,
            mode: 'auto',
            reason: `Chained from ${playbook.name}`,
            confidence: decision.confidence,
            actions: chainedPlaybook.actions,
            isChained: true,
          });

          if (!simulation) {
            executedPlaybooks.push(chainedPlaybook.id);
            
            await fetch(`${supabaseUrl}/functions/v1/execute-playbook`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                incident_id: incident.id,
                playbook_id: chainedPlaybook.id,
                risk_level: incident.risk_level,
                classification: incident.classification,
                internal: true,
              }),
            });
          }
        }
      }
    }

    console.log(`Smart playbook: ${decisions.length} decisions, ${executedPlaybooks.length} executed`);

    return new Response(JSON.stringify({
      success: true,
      simulation,
      incident_number: incident.incident_number,
      decisions,
      executed: executedPlaybooks.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in smart-playbook function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
