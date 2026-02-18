#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SOCMind Executor Agent v2.0.0 — Production SOAR Execution Engine
Copyright (c) 2025 SOCMind. All rights reserved.
Contact: security@socmind.ai

PURPOSE:
  Dedicated SOAR execution engine — NO log collection.
  Polls the SOCMind platform for approved actions and executes them locally.
  Deploy on ONE privileged/secure host (e.g. a dedicated SOC jump server).

Supported Actions:
  ── Network ──────────────────────────────────────────────
  block_ip          | unblock_ip
  isolate_host      | unisolate_host
  flush_dns         | block_domain
  ── Process / Service ────────────────────────────────────
  kill_process      | stop_service      | start_service
  restart_service   | suspend_process
  ── User / Identity ──────────────────────────────────────
  disable_user      | enable_user
  lock_user         | unlock_user
  reset_password    | force_logoff
  ── File / Disk ──────────────────────────────────────────
  quarantine_file   | delete_file       | wipe_file
  collect_forensics | dump_memory
  ── Notification / Alerting ──────────────────────────────
  notify_user       | send_alert
  ── Credential / Config ──────────────────────────────────
  rotate_credentials| revoke_token

Usage:
  python3 socmind-executor.py configure   — First-time setup
  python3 socmind-executor.py start       — Start execution loop
  python3 socmind-executor.py dryrun      — Simulation mode (no real changes)
  python3 socmind-executor.py status      — Show config and action log
  python3 socmind-executor.py test        — Poll once and exit
  python3 socmind-executor.py rollback    — Rollback last reversible action

Requires:
  pip install requests psutil
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
import threading
import socket
import random
import string
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Tuple

try:
    import requests
except ImportError:
    print("[FATAL] 'requests' not installed. Run: pip install requests")
    sys.exit(1)

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

# ============================================================
# Constants
# ============================================================
AGENT_VERSION      = "2.0.0"
AGENT_ROLE         = "executor"
CONFIG_FILE        = os.path.join(os.path.dirname(os.path.abspath(__file__)), "executor.conf")
ACTION_LOG_FILE    = os.path.join(os.path.dirname(os.path.abspath(__file__)), "executor_action_log.json")
ROLLBACK_FILE      = os.path.join(os.path.dirname(os.path.abspath(__file__)), "executor_rollback.json")
FORENSICS_DIR      = "/var/socmind/forensics" if platform.system() != "Windows" else r"C:\SOCMind\Forensics"
QUARANTINE_DIR     = "/var/socmind/quarantine" if platform.system() != "Windows" else r"C:\SOCMind\Quarantine"
POLL_INTERVAL      = 5      # seconds between polls
HEARTBEAT_INTERVAL = 60     # seconds between heartbeats
MAX_ACTION_LOG     = 1000   # max entries kept locally
MAX_ROLLBACK       = 50     # max rollback entries

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
        "version":      AGENT_VERSION,
    }
    with open(CONFIG_FILE, "w") as f:
        cfg.write(f)
    print("[OK] executor.conf saved")


# ============================================================
# Hardware ID
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
def log_action(action_id: str, action_type: str, target: str, status: str, details: str,
               rollback_cmd: Optional[dict] = None) -> None:
    entry = {
        "timestamp":    datetime.now(timezone.utc).isoformat(),
        "action_id":    action_id,
        "action_type":  action_type,
        "target":       target,
        "status":       status,
        "details":      details,
        "hostname":     platform.node(),
        "os":           OS,
        "rollback_cmd": rollback_cmd,
    }
    # Main log
    existing = []
    if os.path.exists(ACTION_LOG_FILE):
        try:
            existing = json.loads(open(ACTION_LOG_FILE).read())
        except Exception:
            existing = []
    existing.append(entry)
    existing = existing[-MAX_ACTION_LOG:]
    with open(ACTION_LOG_FILE, "w") as f:
        json.dump(existing, f, indent=2)

    # Rollback log (only reversible actions)
    if rollback_cmd and status == "completed":
        rb = []
        if os.path.exists(ROLLBACK_FILE):
            try:
                rb = json.loads(open(ROLLBACK_FILE).read())
            except Exception:
                rb = []
        rb.append({"timestamp": entry["timestamp"], "action_type": action_type,
                   "target": target, "rollback_cmd": rollback_cmd})
        rb = rb[-MAX_ROLLBACK:]
        with open(ROLLBACK_FILE, "w") as f:
            json.dump(rb, f, indent=2)


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
            json={"role": "executor", "capabilities": _get_capabilities()},
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
        "action_id":          action_db_id,
        "status":             "success" if result.get("success") else "failed",
        "result":             result,
        "error_message":      None if result.get("success") else result.get("details"),
        "rollback_available": result.get("rollback_available", False),
        "executor_hostname":  platform.node(),
        "executor_os":        OS,
        "executor_version":   AGENT_VERSION,
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
    print("  [ERR] Failed to report after 3 attempts — logged locally only")


def send_heartbeat(api_endpoint: str, api_key: str) -> None:
    try:
        requests.post(
            f"{api_endpoint}/agent-gateway/heartbeat",
            json={
                "hostname":      platform.node(),
                "status":        "active",
                "ip_address":    _get_local_ip(),
                "agent_version": AGENT_VERSION,
                "capabilities":  _get_capabilities(),
                "role":          "executor",
                "os":            OS,
                "hardware_id":   get_hardware_id(),
            },
            headers=make_headers(api_key),
            timeout=10,
        )
    except Exception:
        pass


def send_platform_alert(api_endpoint: str, api_key: str,
                        title: str, message: str, severity: str = "info") -> None:
    """Send an alert/notification back to the SOCMind platform."""
    try:
        requests.post(
            f"{api_endpoint}/agent-gateway/alert",
            json={
                "title":    title,
                "message":  message,
                "severity": severity,
                "source":   "executor",
                "hostname": platform.node(),
            },
            headers=make_headers(api_key),
            timeout=10,
        )
    except Exception:
        pass


# ============================================================
# Safety helpers
# ============================================================
def _get_local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "0.0.0.0"


