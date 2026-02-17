"""
SOCMind Agent – File Integrity Monitor (FIM)
Monitors critical system files for unauthorized changes.

Detects:
  - File modifications (hash-based)
  - File deletions
  - New files in sensitive directories
  - Permission changes

Inspired by: OSSEC/Wazuh FIM, Tripwire, AIDE
"""

import os
import hashlib
import json
import time
import platform
import threading
from datetime import datetime, timezone


class FileIntegrityMonitor:
    """Hash-based file integrity monitoring."""

    def __init__(self, config: dict, audit_logger):
        self.config = config
        self.audit = audit_logger
        self.enabled = config.get("fim", {}).get("enabled", True)

        fim_config = config.get("fim", {})
        self.scan_interval = fim_config.get("scan_interval_seconds", 300)  # 5 min default
        self.hash_algorithm = fim_config.get("hash_algorithm", "sha256")

        # State file for baseline hashes
        agent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.baseline_file = os.path.join(agent_dir, ".fim_baseline.json")

        # Default monitored paths per OS
        system = platform.system().lower()
        default_paths = fim_config.get("monitored_paths", None)

        if default_paths is None:
            if system == "linux":
                default_paths = [
                    "/etc/passwd",
                    "/etc/shadow",
                    "/etc/sudoers",
                    "/etc/ssh/sshd_config",
                    "/etc/hosts",
                    "/etc/resolv.conf",
                    "/etc/crontab",
                    "/etc/ld.so.preload",
                    "/root/.bashrc",
                    "/root/.ssh/authorized_keys",
                ]
            elif system == "windows":
                default_paths = [
                    r"C:\Windows\System32\drivers\etc\hosts",
                    r"C:\Windows\System32\config\SAM",
                    r"C:\Windows\System32\config\SYSTEM",
                    r"C:\Windows\System32\config\SECURITY",
                ]
            else:
                default_paths = []

        self.monitored_paths = default_paths

        # Monitored directories (detect new files)
        self.monitored_dirs = fim_config.get("monitored_directories", [])
        if not self.monitored_dirs:
            if system == "linux":
                self.monitored_dirs = [
                    "/etc/cron.d",
                    "/etc/sudoers.d",
                    "/root/.ssh",
                ]
            elif system == "windows":
                self.monitored_dirs = [
                    r"C:\Windows\System32\Tasks",
                ]

        self._baseline = {}
        self._alerts = []
        self._lock = threading.Lock()
        self._first_run = True

    def run(self, shutdown_event: threading.Event):
        """Main FIM loop."""
        if not self.enabled:
            print("[FIM] File Integrity Monitor disabled")
            return

        print(f"[FIM] Started — monitoring {len(self.monitored_paths)} files, {len(self.monitored_dirs)} directories")
        print(f"[FIM] Scan interval: {self.scan_interval}s | Hash: {self.hash_algorithm}")

        # Load or create baseline
        self._load_baseline()

        while not shutdown_event.is_set():
            try:
                self._scan()
            except Exception as e:
                print(f"[FIM:ERROR] {e}")

            shutdown_event.wait(timeout=self.scan_interval)

    def get_pending_alerts(self) -> list:
        """Retrieve and clear pending FIM alerts."""
        with self._lock:
            alerts = list(self._alerts)
            self._alerts.clear()
        return alerts

    def _load_baseline(self):
        """Load baseline hashes from disk."""
        if os.path.exists(self.baseline_file):
            try:
                with open(self.baseline_file, "r") as f:
                    self._baseline = json.load(f)
                print(f"[FIM] Loaded baseline: {len(self._baseline)} entries")
                self._first_run = False
            except Exception:
                self._baseline = {}
        else:
            print("[FIM] No baseline found — first scan will create it")

    def _save_baseline(self):
        """Persist baseline to disk."""
        try:
            with open(self.baseline_file, "w") as f:
                json.dump(self._baseline, f, indent=2)
        except Exception as e:
            print(f"[FIM:WARN] Failed to save baseline: {e}")

    def _compute_hash(self, filepath: str) -> str | None:
        """Compute file hash."""
        try:
            h = hashlib.new(self.hash_algorithm)
            with open(filepath, "rb") as f:
                while True:
                    chunk = f.read(8192)
                    if not chunk:
                        break
                    h.update(chunk)
            return h.hexdigest()
        except PermissionError:
            return "PERMISSION_DENIED"
        except Exception:
            return None

    def _get_file_metadata(self, filepath: str) -> dict:
        """Get file metadata (permissions, owner, size)."""
        try:
            stat = os.stat(filepath)
            return {
                "size": stat.st_size,
                "mtime": stat.st_mtime,
                "mode": oct(stat.st_mode),
                "uid": getattr(stat, "st_uid", None),
                "gid": getattr(stat, "st_gid", None),
            }
        except Exception:
            return {}

    def _scan(self):
        """Perform a full integrity scan."""
        current_state = {}
        changes_detected = 0

        # ── Scan individual files ──
        for filepath in self.monitored_paths:
            if not os.path.exists(filepath):
                # Check if file was deleted
                if filepath in self._baseline and not self._first_run:
                    self._add_alert({
                        "threat_type": "file_deleted",
                        "severity": "critical",
                        "description": f"Monitored file DELETED: {filepath}",
                        "file_path": filepath,
                        "previous_hash": self._baseline[filepath].get("hash", "unknown"),
                        "mitre_technique": "T1070",
                        "mitre_tactic": "Defense Evasion",
                        "recommended_actions": ["isolate_host"],
                    })
                    changes_detected += 1
                continue

            file_hash = self._compute_hash(filepath)
            metadata = self._get_file_metadata(filepath)
            current_state[filepath] = {"hash": file_hash, **metadata}

            if filepath in self._baseline and not self._first_run:
                old = self._baseline[filepath]
                # Hash changed
                if old.get("hash") != file_hash and file_hash != "PERMISSION_DENIED":
                    self._add_alert({
                        "threat_type": "file_modified",
                        "severity": "high",
                        "description": f"File MODIFIED: {filepath}",
                        "file_path": filepath,
                        "old_hash": old.get("hash", "unknown"),
                        "new_hash": file_hash,
                        "mitre_technique": "T1565",
                        "mitre_tactic": "Impact",
                        "recommended_actions": ["isolate_host"],
                    })
                    changes_detected += 1
                # Permissions changed
                elif old.get("mode") != metadata.get("mode"):
                    self._add_alert({
                        "threat_type": "permissions_changed",
                        "severity": "medium",
                        "description": f"File permissions changed: {filepath} ({old.get('mode')} → {metadata.get('mode')})",
                        "file_path": filepath,
                        "old_permissions": old.get("mode"),
                        "new_permissions": metadata.get("mode"),
                        "mitre_technique": "T1222",
                        "mitre_tactic": "Defense Evasion",
                        "recommended_actions": [],
                    })
                    changes_detected += 1

        # ── Scan directories for new files ──
        for dirpath in self.monitored_dirs:
            if not os.path.isdir(dirpath):
                continue
            try:
                for fname in os.listdir(dirpath):
                    full_path = os.path.join(dirpath, fname)
                    if os.path.isfile(full_path) and full_path not in self._baseline and not self._first_run:
                        file_hash = self._compute_hash(full_path)
                        metadata = self._get_file_metadata(full_path)
                        current_state[full_path] = {"hash": file_hash, **metadata}
                        self._add_alert({
                            "threat_type": "new_file_detected",
                            "severity": "medium",
                            "description": f"New file in sensitive directory: {full_path}",
                            "file_path": full_path,
                            "hash": file_hash,
                            "mitre_technique": "T1053",
                            "mitre_tactic": "Persistence",
                            "recommended_actions": [],
                        })
                        changes_detected += 1
                    elif os.path.isfile(full_path):
                        file_hash = self._compute_hash(full_path)
                        metadata = self._get_file_metadata(full_path)
                        current_state[full_path] = {"hash": file_hash, **metadata}
            except PermissionError:
                pass

        # Update baseline
        self._baseline.update(current_state)
        self._save_baseline()

        if self._first_run:
            print(f"[FIM] Baseline created: {len(current_state)} files")
            self._first_run = False
        elif changes_detected > 0:
            print(f"[FIM] Scan complete: {changes_detected} change(s) detected")
        # Silent if no changes

    def _add_alert(self, alert: dict):
        """Thread-safe alert addition."""
        alert["detected_at"] = datetime.now(timezone.utc).isoformat()
        with self._lock:
            self._alerts.append(alert)
        self.audit.log_event(
            "fim_alert",
            f"[{alert['severity']}] {alert['threat_type']}: {alert['description']}"
        )
        print(f"  📁 FIM: [{alert['severity']}] {alert['threat_type']} — {alert['description']}")
