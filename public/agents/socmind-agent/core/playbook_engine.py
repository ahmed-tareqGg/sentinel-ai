"""
SOCMind Agent – Playbook Engine
Loads YAML playbooks and triggers actions based on local event patterns.
"""

import os
import threading

try:
    import yaml
except ImportError:
    yaml = None


class PlaybookEngine:
    def __init__(self, config: dict, executor, audit_logger):
        self.config = config
        self.executor = executor
        self.audit = audit_logger
        self.enabled = config.get("playbooks", {}).get("enabled", True)
        self.playbook_dir = config.get("playbooks", {}).get("directory", "./playbooks")
        self.playbooks = []
        self._event_counters = {}  # For threshold tracking

        if self.enabled:
            self._load_playbooks()

    def _load_playbooks(self):
        """Load all YAML playbooks from the playbooks directory."""
        if not yaml:
            print("[PLAYBOOK:WARN] PyYAML not installed, playbooks disabled")
            return

        if not os.path.isdir(self.playbook_dir):
            print(f"[PLAYBOOK:WARN] Directory not found: {self.playbook_dir}")
            return

        for fname in os.listdir(self.playbook_dir):
            if fname.endswith((".yaml", ".yml")):
                try:
                    path = os.path.join(self.playbook_dir, fname)
                    with open(path) as f:
                        pb = yaml.safe_load(f)
                    if pb and isinstance(pb, dict):
                        pb["_file"] = fname
                        self.playbooks.append(pb)
                        print(f"[PLAYBOOK] Loaded: {pb.get('name', fname)}")
                except Exception as e:
                    print(f"[PLAYBOOK:WARN] Failed to load {fname}: {e}")

        print(f"[PLAYBOOK] {len(self.playbooks)} playbook(s) loaded")

    def run(self, shutdown_event: threading.Event):
        """Main playbook engine loop — monitors for trigger conditions."""
        if not self.enabled or not self.playbooks:
            print("[PLAYBOOK] Engine disabled or no playbooks loaded")
            return

        print("[PLAYBOOK] Engine started — monitoring triggers")

        while not shutdown_event.is_set():
            # The playbook engine checks trigger conditions periodically
            # In production, this would integrate with the collector's event stream
            shutdown_event.wait(timeout=30)

    def evaluate_event(self, event: dict):
        """
        Evaluate an incoming event against all loaded playbooks.
        Called by the collector when a log matches a pattern.
        """
        for pb in self.playbooks:
            trigger = pb.get("trigger", {})
            if self._matches_trigger(event, trigger):
                print(f"[PLAYBOOK] Triggered: {pb.get('name', 'unknown')}")
                self._execute_playbook(pb, event)

    def _matches_trigger(self, event: dict, trigger: dict) -> bool:
        """Check if an event matches a playbook trigger."""
        # Check event type
        trigger_event = trigger.get("event", "")
        if trigger_event and event.get("event_type") != trigger_event:
            return False

        # Check conditions
        conditions = trigger.get("conditions", {})
        for key, value in conditions.items():
            if event.get(key) != value:
                return False

        # Check threshold (simple counter-based)
        threshold = trigger.get("threshold")
        window = trigger.get("window")
        if threshold:
            counter_key = f"{trigger_event}:{event.get('target', '')}"
            count = self._event_counters.get(counter_key, 0) + 1
            self._event_counters[counter_key] = count

            if count < threshold:
                return False
            else:
                # Reset counter after triggering
                self._event_counters[counter_key] = 0

        return True

    def _execute_playbook(self, playbook: dict, trigger_event: dict):
        """Execute all actions defined in a playbook."""
        pb_name = playbook.get("name", "unknown")
        actions = playbook.get("actions", [])

        self.audit.log_event("playbook_triggered", f"Playbook '{pb_name}' triggered")

        for action_def in actions:
            action_type = action_def.get("type", "")
            requires_approval = action_def.get("approval", False)

            action = {
                "action_type": action_type,
                "target": trigger_event.get("target", trigger_event.get("src_ip", "")),
                "incident_id": trigger_event.get("incident_id", ""),
                "requires_approval": requires_approval,
                "duration_seconds": action_def.get("duration", 0),
                "reason": f"Playbook: {pb_name}",
                "message": action_def.get("message", ""),
            }

            if requires_approval:
                print(f"[PLAYBOOK] Action '{action_type}' requires approval — skipping auto-execute")
                self.audit.log_event(
                    "playbook_action_deferred",
                    f"Action '{action_type}' deferred — requires approval"
                )
                continue

            result = self.executor.execute_action(action)
            status = "OK" if result.get("success") else "FAIL"
            print(f"[PLAYBOOK] {pb_name} -> {action_type}: {status}")
