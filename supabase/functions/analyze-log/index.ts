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
  provider?: string;
  event_id?: string;
  hostname?: string;
}

// Windows Events that are commonly benign (system/telemetry)
const BENIGN_PATTERNS: RegExp[] = [
  /Netwtw10|BTHUSB|WudfUsbccidDriver/i,
  /Service Control Manager.*started|stopped/i,
  /Windows Update Client/i,
  /Application Information.*started/i,
  /DistributedCOM.*machine default/i,
  /Bits Client|Background Intelligent Transfer/i,
  /Microsoft-Windows-Security-SPP/i,
  /Microsoft-Windows-Kernel-Power/i,
  /Microsoft-Windows-WMI/i,
  /User Profile Service.*loaded|unloaded/i,
  /Group Policy.*applied|processed/i,
  /Time-Service.*synchroniz/i,
  /Desktop Window Manager/i,
  /Print Spooler/i,
  /Task Scheduler.*task.*completed/i,
];

// High-risk patterns that should be flagged
const HIGH_RISK_PATTERNS: RegExp[] = [
  /mimikatz|credential.*dump|lsass/i,
  /privilege.*escalation|runas/i,
  /powershell.*-enc|-EncodedCommand|base64/i,
  /suspicious.*login|brute.*force|multiple.*failed/i,
  /malware|trojan|ransomware|payload/i,
  /reverse.*shell|bind.*shell|c2.*beacon/i,
  /lateral.*movement|pass.*hash|pass.*ticket/i,
  /process.*injection|dll.*inject/i,
  /registry.*run.*key|startup.*persistence/i,
];

// MITRE ATT&CK Mapping Database
const MITRE_MAPPING: Record<string, { technique: string; tactic: string; name: string }[]> = {
  // Execution
  'command_execution': [{ technique: 'T1059', tactic: 'Execution', name: 'Command and Scripting Interpreter' }],
  'powershell': [{ technique: 'T1059.001', tactic: 'Execution', name: 'PowerShell' }],
  'script': [{ technique: 'T1059.005', tactic: 'Execution', name: 'Visual Basic' }],
  'process_injection': [{ technique: 'T1055', tactic: 'Defense Evasion', name: 'Process Injection' }],
  
  // Initial Access
  'phishing': [{ technique: 'T1566', tactic: 'Initial Access', name: 'Phishing' }],
  'spearphishing': [{ technique: 'T1566.001', tactic: 'Initial Access', name: 'Spearphishing Attachment' }],
  'drive_by': [{ technique: 'T1189', tactic: 'Initial Access', name: 'Drive-by Compromise' }],
  
  // Credential Access
  'brute_force': [{ technique: 'T1110', tactic: 'Credential Access', name: 'Brute Force' }],
  'password_spray': [{ technique: 'T1110.003', tactic: 'Credential Access', name: 'Password Spraying' }],
  'credential_dump': [{ technique: 'T1003', tactic: 'Credential Access', name: 'OS Credential Dumping' }],
  'mimikatz': [{ technique: 'T1003.001', tactic: 'Credential Access', name: 'LSASS Memory' }],
  
  // Lateral Movement
  'lateral_movement': [{ technique: 'T1021', tactic: 'Lateral Movement', name: 'Remote Services' }],
  'rdp': [{ technique: 'T1021.001', tactic: 'Lateral Movement', name: 'Remote Desktop Protocol' }],
  'smb': [{ technique: 'T1021.002', tactic: 'Lateral Movement', name: 'SMB/Windows Admin Shares' }],
  'ssh': [{ technique: 'T1021.004', tactic: 'Lateral Movement', name: 'SSH' }],
  
  // Exfiltration
  'data_exfiltration': [{ technique: 'T1041', tactic: 'Exfiltration', name: 'Exfiltration Over C2 Channel' }],
  'dns_exfiltration': [{ technique: 'T1048.003', tactic: 'Exfiltration', name: 'Exfiltration Over DNS' }],
  
  // Command & Control
  'c2': [{ technique: 'T1071', tactic: 'Command and Control', name: 'Application Layer Protocol' }],
  'beaconing': [{ technique: 'T1071.001', tactic: 'Command and Control', name: 'Web Protocols' }],
  'dns_c2': [{ technique: 'T1071.004', tactic: 'Command and Control', name: 'DNS' }],
  'encoded_command': [{ technique: 'T1132', tactic: 'Command and Control', name: 'Data Encoding' }],
  
  // Persistence
  'registry': [{ technique: 'T1547.001', tactic: 'Persistence', name: 'Registry Run Keys' }],
  'scheduled_task': [{ technique: 'T1053', tactic: 'Persistence', name: 'Scheduled Task/Job' }],
  'startup': [{ technique: 'T1547', tactic: 'Persistence', name: 'Boot or Logon Autostart Execution' }],
  
  // Discovery
  'network_scan': [{ technique: 'T1046', tactic: 'Discovery', name: 'Network Service Discovery' }],
  'port_scan': [{ technique: 'T1046', tactic: 'Discovery', name: 'Network Service Discovery' }],
  'discovery': [{ technique: 'T1082', tactic: 'Discovery', name: 'System Information Discovery' }],
  
  // Defense Evasion
  'obfuscation': [{ technique: 'T1027', tactic: 'Defense Evasion', name: 'Obfuscated Files or Information' }],
  'disable_security': [{ technique: 'T1562', tactic: 'Defense Evasion', name: 'Impair Defenses' }],
  
  // Impact
  'ransomware': [{ technique: 'T1486', tactic: 'Impact', name: 'Data Encrypted for Impact' }],
  'wiper': [{ technique: 'T1485', tactic: 'Impact', name: 'Data Destruction' }],
  'dos': [{ technique: 'T1499', tactic: 'Impact', name: 'Endpoint Denial of Service' }],
  
  // Malware
  'malware': [{ technique: 'T1204', tactic: 'Execution', name: 'User Execution' }],
  'trojan': [{ technique: 'T1204.002', tactic: 'Execution', name: 'Malicious File' }],
  'backdoor': [{ technique: 'T1543', tactic: 'Persistence', name: 'Create or Modify System Process' }],
};

