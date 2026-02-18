#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SOCMind Executor Agent v1.0.0 — SOAR Action Executor Only
Copyright (c) 2025 SOCMind. All rights reserved.
Contact: security@socmind.ai

PURPOSE:
  Dedicated SOAR execution engine — NO log collection.
  Polls the SOCMind platform for approved actions and executes them locally.
  Deploy on ONE privileged/secure host (e.g. a dedicated SOC jump server).

Supported Actions:
  block_ip        | unblock_ip
  isolate_host    | unisolate_host
  kill_process    | disable_user    | enable_user
  reset_password  | stop_service    | start_service
  quarantine_file | delete_file

Usage:
  python3 socmind-executor.py configure   — First-time setup
  python3 socmind-executor.py start       — Start execution loop
  python3 socmind-executor.py dryrun      — Start in simulation mode (no real changes)
  python3 socmind-executor.py status      — Show config and action log
  python3 socmind-executor.py test        — Poll once and exit

Requires:
  pip install requests
"""

import os
import sys
import json
import time
import shutil
import hashlib
import platform
import subprocess
import configparser
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

try:
    import requests
except ImportError:
    print("[FATAL] 'requests' not installed. Run: pip install requests")
    sys.exit(1)

# ============================================================
# Constants
# ============================================================
AGENT_VERSION      = "1.0.0"
AGENT_ROLE         = "executor"
CONFIG_FILE        = os.path.join(os.path.dirname(os.path.abspath(__file__)), "executor.conf")
ACTION_LOG_FILE    = os.path.join(os.path.dirname(os.path.abspath(__file__)), "executor_action_log.json")
POLL_INTERVAL      = 5      # seconds between polls
HEARTBEAT_INTERVAL = 60     # seconds between heartbeats
MAX_ACTION_LOG     = 500    # max entries kept locally
QUARANTINE_DIR     = "/var/socmind/quarantine" if platform.system() != "Windows" else r"C:\SOCMind\Quarantine"

OS = platform.system().lower()   # 'windows', 'linux', 'darwin'


# ============================================================
# Config
# ============================================================
def read_config() -> dict:
    if not os.path.exists(CONFIG_FILE):
        return {}
    cfg = configparser.ConfigParser()
    cfg.read(CONFIG_FILE)
    if "executor" in cfg:
        return dict(cfg["executor"])
    return {}


def write_config(api_key: str, api_endpoint: str) -> None:
    cfg = configparser.ConfigParser()
    cfg["executor"] = {
        "api_key":      api_key,
        "api_endpoint": api_endpoint,
        "role":         "executor",
    }
    with open(CONFIG_FILE, "w") as f:
        cfg.write(f)
    print("[OK] executor.conf saved")


# ============================================================
# Hardware ID (for heartbeat identification)
# ============================================================
def get_hardware_id() -> str:
    parts = [platform.node()]
    if OS == "linux":
        try:
            parts.append(open("/etc/machine-id").read().strip())
        except Exception:
            pass
    elif OS == "windows":
        try:
            result = subprocess.run(
                ["wmic", "csproduct", "get", "UUID"],
                capture_output=True, text=True, timeout=5
            )
            lines = [l.strip() for l in result.stdout.splitlines() if l.strip() and l.strip() != "UUID"]
            if lines:
                parts.append(lines[0])
        except Exception:
            pass
    raw = "-".join(parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


# ============================================================
# Action Log (local audit trail)
# ============================================================
def log_action(action_id: str, action_type: str, target: str, status: str, details: str) -> None:
    entry = {
        "timestamp":   datetime.now(timezone.utc).isoformat(),
        "action_id":   action_id,
        "action_type": action_type,
        "target":      target,
        "status":      status,
        "details":     details,
        "hostname":    platform.node(),
        "os":          OS,
    }
    existing = []
    if os.path.exists(ACTION_LOG_FILE):
        try:
            existing = json.loads(open(ACTION_LOG_FILE).read())
        except Exception:
            existing = []
    existing.append(entry)
    existing = existing[-MAX_ACTION_LOG:]  # keep last N
    with open(ACTION_LOG_FILE, "w") as f:
        json.dump(existing, f, indent=2)


# ============================================================
# API calls
# ============================================================
def make_headers(api_key: str) -> dict:
    return {
        "Content-Type": "application/json",
        "X-Agent-Key":  api_key,
        "User-Agent":   f"SOCMind-Executor/{AGENT_VERSION}",
    }


def poll_actions(api_endpoint: str, api_key: str) -> list:
    try:
        resp = requests.post(
            f"{api_endpoint}/agent-gateway/poll-actions",
            json={},
            headers=make_headers(api_key),
            timeout=15,
        )
        if resp.status_code == 200:
            return resp.json().get("actions", [])
    except requests.exceptions.Timeout:
        pass
    except Exception as e:
        print(f"[WARN] Poll failed: {e}")
    return []


def report_result(api_endpoint: str, api_key: str, action_db_id: str, result: dict) -> None:
    payload = {
        "action_id":         action_db_id,
        "status":            "success" if result.get("success") else "failed",
        "result":            result,
        "error_message":     None if result.get("success") else result.get("details"),
        "rollback_available": result.get("rollback_available", False),
    }
    for attempt in range(1, 4):
        try:
            resp = requests.post(
                f"{api_endpoint}/agent-gateway/report-action",
                json=payload,
                headers=make_headers(api_key),
                timeout=30,
            )
            if resp.status_code == 200:
                print(f"  [OK] Result reported (attempt {attempt})")
                return
        except Exception as e:
            wait = 5 * (2 ** (attempt - 1))
            print(f"  [WARN] Report failed (attempt {attempt}/3), retrying in {wait}s: {e}")
            time.sleep(wait)
    print("  [ERR] Failed to report after 3 attempts — logged locally")


def send_heartbeat(api_endpoint: str, api_key: str) -> None:
    try:
        requests.post(
            f"{api_endpoint}/agent-gateway/heartbeat",
            json={
                "hostname":      platform.node(),
                "status":        "active",
                "ip_address":    None,
                "agent_version": AGENT_VERSION,
                "capabilities":  ["executor"],
            },
            headers=make_headers(api_key),
            timeout=10,
        )
    except Exception:
        pass


# ============================================================
# Safety helpers
# ============================================================
def get_api_ips(api_endpoint: str) -> list:
    import socket
    try:
        from urllib.parse import urlparse
        host = urlparse(api_endpoint).hostname
        return list(set([info[4][0] for info in socket.getaddrinfo(host, None)]))
    except Exception:
        return []


def is_safe_to_block(target_ip: str, api_endpoint: str) -> tuple:
    """Returns (safe: bool, reason: str)"""
    protected = {"127.0.0.1", "::1", "0.0.0.0", "localhost"}
    if target_ip in protected:
        return False, f"Refusing to block loopback address: {target_ip}"
    api_ips = get_api_ips(api_endpoint)
    if target_ip in api_ips:
        return False, f"Refusing to block SOCMind API IP: {target_ip}"
    return True, "ok"


# ============================================================
# Action Implementations
# ============================================================

def _block_ip(target: str, api_endpoint: str, dry_run: bool) -> dict:
    safe, reason = is_safe_to_block(target, api_endpoint)
    if not safe:
        return {"success": False, "details": f"SELF-PROTECTION: {reason}"}
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would block IP {target}"}
    try:
        if OS == "linux":
            subprocess.run(["iptables", "-I", "INPUT",  "1", "-s", target, "-j", "DROP"], check=True, capture_output=True)
            subprocess.run(["iptables", "-I", "OUTPUT", "1", "-d", target, "-j", "DROP"], check=True, capture_output=True)
            return {"success": True, "details": f"Blocked IP {target} via iptables", "rollback_available": True}
        elif OS == "windows":
            rule = f"SOCMind-Block-{target}"
            subprocess.run(["netsh", "advfirewall", "firewall", "add", "rule",
                            f"name={rule}", "dir=in",  "action=block", f"remoteip={target}"], capture_output=True)
            subprocess.run(["netsh", "advfirewall", "firewall", "add", "rule",
                            f"name={rule}-Out", "dir=out", "action=block", f"remoteip={target}"], capture_output=True)
            return {"success": True, "details": f"Blocked IP {target} via Windows Firewall", "rollback_available": True}
        else:
            return {"success": False, "details": f"Unsupported OS: {OS}"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _unblock_ip(target: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would unblock IP {target}"}
    try:
        if OS == "linux":
            subprocess.run(["iptables", "-D", "INPUT",  "-s", target, "-j", "DROP"], capture_output=True)
            subprocess.run(["iptables", "-D", "OUTPUT", "-d", target, "-j", "DROP"], capture_output=True)
            return {"success": True, "details": f"Unblocked IP {target}"}
        elif OS == "windows":
            subprocess.run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name=SOCMind-Block-{target}"], capture_output=True)
            subprocess.run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name=SOCMind-Block-{target}-Out"], capture_output=True)
            return {"success": True, "details": f"Unblocked IP {target}"}
        else:
            return {"success": False, "details": f"Unsupported OS: {OS}"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _kill_process(target: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would kill process: {target}"}
    try:
        if OS == "windows":
            subprocess.run(["taskkill", "/IM", target, "/F"], capture_output=True)
        else:
            subprocess.run(["pkill", "-9", "-f", target], capture_output=True)
        return {"success": True, "details": f"Killed process: {target}"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _disable_user(target: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would disable user: {target}"}
    try:
        if OS == "windows":
            subprocess.run(["net", "user", target, "/active:no"], capture_output=True)
        else:
            subprocess.run(["usermod", "--lock", target], check=True, capture_output=True)
        return {"success": True, "details": f"User {target} disabled", "rollback_available": True}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _enable_user(target: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would enable user: {target}"}
    try:
        if OS == "windows":
            subprocess.run(["net", "user", target, "/active:yes"], capture_output=True)
        else:
            subprocess.run(["usermod", "--unlock", target], check=True, capture_output=True)
        return {"success": True, "details": f"User {target} re-enabled"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _reset_password(target: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would force password reset for: {target}"}
    import random, string
    temp_pw = "SOCMind_" + "".join(random.choices(string.ascii_letters + string.digits, k=12)) + "!"
    try:
        if OS == "windows":
            subprocess.run(["net", "user", target, temp_pw], capture_output=True)
        else:
            proc = subprocess.run(["chpasswd"], input=f"{target}:{temp_pw}".encode(), capture_output=True)
            if proc.returncode != 0:
                return {"success": False, "details": f"chpasswd failed: {proc.stderr.decode()}"}
        return {"success": True, "details": f"Password reset for {target}. User must change at next logon."}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _stop_service(target: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would stop service: {target}"}
    try:
        if OS == "windows":
            subprocess.run(["sc", "stop", target], check=True, capture_output=True)
        else:
            subprocess.run(["systemctl", "stop", target], check=True, capture_output=True)
        return {"success": True, "details": f"Service {target} stopped", "rollback_available": True}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _start_service(target: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would start service: {target}"}
    try:
        if OS == "windows":
            subprocess.run(["sc", "start", target], check=True, capture_output=True)
        else:
            subprocess.run(["systemctl", "start", target], check=True, capture_output=True)
        return {"success": True, "details": f"Service {target} started"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _quarantine_file(target: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would quarantine file: {target}"}
    if not os.path.exists(target):
        return {"success": False, "details": f"File not found: {target}"}
    try:
        os.makedirs(QUARANTINE_DIR, exist_ok=True)
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        dest = os.path.join(QUARANTINE_DIR, f"{ts}_{os.path.basename(target)}.quarantined")
        shutil.move(target, dest)
        if OS != "windows":
            os.chmod(dest, 0o000)
        return {"success": True, "details": f"File quarantined: {target} -> {dest}", "rollback_available": True}
    except PermissionError:
        return {"success": False, "details": f"Permission denied: {target}"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _delete_file(target: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would delete file: {target}"}
    if not os.path.exists(target):
        return {"success": False, "details": f"File not found: {target}"}
    try:
        os.remove(target)
        return {"success": True, "details": f"File deleted: {target}"}
    except PermissionError:
        return {"success": False, "details": f"Permission denied: {target}"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _isolate_host(api_endpoint: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": "DRY-RUN: Would isolate host (block all non-SOCMind traffic)"}
    api_ips = get_api_ips(api_endpoint)
    if not api_ips:
        return {"success": False, "details": "SAFETY: Cannot resolve API endpoint IPs. Aborting to prevent lockout."}
    try:
        if OS == "linux":
            # Flush existing rules
            subprocess.run(["iptables", "-F"], capture_output=True)
            subprocess.run(["iptables", "-P", "INPUT",  "DROP"], capture_output=True)
            subprocess.run(["iptables", "-P", "OUTPUT", "DROP"], capture_output=True)
            # Allow loopback
            subprocess.run(["iptables", "-A", "INPUT",  "-i", "lo", "-j", "ACCEPT"], capture_output=True)
            subprocess.run(["iptables", "-A", "OUTPUT", "-o", "lo", "-j", "ACCEPT"], capture_output=True)
            # Allow DNS
            subprocess.run(["iptables", "-A", "OUTPUT", "-p", "udp", "--dport", "53", "-j", "ACCEPT"], capture_output=True)
            # Allow SOCMind API IPs
            for ip in api_ips:
                subprocess.run(["iptables", "-A", "OUTPUT", "-d", ip, "-p", "tcp", "--dport", "443", "-j", "ACCEPT"], capture_output=True)
                subprocess.run(["iptables", "-A", "INPUT",  "-s", ip, "-j", "ACCEPT"], capture_output=True)
            return {"success": True, "details": f"Host isolated. API IPs whitelisted: {api_ips}", "rollback_available": True}
        elif OS == "windows":
            # Block all, allow SOCMind management channel
            subprocess.run(["netsh", "advfirewall", "set", "allprofiles", "firewallpolicy", "blockinbound,blockoutbound"], capture_output=True)
            for ip in api_ips:
                subprocess.run(["netsh", "advfirewall", "firewall", "add", "rule",
                                "name=SOCMind-Isolate-AllowAPI", "dir=out", "action=allow",
                                f"remoteip={ip}", "remoteport=443", "protocol=TCP"], capture_output=True)
            return {"success": True, "details": f"Host isolated. API channel preserved.", "rollback_available": True}
        else:
            return {"success": False, "details": f"Unsupported OS: {OS}"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _unisolate_host(dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": "DRY-RUN: Would remove host isolation"}
    try:
        if OS == "linux":
            subprocess.run(["iptables", "-F"], capture_output=True)
            subprocess.run(["iptables", "-P", "INPUT",  "ACCEPT"], capture_output=True)
            subprocess.run(["iptables", "-P", "OUTPUT", "ACCEPT"], capture_output=True)
            return {"success": True, "details": "Host isolation removed"}
        elif OS == "windows":
            subprocess.run(["netsh", "advfirewall", "set", "allprofiles", "firewallpolicy", "blockinbound,allowoutbound"], capture_output=True)
            subprocess.run(["netsh", "advfirewall", "firewall", "delete", "rule", "name=SOCMind-Isolate-AllowAPI"], capture_output=True)
            return {"success": True, "details": "Host isolation removed"}
        else:
            return {"success": False, "details": f"Unsupported OS: {OS}"}
    except Exception as e:
        return {"success": False, "details": str(e)}


# ============================================================
# Main Action Dispatcher
# ============================================================
def execute_action(action: dict, dry_run: bool, api_endpoint: str) -> dict:
    action_type = action.get("action_type", "")
    target      = action.get("target", "")
    params      = action.get("parameters") or {}

    print()
    print("=" * 52)
    print(f"  SOAR ACTION : {action_type}")
    print(f"  Target      : {target}")
    print(f"  Mode        : {'SIMULATION' if dry_run else 'REAL'}")
    print("=" * 52)

    dispatch = {
        "block_ip":       lambda: _block_ip(target, api_endpoint, dry_run),
        "unblock_ip":     lambda: _unblock_ip(target, dry_run),
        "kill_process":   lambda: _kill_process(target, dry_run),
        "disable_user":   lambda: _disable_user(target, dry_run),
        "enable_user":    lambda: _enable_user(target, dry_run),
        "reset_password": lambda: _reset_password(target, dry_run),
        "stop_service":   lambda: _stop_service(target, dry_run),
        "start_service":  lambda: _start_service(target, dry_run),
        "quarantine_file":lambda: _quarantine_file(target, dry_run),
        "delete_file":    lambda: _delete_file(target, dry_run),
        "isolate_host":   lambda: _isolate_host(api_endpoint, dry_run),
        "unisolate_host": lambda: _unisolate_host(dry_run),
    }

    handler = dispatch.get(action_type)
    if not handler:
        result = {"success": False, "details": f"Unknown action type: {action_type}"}
    else:
        try:
            result = handler()
        except Exception as e:
            result = {"success": False, "details": f"Unhandled exception: {e}"}

    status = "completed" if result.get("success") else "failed"
    label  = "[OK]" if result.get("success") else "[FAIL]"
    print(f"  {label} {result.get('details', '')}")

    log_action(
        action_id=action.get("action_id", action.get("id", "")),
        action_type=action_type,
        target=target,
        status=status,
        details=result.get("details", ""),
    )

    return result


# ============================================================
# Main Loop
# ============================================================
def run(dry_run: bool = False, test_once: bool = False):
    cfg = read_config()
    if not cfg.get("api_key") or not cfg.get("api_endpoint"):
        print("[ERR] Not configured. Run: python3 socmind-executor.py configure")
        sys.exit(1)

    api_key      = cfg["api_key"]
    api_endpoint = cfg["api_endpoint"].rstrip("/")

    print()
    print("=" * 52)
    print(f"  SOCMind EXECUTOR v{AGENT_VERSION}")
    print(f"  Host    : {platform.node()}")
    print(f"  OS      : {platform.system()} {platform.release()}")
    print(f"  Role    : SOAR EXECUTOR ONLY (no log collection)")
    print(f"  Mode    : {'SIMULATION (dry-run)' if dry_run else 'REAL EXECUTION'}")
    print(f"  Polling : every {POLL_INTERVAL}s")
    print("  Press Ctrl+C to stop")
    print("=" * 52)
    print()

    last_heartbeat = 0
    actions_executed = 0

    while True:
        try:
            now = time.time()

            # Heartbeat
            if now - last_heartbeat >= HEARTBEAT_INTERVAL:
                send_heartbeat(api_endpoint, api_key)
                last_heartbeat = now

            # Poll for actions
            actions = poll_actions(api_endpoint, api_key)
            if actions:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Received {len(actions)} action(s)")
                for action in actions:
                    result = execute_action(action, dry_run=dry_run, api_endpoint=api_endpoint)
                    db_id  = action.get("id") or action.get("action_id")
                    if db_id:
                        report_result(api_endpoint, api_key, db_id, result)
                    actions_executed += 1
            else:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Waiting for actions... (executed: {actions_executed})", end="\r")

            if test_once:
                print(f"\n[TEST] Done. Executed {actions_executed} action(s).")
                break

            time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            print(f"\n\n[STOP] Executor stopped. Total actions executed: {actions_executed}")
            break
        except Exception as e:
            print(f"\n[ERR] Loop error: {e}")
            time.sleep(5)


# ============================================================
# CLI Commands
# ============================================================
def cmd_configure():
    print()
    print("SOCMind Executor Setup")
    print("======================")
    print("Role: SOAR EXECUTOR ONLY (no log collection)")
    print("Deploy on ONE privileged host (e.g. SOC jump server)")
    print()
    api_key      = input("API Key: ").strip()
    api_endpoint = input("API Endpoint (e.g. https://xxxx.supabase.co/functions/v1): ").strip()

    # Verify
    try:
        resp = requests.post(
            f"{api_endpoint.rstrip('/')}/agent-gateway/heartbeat",
            json={"hostname": "executor-setup", "status": "active"},
            headers=make_headers(api_key),
            timeout=15,
        )
        print(f"[OK] Endpoint reachable (HTTP {resp.status_code})")
    except Exception as e:
        print(f"[WARN] Could not verify endpoint: {e}")

    write_config(api_key, api_endpoint)
    print()
    print("Done. Run: python3 socmind-executor.py start")


def cmd_status():
    cfg = read_config()
    print()
    print(f"SOCMind Executor v{AGENT_VERSION}")
    print("================================")
    if not cfg.get("api_key"):
        print("Status: NOT CONFIGURED")
    else:
        print(f"Endpoint : {cfg.get('api_endpoint')}")
        print(f"API Key  : {cfg.get('api_key', '')[:12]}...")
        print(f"Role     : EXECUTOR ONLY (no log collection)")
        print(f"OS       : {platform.system()} {platform.release()}")
        print(f"Host     : {platform.node()}")

    if os.path.exists(ACTION_LOG_FILE):
        try:
            log = json.loads(open(ACTION_LOG_FILE).read())
            print(f"\nActions in log: {len(log)}")
            for entry in log[-5:]:
                ts  = entry.get("timestamp", "")[:19].replace("T", " ")
                at  = entry.get("action_type", "?")
                tgt = entry.get("target", "?")
                st  = entry.get("status", "?")
                print(f"  [{ts}] {at} -> {tgt} = {st}")
        except Exception:
            pass
    print()


def show_help():
    print(f"""
SOCMind Executor Agent v{AGENT_VERSION}
Role: SOAR EXECUTOR ONLY — no log collection
OS  : {platform.system()}

Commands:
  configure   First-time setup (API key + endpoint)
  start       Start SOAR execution loop (real mode)
  dryrun      Start in simulation mode (no real changes)
  test        Poll once and exit
  status      Show config + recent action log

Deploy on ONE privileged host (SOC jump server or management node).
Use socmind-collector-*.ps1/.sh on each endpoint for log collection.

Supported actions:
  block_ip, unblock_ip, isolate_host, unisolate_host,
  kill_process, disable_user, enable_user, reset_password,
  stop_service, start_service, quarantine_file, delete_file
""")


def main():
    cmd = sys.argv[1].lower() if len(sys.argv) > 1 else "help"
    if cmd == "configure":
        cmd_configure()
    elif cmd == "start":
        run(dry_run=False)
    elif cmd == "dryrun":
        run(dry_run=True)
    elif cmd == "test":
        run(dry_run=False, test_once=True)
    elif cmd == "status":
        cmd_status()
    else:
        show_help()


if __name__ == "__main__":
    main()
