import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LogData {
  eventType: string;
  severity: number;
  srcIP: string;
  dstIP: string;
  msg: string;
  fileHash?: string;
  action?: string;
  rawLog?: Record<string, unknown>;
}

async function verifyAuth(req: Request, isInternal: boolean): Promise<{ user: any; error?: string }> {
  // Allow internal calls from other edge functions with service role key
  if (isInternal) {
    const authHeader = req.headers.get('Authorization');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (authHeader === `Bearer ${serviceKey}`) {
      return { user: { id: 'internal', type: 'service' } };
    }
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Missing authorization header' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, error: 'Invalid or expired token' };
  }

  // Check if user has required role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleData || !['admin', 'soc_analyst'].includes(roleData.role)) {
    return { user: null, error: 'Insufficient permissions. Admin or SOC Analyst role required.' };
  }

  return { user };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as { log: LogData; internal?: boolean };
    const { log, internal } = body;

    // Verify authentication
    const { user, error: authError } = await verifyAuth(req, internal === true);
    if (authError) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: authError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`Analyzing log for ${user.type === 'service' ? 'internal call' : `user ${user.id}`}:`, JSON.stringify(log));

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // AI Classification using Lovable AI
    const aiPrompt = `You are a senior SOC analyst with expertise in threat detection and incident classification.

Analyze the following security event and classify it as either "True Positive" or "False Positive".

Consider:
- Log severity level (${log.severity}/5)
- Event type: ${log.eventType}
- Source IP: ${log.srcIP}
- Destination IP: ${log.dstIP}
- Message: ${log.msg}
${log.fileHash ? `- File Hash: ${log.fileHash}` : ''}
- Known threat behaviors and patterns
- MITRE ATT&CK framework relevance
- Context clues indicating benign or malicious activity

Return ONLY a valid JSON object with this exact structure:
{
  "classification": "True Positive" or "False Positive",
  "confidence": 0-100 (integer),
  "reason": "Brief explanation",
  "mitre_technique": "T#### or null",
  "mitre_tactic": "Tactic name or null",
  "risk_level": "Critical", "High", "Medium", or "Low",
  "recommended_actions": ["action1", "action2"],
  "evidence": ["evidence1", "evidence2"]
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a SOC analyst. Return only valid JSON.' },
          { role: 'user', content: aiPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    
    console.log('AI Response:', aiContent);

    // Parse AI response
    let aiAnalysis;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                        aiContent.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, aiContent];
      aiAnalysis = JSON.parse(jsonMatch[1] || aiContent);
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      aiAnalysis = {
        classification: 'Pending',
        confidence: 0,
        reason: 'AI analysis failed to parse',
        risk_level: log.severity >= 4 ? 'High' : 'Medium',
        recommended_actions: ['Manual review required'],
        evidence: []
      };
    }

    // Check hash with VirusTotal if available
    let sandboxResult = null;
    if (log.fileHash) {
      const VT_API_KEY = Deno.env.get('VIRUSTOTAL_API_KEY');
      if (VT_API_KEY) {
        try {
          console.log('Checking hash with VirusTotal:', log.fileHash);
          const vtResponse = await fetch(`https://www.virustotal.com/api/v3/files/${log.fileHash}`, {
            headers: { 'x-apikey': VT_API_KEY }
          });
          
          if (vtResponse.ok) {
            const vtData = await vtResponse.json();
            const stats = vtData.data?.attributes?.last_analysis_stats;
            sandboxResult = {
              malicious: stats?.malicious || 0,
              suspicious: stats?.suspicious || 0,
              harmless: stats?.harmless || 0,
              undetected: stats?.undetected || 0,
              vendor: 'VirusTotal'
            };
            console.log('VirusTotal result:', sandboxResult);

            // Adjust confidence based on VT results
            if (sandboxResult.malicious > 0) {
              aiAnalysis.confidence = Math.min(100, aiAnalysis.confidence + 15);
              if (!aiAnalysis.evidence.includes('Malicious hash detected by VirusTotal')) {
                aiAnalysis.evidence.push('Malicious hash detected by VirusTotal');
              }
              if (aiAnalysis.classification === 'False Positive' && sandboxResult.malicious > 5) {
                aiAnalysis.classification = 'True Positive';
                aiAnalysis.reason = 'Hash flagged as malicious by multiple vendors';
              }
            }
          } else if (vtResponse.status === 404) {
            sandboxResult = { message: 'Hash not found in VirusTotal database', vendor: 'VirusTotal' };
          }
        } catch (vtError) {
          console.error('VirusTotal check failed:', vtError);
        }
      }
    }

    // Calculate final risk score
    let riskScore = 0;
    if (log.severity >= 4) riskScore += 3;
    if (aiAnalysis.classification === 'True Positive') riskScore += 5;
    if (sandboxResult?.malicious > 0) riskScore += 7;
    
    const calculatedRiskLevel = riskScore >= 10 ? 'Critical' : 
                                riskScore >= 7 ? 'High' : 
                                riskScore >= 4 ? 'Medium' : 'Low';

    // Use calculated risk if AI didn't provide one
    if (!aiAnalysis.risk_level) {
      aiAnalysis.risk_level = calculatedRiskLevel;
    }

    const result = {
      ai_analysis: aiAnalysis,
      sandbox_result: sandboxResult,
      classification: aiAnalysis.classification,
      confidence: aiAnalysis.confidence,
      risk_level: aiAnalysis.risk_level,
      recommended_actions: aiAnalysis.recommended_actions,
      evidence: aiAnalysis.evidence,
      mitre_technique: aiAnalysis.mitre_technique,
      mitre_tactic: aiAnalysis.mitre_tactic,
    };

    console.log('Analysis complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-log function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});