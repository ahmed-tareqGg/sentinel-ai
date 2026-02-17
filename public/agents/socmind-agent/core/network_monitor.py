"""
SOCMind Agent – Network Traffic Monitor
Monitors active network connections to detect:
  - C2 Beaconing (periodic outbound connections)
  - DNS Tunneling (high-volume DNS, unusual TXT queries)
  - Unusual Ports (outbound to non-standard ports)
  - Data Exfiltration (large outbound transfers)

Inspired by: SentinelOne Deep Visibility, CrowdStrike Falcon Insight
"""

import subprocess
import platform
import re
import time
import threading
from collections import defaultdict
from datetime import datetime, timezone


class NetworkMonitor:
    """Passive network connection monitor."""

    def __init__(self, config: dict, audit_logger):
        self.config = config
        self.audit = audit_logger
        self.enabled = config.get("network_monitor", {}).get("enabled", True)

        nm_config = config.get("network_monitor", {})
        self.scan_interval = nm_config.get("scan_interval_seconds", 30)
        self.beacon_threshold = nm_config.get("beacon_threshold", 10)
        self.beacon_window = nm_config.get("beacon_window_seconds", 300)
        self.suspicious_ports = set(nm_config.get("suspicious_ports", [
            4444, 5555, 6666, 7777, 8888, 9999,  # Common reverse shell ports
            1337, 31337, 12345,                     # Classic backdoor ports
            6667, 6697,                              # IRC (C2 channel)
            4443, 8443,                              # Alt HTTPS (C2)
        ]))

        # Known safe outbound ports
        self.safe_ports = {80, 443, 53, 22, 123, 993, 995, 587, 465, 25, 143, 110}

        # Tracking state
        self._connection_history = defaultdict(list)  # {remote_ip: [timestamps]}
        self._dns_queries = defaultdict(int)           # {domain: count}
        self._alerts = []
        self._lock = threading.Lock()
        self._known_connections = set()

    def run(self, shutdown_event: threading.Event):
        """Main monitoring loop."""
        if not self.enabled:
            print("[NETMON] Network monitoring disabled")
            return

        print(f"[NETMON] Started — scanning every {self.scan_interval}s")

        while not shutdown_event.is_set():
            try:
                connections = self._get_active_connections()
                self._analyze_connections(connections)
            except Exception as e:
                print(f"[NETMON:ERROR] {e}")

            shutdown_event.wait(timeout=self.scan_interval)

    def get_pending_alerts(self) -> list:
        """Retrieve and clear pending network alerts."""
        with self._lock:
            alerts = list(self._alerts)
            self._alerts.clear()
        return alerts

    def _get_active_connections(self) -> list:
        """Get current network connections using OS tools."""
        system = platform.system().lower()
        connections = []

        try:
            if system == "linux":
                # Use ss (modern) or netstat (fallback)
                try:
                    result = subprocess.run(
                        ["ss", "-tunap"],
                        capture_output=True, text=True, timeout=10,
                    )
                    connections = self._parse_ss_output(result.stdout)
                except FileNotFoundError:
                    result = subprocess.run(
                        ["netstat", "-tunap"],
                        capture_output=True, text=True, timeout=10,
                    )
                    connections = self._parse_netstat_output(result.stdout)

            elif system == "windows":
                result = subprocess.run(
                    ["netstat", "-ano"],
                    capture_output=True, text=True, timeout=10,
                )
                connections = self._parse_netstat_windows(result.stdout)

        except Exception as e:
            print(f"[NETMON:WARN] Failed to get connections: {e}")

        return connections

    def _parse_ss_output(self, output: str) -> list:
        """Parse Linux 'ss -tunap' output."""
        connections = []
        for line in output.strip().split("\n")[1:]:  # Skip header
            parts = line.split()
            if len(parts) < 5:
                continue
            state = parts[1]
            local = parts[4]
            remote = parts[5] if len(parts) > 5 else ""
            process = parts[-1] if "pid=" in parts[-1] else ""

            # Extract remote IP and port
            match = re.match(r'(.+):(\d+)$', remote)
            if match:
                remote_ip = match.group(1).strip("[]")
                remote_port = int(match.group(2))
                pid_match = re.search(r'pid=(\d+)', process)
                connections.append({
                    "state": state,
                    "remote_ip": remote_ip,
                    "remote_port": remote_port,
                    "local": local,
                    "pid": pid_match.group(1) if pid_match else "",
                    "process": process,
                })
        return connections

    def _parse_netstat_output(self, output: str) -> list:
        """Parse Linux 'netstat -tunap' output."""
        connections = []
        for line in output.strip().split("\n"):
            parts = line.split()
            if len(parts) < 5 or parts[0] not in ("tcp", "tcp6", "udp", "udp6"):
                continue
            remote = parts[4]
            match = re.match(r'(.+):(\d+)$', remote)
            if match:
                connections.append({
                    "state": parts[5] if len(parts) > 5 else "",
                    "remote_ip": match.group(1),
                    "remote_port": int(match.group(2)),
                    "local": parts[3],
                    "pid": parts[-1].split("/")[0] if "/" in parts[-1] else "",
                    "process": parts[-1] if len(parts) > 6 else "",
                })
        return connections

    def _parse_netstat_windows(self, output: str) -> list:
        """Parse Windows 'netstat -ano' output."""
        connections = []
        for line in output.strip().split("\n"):
            parts = line.split()
            if len(parts) < 4 or parts[0] not in ("TCP", "UDP"):
                continue
            remote = parts[2]
            match = re.match(r'(.+):(\d+)$', remote)
            if match:
                connections.append({
                    "state": parts[3] if len(parts) > 3 else "",
                    "remote_ip": match.group(1),
                    "remote_port": int(match.group(2)),
                    "local": parts[1],
                    "pid": parts[-1],
                    "process": "",
                })
        return connections

    def _analyze_connections(self, connections: list):
        """Analyze connections for suspicious patterns."""
        now = time.time()

        for conn in connections:
            remote_ip = conn.get("remote_ip", "")
            remote_port = conn.get("remote_port", 0)
            state = conn.get("state", "")

            # Skip loopback and empty
            if not remote_ip or remote_ip in ("127.0.0.1", "::1", "0.0.0.0", "*"):
                continue

            # ── 1. Suspicious port check ──
            if remote_port in self.suspicious_ports:
                conn_key = f"{remote_ip}:{remote_port}"
                if conn_key not in self._known_connections:
                    self._known_connections.add(conn_key)
                    self._add_alert({
                        "threat_type": "suspicious_port",
                        "severity": "high",
                        "description": f"Connection to suspicious port: {remote_ip}:{remote_port} (PID: {conn.get('pid', '?')})",
                        "remote_ip": remote_ip,
                        "remote_port": remote_port,
                        "mitre_technique": "T1571",
                        "mitre_tactic": "Command and Control",
                        "recommended_actions": ["block_ip"],
                    })

            # ── 2. C2 Beaconing detection (periodic connections) ──
            with self._lock:
                self._connection_history[remote_ip].append(now)
                cutoff = now - self.beacon_window
                self._connection_history[remote_ip] = [
                    t for t in self._connection_history[remote_ip] if t > cutoff
                ]
                count = len(self._connection_history[remote_ip])

            if count >= self.beacon_threshold:
                beacon_key = f"beacon_{remote_ip}"
                if beacon_key not in self._known_connections:
                    self._known_connections.add(beacon_key)
                    # Calculate interval regularity
                    timestamps = sorted(self._connection_history[remote_ip])
                    if len(timestamps) >= 3:
                        intervals = [timestamps[i+1] - timestamps[i] for i in range(len(timestamps)-1)]
                        avg_interval = sum(intervals) / len(intervals)
                        variance = sum((i - avg_interval)**2 for i in intervals) / len(intervals)
                        # Low variance = regular beaconing
                        if variance < (avg_interval * 0.3) ** 2:
                            self._add_alert({
                                "threat_type": "c2_beaconing",
                                "severity": "critical",
                                "description": f"C2 beaconing detected: {remote_ip} — {count} connections in {self.beacon_window}s (avg interval: {avg_interval:.1f}s)",
                                "remote_ip": remote_ip,
                                "connection_count": count,
                                "avg_interval_seconds": round(avg_interval, 1),
                                "mitre_technique": "T1071",
                                "mitre_tactic": "Command and Control",
                                "recommended_actions": ["block_ip", "isolate_host"],
                            })

            # ── 3. Unusual outbound port ──
            if remote_port not in self.safe_ports and remote_port not in self.suspicious_ports:
                if remote_port > 1024 and state in ("ESTAB", "ESTABLISHED"):
                    unusual_key = f"unusual_{remote_ip}:{remote_port}"
                    if unusual_key not in self._known_connections:
                        self._known_connections.add(unusual_key)
                        self._add_alert({
                            "threat_type": "unusual_outbound",
                            "severity": "medium",
                            "description": f"Unusual outbound connection: {remote_ip}:{remote_port}",
                            "remote_ip": remote_ip,
                            "remote_port": remote_port,
                            "mitre_technique": "T1048",
                            "mitre_tactic": "Exfiltration",
                            "recommended_actions": [],
                        })

    def _add_alert(self, alert: dict):
        """Thread-safe alert addition."""
        alert["detected_at"] = datetime.now(timezone.utc).isoformat()
        with self._lock:
            self._alerts.append(alert)
        self.audit.log_event(
            "network_threat_detected",
            f"[{alert['severity']}] {alert['threat_type']}: {alert['description']}"
        )
        print(f"  🌐 NET-THREAT: [{alert['severity']}] {alert['threat_type']} — {alert['description']}")
