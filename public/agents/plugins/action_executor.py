# SOCMind Agent - Action Executor Module
# Copyright (c) 2025 SOCMind. All rights reserved.
# Universal action executor for all platforms

import os
import sys
import json
import time
import socket
import subprocess
import threading
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict


@dataclass
class ActionResult:
    """Result of an executed action."""
    success: bool
    details: str
    rollback_available: bool = False
    rollback_cmd: Optional[str] = None
    execution_time_ms: int = 0


@dataclass
class SOARAction:
    """Action dispatched from SOCMind platform."""
    id: str
    action_id: str
    action_type: str
    target: Optional[str] = None
    target_type: str = 'ip'
    duration_seconds: Optional[int] = None
    parameters: Dict = field(default_factory=dict)
    reason: Optional[str] = None
    execution_mode: str = 'real'
    incident_id: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict) -> 'SOARAction':
        return cls(
            id=data.get('id', ''),
            action_id=data.get('action_id', ''),
            action_type=data.get('action_type', ''),
            target=data.get('target'),
            target_type=data.get('target_type', 'ip'),
            duration_seconds=data.get('duration_seconds'),
            parameters=data.get('parameters', {}),
            reason=data.get('reason'),
            execution_mode=data.get('execution_mode', 'real'),
            incident_id=data.get('incident_id'),
        )


