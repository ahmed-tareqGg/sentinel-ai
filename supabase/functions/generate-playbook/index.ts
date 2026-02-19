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

// Event type templates with recommended actions
const EVENT_TYPE_TEMPLATES: Record<string, { conditions: Record<string, any>; actions: Array<{ type: string; params?: Record<string, any> }> }> = {
  'sql_injection': {
    conditions: { event_type: 'sql_injection', min_severity: 3 },
    actions: [
      { type: 'notify_slack', params: { message: '🚨 SQL Injection Attack Detected' } },
      { type: 'block_ip' },
      { type: 'create_ticket' },
    ],
  },
  'xss': {
    conditions: { event_type: 'xss', min_severity: 3 },
    actions: [
      { type: 'notify_slack', params: { message: '⚠️ XSS Attack Detected' } },
      { type: 'block_ip' },
      { type: 'create_ticket' },
    ],
  },
  'brute_force': {
    conditions: { event_type: 'brute_force', min_severity: 3 },
    actions: [
      { type: 'notify_slack', params: { message: '🔐 Brute Force Attack Detected' } },
      { type: 'block_ip' },
      { type: 'disable_user' },
      { type: 'create_ticket' },
    ],
  },
  'malware': {
    conditions: { event_type: 'malware', min_severity: 4 },
    actions: [
      { type: 'notify_slack', params: { message: '🦠 Malware Detected' } },
      { type: 'isolate_host' },
      { type: 'block_ip' },
      { type: 'escalate', params: { team: 'Incident Response Team' } },
      { type: 'create_ticket' },
    ],
  },
  'ransomware': {
    conditions: { event_type: 'ransomware', risk_level: 'Critical', min_severity: 5 },
    actions: [
      { type: 'notify_slack', params: { message: '🔴 RANSOMWARE EMERGENCY' } },
      { type: 'isolate_host' },
      { type: 'block_ip' },
      { type: 'disable_user' },
      { type: 'escalate', params: { team: 'CISO & Executive Team' } },
      { type: 'create_ticket' },
    ],
  },
  'exfiltration': {
    conditions: { event_type: 'exfiltration', risk_level: 'Critical' },
    actions: [
      { type: 'notify_slack', params: { message: '⚠️ Data Exfiltration Detected' } },
      { type: 'block_ip' },
      { type: 'escalate', params: { team: 'SOC Lead & CISO' } },
      { type: 'create_ticket' },
    ],
  },
  'web_attack': {
    conditions: { event_type: 'web_attack', min_severity: 3 },
    actions: [
      { type: 'notify_slack', params: { message: '🌐 Web Attack Detected' } },
      { type: 'block_ip' },
      { type: 'create_ticket' },
    ],
  },
  'authentication': {
    conditions: { event_type: 'authentication', min_severity: 4 },
    actions: [
      { type: 'notify_slack', params: { message: '🔑 Suspicious Authentication Activity' } },
      { type: 'disable_user' },
      { type: 'create_ticket' },
    ],
  },
  'phishing': {
    conditions: { event_type: 'phishing', min_severity: 3 },
    actions: [
      { type: 'notify_slack', params: { message: '🎣 Phishing Attempt Detected' } },
      { type: 'block_ip' },
      { type: 'create_ticket' },
    ],
  },
  'ddos': {
    conditions: { event_type: 'ddos', risk_level: 'High' },
    actions: [
      { type: 'notify_slack', params: { message: '🌊 DDoS Attack Detected' } },
      { type: 'block_ip' },
      { type: 'escalate', params: { team: 'Network Operations' } },
      { type: 'create_ticket' },
    ],
  },
};

function extractJSONFromContent(content: string): any {
  // Try to extract JSON from markdown code blocks first
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    const jsonStr = codeBlockMatch[1].trim();
    return JSON.parse(jsonStr);
  }

  // Try to find array first (more specific pattern)
  const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    return JSON.parse(arrayMatch[0]);
  }

  // Try to find single object
  const objectMatch = content.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return JSON.parse(objectMatch[0]);
  }

  throw new Error('No JSON found in response');
}