// Keywords to MITRE mapping for automatic detection
const KEYWORD_PATTERNS: { pattern: RegExp; techniques: string[] }[] = [
  { pattern: /powershell|pwsh|ps1/i, techniques: ['powershell'] },
  { pattern: /cmd\.exe|command\s*prompt/i, techniques: ['command_execution'] },
  { pattern: /brute\s*force|failed\s*login|authentication\s*fail/i, techniques: ['brute_force'] },
  { pattern: /password\s*spray/i, techniques: ['password_spray'] },
  { pattern: /mimikatz|lsass|credential\s*dump/i, techniques: ['mimikatz', 'credential_dump'] },
  { pattern: /phish|spoof|impersonat/i, techniques: ['phishing'] },
  { pattern: /ransomware|encrypt.*files|\.locked|\.crypt/i, techniques: ['ransomware'] },
  { pattern: /lateral|remote\s*desktop|rdp/i, techniques: ['rdp', 'lateral_movement'] },
  { pattern: /smb|\\\\.*\\|admin\$|c\$/i, techniques: ['smb'] },
  { pattern: /ssh|port\s*22/i, techniques: ['ssh'] },
  { pattern: /c2|command\s*and\s*control|beacon/i, techniques: ['c2', 'beaconing'] },
  { pattern: /exfiltrat|data\s*theft|upload.*sensitive/i, techniques: ['data_exfiltration'] },
  { pattern: /dns.*tunnel|dns.*exfil/i, techniques: ['dns_exfiltration', 'dns_c2'] },
  { pattern: /encoded|base64|obfuscat/i, techniques: ['encoded_command', 'obfuscation'] },
  { pattern: /registry|hklm|hkcu/i, techniques: ['registry'] },
  { pattern: /scheduled\s*task|schtask|cron/i, techniques: ['scheduled_task'] },
  { pattern: /port\s*scan|nmap|network\s*scan/i, techniques: ['port_scan', 'network_scan'] },
  { pattern: /process\s*inject|dll\s*inject|hollowing/i, techniques: ['process_injection'] },
  { pattern: /malware|trojan|virus|worm/i, techniques: ['malware', 'trojan'] },
  { pattern: /backdoor|reverse\s*shell|bind\s*shell/i, techniques: ['backdoor', 'c2'] },
  { pattern: /disable.*security|kill.*antivirus|stop.*defender/i, techniques: ['disable_security'] },
  { pattern: /wiper|destruct|delete.*system/i, techniques: ['wiper'] },
  { pattern: /denial\s*of\s*service|dos|ddos/i, techniques: ['dos'] },
  { pattern: /outbound.*connection|suspicious.*domain|unknown.*host/i, techniques: ['c2'] },
];

