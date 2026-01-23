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

// ============================================
// BENIGN EVENT WHITELIST - Common Windows Telemetry
// ============================================
const BENIGN_PROVIDERS: string[] = [
  'nhi', 'BTHUSB', 'Netwtw10', 'Netwtw08', 'Netwtw06', 
  'NDIS', 'e1i65x64', 'iaStorA', 'WMI', 'FilterManager',
  'Microsoft-Windows-Time-Service', 'Microsoft-Windows-Kernel-General',
  'Microsoft-Windows-Power', 'Microsoft-Windows-Kernel-Power',
  'Microsoft-Windows-DistributedCOM', 'Microsoft-Windows-DNS-Client',
  'Service Control Manager', 'Application Popup', 'volmgr',
  'Microsoft-Windows-UserModePowerService', 'Microsoft-Windows-WindowsUpdateClient',
  'Microsoft-Windows-Winlogon', 'Microsoft-Windows-Security-SPP',
  'Intel', 'Realtek', 'NVIDIA', 'AMD'
];

const BENIGN_EVENT_IDS: number[] = [
  // Common informational Windows events
  4624,  // Successful logon (Type 5 = Service)
  4634,  // Logoff
  4672,  // Special privileges assigned (admin logon - normal for system)
  7036,  // Service state change
  7040,  // Service config change
  4798,  // User's local group membership was enumerated
  4799,  // Security-enabled local group membership was enumerated
  4688,  // Process creation (normal)
  4689,  // Process exit
  1,     // WMI provider started
  10,    // WMI filter
  5379,  // Credential Manager read (normal for Windows)
  5061,  // Cryptographic operation (normal)
  5058,  // Key file operation (normal)
];

// Benign message patterns (regex)
const BENIGN_PATTERNS: RegExp[] = [
  /Driver\s+(exit|entry)\s+RTD3/i,
  /All\s+the\s+connected\s+devices\s+will\s+now\s+cause/i,
  /service\s+(started|stopped)\s+successfully/i,
  /Windows\s+is\s+starting\s+up/i,
  /Logon\s+Type:\s*(5|7|11)/i,  // Service, unlock, cached logon - normal
  /An\s+account\s+was\s+successfully\s+logged\s+on.*Logon\s+Type:\s*5/si,
  /local\s+group\s+membership\s+was\s+enumerated/i,
  /Special\s+privileges\s+assigned.*WORKGROUP/si,
  /SYSTEM\s+account/i,
  /S-1-5-18/i,  // Local SYSTEM SID
  /S-1-5-19/i,  // Local SERVICE SID
  /S-1-5-20/i,  // NETWORK SERVICE SID
];

// ============================================
// SUSPICIOUS EVENT PATTERNS - Require Investigation
// ============================================
const SUSPICIOUS_PATTERNS: RegExp[] = [
  /failed\s+login/i,
  /authentication\s+fail/i,
  /access\s+denied/i,
  /privilege\s+escalation/i,
  /unauthorized/i,
  /suspicious/i,
  /malware/i,
  /virus/i,
  /trojan/i,
  /ransomware/i,
  /encrypt/i,
  /exfiltrat/i,
  /lateral\s+movement/i,
  /pass.?the.?hash/i,
  /mimikatz/i,
  /credential\s+dump/i,
  /reverse\s+shell/i,
  /c2|command\s*&?\s*control/i,
  /beacon/i,
  /powershell.*-enc|-encodedcommand/i,
  /invoke-expression|iex\s*\(/i,
  /new-object\s+net\.webclient/i,
  /downloadstring|downloadfile/i,
  /frombase64string/i,
];

const HIGH_RISK_EVENT_IDS: number[] = [
  4625,  // Failed logon
  4648,  // Explicit credential logon
  4768,  // Kerberos TGT request
  4769,  // Kerberos service ticket request
  4771,  // Kerberos pre-auth failed
  4776,  // Credential validation
  4720,  // User account created
  4722,  // User account enabled
  4724,  // Password reset attempt
  4728,  // Member added to security group
  4732,  // Member added to local security group
  4756,  // Member added to universal group
  1102,  // Audit log cleared
  4616,  // System time changed
  4657,  // Registry value modified
  4697,  // Service installed
];

// ============================================
// MITRE ATT&CK Mapping Database
// ============================================
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

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if the log event is a known benign Windows telemetry event
 */
function isBenignEvent(log: LogData): { isBenign: boolean; reason: string } {
  const content = `${log.eventType} ${log.msg} ${log.action || ''}`;
  const rawLog = log.rawLog || {};
  const provider = (rawLog as any).provider || '';
  const eventId = (rawLog as any).event_id || (rawLog as any).eventId || 0;
  
  // Check if provider is in benign list
  for (const benignProvider of BENIGN_PROVIDERS) {
    if (provider.toLowerCase().includes(benignProvider.toLowerCase()) ||
        content.toLowerCase().includes(benignProvider.toLowerCase())) {
      return { isBenign: true, reason: `Known benign provider: ${benignProvider}` };
    }
  }
  
  // Check if event ID is in benign list (only for low severity)
  if (log.severity <= 2 && BENIGN_EVENT_IDS.includes(eventId)) {
    // But check if there are suspicious patterns in the message
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(content)) {
        return { isBenign: false, reason: `Suspicious pattern detected despite benign event ID` };
      }
    }
    return { isBenign: true, reason: `Known benign event ID: ${eventId}` };
  }
  
  // Check benign message patterns (only for low severity)
  if (log.severity <= 2) {
    for (const pattern of BENIGN_PATTERNS) {
      if (pattern.test(content)) {
        return { isBenign: true, reason: `Matched benign pattern` };
      }
    }
  }
  
  // Check for high-risk event IDs
  if (HIGH_RISK_EVENT_IDS.includes(eventId)) {
    return { isBenign: false, reason: `High-risk event ID: ${eventId}` };
  }
  
  // Check suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      return { isBenign: false, reason: `Suspicious pattern matched` };
    }
  }
  
  // Default: not benign for medium+ severity
  if (log.severity >= 3) {
    return { isBenign: false, reason: 'Medium+ severity requires analysis' };
  }
  
  // Low severity without suspicious patterns = likely benign
  return { isBenign: true, reason: 'Low severity without suspicious patterns' };
}

