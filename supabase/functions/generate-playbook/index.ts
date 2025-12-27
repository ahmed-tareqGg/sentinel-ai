import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AVAILABLE_ACTIONS = [
  'notify_slack',
  'block_ip',
  'isolate_host',
  'disable_user',
  'create_ticket',
  'escalate',
];

const RISK_LEVELS = ['Critical', 'High', 'Medium', 'Low'];
const CLASSIFICATIONS = ['True Positive', 'False Positive', 'Pending'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Generating playbook from prompt:', prompt);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are a cybersecurity SOAR (Security Orchestration, Automation, and Response) expert. 
Generate a playbook configuration based on the user's natural language description.

Available trigger conditions:
- risk_level: One of ${RISK_LEVELS.join(', ')}
- classification: One of ${CLASSIFICATIONS.join(', ')}
- min_severity: Number from 1-5
- event_type: String to match in event type (e.g., "malware", "authentication", "exfiltration")

Available actions:
${AVAILABLE_ACTIONS.map(a => `- ${a}`).join('\n')}

Action parameters:
- notify_slack: { message: "custom message" }
- escalate: { team: "team name" }
- Other actions don't require parameters

Respond ONLY with a valid JSON object in this exact format:
{
  "name": "Descriptive playbook name",
  "description": "Brief description of what this playbook does",
  "conditions": {
    "risk_level": "Critical" (optional),
    "classification": "True Positive" (optional),
    "min_severity": 4 (optional),
    "event_type": "malware" (optional)
  },
  "actions": [
    { "type": "notify_slack", "params": { "message": "Alert message" } },
    { "type": "block_ip" },
    { "type": "escalate", "params": { "team": "SOC Team" } }
  ]
}

Only include conditions that are relevant to the user's request.
Order actions logically (notifications first, then containment, then escalation).`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('Failed to generate playbook');
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    console.log('AI response:', content);

    // Parse JSON from response - handle both single object and array
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    const objectMatch = content.match(/\{[\s\S]*\}/);
    
    let parsed: any;
    if (arrayMatch) {
      parsed = JSON.parse(arrayMatch[0]);
    } else if (objectMatch) {
      parsed = JSON.parse(objectMatch[0]);
    } else {
      throw new Error('Could not parse playbook from AI response');
    }

    // Normalize to array
    const playbooks = Array.isArray(parsed) ? parsed : [parsed];

    // Validate and clean each playbook
    const validatedPlaybooks = playbooks.map((playbook: any) => {
      if (!playbook.name || !playbook.actions || !Array.isArray(playbook.actions)) {
        throw new Error('Invalid playbook structure');
      }

      // Filter to only valid actions
      playbook.actions = playbook.actions.filter((a: any) => 
        AVAILABLE_ACTIONS.includes(a.type)
      );

      // Validate conditions
      if (playbook.conditions) {
        if (playbook.conditions.risk_level && !RISK_LEVELS.includes(playbook.conditions.risk_level)) {
          delete playbook.conditions.risk_level;
        }
        if (playbook.conditions.classification && !CLASSIFICATIONS.includes(playbook.conditions.classification)) {
          delete playbook.conditions.classification;
        }
        if (playbook.conditions.min_severity) {
          const sev = parseInt(playbook.conditions.min_severity);
          if (isNaN(sev) || sev < 1 || sev > 5) {
            delete playbook.conditions.min_severity;
          } else {
            playbook.conditions.min_severity = sev;
          }
        }
      }

      return playbook;
    });

    // Return single or array based on input
    const result = validatedPlaybooks.length === 1 ? validatedPlaybooks[0] : validatedPlaybooks;
    console.log('Generated playbook(s):', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-playbook function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
