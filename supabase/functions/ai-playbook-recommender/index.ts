import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecommendationRequest {
  incident_id?: string;
  analyze_patterns?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { incident_id, analyze_patterns } = await req.json() as RecommendationRequest;

    // Fetch recent incidents for pattern analysis
    const { data: recentIncidents } = await supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    // Fetch existing playbooks
    const { data: existingPlaybooks } = await supabase
      .from('playbooks')
      .select('*')
      .eq('is_active', true);

    // Fetch playbook executions with outcomes
    const { data: executions } = await supabase
      .from('playbook_executions')
      .select('*, incidents(*)')
      .order('started_at', { ascending: false })
      .limit(50);

    // Analyze patterns: find event types without playbooks
    const eventTypesWithoutPlaybooks: string[] = [];
    const eventTypeCounts: Record<string, number> = {};

    for (const incident of recentIncidents || []) {
      const eventType = incident.event_type;
      eventTypeCounts[eventType] = (eventTypeCounts[eventType] || 0) + 1;

      const hasPlaybook = existingPlaybooks?.some(p => {
        const conditions = p.conditions as any;
        return conditions?.event_type === eventType ||
               conditions?.event_type?.includes?.(eventType);
      });

      if (!hasPlaybook && !eventTypesWithoutPlaybooks.includes(eventType)) {
        eventTypesWithoutPlaybooks.push(eventType);
      }
    }

    // Analyze execution performance
    const playbookPerformance: Record<string, { success: number; total: number; avgMttr: number }> = {};
    
    for (const exec of executions || []) {
      const pbId = exec.playbook_id;
      if (!playbookPerformance[pbId]) {
        playbookPerformance[pbId] = { success: 0, total: 0, avgMttr: 0 };
      }
      playbookPerformance[pbId].total++;
      if (exec.status === 'completed') {
        playbookPerformance[pbId].success++;
      }
    }

    // Generate AI recommendations
    const recommendations: any[] = [];

    // Recommendation 1: Playbooks for uncovered event types
    for (const eventType of eventTypesWithoutPlaybooks.slice(0, 5)) {
      const count = eventTypeCounts[eventType];
      if (count >= 2) { // Only recommend if we've seen it at least twice
        const relevantIncidents = recentIncidents?.filter(i => i.event_type === eventType) || [];
        const avgSeverity = relevantIncidents.reduce((sum, i) => sum + i.severity, 0) / relevantIncidents.length;
        
        // Generate playbook suggestion using AI
        if (LOVABLE_API_KEY) {
          try {
            const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [
                  {
                    role: 'system',
                    content: `You are a SOC automation expert. Generate a playbook for the given event type.
                    Return JSON with: name, description, trigger_conditions, actions (array of {type, params}).
                    Action types: isolate_host, block_ip, reset_credentials, disable_user, notify_slack, create_ticket, forensic_analysis, escalate.`
                  },
                  {
                    role: 'user',
                    content: `Generate a SOC playbook for event type: "${eventType}"
                    Average severity: ${avgSeverity.toFixed(1)}
                    Incident count: ${count}
                    Sample incidents: ${JSON.stringify(relevantIncidents.slice(0, 2))}`
                  }
                ],
                tools: [
                  {
                    type: 'function',
                    function: {
                      name: 'create_playbook',
                      description: 'Create a new SOC playbook',
                      parameters: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          description: { type: 'string' },
                          trigger_conditions: {
                            type: 'object',
                            properties: {
                              event_type: { type: 'string' },
                              min_severity: { type: 'number' },
                              risk_level: { type: 'string' }
                            }
                          },
                          actions: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                type: { type: 'string' },
                                params: { type: 'object' }
                              }
                            }
                          },
                          estimated_mttr_reduction: { type: 'number' },
                          automation_score: { type: 'number' }
                        },
                        required: ['name', 'description', 'trigger_conditions', 'actions']
                      }
                    }
                  }
                ],
                tool_choice: { type: 'function', function: { name: 'create_playbook' } }
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
              if (toolCall) {
                const playbook = JSON.parse(toolCall.function.arguments);
                recommendations.push({
                  type: 'new_playbook',
                  event_type: eventType,
                  incident_count: count,
                  avg_severity: avgSeverity,
                  suggestion: playbook,
                  confidence: Math.min(95, 60 + count * 5),
                  reason: `${count} incidents of type "${eventType}" detected without automated response`,
                });
              }
            }
          } catch (aiError) {
            console.error('AI recommendation failed:', aiError);
            // Fallback to rule-based recommendation
            recommendations.push({
              type: 'new_playbook',
              event_type: eventType,
              incident_count: count,
              avg_severity: avgSeverity,
              suggestion: {
                name: `Auto-Response: ${eventType}`,
                description: `Automated playbook for ${eventType} incidents`,
                trigger_conditions: { event_type: eventType, min_severity: Math.floor(avgSeverity) },
                actions: [
                  { type: 'notify_slack', params: { channel: '#soc-alerts' } },
                  { type: 'create_ticket', params: {} },
                  ...(avgSeverity >= 4 ? [{ type: 'isolate_host', params: {} }] : []),
                ],
              },
              confidence: 70,
              reason: `${count} incidents of type "${eventType}" detected (rule-based suggestion)`,
            });
          }
        }
      }
    }

    // Recommendation 2: Playbook improvements based on execution data
    for (const [pbId, perf] of Object.entries(playbookPerformance)) {
      const successRate = perf.success / perf.total;
      if (successRate < 0.7 && perf.total >= 3) {
        const playbook = existingPlaybooks?.find(p => p.id === pbId);
        if (playbook) {
          recommendations.push({
            type: 'improve_playbook',
            playbook_id: pbId,
            playbook_name: playbook.name,
            success_rate: (successRate * 100).toFixed(1) + '%',
            total_executions: perf.total,
            suggestion: 'Consider reviewing and updating this playbook. Success rate is below 70%.',
            confidence: 85,
            reason: `Low success rate (${(successRate * 100).toFixed(1)}%) over ${perf.total} executions`,
          });
        }
      }
    }

    // Save recommendations to database
    for (const rec of recommendations) {
      if (rec.type === 'new_playbook' && rec.suggestion) {
        await supabase.from('playbook_suggestions').insert({
          name: rec.suggestion.name,
          description: rec.suggestion.description,
          suggested_conditions: rec.suggestion.trigger_conditions,
          suggested_actions: rec.suggestion.actions,
          reasoning: rec.reason,
          confidence_score: rec.confidence,
          pattern_source: 'ai_recommender',
          incident_count: rec.incident_count,
          status: 'pending',
        });
      }
    }

    console.log(`Generated ${recommendations.length} AI recommendations`);

    return new Response(JSON.stringify({
      success: true,
      recommendations,
      stats: {
        incidents_analyzed: recentIncidents?.length || 0,
        active_playbooks: existingPlaybooks?.length || 0,
        uncovered_event_types: eventTypesWithoutPlaybooks.length,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-playbook-recommender:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