class ActionExecutor:
    """
    Universal SOAR Action Executor.
    Executes security response actions on Windows and Linux.
    """

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.platform = sys.platform
        self.action_log: List[Dict] = []
        self.log_file = os.path.join(os.path.dirname(__file__), '..', 'action_log.json')

    @property
    def is_windows(self) -> bool:
        return self.platform == 'win32'

    @property
    def is_linux(self) -> bool:
        return self.platform.startswith('linux')

    def execute(self, action: SOARAction) -> ActionResult:
        """Execute a SOAR action."""
        is_sim = self.dry_run or action.execution_mode in ('dry_run', 'simulation')
        start_time = time.time()

        print(f"\n{'='*50}")
        print(f"  SOAR ACTION: {action.action_type}")
        print(f"  Target: {action.target or 'N/A'}")
        print(f"  Mode: {'SIMULATION' if is_sim else 'REAL'}")
        print(f"{'='*50}")

        # Route to appropriate handler
        handler = getattr(self, f'_action_{action.action_type}', None)
        if handler:
            result = handler(action, is_sim)
        else:
            result = ActionResult(success=False, details=f"Unknown action type: {action.action_type}")

        result.execution_time_ms = int((time.time() - start_time) * 1000)

        # Log the action
        self._log_action(action, result)

        status = "✅" if result.success else "❌"
        print(f"{status} {result.details}")

        return result

    def _run_cmd(self, cmd: str, shell: bool = True) -> tuple:
        """Run a system command safely."""
        try:
            result = subprocess.run(
                cmd, shell=shell, capture_output=True, text=True, timeout=30
            )
            return result.returncode == 0, result.stdout.strip() or result.stderr.strip()
        except subprocess.TimeoutExpired:
            return False, "Command timed out"
        except Exception as e:
            return False, str(e)

    # ==================== IP ACTIONS ====================
    def _action_block_ip(self, action: SOARAction, sim: bool) -> ActionResult:
        ip = action.target
        if sim:
            return ActionResult(True, f"DRY-RUN: Would block IP {ip}")

        if self.is_windows:
            rule = f"SOCMind-Block-{ip}-{int(time.time())}"
            ok1, _ = self._run_cmd(f'netsh advfirewall firewall add rule name="{rule}" dir=in action=block remoteip={ip}')
            ok2, _ = self._run_cmd(f'netsh advfirewall firewall add rule name="{rule}-Out" dir=out action=block remoteip={ip}')
            if ok1 and ok2:
                return ActionResult(True, f"Blocked IP {ip} (Rule: {rule})", rollback_available=True)
            return ActionResult(False, f"Failed to create firewall rules for {ip}")
        else:
            ok1, _ = self._run_cmd(f'iptables -A INPUT -s {ip} -j DROP')
            ok2, _ = self._run_cmd(f'iptables -A OUTPUT -d {ip} -j DROP')
            if ok1 and ok2:
                return ActionResult(True, f"Blocked IP {ip} (iptables)", rollback_available=True)
            return ActionResult(False, f"Failed to block {ip} via iptables")

    def _action_unblock_ip(self, action: SOARAction, sim: bool) -> ActionResult:
        ip = action.target
        if sim:
            return ActionResult(True, f"DRY-RUN: Would unblock IP {ip}")

        if self.is_windows:
            self._run_cmd(f'netsh advfirewall firewall delete rule name=all remoteip={ip}')
            return ActionResult(True, f"Unblocked IP {ip}")
        else:
            self._run_cmd(f'iptables -D INPUT -s {ip} -j DROP')
            self._run_cmd(f'iptables -D OUTPUT -d {ip} -j DROP')
            return ActionResult(True, f"Unblocked IP {ip}")

    # ==================== PROCESS ACTIONS ====================
    def _action_kill_process(self, action: SOARAction, sim: bool) -> ActionResult:
        proc = action.target
        if sim:
            return ActionResult(True, f"DRY-RUN: Would kill process {proc}")

        if self.is_windows:
            ok, out = self._run_cmd(f'taskkill /F /IM {proc}')
        else:
            ok, out = self._run_cmd(f'pkill -f {proc}')

        return ActionResult(ok, f"{'Killed' if ok else 'Failed to kill'} process: {proc}")

    # ==================== USER ACTIONS ====================
    def _action_disable_user(self, action: SOARAction, sim: bool) -> ActionResult:
        user = action.target
        if sim:
            return ActionResult(True, f"DRY-RUN: Would disable user {user}")

        if self.is_windows:
            ok, _ = self._run_cmd(f'net user {user} /active:no')
        else:
            ok, _ = self._run_cmd(f'passwd -l {user}')

        result = ActionResult(ok, f"{'Disabled' if ok else 'Failed to disable'} user: {user}", rollback_available=ok)

        # Auto re-enable after duration
        if ok and action.duration_seconds and action.duration_seconds > 0:
            def reenable():
                time.sleep(action.duration_seconds)
                if self.is_windows:
                    self._run_cmd(f'net user {user} /active:yes')
                else:
                    self._run_cmd(f'passwd -u {user}')
                print(f"[AUTO] Re-enabled user {user} after {action.duration_seconds}s")

            threading.Thread(target=reenable, daemon=True).start()
            result.details += f" (auto-enable in {action.duration_seconds}s)"

        return result

    def _action_enable_user(self, action: SOARAction, sim: bool) -> ActionResult:
        user = action.target
        if sim:
            return ActionResult(True, f"DRY-RUN: Would enable user {user}")
        if self.is_windows:
            ok, _ = self._run_cmd(f'net user {user} /active:yes')
        else:
            ok, _ = self._run_cmd(f'passwd -u {user}')
        return ActionResult(ok, f"{'Enabled' if ok else 'Failed to enable'} user: {user}")

    def _action_lock_account(self, action: SOARAction, sim: bool) -> ActionResult:
        return self._action_disable_user(action, sim)

    def _action_unlock_account(self, action: SOARAction, sim: bool) -> ActionResult:
        return self._action_enable_user(action, sim)

    def _action_reset_password(self, action: SOARAction, sim: bool) -> ActionResult:
        user = action.target
        if sim:
            return ActionResult(True, f"DRY-RUN: Would force password reset for {user}")
        if self.is_windows:
            ok, _ = self._run_cmd(f'net user {user} SOCMind_Reset_{int(time.time())}! /logonpasswordchg:yes')
        else:
            ok, _ = self._run_cmd(f'passwd -e {user}')
        return ActionResult(ok, f"Password reset {'forced' if ok else 'failed'} for {user}")

    # ==================== SERVICE ACTIONS ====================
    def _action_stop_service(self, action: SOARAction, sim: bool) -> ActionResult:
        svc = action.target
        if sim:
            return ActionResult(True, f"DRY-RUN: Would stop service {svc}")
        if self.is_windows:
            ok, _ = self._run_cmd(f'net stop "{svc}"')
        else:
            ok, _ = self._run_cmd(f'systemctl stop {svc}')
        return ActionResult(ok, f"Service {svc} {'stopped' if ok else 'failed to stop'}", rollback_available=ok)

    def _action_start_service(self, action: SOARAction, sim: bool) -> ActionResult:
        svc = action.target
        if sim:
            return ActionResult(True, f"DRY-RUN: Would start service {svc}")
        if self.is_windows:
            ok, _ = self._run_cmd(f'net start "{svc}"')
        else:
            ok, _ = self._run_cmd(f'systemctl start {svc}')
        return ActionResult(ok, f"Service {svc} {'started' if ok else 'failed to start'}")

    # ==================== FILE ACTIONS ====================
    def _action_quarantine_file(self, action: SOARAction, sim: bool) -> ActionResult:
        path = action.target
        if sim:
            return ActionResult(True, f"DRY-RUN: Would quarantine file {path}")

        quarantine_dir = 'C:\\SOCMind\\Quarantine' if self.is_windows else '/var/socmind/quarantine'
        os.makedirs(quarantine_dir, exist_ok=True)

        if os.path.exists(path):
            fname = os.path.basename(path)
            dest = os.path.join(quarantine_dir, f"{fname}.quarantined")
            os.rename(path, dest)
            if not self.is_windows:
                os.chmod(dest, 0o000)
            return ActionResult(True, f"File quarantined: {path} -> {dest}", rollback_available=True)
        return ActionResult(False, f"File not found: {path}")

    def _action_delete_file(self, action: SOARAction, sim: bool) -> ActionResult:
        path = action.target
        if sim:
            return ActionResult(True, f"DRY-RUN: Would delete file {path}")
        if os.path.exists(path):
            os.remove(path)
            return ActionResult(True, f"File deleted: {path}")
        return ActionResult(False, f"File not found: {path}")

    # ==================== HOST ISOLATION ====================
    def _action_isolate_host(self, action: SOARAction, sim: bool) -> ActionResult:
        if sim:
            return ActionResult(True, "DRY-RUN: Would isolate host (block all non-essential traffic)")

        if self.is_windows:
            self._run_cmd('netsh advfirewall firewall add rule name="SOCMind-Isolate-BlockAll" dir=out action=block')
            gw = action.parameters.get('gateway_host')
            if gw:
                self._run_cmd(f'netsh advfirewall firewall add rule name="SOCMind-Isolate-AllowGW" dir=out action=allow remoteip={gw}')
        else:
            self._run_cmd('iptables-save > /tmp/socmind_pre_isolate.rules')
            self._run_cmd('iptables -P OUTPUT DROP')
            self._run_cmd('iptables -P INPUT DROP')
            self._run_cmd('iptables -A INPUT -i lo -j ACCEPT')
            self._run_cmd('iptables -A OUTPUT -o lo -j ACCEPT')
            self._run_cmd('iptables -A OUTPUT -p udp --dport 53 -j ACCEPT')
            self._run_cmd('iptables -A INPUT -p udp --sport 53 -j ACCEPT')
            self._run_cmd('iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT')
            self._run_cmd('iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT')

        return ActionResult(True, "Host isolated. Only essential traffic allowed.", rollback_available=True)

    def _action_unisolate_host(self, action: SOARAction, sim: bool) -> ActionResult:
        if sim:
            return ActionResult(True, "DRY-RUN: Would remove host isolation")

        if self.is_windows:
            self._run_cmd('netsh advfirewall firewall delete rule name="SOCMind-Isolate-BlockAll"')
            self._run_cmd('netsh advfirewall firewall delete rule name="SOCMind-Isolate-AllowGW"')
        else:
            if os.path.exists('/tmp/socmind_pre_isolate.rules'):
                self._run_cmd('iptables-restore < /tmp/socmind_pre_isolate.rules')
            else:
                self._run_cmd('iptables -P INPUT ACCEPT')
                self._run_cmd('iptables -P OUTPUT ACCEPT')
                self._run_cmd('iptables -F')

        return ActionResult(True, "Host isolation removed")

    # ==================== DECEPTION ====================
    def _action_show_warning(self, action: SOARAction, sim: bool) -> ActionResult:
        msg = action.parameters.get('message', 'SOCMind Security Alert: Suspicious activity detected.')
        if sim:
            return ActionResult(True, f"DRY-RUN: Would show warning: {msg}")
        if self.is_windows:
            self._run_cmd(f'msg * "{msg}"')
        else:
            self._run_cmd(f'wall "{msg}"')
        return ActionResult(True, f"Warning displayed: {msg}")

    # ==================== LOGGING ====================
    def _log_action(self, action: SOARAction, result: ActionResult):
        entry = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'action_id': action.action_id,
            'action_type': action.action_type,
            'target': action.target,
            'status': 'completed' if result.success else 'failed',
            'details': result.details,
            'execution_time_ms': result.execution_time_ms,
            'hostname': socket.gethostname(),
        }
        self.action_log.append(entry)

        # Persist to file
        try:
            existing = []
            if os.path.exists(self.log_file):
                with open(self.log_file) as f:
                    existing = json.load(f)
            existing.append(entry)
            # Keep last 1000 entries
            with open(self.log_file, 'w') as f:
                json.dump(existing[-1000:], f, indent=2)
        except Exception:
            pass


