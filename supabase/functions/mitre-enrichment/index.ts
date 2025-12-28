import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MitreTechnique {
  technique_id: string;
  technique_name: string;
  tactic: string;
  confidence?: number;
  evidence?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { action, incident_id, techniques } = await req.json();

    console.log(`MITRE Enrichment: ${action} for incident ${incident_id}`);

    if (action === 'enrich_incident') {
      // Get incident details
      const { data: incident, error: incidentError } = await supabase
        .from('incidents')
        .select('*')
        .eq('id', incident_id)
        .single();

      if (incidentError || !incident) {
        throw new Error('Incident not found');
      }

      // Extract MITRE techniques from AI analysis
      const aiAnalysis = incident.ai_analysis;
      const mitreTechniques: MitreTechnique[] = aiAnalysis?.mitre_techniques || [];
      
      // Also include primary technique if set
      if (incident.mitre_technique && !mitreTechniques.find((t: MitreTechnique) => t.technique_id === incident.mitre_technique)) {
        mitreTechniques.push({
          technique_id: incident.mitre_technique,
          technique_name: 'Unknown',
          tactic: incident.mitre_tactic || 'Unknown',
          confidence: 80
        });
      }

      // Update MITRE coverage table
      for (const technique of mitreTechniques) {
        // Check if technique exists in coverage table
        const { data: existing } = await supabase
          .from('mitre_coverage')
          .select('*')
          .eq('technique_id', technique.technique_id)
          .single();

        if (existing) {
          // Update detection count
          await supabase
            .from('mitre_coverage')
            .update({
              detection_count: (existing.detection_count || 0) + 1,
              last_detected: new Date().toISOString(),
              coverage_status: existing.has_playbook ? 'full' : 'detection_only',
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        } else {
          // Insert new technique
          await supabase
            .from('mitre_coverage')
            .insert({
              technique_id: technique.technique_id,
              technique_name: technique.technique_name,
              tactic: technique.tactic,
              detection_count: 1,
              last_detected: new Date().toISOString(),
              has_playbook: false,
              coverage_status: 'detection_only'
            });
        }
      }

      // Add timeline entry
      if (mitreTechniques.length > 0) {
        await supabase.from('incident_timeline').insert({
          incident_id: incident_id,
          stage: 'MITRE Enriched',
          details: `Mapped to ${mitreTechniques.length} MITRE technique(s): ${mitreTechniques.map(t => t.technique_id).join(', ')}`
        });
      }

      return new Response(JSON.stringify({
        success: true,
        techniques_mapped: mitreTechniques.length,
        techniques: mitreTechniques
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'update_coverage') {
      // Update coverage for provided techniques
      for (const technique of techniques) {
        await supabase
          .from('mitre_coverage')
          .upsert({
            technique_id: technique.technique_id,
            technique_name: technique.technique_name,
            tactic: technique.tactic,
            detection_count: technique.detection_count || 1,
            last_detected: new Date().toISOString(),
            has_playbook: technique.has_playbook || false,
            coverage_status: technique.coverage_status || 'detection_only'
          }, { onConflict: 'technique_id' });
      }

      return new Response(JSON.stringify({
        success: true,
        updated: techniques.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'backfill') {
      // Backfill MITRE data for all incidents
      console.log('Starting MITRE backfill...');
      
      const { data: incidents, error: fetchError } = await supabase
        .from('incidents')
        .select('id, ai_analysis, mitre_technique, mitre_tactic')
        .order('created_at', { ascending: false })
        .limit(500);

      if (fetchError) throw fetchError;

      let processed = 0;
      let enriched = 0;
      const techniqueCounts: Record<string, { count: number; name: string; tactic: string }> = {};

      for (const incident of incidents || []) {
        processed++;
        
        // Extract techniques from AI analysis
        const techniques: MitreTechnique[] = incident.ai_analysis?.mitre_techniques || [];
        
        // Include primary technique
        if (incident.mitre_technique && !techniques.find(t => t.technique_id === incident.mitre_technique)) {
          techniques.push({
            technique_id: incident.mitre_technique,
            technique_name: 'Unknown',
            tactic: incident.mitre_tactic || 'Unknown'
          });
        }

        if (techniques.length > 0) {
          enriched++;
          for (const tech of techniques) {
            if (!techniqueCounts[tech.technique_id]) {
              techniqueCounts[tech.technique_id] = {
                count: 0,
                name: tech.technique_name,
                tactic: tech.tactic
              };
            }
            techniqueCounts[tech.technique_id].count++;
          }
        }
      }

      // Update coverage table with aggregated data
      for (const [techniqueId, data] of Object.entries(techniqueCounts)) {
        const { data: existing } = await supabase
          .from('mitre_coverage')
          .select('*')
          .eq('technique_id', techniqueId)
          .single();

        if (existing) {
          await supabase
            .from('mitre_coverage')
            .update({
              detection_count: data.count,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('mitre_coverage')
            .insert({
              technique_id: techniqueId,
              technique_name: data.name,
              tactic: data.tactic,
              detection_count: data.count,
              has_playbook: false,
              coverage_status: 'detection_only'
            });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        processed,
        enriched,
        techniques_found: Object.keys(techniqueCounts).length,
        technique_summary: techniqueCounts
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'get_analytics') {
      // Get MITRE analytics
      const { data: coverage, error: coverageError } = await supabase
        .from('mitre_coverage')
        .select('*')
        .order('detection_count', { ascending: false });

      if (coverageError) throw coverageError;

      // Get incidents with MITRE data for trend analysis
      const { data: incidents } = await supabase
        .from('incidents')
        .select('mitre_technique, mitre_tactic, created_at')
        .not('mitre_technique', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000);

      // Calculate stats
      const totalTechniques = coverage?.length || 0;
      const withPlaybooks = coverage?.filter(c => c.has_playbook).length || 0;
      const fullCoverage = coverage?.filter(c => c.coverage_status === 'full').length || 0;

      // Group by tactic
      const tacticCounts: Record<string, number> = {};
      for (const c of coverage || []) {
        tacticCounts[c.tactic] = (tacticCounts[c.tactic] || 0) + c.detection_count;
      }

      // 7-day trend
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentIncidents = incidents?.filter(i => new Date(i.created_at) >= sevenDaysAgo) || [];
      const recentTechniques: Record<string, number> = {};
      for (const i of recentIncidents) {
        if (i.mitre_technique) {
          recentTechniques[i.mitre_technique] = (recentTechniques[i.mitre_technique] || 0) + 1;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        analytics: {
          total_techniques: totalTechniques,
          with_playbooks: withPlaybooks,
          full_coverage: fullCoverage,
          coverage_percentage: totalTechniques > 0 ? Math.round((fullCoverage / totalTechniques) * 100) : 0,
          tactic_distribution: tacticCounts,
          top_techniques: coverage?.slice(0, 10) || [],
          seven_day_trend: recentTechniques
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in MITRE enrichment:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