// Normalize the log data to handle various formats
function normalizeLog(rawLog: any): LogData {
  return {
    eventType: rawLog.eventType || rawLog.event_type || rawLog.EventType || 'Unknown',
    severity: rawLog.severity || rawLog.Severity || 1,
    srcIP: rawLog.srcIP || rawLog.source_ip || rawLog.src_ip || rawLog.ip_address || 'N/A',
    dstIP: rawLog.dstIP || rawLog.destination_ip || rawLog.dst_ip || 'N/A',
    msg: rawLog.msg || rawLog.message || rawLog.Message || rawLog.parsed_message || '',
    fileHash: rawLog.fileHash || rawLog.file_hash,
    action: rawLog.action || rawLog.Action,
    rawLog: rawLog.rawLog || rawLog.raw_log || rawLog,
    provider: rawLog.provider || rawLog.Provider || rawLog.ProviderName,
    event_id: rawLog.event_id || rawLog.EventId || rawLog.Id,
    hostname: rawLog.hostname || rawLog.host || rawLog.Host,
  };
}

// Check if the event is a known benign pattern
function isBenignEvent(log: LogData): { isBenign: boolean; reason: string } {
  const content = `${log.eventType} ${log.msg} ${log.provider || ''} ${log.action || ''}`;
  
  for (const pattern of BENIGN_PATTERNS) {
    if (pattern.test(content)) {
      return { 
        isBenign: true, 
        reason: `Common system/telemetry event: ${pattern.source.substring(0, 50)}` 
      };
    }
  }
  return { isBenign: false, reason: '' };
}

// Check if the event matches high-risk patterns
function isHighRiskEvent(log: LogData): { isHighRisk: boolean; reason: string } {
  const content = `${log.eventType} ${log.msg} ${log.action || ''}`;
  
  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(content)) {
      return { 
        isHighRisk: true, 
        reason: `Matches high-risk pattern: ${pattern.source.substring(0, 50)}` 
      };
    }
  }
  return { isHighRisk: false, reason: '' };
}