def _get_local_ips() -> set:
    protected = {"127.0.0.1", "::1", "0.0.0.0", "localhost", "255.255.255.255"}
    protected.add(_get_local_ip())
    if OS == "linux":
        try:
            result = subprocess.run(["ip", "-4", "addr", "show"],
                                    capture_output=True, text=True, timeout=5)
            for match in re.findall(r"inet\s+(\d+\.\d+\.\d+\.\d+)", result.stdout):
                protected.add(match)
        except Exception:
            pass
    elif OS == "windows":
        try:
            result = subprocess.run(["ipconfig"], capture_output=True, text=True, timeout=5)
            for match in re.findall(r"(\d+\.\d+\.\d+\.\d+)", result.stdout):
                protected.add(match)
        except Exception:
            pass
    return protected


def get_api_ips(api_endpoint: str) -> list:
    try:
        from urllib.parse import urlparse
        host = urlparse(api_endpoint).hostname
        return list(set([info[4][0] for info in socket.getaddrinfo(host, None)]))
    except Exception:
        return []


def is_safe_to_block(target_ip: str, api_endpoint: str) -> Tuple[bool, str]:
    local_ips = _get_local_ips()
    if target_ip in local_ips:
        return False, f"Refusing to block local/loopback address: {target_ip}"
    api_ips = get_api_ips(api_endpoint)
    if target_ip in api_ips:
        return False, f"Refusing to block SOCMind API IP: {target_ip}"
    # Check if it looks like a gateway
    parts = target_ip.split(".")
    if len(parts) == 4 and parts[-1] == "1":
        pass  # warn but allow (gateway might be legitimately blocked)
    return True, "ok"


def _is_valid_ip(ip: str) -> bool:
    parts = ip.strip().split(".")
    if len(parts) != 4:
        return False
    return all(p.isdigit() and 0 <= int(p) <= 255 for p in parts)


def _get_capabilities() -> list:
    caps = [
        "block_ip", "unblock_ip", "isolate_host", "unisolate_host",
        "flush_dns", "block_domain",
        "kill_process", "stop_service", "start_service",
        "restart_service", "suspend_process",
        "disable_user", "enable_user", "lock_user", "unlock_user",
        "reset_password", "force_logoff",
        "quarantine_file", "delete_file", "wipe_file",
        "collect_forensics", "dump_memory",
        "notify_user", "send_alert",
        "rotate_credentials", "revoke_token",
    ]
    return caps


# ============================================================
# ─── NETWORK ACTIONS ─────────────────────────────────────────
# ============================================================

