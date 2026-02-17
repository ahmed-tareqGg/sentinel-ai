"""
SOCMind Action – Block IP (Production-Grade)
Blocks an IP address using iptables (Linux) or netsh (Windows).

Safety features:
  - Never blocks the machine's own IPs (loopback, local interfaces)
  - Never blocks the SOCMind platform endpoint
  - Validates target is a real IP address
  - Supports rollback
"""

import subprocess
import platform
import socket
import re

ACTION_TYPE = "block_ip"

# Reserved / protected ranges that should NEVER be blocked
NEVER_BLOCK = {
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "255.255.255.255",
}


def _get_local_ips() -> set:
    """Return all IP addresses assigned to this machine."""
    local_ips = set(NEVER_BLOCK)
    try:
        hostname = socket.gethostname()
        # All IPs associated with hostname
        for info in socket.getaddrinfo(hostname, None):
            local_ips.add(info[4][0])
        # Also try getting the default outbound IP
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            local_ips.add(s.getsockname()[0])
    except Exception:
        pass

    # Linux: parse ip addr
    if platform.system().lower() == "linux":
        try:
            result = subprocess.run(
                ["ip", "-4", "addr", "show"],
                capture_output=True, text=True, timeout=5,
            )
            for match in re.findall(r"inet\s+(\d+\.\d+\.\d+\.\d+)", result.stdout):
                local_ips.add(match)
        except Exception:
            pass

    # Windows: parse ipconfig
    if platform.system().lower() == "windows":
        try:
            result = subprocess.run(
                ["ipconfig"],
                capture_output=True, text=True, timeout=5,
            )
            for match in re.findall(r"(\d+\.\d+\.\d+\.\d+)", result.stdout):
                local_ips.add(match)
        except Exception:
            pass

    return local_ips


def _get_platform_ip(action: dict) -> str | None:
    """Extract the SOCMind platform IP so we never block our own C2."""
    endpoint = action.get("platform_endpoint", "")
    if endpoint:
        try:
            from urllib.parse import urlparse
            host = urlparse(endpoint).hostname
            if host:
                return socket.gethostbyname(host)
        except Exception:
            pass
    return None


def _is_valid_ip(ip: str) -> bool:
    """Basic IPv4 validation."""
    parts = ip.strip().split(".")
    if len(parts) != 4:
        return False
    return all(p.isdigit() and 0 <= int(p) <= 255 for p in parts)


def execute(action: dict, dry_run: bool = False) -> dict:
    target = action.get("target", "").strip()

    # ── Validation ──
    if not target:
        return {"success": False, "details": "No target IP specified"}

    if not _is_valid_ip(target):
        return {"success": False, "details": f"Invalid IP address: {target}"}

    # ── Self-protection: never block own IPs ──
    local_ips = _get_local_ips()
    if target in local_ips:
        return {
            "success": False,
            "details": f"BLOCKED: {target} is a local interface IP. Blocking it would cut off this machine.",
            "safety_block": True,
        }

    # ── Platform protection: never block SOCMind endpoint ──
    platform_ip = _get_platform_ip(action)
    if platform_ip and target == platform_ip:
        return {
            "success": False,
            "details": f"BLOCKED: {target} resolves to the SOCMind platform. Blocking it would disconnect the agent.",
            "safety_block": True,
        }

    # ── Gateway IP protection ──
    gateway_ip = action.get("gateway_ip", "")
    if gateway_ip and target == gateway_ip:
        return {
            "success": False,
            "details": f"BLOCKED: {target} is the default gateway. Blocking it would isolate this machine from the network.",
            "safety_block": True,
        }

    # ── Dry run ──
    if dry_run:
        return {
            "success": True,
            "details": f"DRY-RUN: Would block IP {target} (validated: not self, not platform, not gateway)",
            "dry_run": True,
        }

    # ── Execute ──
    system = platform.system().lower()

    try:
        if system == "linux":
            # Block inbound and outbound
            subprocess.run(
                ["iptables", "-A", "INPUT", "-s", target, "-j", "DROP"],
                check=True, capture_output=True,
            )
            subprocess.run(
                ["iptables", "-A", "OUTPUT", "-d", target, "-j", "DROP"],
                check=True, capture_output=True,
            )
            return {
                "success": True,
                "details": f"Blocked IP {target} via iptables (INPUT+OUTPUT DROP)",
                "rollback_available": True,
            }

        elif system == "windows":
            subprocess.run(
                ["netsh", "advfirewall", "firewall", "add", "rule",
                 f"name=SOCMind Block {target}", "dir=in",
                 f"remoteip={target}", "action=block"],
                check=True, capture_output=True,
            )
            subprocess.run(
                ["netsh", "advfirewall", "firewall", "add", "rule",
                 f"name=SOCMind Block {target}", "dir=out",
                 f"remoteip={target}", "action=block"],
                check=True, capture_output=True,
            )
            return {
                "success": True,
                "details": f"Blocked IP {target} via Windows Firewall (in+out)",
                "rollback_available": True,
            }

        else:
            return {"success": False, "details": f"Unsupported OS: {system}"}

    except subprocess.CalledProcessError as e:
        return {"success": False, "details": f"Command failed: {e.stderr.decode() if e.stderr else str(e)}"}
    except Exception as e:
        return {"success": False, "details": str(e)}
