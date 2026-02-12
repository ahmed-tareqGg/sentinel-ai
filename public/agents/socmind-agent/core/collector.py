"""
SOCMind Agent – Log Collector
Reads system/auth/security logs and sends them to the SOCMind platform.
"""

import os
import re
import json
import time
import threading
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    requests = None


class LogCollector:
    def __init__(self, config: dict, audit_logger, playbook_engine=None):
        self.config = config
        self.audit = audit_logger
        self.playbook_engine = playbook_engine
        self.api_endpoint = config.get("api", {}).get("endpoint", "")
        self.api_key = config.get("api", {}).get("key", "")
        self.interval = config.get("collector", {}).get("interval_seconds", 60)
        self.max_lines = config.get("collector", {}).get("max_lines_per_source", 50)
        self.sources = config.get("collector", {}).get("sources", [])
        self._file_positions = {}

    def run(self, shutdown_event: threading.Event):
        """Main collector loop."""
        print("[COLLECTOR] Started — monitoring log sources")
        while not shutdown_event.is_set():
            try:
                logs = self._collect_all()
                if logs:
                    self._send_logs(logs)
                    print(f"[COLLECTOR] Sent {len(logs)} log entries")

                    # Feed events to the local playbook engine for pattern matching
                    if self.playbook_engine:
                        for log_entry in logs:
                            event = self._classify_event(log_entry)
                            if event:
                                self.playbook_engine.evaluate_event(event)
                else:
                    print("[COLLECTOR] No new logs")
            except Exception as e:
                print(f"[COLLECTOR:ERROR] {e}")
                self.audit.log_error("collector", str(e))

            shutdown_event.wait(timeout=self.interval)

    def _collect_all(self) -> list:
        """Collect logs from all configured sources."""
        all_logs = []
        for source_path in self.sources:
            if not os.path.exists(source_path):
                continue
            try:
                logs = self._read_log_file(source_path)
                all_logs.extend(logs)
            except PermissionError:
                print(f"[COLLECTOR:WARN] Permission denied: {source_path}")
            except Exception as e:
                print(f"[COLLECTOR:WARN] Error reading {source_path}: {e}")
        return all_logs

    def _read_log_file(self, path: str) -> list:
        """Read new lines from a log file using file position tracking."""
        logs = []
        last_pos = self._file_positions.get(path, 0)

        with open(path, "r", errors="replace") as f:
            # Check if file was rotated (smaller than last position)
            f.seek(0, 2)
            file_size = f.tell()
            if file_size < last_pos:
                last_pos = 0

            f.seek(last_pos)
            lines = f.readlines()
            self._file_positions[path] = f.tell()

        # Only process last N lines if reading from start
        if last_pos == 0:
            lines = lines[-self.max_lines:]

        now = datetime.now(timezone.utc).isoformat()
        for line in lines:
            line = line.strip()
            if not line:
                continue

            severity = self._detect_severity(line)
            log_type = self._detect_log_type(path)

            logs.append({
                "log_type": log_type,
                "timestamp": now,
                "message": line[:500],
                "severity": severity,
                "source_ip": os.uname().nodename if hasattr(os, "uname") else "unknown",
                "raw_log": {"file": path},
            })

        return logs

    def _detect_severity(self, line: str) -> int:
        """Detect log severity from content."""
        lower = line.lower()
        if any(w in lower for w in ["critical", "emergency", "panic"]):
            return 5
        if any(w in lower for w in ["failed", "denied", "error", "attack", "blocked"]):
            return 4
        if any(w in lower for w in ["warning", "warn", "suspicious"]):
            return 3
        return 2

    def _detect_log_type(self, path: str) -> str:
        """Detect log type from file path."""
        name = os.path.basename(path).lower()
        if "auth" in name or "secure" in name:
            return "auth"
        if "syslog" in name or "messages" in name:
            return "system"
        if "kern" in name:
            return "kernel"
        return "system"

    def _classify_event(self, log_entry: dict) -> dict | None:
        """
        Classify a collected log into an event that the PlaybookEngine can evaluate.
        Returns an event dict with 'event_type' or None if not classifiable.
        """
        msg = log_entry.get("message", "").lower()
        severity = log_entry.get("severity", 0)
        event = dict(log_entry)  # copy original fields

        # --- Failed login / brute force patterns ---
        if any(kw in msg for kw in [
            "failed password", "authentication failure", "failed login",
            "invalid user", "logon failure", "account locked",
            "event id: 4625",  # Windows failed logon
        ]):
            event["event_type"] = "failed_login"
            # Try to extract target user
            for pattern in [
                r"for (?:invalid user )?(\S+)",
                r"user[= ]+(\S+)",
                r"account[= ]+(\S+)",
            ]:
                m = re.search(pattern, log_entry.get("message", ""))
                if m:
                    event["target"] = m.group(1)
                    break
            return event

        # --- Suspicious process / malware patterns ---
        if any(kw in msg for kw in [
            "malware", "trojan", "ransomware", "c2 beacon",
            "reverse shell", "mimikatz", "payload",
        ]):
            event["event_type"] = "malware_detected"
            return event

        # --- Privilege escalation ---
        if any(kw in msg for kw in [
            "privilege escalation", "sudo", "su:", "runas",
            "event id: 4672",  # Windows special privileges
        ]):
            event["event_type"] = "privilege_escalation"
            return event

        # --- Suspicious login (unusual location, new device, etc.) ---
        if severity >= 4 and any(kw in msg for kw in [
            "unusual", "new device", "impossible travel", "suspicious login",
        ]):
            event["event_type"] = "suspicious_login"
            return event

        return None

    def _send_logs(self, logs: list):
        """Send collected logs to SOCMind platform."""
        if not requests:
            print("[COLLECTOR:WARN] 'requests' library not installed, skipping send")
            return

        try:
            resp = requests.post(
                f"{self.api_endpoint}/ingest",
                json={"logs": logs},
                headers={
                    "Content-Type": "application/json",
                    "X-Agent-Key": self.api_key,
                },
                timeout=60,
            )
            if resp.status_code == 200:
                data = resp.json()
                received = data.get("logs_received", 0)
                incidents = data.get("incidents_created", 0)
                print(f"[COLLECTOR:OK] {received} processed, {incidents} incidents created")
            else:
                print(f"[COLLECTOR:WARN] Server returned {resp.status_code}")
        except Exception as e:
            print(f"[COLLECTOR:ERROR] Failed to send logs: {e}")
