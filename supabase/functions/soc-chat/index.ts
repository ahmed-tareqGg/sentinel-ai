import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to get the authenticated user from the JWT
    let currentUserId: string | null = null;
    let currentUserEmail: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      // Try to get user from JWT (not the anon key)
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
      if (token !== anonKey) {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: { user } } = await userClient.auth.getUser(token);
        if (user) {
          currentUserId = user.id;
          currentUserEmail = user.email || null;
        }
      }
    }

    const { messages, context_type } = await req.json();

    // Gather real-time SOC context
    // Extract search terms from the last user message for targeted lookup
    const lastUserMsg = messages?.filter((m: any) => m.role === 'user').pop()?.content || '';
    
    // Check if user is asking about a specific hash, IP, or incident number
    const hashMatch = lastUserMsg.match(/[a-fA-F0-9]{32,64}/g);
    const ipMatch = lastUserMsg.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g);
    const incidentMatch = lastUserMsg.match(/INC-\d+/gi);

    const queries: Promise<any>[] = [
      supabase.from('incidents').select('id, incident_number, event_type, severity, risk_level, classification, status, src_ip, dst_ip, mitre_technique, mitre_tactic, confidence, message, file_hash, assigned_to, evidence, recommended_actions, created_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('incidents').select('id, incident_number, event_type, risk_level, status, created_at').eq('status', 'Open').order('created_at', { ascending: false }).limit(10),
      supabase.from('raw_logs').select('id', { count: 'exact', head: true }),
    ];

    // Fetch team chat mentions for the current user
    if (currentUserId) {
      queries.push(
        supabase.from('chat_messages')
          .select('id, sender_name, sender_email, content, channel, created_at, mentions, priority')
          .contains('mentions', [currentUserId])
          .order('created_at', { ascending: false })
          .limit(20)
      );
    }

    // Targeted searches based on user query
    if (hashMatch) {
      for (const hash of hashMatch) {
        queries.push(supabase.from('incidents').select('id, incident_number, event_type, severity, risk_level, classification, status, src_ip, dst_ip, file_hash, mitre_technique, mitre_tactic, message, created_at').ilike('file_hash', `%${hash}%`));
      }
    }
    if (ipMatch) {
      for (const ip of ipMatch) {
        queries.push(supabase.from('incidents').select('id, incident_number, event_type, severity, risk_level, classification, status, src_ip, dst_ip, file_hash, mitre_technique, message, created_at').or(`src_ip.eq.${ip},dst_ip.eq.${ip}`));
      }
    }
    if (incidentMatch) {
      for (const inc of incidentMatch) {
        queries.push(supabase.from('incidents').select('*').ilike('incident_number', `%${inc}%`));
      }
    }

    const results = await Promise.all(queries);
    const [incidentsRes, recentRes, statsRes, ...extraResults] = results;

    const incidents = incidentsRes.data || [];
    const openIncidents = recentRes.data || [];
    const totalLogs = statsRes.count || 0;

    // Separate mentions from targeted results
    let mentionMessages: any[] = [];
    const targetedResults: any[] = [];
    
    if (currentUserId) {
      // First extra result is mentions if user is authenticated
      const mentionsResult = extraResults.shift();
      mentionMessages = mentionsResult?.data || [];
    }
    
    // Collect remaining targeted search results
    for (const r of extraResults) {
      if (r.data && r.data.length > 0) targetedResults.push(...r.data);
    }

    const criticalCount = incidents.filter(i => i.risk_level === 'Critical').length;
    const tpCount = incidents.filter(i => i.classification === 'True Positive').length;
    const fpCount = incidents.filter(i => i.classification === 'False Positive').length;

    // Build targeted context section
    let targetedContext = '';
    if (targetedResults.length > 0) {
      const unique = [...new Map(targetedResults.map(i => [i.id, i])).values()];
      targetedContext = `\n\nSEARCH RESULTS (matching user query):
${unique.map(i => `• ${i.incident_number}: ${i.event_type} | Severity: ${i.severity} | Risk: ${i.risk_level} | Class: ${i.classification} | Hash: ${i.file_hash || 'N/A'} | Src: ${i.src_ip || 'N/A'} → Dst: ${i.dst_ip || 'N/A'} | MITRE: ${i.mitre_technique || 'N/A'} | Message: ${(i.message || '').slice(0, 200)} | Status: ${i.status}`).join('\n')}`;
    }

    // Build mentions context
    let mentionsContext = '';
    if (mentionMessages.length > 0) {
      // Clean mention tags from content for readability
      const cleanContent = (text: string) => text
        .replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1')
        .replace(/#\[([^\]]+)\]\([^)]+\)/g, '#$1')
        .replace(/\$\[([^\]]+)\]\([^)]+\)/g, '$$$1');
      
      mentionsContext = `\n\nTEAM CHAT MENTIONS (messages where the current user was @mentioned):
${mentionMessages.map(m => `• [${m.channel}] ${m.sender_name || m.sender_email} (${new Date(m.created_at).toLocaleString()}): "${cleanContent(m.content)}" ${m.priority !== 'normal' ? `[Priority: ${m.priority}]` : ''}`).join('\n')}`;
    }

    const systemPrompt = `You are SOCMind AI — an expert Security Operations Center assistant embedded in a real SOC platform.

CURRENT SOC STATUS:
- Total Incidents: ${incidents.length} (last 50)
- Open Incidents: ${openIncidents.length}
- Critical Alerts: ${criticalCount}
- True Positives: ${tpCount}, False Positives: ${fpCount}
- Total Raw Logs Ingested: ${totalLogs}

OPEN INCIDENTS:
${openIncidents.map(i => `• ${i.incident_number} — ${i.event_type} [${i.risk_level}] — ${i.status} — ${new Date(i.created_at).toLocaleString()}`).join('\n')}

RECENT INCIDENT DETAILS (with file hashes):
${incidents.slice(0, 20).map(i => `• ${i.incident_number}: ${i.event_type} | Severity: ${i.severity} | Risk: ${i.risk_level} | Class: ${i.classification} (${i.confidence}%) | Hash: ${i.file_hash || 'N/A'} | MITRE: ${i.mitre_technique || 'N/A'} | Src: ${i.src_ip || 'N/A'} → Dst: ${i.dst_ip || 'N/A'} | Status: ${i.status}`).join('\n')}${targetedContext}${mentionsContext}
${currentUserId ? `\nCURRENT USER: ${currentUserEmail || 'Unknown'} (ID: ${currentUserId})` : ''}
CAPABILITIES:
- Search and find incidents by file hash, IP address, incident number, event type, or any field
- Answer questions about incidents, threats, MITRE ATT&CK techniques
- Provide root cause analysis and investigation recommendations
- Explain AI classifications and confidence scores
- Suggest playbook actions and containment strategies
- Analyze attack patterns and correlations between incidents
- Look up IOCs (hashes, IPs, domains) across all incident data
- Access TEAM CHAT MENTIONS: see who mentioned the current user, what they said, and in which channel

RULES:
- Be concise and actionable — you're talking to SOC analysts
- ALWAYS reference specific incident numbers when you find matching data
- When asked about a hash/IP/indicator, search the provided data and return ALL matching incidents with full details
- Use MITRE ATT&CK framework terminology
- Provide risk-prioritized recommendations
- If you find matching incidents, list them with: incident number, event type, severity, risk level, source/dest IPs, and status
- If no match is found, say so clearly
- When the user asks about mentions, team chat messages, or who mentioned them, use the TEAM CHAT MENTIONS data to answer. Tell them who mentioned them, what they said, which channel it was in, and when.
- Answer in the same language the user uses (Arabic or English)
- Be thorough — analysts depend on your accuracy`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again shortly.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('soc-chat error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