class ActionPoller:
    """Polls the SOCMind platform for pending actions."""

    def __init__(self, api_endpoint: str, api_key: str, executor: ActionExecutor):
        self.api_endpoint = api_endpoint.rstrip('/')
        self.api_key = api_key
        self.executor = executor
        self.running = False

    def start(self, interval: int = 10):
        """Start polling in a background thread."""
        self.running = True
        thread = threading.Thread(target=self._poll_loop, args=(interval,), daemon=True)
        thread.start()
        print(f"[EXECUTOR] Action poller started (every {interval}s)")

    def stop(self):
        self.running = False

    def _poll_loop(self, interval: int):
        while self.running:
            try:
                actions = self._poll()
                for action_data in actions:
                    action = SOARAction.from_dict(action_data)
                    result = self.executor.execute(action)
                    self._report_result(action, result)
            except Exception as e:
                print(f"[EXECUTOR:ERR] Poll error: {e}")
            time.sleep(interval)

    def _poll(self) -> List[Dict]:
        try:
            import requests
            resp = requests.post(
                f"{self.api_endpoint}/agent-gateway/poll-actions",
                json={},
                headers={
                    'Content-Type': 'application/json',
                    'X-Agent-Key': self.api_key,
                },
                timeout=15,
            )
            data = resp.json()
            return data.get('actions', [])
        except Exception:
            return []

    def _report_result(self, action: SOARAction, result: ActionResult):
        try:
            import requests
            requests.post(
                f"{self.api_endpoint}/agent-gateway/report-action",
                json={
                    'action_id': action.id,
                    'status': 'success' if result.success else 'failed',
                    'result': {
                        'details': result.details,
                        'execution_time_ms': result.execution_time_ms,
                    },
                    'error_message': result.details if not result.success else None,
                    'rollback_available': result.rollback_available,
                },
                headers={
                    'Content-Type': 'application/json',
                    'X-Agent-Key': self.api_key,
                },
                timeout=15,
            )
        except Exception as e:
            print(f"[EXECUTOR:WARN] Could not report result: {e}")
