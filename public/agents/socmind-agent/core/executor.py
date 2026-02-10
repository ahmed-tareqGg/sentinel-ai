"""
SOCMind Agent – Action Executor
Polls the platform for pending SOAR actions and executes them locally.
"""

import os
import sys
import json
import time
import importlib
import threading
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    requests = None

AGENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class ActionExecutor:
    def __init__(self, config: dict, audit_logger, approval_client):
        self.config = config
        self.audit = audit_logger
        self.approval = approval_client
        self.api_endpoint = config.get("api", {}).get("endpoint", "")
        self.api_key = config.get("api", {}).get("key", "")
        self.poll_interval = config.get("executor", {}).get("poll_interval_seconds", 10)
        self.dry_run = config.get("executor", {}).get("dry_run", False)
        self.allowed_actions = config.get("executor", {}).get("allowed_actions", [])
        self._action_handlers = {}
        self._load_action_handlers()

    def _load_action_handlers(self):
        """Dynamically load action handlers from actions/ directory."""
        actions_dir = os.path.join(AGENT_DIR, "actions")
        if not os.path.isdir(actions_dir):
            print("[EXECUTOR:WARN] actions/ directory not found")
            return

        sys.path.insert(0, AGENT_DIR)
        for fname in os.listdir(actions_dir):
            if fname.endswith(".py") and not fname.startswith("_"):
                module_name = fname[:-3]
                try:
                    mod = importlib.import_module(f"actions.{module_name}")
                    if hasattr(mod, "ACTION_TYPE") and hasattr(mod, "execute"):
                        self._action_handlers[mod.ACTION_TYPE] = mod.execute
                        print(f"[EXECUTOR] Loaded action handler: {mod.ACTION_TYPE}")
                except Exception as e:
                    print(f"[EXECUTOR:WARN] Failed to load {fname}: {e}")

    def run(self, shutdown_event: threading.Event):
        """Main executor loop — polls for actions and executes them."""
        print(f"[EXECUTOR] Started — polling every {self.poll_interval}s")
        print(f"[EXECUTOR] Dry Run: {self.dry_run}")
        print(f"[EXECUTOR] Loaded {len(self._action_handlers)} action handlers")

        while not shutdown_event.is_set():
            try:
                actions = self._poll_actions()
                for action in actions:
                    self._process_action(action)
            except Exception as e:
                print(f"[EXECUTOR:ERROR] {e}")
                self.audit.log_error("executor", str(e))

            shutdown_event.wait(timeout=self.poll_interval)

    def _poll_actions(self) -> list:
        """Poll the SOCMind platform for pending actions."""
        if not requests:
            return []

        try:
            resp = requests.post(
                f"{self.api_endpoint}/poll-actions",
                json={},
                headers={
                    "Content-Type": "application/json",
                    "X-Agent-Key": self.api_key,
                },
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("actions", [])
        except Exception as e:
            print(f"[EXECUTOR:WARN] Poll failed: {e}")
        return []

    def _process_action(self, action: dict):
        """Process a single action with approval checks."""
        action_type = action.get("action_type", "")
        action_id = action.get("action_id", action.get("id", ""))
        target = action.get("target", "")
        execution_mode = action.get("execution_mode", "real")
        requires_approval = action.get("requires_approval", False)

        print(f"\n{'='*50}")
        print(f"  SOAR ACTION: {action_type}")
        print(f"  Target: {target}")
        print(f"  Action ID: {action_id}")

        # Check if action type is allowed
        if action_type not in self.allowed_actions:
            print(f"  [BLOCKED] Action type '{action_type}' is not in allowed_actions")
            self._report_result(action, False, f"Action type not allowed: {action_type}")
            return

        # Check approval if required
        if requires_approval:
            print(f"  [APPROVAL] Waiting for approval...")
            try:
                self.approval.wait_for_approval(action_id)
                print(f"  [APPROVAL] Approved ✓")
            except Exception as e:
                print(f"  [APPROVAL] {e}")
                self._report_result(action, False, str(e))
                return

        # Determine execution mode
        is_dry = self.dry_run or execution_mode in ("dry_run", "simulation")
        mode_label = "SIMULATION" if is_dry else "REAL"
        print(f"  Mode: {mode_label}")
        print(f"{'='*50}")

        # Execute the action
        handler = self._action_handlers.get(action_type)
        if handler:
            try:
                result = handler(action, dry_run=is_dry)
                success = result.get("success", True)
                details = result.get("details", "Completed")
                rollback = result.get("rollback_available", False)

                if success:
                    print(f"  [OK] {details}")
                else:
                    print(f"  [FAIL] {details}")

                self.audit.log_action(action, result)
                self._report_result(action, success, details, rollback)

            except Exception as e:
                print(f"  [ERROR] {e}")
                self.audit.log_action(action, {"success": False, "details": str(e)})
                self._report_result(action, False, str(e))
        else:
            msg = f"No handler found for action type: {action_type}"
            print(f"  [ERROR] {msg}")
            self._report_result(action, False, msg)

    def execute_action(self, action: dict, dry_run: bool = None) -> dict:
        """Execute a single action directly (used by PlaybookEngine)."""
        action_type = action.get("action_type", action.get("type", ""))
        is_dry = dry_run if dry_run is not None else self.dry_run

        handler = self._action_handlers.get(action_type)
        if handler:
            result = handler(action, dry_run=is_dry)
            self.audit.log_action(action, result)
            return result
        else:
            return {"success": False, "details": f"Unknown action: {action_type}"}

    def _report_result(self, action: dict, success: bool, details: str, rollback: bool = False):
        """Report action result back to the platform."""
        if not requests:
            return

        db_id = action.get("id", action.get("action_id", ""))
        status = "success" if success else "failed"

        try:
            requests.post(
                f"{self.api_endpoint}/report-action",
                json={
                    "action_id": db_id,
                    "status": status,
                    "result": {"details": details},
                    "error_message": None if success else details,
                    "rollback_available": rollback,
                },
                headers={
                    "Content-Type": "application/json",
                    "X-Agent-Key": self.api_key,
                },
                timeout=15,
            )
        except Exception as e:
            print(f"[EXECUTOR:WARN] Failed to report result: {e}")