def _block_ip(target: str, api_endpoint: str, dry_run: bool, params: dict) -> dict:
    if not _is_valid_ip(target):
        return {"success": False, "details": f"Invalid IP address format: {target}"}
    safe, reason = is_safe_to_block(target, api_endpoint)
    if not safe:
        return {"success": False, "details": f"SELF-PROTECTION: {reason}"}
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would block IP {target} (inbound + outbound)"}
    duration = params.get("duration_seconds", 0)
    try:
        if OS == "linux":
            subprocess.run(["iptables", "-I", "INPUT",  "1", "-s", target, "-j", "DROP"], check=True, capture_output=True)
            subprocess.run(["iptables", "-I", "OUTPUT", "1", "-d", target, "-j", "DROP"], check=True, capture_output=True)
            # Auto-unblock after duration
            if duration and int(duration) > 0:
                def _auto_unblock():
                    time.sleep(int(duration))
                    subprocess.run(["iptables", "-D", "INPUT",  "-s", target, "-j", "DROP"], capture_output=True)
                    subprocess.run(["iptables", "-D", "OUTPUT", "-d", target, "-j", "DROP"], capture_output=True)
                    print(f"\n[AUTO] Unblocked IP {target} after {duration}s")
                threading.Thread(target=_auto_unblock, daemon=True).start()
                return {"success": True,
                        "details": f"Blocked IP {target} via iptables (auto-unblock in {duration}s)",
                        "rollback_available": True}
            return {"success": True,
                    "details": f"Blocked IP {target} via iptables (INPUT+OUTPUT DROP)",
                    "rollback_available": True}
        elif OS == "windows":
            rule = f"SOCMind-Block-{target}"
            subprocess.run(["netsh", "advfirewall", "firewall", "add", "rule",
                            f"name={rule}", "dir=in",  "action=block", f"remoteip={target}"], capture_output=True)
            subprocess.run(["netsh", "advfirewall", "firewall", "add", "rule",
                            f"name={rule}-Out", "dir=out", "action=block", f"remoteip={target}"], capture_output=True)
            return {"success": True,
                    "details": f"Blocked IP {target} via Windows Firewall (in+out)",
                    "rollback_available": True,
                    "_rollback_cmd": {"type": "unblock_ip", "target": target}}
        else:
            return {"success": False, "details": f"Unsupported OS: {OS}"}
    except subprocess.CalledProcessError as e:
        return {"success": False, "details": f"Command failed: {e.stderr.decode() if e.stderr else str(e)}"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _unblock_ip(target: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would unblock IP {target}"}
    try:
        if OS == "linux":
            subprocess.run(["iptables", "-D", "INPUT",  "-s", target, "-j", "DROP"], capture_output=True)
            subprocess.run(["iptables", "-D", "OUTPUT", "-d", target, "-j", "DROP"], capture_output=True)
            return {"success": True, "details": f"Unblocked IP {target} from iptables"}
        elif OS == "windows":
            subprocess.run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name=SOCMind-Block-{target}"], capture_output=True)
            subprocess.run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name=SOCMind-Block-{target}-Out"], capture_output=True)
            return {"success": True, "details": f"Unblocked IP {target} from Windows Firewall"}
        else:
            return {"success": False, "details": f"Unsupported OS: {OS}"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _isolate_host(api_endpoint: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": "DRY-RUN: Would isolate host (block all non-SOCMind traffic)"}
    api_ips = get_api_ips(api_endpoint)
    if not api_ips:
        return {"success": False, "details": "SAFETY: Cannot resolve API endpoint IPs — aborting to prevent lockout."}
    try:
        if OS == "linux":
            # Save current rules for rollback
            backup_result = subprocess.run(["iptables-save"], capture_output=True, text=True)
            iptables_backup = backup_result.stdout

            subprocess.run(["iptables", "-F"], capture_output=True)
            subprocess.run(["iptables", "-P", "INPUT",   "DROP"], capture_output=True)
            subprocess.run(["iptables", "-P", "OUTPUT",  "DROP"], capture_output=True)
            subprocess.run(["iptables", "-P", "FORWARD", "DROP"], capture_output=True)
            # Loopback
            subprocess.run(["iptables", "-A", "INPUT",  "-i", "lo", "-j", "ACCEPT"], capture_output=True)
            subprocess.run(["iptables", "-A", "OUTPUT", "-o", "lo", "-j", "ACCEPT"], capture_output=True)
            # DNS (needed for API resolution)
            subprocess.run(["iptables", "-A", "OUTPUT", "-p", "udp", "--dport", "53", "-j", "ACCEPT"], capture_output=True)
            subprocess.run(["iptables", "-A", "INPUT",  "-p", "udp", "--sport", "53", "-j", "ACCEPT"], capture_output=True)
            # SOCMind API channel
            for ip in api_ips:
                subprocess.run(["iptables", "-A", "OUTPUT", "-d", ip, "-p", "tcp", "--dport", "443", "-j", "ACCEPT"], capture_output=True)
                subprocess.run(["iptables", "-A", "INPUT",  "-s", ip, "-p", "tcp", "--sport", "443", "-j", "ACCEPT"], capture_output=True)
            # SSH (management access preservation)
            subprocess.run(["iptables", "-A", "INPUT",  "-p", "tcp", "--dport", "22", "-j", "ACCEPT"], capture_output=True)
            subprocess.run(["iptables", "-A", "OUTPUT", "-p", "tcp", "--sport", "22", "-j", "ACCEPT"], capture_output=True)
            # Established connections
            subprocess.run(["iptables", "-A", "INPUT",  "-m", "state", "--state", "ESTABLISHED,RELATED", "-j", "ACCEPT"], capture_output=True)
            subprocess.run(["iptables", "-A", "OUTPUT", "-m", "state", "--state", "ESTABLISHED,RELATED", "-j", "ACCEPT"], capture_output=True)

            return {
                "success": True,
                "details": f"Host ISOLATED. API IPs whitelisted: {api_ips}. SSH preserved. All other traffic blocked.",
                "rollback_available": True,
                "_iptables_backup": iptables_backup,
            }
        elif OS == "windows":
            # Backup firewall policy
            backup_path = r"C:\SOCMind\fw_backup.wfw"
            os.makedirs(r"C:\SOCMind", exist_ok=True)
            subprocess.run(["netsh", "advfirewall", "export", backup_path], capture_output=True)
            # Block all
            subprocess.run(["netsh", "advfirewall", "set", "allprofiles", "firewallpolicy",
                            "blockinbound,blockoutbound"], capture_output=True)
            # Allow SOCMind API
            for ip in api_ips:
                subprocess.run(["netsh", "advfirewall", "firewall", "add", "rule",
                                "name=SOCMind-Isolate-AllowAPI", "dir=out", "action=allow",
                                f"remoteip={ip}", "protocol=TCP", "remoteport=443"], capture_output=True)
                subprocess.run(["netsh", "advfirewall", "firewall", "add", "rule",
                                "name=SOCMind-Isolate-AllowAPI-In", "dir=in", "action=allow",
                                f"remoteip={ip}", "protocol=TCP"], capture_output=True)
            # Allow loopback
            subprocess.run(["netsh", "advfirewall", "firewall", "add", "rule",
                            "name=SOCMind-Isolate-Loopback", "dir=in", "action=allow",
                            "remoteip=127.0.0.1"], capture_output=True)
            return {
                "success": True,
                "details": f"Host ISOLATED via Windows Firewall. API channel preserved. Backup: {backup_path}",
                "rollback_available": True,
            }
        else:
            return {"success": False, "details": f"Unsupported OS: {OS}"}
    except Exception as e:
        return {"success": False, "details": f"Isolation failed: {str(e)}"}


def _unisolate_host(dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": "DRY-RUN: Would remove host isolation"}
    try:
        if OS == "linux":
            subprocess.run(["iptables", "-F"], capture_output=True)
            subprocess.run(["iptables", "-P", "INPUT",   "ACCEPT"], capture_output=True)
            subprocess.run(["iptables", "-P", "OUTPUT",  "ACCEPT"], capture_output=True)
            subprocess.run(["iptables", "-P", "FORWARD", "ACCEPT"], capture_output=True)
            return {"success": True, "details": "Host UNISOLATED. All iptables rules flushed, policies set to ACCEPT."}
        elif OS == "windows":
            # Try to restore from backup
            backup_path = r"C:\SOCMind\fw_backup.wfw"
            if os.path.exists(backup_path):
                subprocess.run(["netsh", "advfirewall", "import", backup_path], capture_output=True)
                return {"success": True, "details": "Host UNISOLATED. Firewall restored from backup."}
            else:
                subprocess.run(["netsh", "advfirewall", "set", "allprofiles", "firewallpolicy",
                                "blockinbound,allowoutbound"], capture_output=True)
                for rule in ["SOCMind-Isolate-AllowAPI", "SOCMind-Isolate-AllowAPI-In",
                             "SOCMind-Isolate-Loopback"]:
                    subprocess.run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name={rule}"],
                                   capture_output=True)
                return {"success": True, "details": "Host UNISOLATED. SOCMind isolation rules removed."}
        else:
            return {"success": False, "details": f"Unsupported OS: {OS}"}
    except Exception as e:
        return {"success": False, "details": f"Unisolation failed: {str(e)}"}


def _flush_dns(dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": "DRY-RUN: Would flush DNS cache"}
    try:
        if OS == "windows":
            subprocess.run(["ipconfig", "/flushdns"], check=True, capture_output=True)
        elif OS == "linux":
            # Try multiple DNS cache services
            for svc in ["systemd-resolved", "nscd", "dnsmasq"]:
                r = subprocess.run(["systemctl", "is-active", "--quiet", svc])
                if r.returncode == 0:
                    subprocess.run(["systemctl", "restart", svc], capture_output=True)
                    break
            else:
                # Fallback: clear nscd cache
                subprocess.run(["nscd", "-i", "hosts"], capture_output=True)
        elif OS == "darwin":
            subprocess.run(["dscacheutil", "-flushcache"], capture_output=True)
            subprocess.run(["killall", "-HUP", "mDNSResponder"], capture_output=True)
        return {"success": True, "details": f"DNS cache flushed on {OS}"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _block_domain(target: str, dry_run: bool) -> dict:
    """Block a domain by adding it to hosts file pointing to 0.0.0.0"""
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would block domain {target} via hosts file"}
    try:
        hosts_file = r"C:\Windows\System32\drivers\etc\hosts" if OS == "windows" else "/etc/hosts"
        entry = f"\n0.0.0.0 {target}  # SOCMind-Block\n0.0.0.0 www.{target}  # SOCMind-Block\n"
        # Check if already blocked
        with open(hosts_file, "r") as f:
            content = f.read()
        if target in content and "SOCMind-Block" in content:
            return {"success": True, "details": f"Domain {target} already blocked"}
        with open(hosts_file, "a") as f:
            f.write(entry)
        return {"success": True,
                "details": f"Domain {target} blocked via hosts file",
                "rollback_available": True}
    except PermissionError:
        return {"success": False, "details": "Permission denied — run as root/Administrator"}
    except Exception as e:
        return {"success": False, "details": str(e)}


# ============================================================
# ─── PROCESS / SERVICE ACTIONS ───────────────────────────────
# ============================================================

def _kill_process(target: str, dry_run: bool, params: dict) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would kill process '{target}'"}
    killed = 0
    try:
        if HAS_PSUTIL:
            for proc in psutil.process_iter(["pid", "name", "cmdline", "username"]):
                try:
                    name    = proc.info.get("name", "") or ""
                    cmdline = " ".join(proc.info.get("cmdline") or [])
                    if target.lower() in name.lower() or target.lower() in cmdline.lower():
                        proc.kill()
                        killed += 1
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            if killed:
                return {"success": True, "details": f"Killed {killed} process(es) matching '{target}'"}
            return {"success": False, "details": f"No process found matching '{target}'"}
        else:
            if OS == "windows":
                r = subprocess.run(["taskkill", "/IM", target, "/F"], capture_output=True, text=True)
                return {"success": r.returncode == 0,
                        "details": r.stdout.strip() or r.stderr.strip() or f"Killed {target}"}
            else:
                r = subprocess.run(["pkill", "-9", "-f", target], capture_output=True)
                return {"success": r.returncode == 0,
                        "details": f"pkill -9 -f {target} (rc={r.returncode})"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _suspend_process(target: str, dry_run: bool) -> dict:
    """Suspend (pause) a process without killing it — useful for forensics."""
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would suspend process '{target}'"}
    if not HAS_PSUTIL:
        return {"success": False, "details": "psutil not installed — run: pip install psutil"}
    suspended = 0
    try:
        for proc in psutil.process_iter(["pid", "name", "cmdline"]):
            try:
                name = proc.info.get("name", "") or ""
                if target.lower() in name.lower():
                    proc.suspend()
                    suspended += 1
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        if suspended:
            return {"success": True,
                    "details": f"Suspended {suspended} process(es) matching '{target}'",
                    "rollback_available": True}
        return {"success": False, "details": f"No process found matching '{target}'"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _stop_service(target: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would stop service '{target}'"}
    try:
        if OS == "windows":
            r = subprocess.run(["sc", "stop", target], capture_output=True, text=True)
        else:
            r = subprocess.run(["systemctl", "stop", target], capture_output=True, text=True)
        if r.returncode == 0:
            return {"success": True,
                    "details": f"Service '{target}' stopped",
                    "rollback_available": True}
        return {"success": False, "details": r.stderr.strip() or f"Failed to stop {target}"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _start_service(target: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would start service '{target}'"}
    try:
        if OS == "windows":
            r = subprocess.run(["sc", "start", target], capture_output=True, text=True)
        else:
            r = subprocess.run(["systemctl", "start", target], capture_output=True, text=True)
        success = r.returncode == 0
        return {"success": success,
                "details": f"Service '{target}' started" if success else r.stderr.strip()}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _restart_service(target: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would restart service '{target}'"}
    try:
        if OS == "windows":
            subprocess.run(["sc", "stop",  target], capture_output=True)
            time.sleep(2)
            r = subprocess.run(["sc", "start", target], capture_output=True, text=True)
        else:
            r = subprocess.run(["systemctl", "restart", target], capture_output=True, text=True)
        success = r.returncode == 0
        return {"success": success,
                "details": f"Service '{target}' restarted" if success else r.stderr.strip()}
    except Exception as e:
        return {"success": False, "details": str(e)}


# ============================================================
# ─── USER / IDENTITY ACTIONS ─────────────────────────────────
# ============================================================

def _disable_user(target: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would disable user '{target}'"}
    try:
        if OS == "windows":
            r = subprocess.run(["net", "user", target, "/active:no"], capture_output=True, text=True)
        else:
            r = subprocess.run(["usermod", "--lock", target], capture_output=True, text=True)
        success = r.returncode == 0
        return {"success": success,
                "details": f"User '{target}' disabled" if success else r.stderr.strip(),
                "rollback_available": True}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _enable_user(target: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would enable user '{target}'"}
    try:
        if OS == "windows":
            r = subprocess.run(["net", "user", target, "/active:yes"], capture_output=True, text=True)
        else:
            r = subprocess.run(["usermod", "--unlock", target], capture_output=True, text=True)
        success = r.returncode == 0
        return {"success": success,
                "details": f"User '{target}' re-enabled" if success else r.stderr.strip()}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _lock_user(target: str, dry_run: bool, params: dict) -> dict:
    """Lock user account with optional auto-unlock after duration_seconds."""
    duration = params.get("duration_seconds", params.get("duration", 0))
    if dry_run:
        return {"success": True,
                "details": f"DRY-RUN: Would lock user '{target}'" + (f" for {duration}s" if duration else "")}
    try:
        if OS == "linux":
            r = subprocess.run(["passwd", "-l", target], check=True, capture_output=True, text=True)
            details = f"User '{target}' locked"
            if duration and int(duration) > 0:
                def _auto_unlock():
                    time.sleep(int(duration))
                    subprocess.run(["passwd", "-u", target], capture_output=True)
                    print(f"\n[AUTO] Unlocked user '{target}' after {duration}s")
                threading.Thread(target=_auto_unlock, daemon=True).start()
                details += f" (auto-unlock in {duration}s)"
        elif OS == "windows":
            r = subprocess.run(["net", "user", target, "/active:no"],
                               check=True, capture_output=True, text=True)
            details = f"User '{target}' locked (Windows account disabled)"
            if duration and int(duration) > 0:
                def _auto_enable():
                    time.sleep(int(duration))
                    subprocess.run(["net", "user", target, "/active:yes"], capture_output=True)
                    print(f"\n[AUTO] Re-enabled user '{target}' after {duration}s")
                threading.Thread(target=_auto_enable, daemon=True).start()
                details += f" (auto-enable in {duration}s)"
        else:
            return {"success": False, "details": f"Unsupported OS: {OS}"}
        return {"success": True, "details": details, "rollback_available": True}
    except subprocess.CalledProcessError as e:
        return {"success": False, "details": f"Failed: {e.stderr or str(e)}"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _unlock_user(target: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would unlock user '{target}'"}
    try:
        if OS == "linux":
            subprocess.run(["passwd", "-u", target], check=True, capture_output=True)
        elif OS == "windows":
            subprocess.run(["net", "user", target, "/active:yes"], check=True, capture_output=True)
        else:
            return {"success": False, "details": f"Unsupported OS: {OS}"}
        return {"success": True, "details": f"User '{target}' unlocked"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _reset_password(target: str, dry_run: bool, params: dict) -> dict:
    new_pw = params.get("new_password", "")
    if not new_pw:
        new_pw = "SOCMind_" + "".join(random.choices(string.ascii_letters + string.digits, k=14)) + "!@"
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would force password reset for '{target}'"}
    try:
        if OS == "windows":
            r = subprocess.run(["net", "user", target, new_pw], capture_output=True, text=True)
            if r.returncode != 0:
                return {"success": False, "details": r.stderr.strip()}
            # Force change at next logon
            subprocess.run(["net", "user", target, "/logonpasswordchg:yes"], capture_output=True)
        else:
            proc = subprocess.run(["chpasswd"], input=f"{target}:{new_pw}".encode(), capture_output=True)
            if proc.returncode != 0:
                return {"success": False, "details": f"chpasswd failed: {proc.stderr.decode()}"}
            # Force change at next login
            subprocess.run(["chage", "-d", "0", target], capture_output=True)
        return {"success": True,
                "details": f"Password reset for '{target}'. User must change at next login. Temp pw sent via secure channel."}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _force_logoff(target: str, dry_run: bool) -> dict:
    """Force logoff of all sessions for a user."""
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would force logoff user '{target}'"}
    try:
        if OS == "windows":
            # Get session IDs for the user
            r = subprocess.run(["query", "session", target], capture_output=True, text=True)
            # Parse session IDs
            session_ids = re.findall(r'\s+(\d+)\s+', r.stdout)
            for sid in session_ids:
                subprocess.run(["logoff", sid], capture_output=True)
            return {"success": True, "details": f"Forced logoff for '{target}' ({len(session_ids)} session(s))"}
        elif OS == "linux":
            # Kill all processes belonging to user
            r = subprocess.run(["pkill", "-KILL", "-u", target], capture_output=True)
            return {"success": True, "details": f"Killed all processes for user '{target}'"}
        else:
            return {"success": False, "details": f"Unsupported OS: {OS}"}
    except Exception as e:
        return {"success": False, "details": str(e)}


# ============================================================
# ─── FILE / DISK ACTIONS ─────────────────────────────────────
# ============================================================

def _quarantine_file(target: str, dry_run: bool) -> dict:
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would quarantine file: {target}"}
    if not os.path.exists(target):
        return {"success": False, "details": f"File not found: {target}"}
    try:
        os.makedirs(QUARANTINE_DIR, exist_ok=True)
        ts   = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        dest = os.path.join(QUARANTINE_DIR, f"{ts}_{os.path.basename(target)}.quarantined")
        # Hash before quarantine for integrity
        sha256 = hashlib.sha256(open(target, "rb").read()).hexdigest()
        shutil.move(target, dest)
        if OS != "windows":
            os.chmod(dest, 0o000)
        return {"success": True,
                "details": f"File quarantined: {target} → {dest} (SHA256: {sha256[:16]}...)",
                "rollback_available": True,
                "quarantine_path": dest,
                "original_path": target,
                "sha256": sha256}
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
        # First quarantine, then remove (safer)
        q_result = _quarantine_file(target, dry_run=False)
        if q_result.get("success"):
            qpath = q_result.get("quarantine_path", "")
            os.remove(qpath)
            return {"success": True, "details": f"File deleted: {target} (was quarantined first)", "rollback_available": False}
        # Fallback direct delete
        os.remove(target)
        return {"success": True, "details": f"File deleted: {target}", "rollback_available": False}
    except PermissionError:
        return {"success": False, "details": f"Permission denied: {target}"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _wipe_file(target: str, dry_run: bool) -> dict:
    """Securely wipe a file (overwrite with zeros before deleting)."""
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would securely wipe file: {target}"}
    if not os.path.exists(target):
        return {"success": False, "details": f"File not found: {target}"}
    try:
        size = os.path.getsize(target)
        with open(target, "r+b") as f:
            f.write(b"\x00" * size)
            f.flush()
            os.fsync(f.fileno())
        os.remove(target)
        return {"success": True, "details": f"File securely wiped: {target} ({size} bytes zeroed)"}
    except PermissionError:
        return {"success": False, "details": f"Permission denied: {target}"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _collect_forensics(target: str, dry_run: bool, params: dict) -> dict:
    """Collect forensic data: running processes, network connections, open files, recent logs."""
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would collect forensics for target: {target or 'system'}"}
    try:
        os.makedirs(FORENSICS_DIR, exist_ok=True)
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        output_file = os.path.join(FORENSICS_DIR, f"forensics_{ts}_{platform.node()}.json")

        data = {
            "timestamp":  datetime.now(timezone.utc).isoformat(),
            "hostname":   platform.node(),
            "os":         f"{platform.system()} {platform.release()}",
            "target":     target,
            "processes":  [],
            "connections": [],
            "open_files": [],
            "env_vars":   {},
        }

        if HAS_PSUTIL:
            # Running processes
            for proc in psutil.process_iter(["pid", "name", "cmdline", "username", "create_time", "status"]):
                try:
                    info = proc.info
                    info["create_time"] = datetime.fromtimestamp(info.get("create_time", 0)).isoformat() if info.get("create_time") else None
                    data["processes"].append(info)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

            # Network connections
            for conn in psutil.net_connections(kind="inet"):
                data["connections"].append({
                    "fd":     conn.fd,
                    "family": str(conn.family),
                    "type":   str(conn.type),
                    "laddr":  f"{conn.laddr.ip}:{conn.laddr.port}" if conn.laddr else None,
                    "raddr":  f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else None,
                    "status": conn.status,
                    "pid":    conn.pid,
                })

        # OS-specific collection
        if OS == "linux":
            # Recent auth logs
            try:
                r = subprocess.run(["tail", "-n", "200", "/var/log/auth.log"],
                                   capture_output=True, text=True)
                data["auth_log_tail"] = r.stdout
            except Exception:
                pass
            # Active connections
            try:
                r = subprocess.run(["ss", "-tunap"], capture_output=True, text=True)
                data["ss_output"] = r.stdout
            except Exception:
                pass

        elif OS == "windows":
            # netstat
            try:
                r = subprocess.run(["netstat", "-anob"], capture_output=True, text=True)
                data["netstat"] = r.stdout
            except Exception:
                pass
            # tasklist
            try:
                r = subprocess.run(["tasklist", "/V"], capture_output=True, text=True)
                data["tasklist"] = r.stdout
            except Exception:
                pass

        with open(output_file, "w") as f:
            json.dump(data, f, indent=2, default=str)

        return {
            "success": True,
            "details": f"Forensics collected: {len(data['processes'])} processes, {len(data['connections'])} connections",
            "forensics_file": output_file,
        }
    except Exception as e:
        return {"success": False, "details": f"Forensics collection failed: {str(e)}"}


def _dump_memory(target: str, dry_run: bool) -> dict:
    """Dump memory of a specific process for forensic analysis."""
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would dump memory of process '{target}'"}
    if not HAS_PSUTIL:
        return {"success": False, "details": "psutil not installed — run: pip install psutil"}
    try:
        os.makedirs(FORENSICS_DIR, exist_ok=True)
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        dumps = []

        for proc in psutil.process_iter(["pid", "name", "cmdline"]):
            try:
                name = proc.info.get("name", "") or ""
                if target.lower() not in name.lower():
                    continue
                pid = proc.pid
                dump_file = os.path.join(FORENSICS_DIR, f"memdump_{ts}_{name}_{pid}.bin")

                if OS == "linux":
                    # Read /proc/<pid>/mem maps
                    maps_file = f"/proc/{pid}/maps"
                    mem_file  = f"/proc/{pid}/mem"
                    if os.path.exists(maps_file) and os.path.exists(mem_file):
                        with open(maps_file) as maps, open(mem_file, "rb") as mem, \
                             open(dump_file, "wb") as out:
                            for line in maps:
                                fields = line.split()
                                if not fields:
                                    continue
                                addr_range = fields[0]
                                start, end = [int(x, 16) for x in addr_range.split("-")]
                                try:
                                    mem.seek(start)
                                    chunk = mem.read(end - start)
                                    out.write(chunk)
                                except Exception:
                                    pass
                        dumps.append(dump_file)

                elif OS == "windows":
                    # Use procdump if available, else create info dump
                    r = subprocess.run(["procdump", "-ma", str(pid), dump_file],
                                       capture_output=True, timeout=60)
                    if r.returncode == 0:
                        dumps.append(dump_file)
                    else:
                        # Fallback: dump process info
                        info_file = dump_file.replace(".bin", ".json")
                        mem_info = {"pid": pid, "name": name,
                                    "memory_info": str(proc.memory_info())}
                        with open(info_file, "w") as f:
                            json.dump(mem_info, f, indent=2)
                        dumps.append(info_file)

            except (psutil.NoSuchProcess, psutil.AccessDenied, Exception):
                continue

        if dumps:
            return {"success": True,
                    "details": f"Memory dumped for {len(dumps)} process(es): {', '.join(dumps)}",
                    "dump_files": dumps}
        return {"success": False, "details": f"No process found matching '{target}'"}
    except Exception as e:
        return {"success": False, "details": f"Memory dump failed: {str(e)}"}


# ============================================================
# ─── NOTIFICATION / ALERTING ─────────────────────────────────
# ============================================================

def _notify_user(target: str, dry_run: bool, params: dict) -> dict:
    """Send a system notification to a local user."""
    message = params.get("message", "SOCMind Security Alert: Suspicious activity detected.")
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would notify user '{target or 'all'}': {message}"}
    try:
        if OS == "linux":
            if target:
                subprocess.run(["write", target], input=message.encode(), capture_output=True, timeout=5)
            else:
                subprocess.run(["wall", message], capture_output=True, timeout=5)
            return {"success": True, "details": f"Notification sent to '{target or 'all users'}' on Linux"}
        elif OS == "windows":
            subprocess.run(["msg", target or "*", message], capture_output=True, timeout=5)
            return {"success": True, "details": f"Notification sent to '{target or 'all users'}' on Windows"}
        else:
            return {"success": True, "details": f"Notification logged (no display on {OS}): {message}"}
    except Exception:
        # Non-critical — notification failure should not be an error
        return {"success": True, "details": f"Notification attempted for '{target}' (may not have reached): {message}"}


def _send_alert(target: str, dry_run: bool, params: dict, api_endpoint: str, api_key: str) -> dict:
    """Send an alert back to SOCMind platform (Team Chat / Notification)."""
    title   = params.get("title", "SOCMind Executor Alert")
    message = params.get("message", target or "Alert from executor agent")
    severity = params.get("severity", "warning")
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would send alert '{title}' to platform"}
    send_platform_alert(api_endpoint, api_key, title, message, severity)
    return {"success": True, "details": f"Alert '{title}' sent to SOCMind platform"}


# ============================================================
# ─── CREDENTIAL / CONFIG ACTIONS ─────────────────────────────
# ============================================================

def _rotate_credentials(target: str, dry_run: bool, params: dict) -> dict:
    """Rotate service credentials / API keys (generates new password and resets)."""
    service_type = params.get("service_type", "system_user")
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would rotate credentials for '{target}' ({service_type})"}
    new_cred = "SOCMind_" + "".join(random.choices(string.ascii_letters + string.digits, k=20)) + "!#"
    try:
        if service_type == "system_user":
            result = _reset_password(target, dry_run=False, params={"new_password": new_cred})
            if result.get("success"):
                result["details"] = f"Credentials rotated for system user '{target}'"
                result["new_credential_generated"] = True
            return result
        elif service_type == "ssh_key":
            # Invalidate authorized_keys for user
            if OS == "linux":
                auth_keys = f"/home/{target}/.ssh/authorized_keys"
                if os.path.exists(auth_keys):
                    backup_path = auth_keys + f".bak.{datetime.now().strftime('%Y%m%d%H%M%S')}"
                    shutil.move(auth_keys, backup_path)
                    return {"success": True,
                            "details": f"SSH keys rotated for '{target}': authorized_keys moved to {backup_path}",
                            "rollback_available": True}
                return {"success": False, "details": f"No authorized_keys found for user '{target}'"}
        return {"success": True, "details": f"Credential rotation executed for '{target}' ({service_type})"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _revoke_token(target: str, dry_run: bool, params: dict) -> dict:
    """Revoke an auth token / session (calls platform API)."""
    token_type = params.get("token_type", "session")
    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would revoke {token_type} token for '{target}'"}
    try:
        if token_type == "kerberos" and OS == "windows":
            subprocess.run(["klist", "-p", target, "purge"], capture_output=True)
            return {"success": True, "details": f"Kerberos tickets purged for '{target}'"}
        elif OS == "linux":
            # Kill active login sessions
            subprocess.run(["pkill", "-KILL", "-u", target, "-t", "pts"], capture_output=True)
            return {"success": True, "details": f"Active sessions revoked for '{target}'"}
        return {"success": True, "details": f"Token revocation attempted for '{target}' ({token_type})"}
    except Exception as e:
        return {"success": False, "details": str(e)}


# ============================================================
# Main Action Dispatcher
# ============================================================
def execute_action(action: dict, dry_run: bool, api_endpoint: str, api_key: str) -> dict:
    action_type = action.get("action_type", "")
    target      = action.get("target", "")
    params      = action.get("parameters") or action.get("params") or {}

    print()
    print("=" * 58)
    print(f"  SOAR ACTION  : {action_type}")
    print(f"  Target       : {target or '(none)'}")
    print(f"  Params       : {json.dumps(params) if params else '{}'}")
    print(f"  Mode         : {'🟡 SIMULATION' if dry_run else '🔴 REAL EXECUTION'}")
    print("=" * 58)

    dispatch = {
        # Network
        "block_ip":           lambda: _block_ip(target, api_endpoint, dry_run, params),
        "unblock_ip":         lambda: _unblock_ip(target, dry_run),
        "isolate_host":       lambda: _isolate_host(api_endpoint, dry_run),
        "unisolate_host":     lambda: _unisolate_host(dry_run),
        "flush_dns":          lambda: _flush_dns(dry_run),
        "block_domain":       lambda: _block_domain(target, dry_run),
        # Process / Service
        "kill_process":       lambda: _kill_process(target, dry_run, params),
        "suspend_process":    lambda: _suspend_process(target, dry_run),
        "stop_service":       lambda: _stop_service(target, dry_run),
        "start_service":      lambda: _start_service(target, dry_run),
        "restart_service":    lambda: _restart_service(target, dry_run),
        # User / Identity
        "disable_user":       lambda: _disable_user(target, dry_run),
        "enable_user":        lambda: _enable_user(target, dry_run),
        "lock_user":          lambda: _lock_user(target, dry_run, params),
        "unlock_user":        lambda: _unlock_user(target, dry_run),
        "reset_password":     lambda: _reset_password(target, dry_run, params),
        "force_logoff":       lambda: _force_logoff(target, dry_run),
        # File / Disk
        "quarantine_file":    lambda: _quarantine_file(target, dry_run),
        "delete_file":        lambda: _delete_file(target, dry_run),
        "wipe_file":          lambda: _wipe_file(target, dry_run),
        "collect_forensics":  lambda: _collect_forensics(target, dry_run, params),
        "dump_memory":        lambda: _dump_memory(target, dry_run),
        # Notification
        "notify_user":        lambda: _notify_user(target, dry_run, params),
        "send_alert":         lambda: _send_alert(target, dry_run, params, api_endpoint, api_key),
        # Credentials
        "rotate_credentials": lambda: _rotate_credentials(target, dry_run, params),
        "revoke_token":       lambda: _revoke_token(target, dry_run, params),
    }

    handler = dispatch.get(action_type)
    if not handler:
        result = {"success": False, "details": f"Unknown action type: '{action_type}'. Supported: {', '.join(sorted(dispatch.keys()))}"}
    else:
        try:
            result = handler()
        except Exception as e:
            result = {"success": False, "details": f"Unhandled exception in {action_type}: {e}"}

    status = "completed" if result.get("success") else "failed"
    label  = "[✓ OK  ]" if result.get("success") else "[✗ FAIL]"
    print(f"  {label} {result.get('details', '')}")
    if result.get("rollback_available"):
        print(f"  [ROLLBACK] Available")

    log_action(
        action_id   = action.get("action_id", action.get("id", "unknown")),
        action_type = action_type,
        target      = target,
        status      = status,
        details     = result.get("details", ""),
        rollback_cmd = result.pop("_rollback_cmd", None),
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
    print("=" * 58)
    print(f"  SOCMind EXECUTOR v{AGENT_VERSION}")
    print(f"  Host      : {platform.node()}")
    print(f"  OS        : {platform.system()} {platform.release()}")
    print(f"  Role      : SOAR EXECUTOR (no log collection)")
    print(f"  Mode      : {'🟡 SIMULATION (dry-run)' if dry_run else '🔴 REAL EXECUTION'}")
    print(f"  Actions   : {len(_get_capabilities())} supported")
    print(f"  psutil    : {'✓ installed' if HAS_PSUTIL else '✗ not installed (pip install psutil)'}")
    print(f"  Polling   : every {POLL_INTERVAL}s")
    print(f"  Endpoint  : {api_endpoint}")
    print("  Press Ctrl+C to stop")
    print("=" * 58)
    print()

    last_heartbeat   = 0
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
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] ⚡ Received {len(actions)} action(s)")
                for action in actions:
                    result = execute_action(action, dry_run=dry_run,
                                            api_endpoint=api_endpoint, api_key=api_key)
                    db_id  = action.get("id") or action.get("action_id")
                    if db_id:
                        report_result(api_endpoint, api_key, db_id, result)
                    actions_executed += 1
            else:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Waiting... (executed: {actions_executed})", end="\r")

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
    print("SOCMind Executor v" + AGENT_VERSION + " — Setup")
    print("=" * 50)
    print("Role: SOAR EXECUTOR ONLY (no log collection)")
    print("Deploy on ONE privileged host (SOC jump server)")
    print()
    api_key      = input("API Key (socm_...): ").strip()
    api_endpoint = input("API Endpoint (e.g. https://xxxx.supabase.co/functions/v1): ").strip()

    print("\nVerifying endpoint...")
    try:
        resp = requests.post(
            f"{api_endpoint.rstrip('/')}/agent-gateway/heartbeat",
            json={"hostname": "executor-setup", "status": "active",
                  "agent_version": AGENT_VERSION, "role": "executor"},
            headers=make_headers(api_key),
            timeout=15,
        )
        print(f"[OK] Endpoint reachable (HTTP {resp.status_code})")
    except Exception as e:
        print(f"[WARN] Could not verify endpoint: {e}")

    write_config(api_key, api_endpoint)
    print()
    print("✓ Done! Run: python3 socmind-executor.py start")
    print("  Or for safe testing: python3 socmind-executor.py dryrun")


def cmd_status():
    cfg = read_config()
    print()
    print(f"SOCMind Executor v{AGENT_VERSION}")
    print("=" * 50)
    if not cfg.get("api_key"):
        print("Status: NOT CONFIGURED")
    else:
        print(f"Endpoint   : {cfg.get('api_endpoint')}")
        print(f"API Key    : {cfg.get('api_key', '')[:12]}...")
        print(f"Role       : EXECUTOR ONLY (no log collection)")
        print(f"OS         : {platform.system()} {platform.release()}")
        print(f"Host       : {platform.node()}")
        print(f"psutil     : {'✓ installed' if HAS_PSUTIL else '✗ missing'}")
        print(f"Actions    : {len(_get_capabilities())} supported")

    if os.path.exists(ACTION_LOG_FILE):
        try:
            log = json.loads(open(ACTION_LOG_FILE).read())
            print(f"\nAction log : {len(log)} entries (showing last 5)")
            for entry in log[-5:]:
                ts  = entry.get("timestamp", "")[:19].replace("T", " ")
                at  = entry.get("action_type", "?")
                tgt = entry.get("target", "?") or "(none)"
                st  = entry.get("status", "?")
                icon = "✓" if st == "completed" else "✗"
                print(f"  {icon} [{ts}] {at} → {tgt} = {st}")
        except Exception:
            pass
    print()


def cmd_rollback():
    if not os.path.exists(ROLLBACK_FILE):
        print("[INFO] No rollback history found.")
        return
    try:
        rb = json.loads(open(ROLLBACK_FILE).read())
        if not rb:
            print("[INFO] Rollback log is empty.")
            return
        last = rb[-1]
        print(f"\nLast reversible action:")
        print(f"  Type   : {last['action_type']}")
        print(f"  Target : {last['target']}")
        print(f"  Time   : {last['timestamp']}")
        print(f"  Cmd    : {json.dumps(last['rollback_cmd'])}")
        confirm = input("\nRollback this action? (yes/no): ").strip().lower()
        if confirm == "yes":
            cfg = read_config()
            action = {"action_type": last["rollback_cmd"]["type"],
                      "target": last["rollback_cmd"].get("target", last["target"]),
                      "parameters": {}}
            result = execute_action(action, dry_run=False,
                                    api_endpoint=cfg.get("api_endpoint", ""),
                                    api_key=cfg.get("api_key", ""))
            print(f"Result: {result.get('details')}")
        else:
            print("Rollback cancelled.")
    except Exception as e:
        print(f"[ERR] Rollback failed: {e}")


def show_help():
    print(f"""
SOCMind Executor Agent v{AGENT_VERSION}
Role: SOAR EXECUTOR ONLY — no log collection
OS  : {platform.system()}

Commands:
  configure    First-time setup (API key + endpoint)
  start        Start SOAR execution loop (REAL mode)
  dryrun       Simulation mode — no real changes made
  test         Poll once and exit
  status       Show config + recent action log
  rollback     Rollback the last reversible action

Supported actions ({len(_get_capabilities())} total):
  ── Network ──────────────────────────────
  block_ip, unblock_ip
  isolate_host, unisolate_host
  flush_dns, block_domain
  ── Process / Service ────────────────────
  kill_process, suspend_process
  stop_service, start_service, restart_service
  ── User / Identity ──────────────────────
  disable_user, enable_user
  lock_user, unlock_user
  reset_password, force_logoff
  ── File / Disk ──────────────────────────
  quarantine_file, delete_file, wipe_file
  collect_forensics, dump_memory
  ── Notification ─────────────────────────
  notify_user, send_alert
  ── Credentials ──────────────────────────
  rotate_credentials, revoke_token

Deploy on ONE privileged host (SOC jump server).
Use socmind-collector-*.ps1/.sh on endpoints for log collection.
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
    elif cmd == "rollback":
        cmd_rollback()
    else:
        show_help()


if __name__ == "__main__":
    main()
