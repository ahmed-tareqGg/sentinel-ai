"""
SOCMind Agent – Real-Time Threat Detection Engine
Runs locally on the endpoint to detect threats in real-time before sending to platform.

Detects:
  - Brute Force (login threshold per source)
  - Port Scanning (connection patterns)
  - Privilege Escalation (sudo/su/runas abuse)
  - Lateral Movement (SMB/WinRM/SSH patterns)
  - Suspicious Processes (known malware names, reverse shells)
  - Credential Dumping (LSASS access, /etc/shadow reads)

Inspired by: CrowdStrike Falcon, SentinelOne, OSSEC
"""

import re
import time
import threading
from collections import defaultdict
from datetime import datetime, timezone


class ThreatDetector:
    """Local real-time threat detection engine."""

    def __init__(self, config: dict, audit_logger):
        self.config = config
        self.audit = audit_logger
        self.enabled = config.get("threat_detection", {}).get("enabled", True)

        # ── Thresholds (configurable via config.yaml) ──
        td_config = config.get("threat_detection", {})
        self.brute_force_threshold = td_config.get("brute_force_threshold", 5)
        self.brute_force_window = td_config.get("brute_force_window_seconds", 300)
        self.port_scan_threshold = td_config.get("port_scan_threshold", 15)
        self.port_scan_window = td_config.get("port_scan_window_seconds", 60)

        # ── State tracking ──
        self._failed_logins = defaultdict(list)     # {source_ip: [timestamps]}
        self._connection_attempts = defaultdict(list)  # {source_ip: [(timestamp, port)]}
        self._alerts = []                             # Generated alerts queue
        self._lock = threading.Lock()

        # ── Known suspicious process names ──
        self.suspicious_processes = {
            "mimikatz", "lazagne", "procdump", "secretsdump",
            "bloodhound", "rubeus", "covenant", "meterpreter",
            "nc.exe", "ncat", "socat", "chisel", "ngrok",
            "psexec", "wmiexec", "smbexec", "evil-winrm",
            "crackmapexec", "impacket", "hashcat", "john",
        }

        # ── Suspicious paths ──
        self.sensitive_paths = {
            "/etc/shadow", "/etc/passwd", "/etc/sudoers",
            "/proc/self/maps", "/proc/kcore",
            "sam", "system", "security",  # Windows registry hives
        }

    def analyze_log(self, log_entry: dict) -> list:
        """
        Analyze a single log entry for threats.
        Returns a list of alert dicts (empty if no threat detected).
        """
        if not self.enabled:
            return []

        alerts = []
        msg = log_entry.get("message", "")
        msg_lower = msg.lower()
        source_ip = log_entry.get("source_ip", "unknown")
        timestamp = time.time()

        # ── 1. Brute Force Detection ──
        bf_alert = self._check_brute_force(msg_lower, source_ip, timestamp)
        if bf_alert:
            alerts.append(bf_alert)

        # ── 2. Port Scan Detection ──
        ps_alert = self._check_port_scan(msg_lower, source_ip, timestamp)
        if ps_alert:
            alerts.append(ps_alert)

        # ── 3. Privilege Escalation ──
        pe_alert = self._check_privilege_escalation(msg_lower, msg)
        if pe_alert:
            alerts.append(pe_alert)

        # ── 4. Suspicious Process ──
        sp_alert = self._check_suspicious_process(msg_lower, msg)
        if sp_alert:
            alerts.append(sp_alert)

        # ── 5. Credential Dumping ──
        cd_alert = self._check_credential_dump(msg_lower, msg)
        if cd_alert:
            alerts.append(cd_alert)

        # ── 6. Lateral Movement ──
        lm_alert = self._check_lateral_movement(msg_lower, msg, source_ip)
        if lm_alert:
            alerts.append(lm_alert)

        # ── 7. Reverse Shell / C2 ──
        c2_alert = self._check_c2_indicators(msg_lower, msg)
        if c2_alert:
            alerts.append(c2_alert)

        # Store and log alerts
        for alert in alerts:
            alert["detected_at"] = datetime.now(timezone.utc).isoformat()
            alert["source_log"] = msg[:200]
            with self._lock:
                self._alerts.append(alert)
            self.audit.log_event("threat_detected", f"[{alert['severity']}] {alert['threat_type']}: {alert['description']}")
            print(f"  🚨 THREAT: [{alert['severity']}] {alert['threat_type']} — {alert['description']}")

        return alerts

    def get_pending_alerts(self) -> list:
        """Retrieve and clear pending alerts for platform submission."""
        with self._lock:
            alerts = list(self._alerts)
            self._alerts.clear()
        return alerts

    # ── Detection Methods ──

    def _check_brute_force(self, msg_lower: str, source_ip: str, ts: float) -> dict | None:
        brute_keywords = [
            "failed password", "authentication failure", "failed login",
            "invalid user", "logon failure", "account locked",
            "event id: 4625", "bad password",
        ]
        if not any(kw in msg_lower for kw in brute_keywords):
            return None

        with self._lock:
            attempts = self._failed_logins[source_ip]
            attempts.append(ts)
            # Prune old entries
            cutoff = ts - self.brute_force_window
            self._failed_logins[source_ip] = [t for t in attempts if t > cutoff]

            count = len(self._failed_logins[source_ip])

        if count >= self.brute_force_threshold:
            with self._lock:
                self._failed_logins[source_ip] = []  # Reset after alert
            return {
                "threat_type": "brute_force",
                "severity": "high",
                "description": f"Brute force detected: {count} failed logins from {source_ip} in {self.brute_force_window}s",
                "source_ip": source_ip,
                "count": count,
                "mitre_technique": "T1110",
                "mitre_tactic": "Credential Access",
                "recommended_actions": ["block_ip", "lock_user"],
            }
        return None

    def _check_port_scan(self, msg_lower: str, source_ip: str, ts: float) -> dict | None:
        scan_keywords = [
            "connection refused", "port scan", "syn scan",
            "rejected", "dropped packet", "portscan",
        ]
        if not any(kw in msg_lower for kw in scan_keywords):
            return None

        # Extract port if available
        port_match = re.search(r'(?:port|dpt)[= :](\d+)', msg_lower)
        port = int(port_match.group(1)) if port_match else 0

        with self._lock:
            attempts = self._connection_attempts[source_ip]
            attempts.append((ts, port))
            cutoff = ts - self.port_scan_window
            self._connection_attempts[source_ip] = [(t, p) for t, p in attempts if t > cutoff]

            unique_ports = len(set(p for _, p in self._connection_attempts[source_ip]))

        if unique_ports >= self.port_scan_threshold:
            with self._lock:
                self._connection_attempts[source_ip] = []
            return {
                "threat_type": "port_scan",
                "severity": "medium",
                "description": f"Port scan detected: {unique_ports} unique ports from {source_ip} in {self.port_scan_window}s",
                "source_ip": source_ip,
                "unique_ports": unique_ports,
                "mitre_technique": "T1046",
                "mitre_tactic": "Discovery",
                "recommended_actions": ["block_ip"],
            }
        return None

    def _check_privilege_escalation(self, msg_lower: str, msg: str) -> dict | None:
        patterns = [
            (r"sudo:\s+(\S+).*command", "sudo_abuse"),
            (r"su\[\d+\]:\s+.*session opened.*root", "su_to_root"),
            (r"event id: 4672", "special_privileges_assigned"),
            (r"pkexec|polkit.*authentication", "polkit_escalation"),
            (r"setuid|setgid|chmod.*[24]755", "suid_modification"),
        ]
        for pattern, subtype in patterns:
            if re.search(pattern, msg_lower):
                return {
                    "threat_type": "privilege_escalation",
                    "severity": "high",
                    "description": f"Privilege escalation attempt detected ({subtype})",
                    "subtype": subtype,
                    "mitre_technique": "T1548",
                    "mitre_tactic": "Privilege Escalation",
                    "recommended_actions": ["lock_user", "isolate_host"],
                }
        return None

    def _check_suspicious_process(self, msg_lower: str, msg: str) -> dict | None:
        for proc in self.suspicious_processes:
            if proc in msg_lower:
                return {
                    "threat_type": "suspicious_process",
                    "severity": "critical",
                    "description": f"Known attack tool detected: {proc}",
                    "process_name": proc,
                    "mitre_technique": "T1059",
                    "mitre_tactic": "Execution",
                    "recommended_actions": ["kill_process", "isolate_host"],
                }
        return None

    def _check_credential_dump(self, msg_lower: str, msg: str) -> dict | None:
        patterns = [
            "lsass", "/etc/shadow", "secretsdump", "hashdump",
            "credential dump", "sam database", "ntds.dit",
            "dcsync", "kerberoast",
        ]
        if any(p in msg_lower for p in patterns):
            return {
                "threat_type": "credential_dump",
                "severity": "critical",
                "description": "Credential dumping activity detected",
                "mitre_technique": "T1003",
                "mitre_tactic": "Credential Access",
                "recommended_actions": ["isolate_host", "lock_user"],
            }
        return None

    def _check_lateral_movement(self, msg_lower: str, msg: str, source_ip: str) -> dict | None:
        patterns = [
            "psexec", "wmiexec", "winrm", "smbclient",
            "net use", "mount.*cifs", "evil-winrm",
            "ssh.*accepted.*from",
        ]
        if any(p in msg_lower for p in patterns):
            return {
                "threat_type": "lateral_movement",
                "severity": "high",
                "description": f"Lateral movement indicators from {source_ip}",
                "source_ip": source_ip,
                "mitre_technique": "T1021",
                "mitre_tactic": "Lateral Movement",
                "recommended_actions": ["block_ip", "isolate_host"],
            }
        return None

    def _check_c2_indicators(self, msg_lower: str, msg: str) -> dict | None:
        patterns = [
            "reverse shell", "bind shell", "c2 beacon", "callback",
            "meterpreter", "cobalt strike", "empire framework",
            "powershell.*encodedcommand", "bash.*-i.*>.*&.*0>&1",
            r"/dev/tcp/\d+\.\d+\.\d+\.\d+",
        ]
        for p in patterns:
            if re.search(p, msg_lower):
                return {
                    "threat_type": "c2_communication",
                    "severity": "critical",
                    "description": "Command & Control communication detected",
                    "mitre_technique": "T1071",
                    "mitre_tactic": "Command and Control",
                    "recommended_actions": ["isolate_host", "block_ip", "kill_process"],
                }
        return None