function detectMitreFromContent(log: LogData): { technique: string; tactic: string; name: string; confidence: number }[] {
  const detected: { technique: string; tactic: string; name: string; confidence: number }[] = [];
  const content = `${log.eventType} ${log.msg} ${log.action || ''}`.toLowerCase();
  
  for (const { pattern, techniques } of KEYWORD_PATTERNS) {
    if (pattern.test(content)) {
      for (const techKey of techniques) {
        const mappings = MITRE_MAPPING[techKey];
        if (mappings) {
          for (const mapping of mappings) {
            if (!detected.find(d => d.technique === mapping.technique)) {
              detected.push({
                ...mapping,
                confidence: 75 + Math.floor(Math.random() * 20)
              });
            }
          }
        }
      }
    }
  }
  
  return detected.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

async function verifyAuth(req: Request, isInternal: boolean): Promise<{ user: any; error?: string }> {
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
    const { internal } = body;
    
    // Normalize the log data
    const log = normalizeLog(body.log);

    const { user, error: authError } = await verifyAuth(req, internal === true);
    if (authError) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: authError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`Analyzing log for ${user.type === 'service' ? 'internal call' : `user ${user.id}`}:`, JSON.stringify(log));

    // Step 1: Quick benign check - avoid unnecessary AI calls
    const benignCheck = isBenignEvent(log);
    if (benignCheck.isBenign && log.severity <= 2) {
      console.log(`📌 Fast-tracked as benign: ${benignCheck.reason}`);
      return new Response(JSON.stringify({
        ai_analysis: {
          classification: 'Benign',
          confidence: 15,
          reason: benignCheck.reason,
          risk_level: 'Low',
          mitre_techniques: [],
          recommended_actions: ['No action required - normal system activity'],
          evidence: [benignCheck.reason],
          kill_chain_phase: 'N/A',
        },
        sandbox_result: null,
        classification: 'Benign',
        confidence: 15,
        risk_level: 'Low',
        recommended_actions: ['No action required'],
        evidence: [benignCheck.reason],
        mitre_technique: null,
        mitre_tactic: null,
        mitre_techniques: [],
        kill_chain_phase: 'N/A',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('API key is not configured');
    }

    // First, detect MITRE techniques from keywords
    const keywordMitre = detectMitreFromContent(log);
    console.log('Keyword-based MITRE detection:', keywordMitre);

    // Check for high-risk patterns
    const riskCheck = isHighRiskEvent(log);

    // Security-tuned SOC Analyst Prompt
    const aiPrompt = `You are a Tier-2 SOC Analyst with expertise in MITRE ATT&CK framework.

Analyze the following security event carefully and provide classification.

EVENT DETAILS:
- Event Type: ${log.eventType}
- Provider: ${log.provider || 'Unknown'}
- Event ID: ${log.event_id || 'N/A'}
- Severity: ${log.severity}/5
- Source IP: ${log.srcIP}
- Destination IP: ${log.dstIP}
- Hostname: ${log.hostname || 'Unknown'}
- Message: ${log.msg}
${log.fileHash ? `- File Hash: ${log.fileHash}` : ''}

CRITICAL ANALYSIS RULES:
1. Do NOT flag common system or telemetry events as malicious
2. Windows events like Netwtw10, BTHUSB, Service start/stop, driver events are usually Benign
3. One event alone is rarely malicious unless clearly suspicious
4. Only flag as True Positive if there are CLEAR indicators of compromise
5. Consider context: failed logins could be user mistakes, not attacks

HIGH-RISK indicators (if present, investigate carefully):
- Credential access, privilege escalation, persistence mechanisms
- Encoded/obfuscated commands
- Known malware signatures
- Lateral movement indicators
- Data exfiltration patterns
- C2 beaconing

Return ONLY a valid JSON object with this EXACT structure:
{
  "classification": "True Positive" | "False Positive" | "Benign",
  "confidence": 0-100 (integer, be conservative),
  "reason": "Brief explanation (1-2 sentences)",
  "risk_level": "Critical" | "High" | "Medium" | "Low",
  "mitre_techniques": [
    {
      "technique_id": "T####.###",
      "technique_name": "Full technique name",
      "tactic": "Tactic name",
      "confidence": 0-100,
      "evidence": "Why this technique was identified"
    }
  ],
  "recommended_actions": ["action1", "action2"],
  "evidence": ["evidence1", "evidence2"],
  "kill_chain_phase": "Reconnaissance/Weaponization/Delivery/Exploitation/Installation/C2/Actions"
}

IMPORTANT: 
- For Benign events, mitre_techniques should be empty array []
- Be CONSERVATIVE with True Positive classifications
- confidence should reflect actual certainty (don't default to high values)`;

    let aiAnalysis;
    
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
            { role: 'system', content: 'You are an expert SOC analyst. Return only valid JSON. Be conservative with True Positive classifications. Most system events are benign.' },
            { role: 'user', content: aiPrompt }
          ],
          temperature: 0.1, // Lower temperature for more consistent results
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
      const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                        aiContent.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, aiContent];
      aiAnalysis = JSON.parse(jsonMatch[1] || aiContent);
      
    } catch (e) {
      console.error('AI analysis failed, using fallback:', e);
      
      // Fallback analysis - conservative approach
      const isSuspicious = riskCheck.isHighRisk || log.severity >= 4;
      
      aiAnalysis = {
        classification: isSuspicious ? 'False Positive' : 'Benign',
        confidence: isSuspicious ? 40 : 20,
        reason: isSuspicious 
          ? 'Automated analysis inconclusive - manual review recommended' 
          : 'Low severity system event - likely benign activity',
        risk_level: log.severity >= 4 ? 'Medium' : 'Low',
        mitre_techniques: keywordMitre.map(m => ({
          technique_id: m.technique,
          technique_name: m.name,
          tactic: m.tactic,
          confidence: m.confidence,
          evidence: 'Detected via keyword matching'
        })),
        recommended_actions: isSuspicious 
          ? ['Manual review required', 'Check related events for context']
          : ['No immediate action required', 'Monitor for patterns'],
        evidence: isSuspicious ? [riskCheck.reason || 'High severity event'] : ['Normal system activity'],
        kill_chain_phase: 'Unknown'
      };
    }

    // Ensure mitre_techniques is always an array
    if (!Array.isArray(aiAnalysis.mitre_techniques)) {
      aiAnalysis.mitre_techniques = [];
    }

    // Merge keyword-detected techniques with AI-detected (only for non-benign)
    if (aiAnalysis.classification !== 'Benign') {
      for (const kwTech of keywordMitre) {
        const exists = aiAnalysis.mitre_techniques.find(
          (t: any) => t.technique_id === kwTech.technique
        );
        if (!exists) {
          aiAnalysis.mitre_techniques.push({
            technique_id: kwTech.technique,
            technique_name: kwTech.name,
            tactic: kwTech.tactic,
            confidence: kwTech.confidence,
            evidence: 'Detected via keyword pattern matching'
          });
        }
      }
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

            if (sandboxResult.malicious > 0) {
              aiAnalysis.confidence = Math.min(100, aiAnalysis.confidence + 15);
              if (!aiAnalysis.evidence.includes('Malicious hash detected by VirusTotal')) {
                aiAnalysis.evidence.push('Malicious hash detected by VirusTotal');
              }
              if (aiAnalysis.classification === 'Benign' && sandboxResult.malicious > 5) {
                aiAnalysis.classification = 'True Positive';
                aiAnalysis.reason = 'Hash flagged as malicious by multiple vendors';
                aiAnalysis.risk_level = 'High';
              }
              if (!aiAnalysis.mitre_techniques.find((t: any) => t.technique_id === 'T1204.002')) {
                aiAnalysis.mitre_techniques.push({
                  technique_id: 'T1204.002',
                  technique_name: 'Malicious File',
                  tactic: 'Execution',
                  confidence: 90,
                  evidence: `VirusTotal: ${sandboxResult.malicious} vendors flagged as malicious`
                });
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
    if (log.severity >= 4) riskScore += 2;
    if (aiAnalysis.classification === 'True Positive') riskScore += 5;
    if (sandboxResult?.malicious > 0) riskScore += 7;
    if (aiAnalysis.mitre_techniques.length > 2) riskScore += 1;
    if (riskCheck.isHighRisk) riskScore += 3;
    
    const calculatedRiskLevel = riskScore >= 10 ? 'Critical' : 
                                riskScore >= 7 ? 'High' : 
                                riskScore >= 4 ? 'Medium' : 'Low';

    // Only override risk_level if AI didn't provide one or if VirusTotal found malware
    if (!aiAnalysis.risk_level || sandboxResult?.malicious > 5) {
      aiAnalysis.risk_level = calculatedRiskLevel;
    }

    // Get primary MITRE technique (highest confidence)
    const primaryTechnique = aiAnalysis.mitre_techniques.length > 0 
      ? aiAnalysis.mitre_techniques.sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))[0]
      : null;

    const result = {
      ai_analysis: aiAnalysis,
      sandbox_result: sandboxResult,
      classification: aiAnalysis.classification,
      confidence: aiAnalysis.confidence,
      risk_level: aiAnalysis.risk_level,
      recommended_actions: aiAnalysis.recommended_actions || [],
      evidence: aiAnalysis.evidence || [],
      mitre_technique: primaryTechnique?.technique_id || null,
      mitre_tactic: primaryTechnique?.tactic || null,
      mitre_techniques: aiAnalysis.mitre_techniques,
      kill_chain_phase: aiAnalysis.kill_chain_phase || null,
    };

    console.log(`✅ Analysis complete: ${result.classification} (${result.confidence}%) - ${result.risk_level}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-log function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Return a safe fallback instead of error
    return new Response(JSON.stringify({
      ai_analysis: {
        classification: 'Benign',
        confidence: 10,
        reason: 'Analysis error - defaulting to benign for unsupported event type',
        risk_level: 'Low',
        mitre_techniques: [],
        recommended_actions: ['Manual review if recurring'],
        evidence: ['Automated analysis failed'],
        kill_chain_phase: 'N/A',
      },
      sandbox_result: null,
      classification: 'Benign',
      confidence: 10,
      risk_level: 'Low',
      recommended_actions: ['Manual review if recurring'],
      evidence: ['Automated analysis failed'],
      mitre_technique: null,
      mitre_tactic: null,
      mitre_techniques: [],
      kill_chain_phase: 'N/A',
      _error: message, // Include error for debugging but don't fail
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
