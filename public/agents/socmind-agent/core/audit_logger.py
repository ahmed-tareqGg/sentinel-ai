"""
SOCMind Agent – Audit Logger
Logs every action locally and sends to the SOCMind platform.
"""

import os
import json
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    requests = None


class AuditLogger:
    def __init__(self, config: dict):
        self.config = config
        self.api_endpoint = config.get("api", {}).get("endpoint", "")
        self.api_key = config.get("api", {}).get("key", "")
        self.local_log_path = config.get("audit", {}).get("local_log_path", "./audit.log")
        self.send_to_platform = config.get("audit", {}).get("send_to_platform", True)

    def log_action(self, action: dict, result: dict):
        """Log an executed action with its result."""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "actor": "agent",
            "action_type": action.get("action_type", action.get("type", "unknown")),
            "action_id": action.get("action_id", action.get("id", "")),
            "incident_id": action.get("incident_id", ""),
            "target": action.get("target", ""),
            "success": result.get("success", False),
            "details": result.get("details", ""),
            "execution_mode": "dry_run" if result.get("dry_run") else "real",
        }

        self._write_local(entry)

        if self.send_to_platform:
            self._send_remote(entry)

    def log_event(self, event_type: str, details: str):
        """Log a general agent event."""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "actor": "agent",
            "event_type": event_type,
            "details": details,
        }
        self._write_local(entry)

    def log_error(self, component: str, error: str):
        """Log an error from any component."""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "actor": "agent",
            "event_type": "error",
            "component": component,
            "error": error,
        }
        self._write_local(entry)

    def _write_local(self, entry: dict):
        """Append entry to local audit log file."""
        try:
            with open(self.local_log_path, "a") as f:
                f.write(json.dumps(entry) + "\n")
        except Exception as e:
            print(f"[AUDIT:WARN] Failed to write local log: {e}")

    def _send_remote(self, entry: dict):
        """Send audit entry to SOCMind platform."""
        if not requests:
            return

        try:
            requests.post(
                f"{self.api_endpoint}/audit",
                json=entry,
                headers={
                    "Content-Type": "application/json",
                    "X-Agent-Key": self.api_key,
                },
                timeout=10,
            )
        except Exception:
            pass  # Non-critical — local log is the fallback