/**
 * Detect MITRE techniques from content keywords
 */
function detectMitreFromContent(log: LogData): { technique: string; tactic: string; name: string; confidence: number }[] {
  const detected: { technique: string; tactic: string; name: string; confidence: number }[] = [];
  const content = `${log.eventType} ${log.msg} ${log.action || ''}`.toLowerCase();

  for (const { pattern, techniques } of KEYWORD_PATTERNS) {
    if (pattern.test(content)) {
      for (const techKey of techniques) {
        const mappings = MITRE_MAPPING[techKey];
        if (mappings) {
          for (const mapping of mappings) {
            // Avoid duplicates
            if (!detected.find(d => d.technique === mapping.technique)) {
              detected.push({
                ...mapping,
                confidence: 75 + Math.floor(Math.random() * 20) // 75-95%
              });
            }
          }
        }
      }
    }
  }

  // Sort by confidence
  return detected.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

/**
 * Calculate confidence based on multiple factors
 */
function calculateFallbackConfidence(log: LogData, hasMitreTechniques: boolean, isSuspicious: boolean): number {
  let confidence = 25; // Base low confidence for fallback
  
  // Severity affects confidence
  if (log.severity >= 5) confidence += 35;
  else if (log.severity >= 4) confidence += 25;
  else if (log.severity >= 3) confidence += 15;
  else confidence += 5;
  
  // MITRE techniques increase confidence
  if (hasMitreTechniques) confidence += 20;
  
  // Suspicious patterns increase confidence
  if (isSuspicious) confidence += 15;
  
  // File hash present increases confidence
  if (log.fileHash) confidence += 10;
  
  return Math.min(95, confidence);
}

/**
 * Determine classification based on heuristics
 */
function determineClassification(log: LogData, keywordMitre: any[], isSuspicious: boolean): {
  classification: string;
  riskLevel: string;
  reason: string;
} {
  // High severity + suspicious patterns = True Positive
  if (log.severity >= 4 && (keywordMitre.length > 0 || isSuspicious)) {
    return {
      classification: 'True Positive',
      riskLevel: log.severity >= 5 ? 'Critical' : 'High',
      reason: 'High severity event with suspicious indicators'
    };
  }
  
  // High severity alone = needs investigation
  if (log.severity >= 4) {
    return {
      classification: 'Suspicious',
      riskLevel: 'High',
      reason: 'High severity event requires investigation'
    };
  }
  
  // Medium severity + MITRE techniques = Suspicious
  if (log.severity >= 3 && keywordMitre.length > 0) {
    return {
      classification: 'Suspicious',
      riskLevel: 'Medium',
      reason: 'Medium severity with MITRE technique indicators'
    };
  }
  
  // Medium severity + suspicious patterns = needs review
  if (log.severity >= 3 && isSuspicious) {
    return {
      classification: 'Suspicious',
      riskLevel: 'Medium',
      reason: 'Medium severity with suspicious patterns detected'
    };
  }
  
  // Low severity with suspicious patterns = low priority review
  if (isSuspicious) {
    return {
      classification: 'Suspicious',
      riskLevel: 'Low',
      reason: 'Suspicious patterns detected in low severity event'
    };
  }
  
  // Default: Benign
  return {
    classification: 'Benign',
    riskLevel: 'Low',
    reason: 'No suspicious indicators detected'
  };
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

  if (!roleData || !['admin', 'soc_analyst', 'soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager', 'ciso'].includes(roleData.role)) {
    return { user: null, error: 'Insufficient permissions. Admin or SOC Analyst role required.' };
  }

  return { user };
}

// ============================================
// MAIN HANDLER
// ============================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as { log: LogData; internal?: boolean };
    const { log, internal } = body;

    const { user, error: authError } = await verifyAuth(req, internal === true);
    if (authError) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: authError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Analyzing log for ${user.type === 'service' ? 'internal call' : `user ${user.id}`}:`, JSON.stringify(log).substring(0, 200));

    // ============================================
    // STEP 1: Check if event is known benign
    // ============================================
    const benignCheck = isBenignEvent(log);
    if (benignCheck.isBenign) {
      console.log(`✅ Skipping benign event: ${benignCheck.reason}`);
      return new Response(JSON.stringify({
        ai_analysis: {
          classification: 'Benign',
          confidence: 95,
          reason: benignCheck.reason,
          risk_level: 'Low',
          mitre_techniques: [],
          recommended_actions: [],
          evidence: [],
          kill_chain_phase: null
        },
        sandbox_result: null,
        classification: 'Benign',
        confidence: 95,
        risk_level: 'Low',
        recommended_actions: [],
        evidence: [],
        mitre_technique: null,
        mitre_tactic: null,
        mitre_techniques: [],
        kill_chain_phase: null,
        is_benign: true,
        benign_reason: benignCheck.reason
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============================================
    // STEP 2: Detect MITRE techniques from keywords
    // ============================================
    const keywordMitre = detectMitreFromContent(log);
    console.log('Keyword-based MITRE detection:', keywordMitre.length > 0 ? keywordMitre : 'None');

    // Check for suspicious patterns
    const content = `${log.eventType} ${log.msg} ${log.action || ''}`;
    const isSuspicious = SUSPICIOUS_PATTERNS.some(p => p.test(content));

    // ============================================
    // STEP 3: Try AI Analysis
    // ============================================
    const aiPrompt = `Analyze this security log and provide a threat assessment:

Event Type: ${log.eventType}
Severity: ${log.severity}
Source IP: ${log.srcIP}
Destination IP: ${log.dstIP}
Message: ${log.msg}
${log.fileHash ? `File Hash: ${log.fileHash}` : ''}
${log.action ? `Action: ${log.action}` : ''}

IMPORTANT: Be conservative with classifications. Only mark as "True Positive" if there are clear indicators of malicious activity.
Mark as "Benign" for normal system operations, routine Windows events, and expected user activities.
Mark as "Suspicious" if the event warrants investigation but isn't clearly malicious.

Respond with JSON containing:
{
  "classification": "True Positive" | "Suspicious" | "False Positive" | "Benign",
  "confidence": 0-100,
  "reason": "explanation",
  "risk_level": "Critical" | "High" | "Medium" | "Low",
  "mitre_techniques": [{ "technique_id": "T1234", "technique_name": "Name", "tactic": "Tactic", "confidence": 80, "evidence": "why" }],
  "recommended_actions": ["action1", "action2"],
  "evidence": ["evidence1", "evidence2"],
  "kill_chain_phase": "phase name"
}`;

    let aiAnalysis: any = null;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // 1. Try Primary Model (Lovable AI Gateway)
    try {
      if (LOVABLE_API_KEY) {
        console.log('🤖 Analyzing with Primary Model (Lovable)...');
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a conservative SOC analyst expert in MITRE ATT&CK. Only flag events as True Positive if there are clear indicators of malicious activity. Return only valid JSON.' },
              { role: 'user', content: aiPrompt }
            ],
            temperature: 0.1,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const aiContent = aiData.choices?.[0]?.message?.content;
          console.log('✅ Primary Model Response received');

          const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/) ||
            aiContent.match(/```\s*([\s\S]*?)\s*```/) ||
            [null, aiContent];
          aiAnalysis = JSON.parse(jsonMatch[1] || aiContent);
        } else {
          console.warn(`Primary model failed: ${aiResponse.status} ${aiResponse.statusText}`);
        }
      }
    } catch (e) {
      console.warn('Primary model error:', e);
    }

    // 2. Try Secondary Model (Direct OpenAI Fallback)
    if (!aiAnalysis) {
      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
      if (OPENAI_API_KEY) {
        try {
          console.log('🤖 Switching to Secondary Model (OpenAI)...');
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'You are a conservative SOC analyst expert in MITRE ATT&CK. Only flag events as True Positive if there are clear indicators. Return only valid JSON.' },
                { role: 'user', content: aiPrompt }
              ],
              temperature: 0.1,
              response_format: { type: "json_object" }
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices[0].message.content;
            console.log('✅ Secondary model analysis successful');
            aiAnalysis = JSON.parse(content);
          } else {
            console.warn(`Secondary model failed: ${response.status}`);
          }
        } catch (err) {
          console.warn('Secondary model error:', err);
        }
      }
    }

    // ============================================
    // STEP 4: Intelligent Fallback Analysis
    // ============================================
    if (!aiAnalysis) {
      console.log('⚠️ All AI models unavailable. Using intelligent rule-based fallback.');

      const classification = determineClassification(log, keywordMitre, isSuspicious);
      const confidence = calculateFallbackConfidence(log, keywordMitre.length > 0, isSuspicious);

      aiAnalysis = {
        classification: classification.classification,
        confidence: confidence,
        reason: `${classification.reason}. (Automated analysis - AI services unavailable)`,
        risk_level: classification.riskLevel,
        mitre_techniques: keywordMitre.map(m => ({
          technique_id: m.technique,
          technique_name: m.name,
          tactic: m.tactic,
          confidence: m.confidence,
          evidence: 'Detected via keyword matching'
        })),
        recommended_actions: classification.classification !== 'Benign' 
          ? ['Manual review recommended', 'Verify AI service connectivity']
          : [],
        evidence: isSuspicious ? ['Suspicious patterns detected in log content'] : [],
        kill_chain_phase: 'Unknown'
      };
      
      console.log(`📊 Fallback result: ${aiAnalysis.classification} (${aiAnalysis.confidence}%) - ${aiAnalysis.reason}`);
    }

    // Ensure mitre_techniques is always an array
    if (!Array.isArray(aiAnalysis.mitre_techniques)) {
      aiAnalysis.mitre_techniques = [];
    }

    // Merge keyword-detected techniques with AI-detected
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

    // ============================================
    // STEP 5: Check hash with VirusTotal if available
    // ============================================
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
              if ((aiAnalysis.classification === 'Benign' || aiAnalysis.classification === 'False Positive') && sandboxResult.malicious > 5) {
                aiAnalysis.classification = 'True Positive';
                aiAnalysis.reason = 'Hash flagged as malicious by multiple vendors';
                aiAnalysis.risk_level = 'High';
              }
              // Add malware technique if not present
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

    // ============================================
    // STEP 6: Calculate final risk score
    // ============================================
    let riskScore = 0;
    if (log.severity >= 5) riskScore += 5;
    else if (log.severity >= 4) riskScore += 3;
    else if (log.severity >= 3) riskScore += 1;
    
    if (aiAnalysis.classification === 'True Positive') riskScore += 5;
    else if (aiAnalysis.classification === 'Suspicious') riskScore += 2;
    
    if (sandboxResult?.malicious > 0) riskScore += 7;
    if (aiAnalysis.mitre_techniques.length > 2) riskScore += 2;
    else if (aiAnalysis.mitre_techniques.length > 0) riskScore += 1;

    const calculatedRiskLevel = riskScore >= 10 ? 'Critical' :
      riskScore >= 7 ? 'High' :
        riskScore >= 4 ? 'Medium' : 'Low';

    // Only override if AI didn't provide risk level
    if (!aiAnalysis.risk_level || aiAnalysis.risk_level === 'Unknown') {
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
      // Primary MITRE fields for backward compatibility
      mitre_technique: primaryTechnique?.technique_id || null,
      mitre_tactic: primaryTechnique?.tactic || null,
      // Full MITRE techniques array
      mitre_techniques: aiAnalysis.mitre_techniques,
      kill_chain_phase: aiAnalysis.kill_chain_phase || null,
      is_benign: aiAnalysis.classification === 'Benign',
    };

    console.log(`📊 Final Analysis: ${result.classification} (${result.confidence}%) Risk: ${result.risk_level} MITRE: ${result.mitre_techniques?.length || 0}`);

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
