"""
SOCMind Agent – Heartbeat Service
Sends periodic heartbeat signals to the SOCMind platform.
"""

import os
import socket
import platform
import threading

try:
    import requests
except ImportError:
    requests = None


class HeartbeatService:
    def __init__(self, config: dict, agent_version: str):
        self.config = config
        self.agent_version = agent_version
        self.api_endpoint = config.get("api", {}).get("endpoint", "")
        self.api_key = config.get("api", {}).get("key", "")
        self.interval = config.get("heartbeat", {}).get("interval_seconds", 30)

    def run(self, shutdown_event: threading.Event):
        """Main heartbeat loop."""
        print(f"[HEARTBEAT] Started — every {self.interval}s")
        while not shutdown_event.is_set():
            try:
                self._send()
            except Exception as e:
                print(f"[HEARTBEAT:WARN] {e}")
            shutdown_event.wait(timeout=self.interval)

    def _send(self):
        """Send heartbeat to the platform."""
        if not requests:
            return

        hostname = socket.gethostname()
        try:
            ip = socket.gethostbyname(hostname)
        except Exception:
            ip = "unknown"

        payload = {
            "hostname": hostname,
            "status": "active",
            "ip_address": ip,
            "agent_version": self.agent_version,
            "platform": platform.system().lower(),
            "capabilities": [
                "collector",
                "executor",
                "playbook_runner",
                "ioc_enforcer",
            ],
        }

        try:
            requests.post(
                f"{self.api_endpoint}/heartbeat",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Agent-Key": self.api_key,
                },
                timeout=10,
            )
        except Exception:
            pass  # Heartbeat failures are non-critical