function validatePlaybook(playbook: any): any {
  // Ensure required fields exist
  if (!playbook.name) {
    playbook.name = 'Generated Playbook';
  }
  
  if (!playbook.description) {
    playbook.description = 'Automatically generated playbook';
  }

  // Ensure conditions object exists
  if (!playbook.conditions || typeof playbook.conditions !== 'object') {
    playbook.conditions = {};
  }

  // Ensure actions array exists and has at least one action
  if (!playbook.actions || !Array.isArray(playbook.actions) || playbook.actions.length === 0) {
    playbook.actions = [
      { type: 'notify_slack', params: { message: 'Security alert triggered' } },
      { type: 'create_ticket' },
    ];
  }

  // Filter to only valid actions
  playbook.actions = playbook.actions.filter((a: any) => 
    a && a.type && AVAILABLE_ACTIONS.includes(a.type)
  );

  // If all actions were filtered out, add defaults
  if (playbook.actions.length === 0) {
    playbook.actions = [
      { type: 'notify_slack', params: { message: 'Security alert triggered' } },
      { type: 'create_ticket' },
    ];
  }

  // Validate conditions
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

  return playbook;
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
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
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
    const { prompt, autoGenerate, eventType, riskLevel, severity } = body;

    // Auto-generate mode: create playbook based on detected attack type
    if (autoGenerate && eventType) {
      console.log('Auto-generating playbook for event type:', eventType);
      
      const eventKey = eventType.toLowerCase().replace(/[^a-z_]/g, '_');
      const template = EVENT_TYPE_TEMPLATES[eventKey];
      
      if (template) {
        const playbook = {
          name: `Auto: ${eventType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} Response`,
          description: `Automatically generated playbook for ${eventType} incidents`,
          conditions: { ...template.conditions },
          actions: [...template.actions],
        };
        
        // Adjust based on risk level
        if (riskLevel === 'Critical' || severity >= 5) {
          playbook.conditions.risk_level = 'Critical';
          // Add escalation if not present
          if (!playbook.actions.some(a => a.type === 'escalate')) {
            playbook.actions.push({ type: 'escalate', params: { team: 'Incident Response Team' } });
          }
        }
        
        console.log('Auto-generated playbook:', playbook);
        return new Response(JSON.stringify(playbook), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Fallback: generic playbook for unknown event types
      const genericActions: Array<{ type: string; params?: Record<string, any> }> = [
        { type: 'notify_slack', params: { message: `🚨 ${eventType} Alert` } },
        { type: 'create_ticket' },
      ];
      
      if (riskLevel === 'Critical' || riskLevel === 'High') {
        genericActions.push({ type: 'escalate', params: { team: 'SOC Team' } });
      }
      
      const genericPlaybook = {
        name: `Auto: ${eventType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} Response`,
        description: `Automatically generated playbook for ${eventType} incidents`,
        conditions: { 
          event_type: eventType,
          min_severity: severity || 3,
        },
        actions: genericActions,
      };
      
      console.log('Generated generic playbook:', genericPlaybook);
      return new Response(JSON.stringify(genericPlaybook), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // AI generation mode
    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Generating playbook from prompt:', prompt);

    const GEMINI_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GOOGLE_GEMINI_API_KEY is not configured');
    }

    const systemPrompt = `You are a cybersecurity SOAR expert. Generate playbook configuration(s) as JSON.

AVAILABLE CONDITIONS:
- risk_level: ${RISK_LEVELS.join(' | ')}
- classification: ${CLASSIFICATIONS.join(' | ')}
- min_severity: 1-5 (number)
- event_type: malware, ransomware, authentication, exfiltration, web_attack, sql_injection, xss, brute_force, phishing, ddos

AVAILABLE ACTIONS (use only these):
${AVAILABLE_ACTIONS.map(a => `- ${a}`).join('\n')}

Action parameters:
- notify_slack: { "message": "alert text" }
- escalate: { "team": "team name" }
- Others need no params

OUTPUT FORMAT - Return ONLY valid JSON, nothing else:

Single playbook:
{"name":"Playbook Name","description":"What it does","conditions":{"event_type":"malware","min_severity":4},"actions":[{"type":"notify_slack","params":{"message":"Alert"}},{"type":"block_ip"},{"type":"create_ticket"}]}

Multiple playbooks (when user asks for several):
[{"name":"Playbook 1","description":"...","conditions":{...},"actions":[...]},{"name":"Playbook 2","description":"...","conditions":{...},"actions":[...]}]

RULES:
1. Always include at least 2-3 actions per playbook
2. Always include event_type or risk_level in conditions
3. Order: notifications → containment → escalation
4. NO explanatory text, ONLY JSON`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GEMINI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate SOAR playbook(s) for: ${prompt}` },
        ],
        temperature: 0.3,
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

    console.log('AI raw response:', content);

    let parsed: any;
    try {
      parsed = extractJSONFromContent(content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.log('Attempting to clean content...');
      
      // Try removing common issues
      const cleaned = content
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
        .trim();
      
      try {
        parsed = extractJSONFromContent(cleaned);
      } catch (_e) {
        throw new Error('Could not parse playbook from AI response');
      }
    }

    // Normalize to array
    const playbooks = Array.isArray(parsed) ? parsed : [parsed];

    // Validate and clean each playbook
    const validatedPlaybooks = playbooks.map(validatePlaybook);

    // Return single or array based on count
    const result = validatedPlaybooks.length === 1 ? validatedPlaybooks[0] : validatedPlaybooks;
    console.log('Generated playbook(s):', JSON.stringify(result));

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
