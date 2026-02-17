"""
SOCMind Agent – Auto-Recovery & Offline Mode
Handles:
  - Offline event queuing when platform is unreachable
  - Auto-rollback of failed actions
  - State persistence and recovery after crashes
  - Connection health monitoring

Inspired by: CrowdStrike offline detection, Wazuh agent recovery
"""

import os
import json
import time
import threading
from datetime import datetime, timezone
from collections import deque


class RecoveryManager:
    """Manages offline operation, event queuing, and auto-rollback."""

    def __init__(self, config: dict, audit_logger):
        self.config = config
        self.audit = audit_logger

        recovery_config = config.get("recovery", {})
        self.enabled = recovery_config.get("enabled", True)
        self.max_queue_size = recovery_config.get("max_queue_size", 10000)
        self.retry_interval = recovery_config.get("retry_interval_seconds", 60)
        self.max_retries = recovery_config.get("max_retries", 5)
        self.auto_rollback = recovery_config.get("auto_rollback", True)

        agent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.queue_file = os.path.join(agent_dir, ".offline_queue.json")
        self.state_file = os.path.join(agent_dir, ".agent_state.json")
        self.rollback_file = os.path.join(agent_dir, ".rollback_stack.json")

        self._event_queue = deque(maxlen=self.max_queue_size)
        self._rollback_stack = []  # Actions that can be rolled back
        self._is_online = True
        self._consecutive_failures = 0
        self._lock = threading.Lock()

        # Load persisted state
        self._load_queue()
        self._load_rollback_stack()

    # ── Online/Offline State ──

    @property
    def is_online(self) -> bool:
        return self._is_online

    def report_connection_success(self):
        """Called when a platform request succeeds."""
        was_offline = not self._is_online
        self._is_online = True
        self._consecutive_failures = 0

        if was_offline:
            queued = len(self._event_queue)
            print(f"[RECOVERY] 🟢 Back ONLINE — {queued} queued events to flush")
            self.audit.log_event("agent_online", f"Connection restored. {queued} events queued.")

    def report_connection_failure(self):
        """Called when a platform request fails."""
        self._consecutive_failures += 1
        if self._consecutive_failures >= 3 and self._is_online:
            self._is_online = False
            print("[RECOVERY] 🔴 OFFLINE — switching to local queue mode")
            self.audit.log_event("agent_offline", "Platform unreachable. Queueing events locally.")

    # ── Event Queue (Offline Mode) ──

    def queue_event(self, event: dict):
        """Queue an event for later submission when back online."""
        event["queued_at"] = datetime.now(timezone.utc).isoformat()
        with self._lock:
            self._event_queue.append(event)
        self._persist_queue()

    def get_queued_events(self, batch_size: int = 50) -> list:
        """Get a batch of queued events for submission."""
        with self._lock:
            batch = []
            for _ in range(min(batch_size, len(self._event_queue))):
                batch.append(self._event_queue.popleft())
        if batch:
            self._persist_queue()
        return batch

    def requeue_events(self, events: list):
        """Put events back in the queue if submission fails."""
        with self._lock:
            for event in reversed(events):
                self._event_queue.appendleft(event)
        self._persist_queue()

    @property
    def queue_size(self) -> int:
        return len(self._event_queue)

    # ── Rollback Management ──

    def register_action(self, action: dict, result: dict):
        """Register an executed action for potential rollback."""
        if not result.get("rollback_available", False):
            return

        rollback_entry = {
            "action_type": action.get("action_type", ""),
            "target": action.get("target", ""),
            "action_params": action.get("action_params", {}),
            "executed_at": datetime.now(timezone.utc).isoformat(),
            "result": result,
        }

        # Map action to its rollback counterpart
        rollback_map = {
            "block_ip": "unblock_ip",
            "isolate_host": "unisolate_host",
            "kill_process": None,  # No rollback for killed processes
            "lock_user": "unlock_user",
            "delete_file": None,   # No rollback for deleted files
        }

        rollback_action = rollback_map.get(rollback_entry["action_type"])
        if rollback_action:
            rollback_entry["rollback_action"] = rollback_action
            with self._lock:
                self._rollback_stack.append(rollback_entry)
            self._persist_rollback_stack()
            print(f"[RECOVERY] Registered rollback: {rollback_entry['action_type']} → {rollback_action}")

    def rollback_last_action(self, executor) -> dict:
        """Rollback the most recent reversible action."""
        with self._lock:
            if not self._rollback_stack:
                return {"success": False, "details": "No actions to rollback"}
            entry = self._rollback_stack.pop()

        rollback_action = {
            "action_type": entry.get("rollback_action", ""),
            "target": entry.get("target", ""),
        }

        print(f"[RECOVERY] Rolling back: {entry['action_type']} → {rollback_action['action_type']} on {rollback_action['target']}")
        result = executor.execute_action(rollback_action)
        self._persist_rollback_stack()

        if result.get("success"):
            self.audit.log_event("rollback_success", f"Rolled back {entry['action_type']} on {entry['target']}")
        else:
            self.audit.log_event("rollback_failed", f"Failed to rollback {entry['action_type']}: {result.get('details', '')}")

        return result

    def auto_rollback_failed(self, action: dict, error: str, executor) -> dict | None:
        """Automatically rollback if an action causes system issues."""
        if not self.auto_rollback:
            return None

        action_type = action.get("action_type", "")
        target = action.get("target", "")

        # Check if this action type supports auto-rollback
        rollback_map = {
            "block_ip": "unblock_ip",
            "isolate_host": "unisolate_host",
        }

        rollback_type = rollback_map.get(action_type)
        if not rollback_type:
            return None

        print(f"[RECOVERY] ⚠️ Auto-rollback triggered for failed {action_type}: {error}")
        self.audit.log_event("auto_rollback", f"Auto-rolling back {action_type} on {target} due to: {error}")

        rollback_action = {"action_type": rollback_type, "target": target}
        return executor.execute_action(rollback_action)

    # ── Agent State Persistence ──

    def save_state(self, state: dict):
        """Save agent state to disk for crash recovery."""
        state["saved_at"] = datetime.now(timezone.utc).isoformat()
        try:
            with open(self.state_file, "w") as f:
                json.dump(state, f, indent=2)
        except Exception as e:
            print(f"[RECOVERY:WARN] Failed to save state: {e}")

    def load_state(self) -> dict:
        """Load agent state from disk."""
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, "r") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    # ── Persistence Helpers ──

    def _persist_queue(self):
        """Save event queue to disk."""
        try:
            with self._lock:
                events = list(self._event_queue)
            with open(self.queue_file, "w") as f:
                json.dump(events[-self.max_queue_size:], f)
        except Exception:
            pass

    def _load_queue(self):
        """Load event queue from disk."""
        if os.path.exists(self.queue_file):
            try:
                with open(self.queue_file, "r") as f:
                    events = json.load(f)
                self._event_queue = deque(events, maxlen=self.max_queue_size)
                if events:
                    print(f"[RECOVERY] Loaded {len(events)} queued events from disk")
            except Exception:
                pass

    def _persist_rollback_stack(self):
        """Save rollback stack to disk."""
        try:
            with self._lock:
                stack = list(self._rollback_stack)
            with open(self.rollback_file, "w") as f:
                json.dump(stack[-50:], f)  # Keep last 50 rollbacks
        except Exception:
            pass

    def _load_rollback_stack(self):
        """Load rollback stack from disk."""
        if os.path.exists(self.rollback_file):
            try:
                with open(self.rollback_file, "r") as f:
                    self._rollback_stack = json.load(f)
                if self._rollback_stack:
                    print(f"[RECOVERY] Loaded {len(self._rollback_stack)} rollback entries")
            except Exception:
                pass
