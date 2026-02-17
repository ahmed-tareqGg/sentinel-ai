"""
SOCMind Action – Isolate Host (Production-Grade)
Cuts off all network traffic EXCEPT:
  1. SOCMind platform communication (so the agent stays connected)
  2. DNS (so the agent can resolve the platform domain)
  3. Loopback traffic

This mimics how real EDR agents (CrowdStrike, SentinelOne, Defender) isolate endpoints
while maintaining their own management channel.
"""

import subprocess
import platform
import socket
import json
import os

ACTION_TYPE = "isolate_host"

# File to persist isolation state for rollback
ISOLATION_STATE_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    ".isolation_state.json",
)


def _resolve_platform_ip(action: dict) -> str | None:
    """Resolve the SOCMind platform IP for whitelisting."""
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


def _isolate_linux(platform_ip: str | None, dns_servers: list) -> dict:
    """Isolate using iptables with agent whitelist."""
    try:
        # Save current iptables rules for rollback
        backup = subprocess.run(
            ["iptables-save"], capture_output=True, text=True
        )

        state = {
            "os": "linux",
            "iptables_backup": backup.stdout,
            "platform_ip": platform_ip,
            "isolated_at": __import__("datetime").datetime.now().isoformat(),
        }

        # Flush existing rules (we rebuild from scratch)
        subprocess.run(["iptables", "-F"], check=True, capture_output=True)

        # 1. Allow loopback
        subprocess.run(["iptables", "-A", "INPUT", "-i", "lo", "-j", "ACCEPT"], check=True, capture_output=True)
        subprocess.run(["iptables", "-A", "OUTPUT", "-o", "lo", "-j", "ACCEPT"], check=True, capture_output=True)

        # 2. Allow established/related connections (keeps current agent session alive)
        subprocess.run(
            ["iptables", "-A", "INPUT", "-m", "state", "--state", "ESTABLISHED,RELATED", "-j", "ACCEPT"],
            check=True, capture_output=True,
        )
        subprocess.run(
            ["iptables", "-A", "OUTPUT", "-m", "state", "--state", "ESTABLISHED,RELATED", "-j", "ACCEPT"],
            check=True, capture_output=True,
        )

        # 3. Allow DNS (UDP 53) so agent can resolve platform domain
        for dns in dns_servers:
            subprocess.run(
                ["iptables", "-A", "OUTPUT", "-p", "udp", "-d", dns, "--dport", "53", "-j", "ACCEPT"],
                check=True, capture_output=True,
            )
            subprocess.run(
                ["iptables", "-A", "INPUT", "-p", "udp", "-s", dns, "--sport", "53", "-j", "ACCEPT"],
                check=True, capture_output=True,
            )

        # 4. Allow SOCMind platform communication (HTTPS 443)
        if platform_ip:
            subprocess.run(
                ["iptables", "-A", "OUTPUT", "-p", "tcp", "-d", platform_ip, "--dport", "443", "-j", "ACCEPT"],
                check=True, capture_output=True,
            )
            subprocess.run(
                ["iptables", "-A", "INPUT", "-p", "tcp", "-s", platform_ip, "--sport", "443", "-j", "ACCEPT"],
                check=True, capture_output=True,
            )

        # 5. Drop everything else
        subprocess.run(["iptables", "-A", "INPUT", "-j", "DROP"], check=True, capture_output=True)
        subprocess.run(["iptables", "-A", "OUTPUT", "-j", "DROP"], check=True, capture_output=True)

        # Persist state
        with open(ISOLATION_STATE_FILE, "w") as f:
            json.dump(state, f)

        return {
            "success": True,
            "details": f"Host ISOLATED via iptables. Whitelisted: platform={platform_ip}, DNS={dns_servers}, loopback. All other traffic DROPPED.",
            "rollback_available": True,
        }

    except subprocess.CalledProcessError as e:
        return {"success": False, "details": f"iptables command failed: {e.stderr.decode() if e.stderr else str(e)}"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _isolate_windows(platform_ip: str | None, dns_servers: list) -> dict:
    """Isolate using Windows Firewall with agent whitelist."""
    try:
        state = {
            "os": "windows",
            "platform_ip": platform_ip,
            "isolated_at": __import__("datetime").datetime.now().isoformat(),
        }

        # Export current firewall rules for rollback
        backup_path = os.path.join(
            os.path.dirname(ISOLATION_STATE_FILE),
            ".fw_backup.wfw",
        )
        subprocess.run(
            ["netsh", "advfirewall", "export", backup_path],
            capture_output=True,
        )
        state["fw_backup_path"] = backup_path

        # Block ALL inbound and outbound by default
        subprocess.run(
            ["netsh", "advfirewall", "set", "allprofiles", "firewallpolicy", "blockinbound,blockoutbound"],
            check=True, capture_output=True,
        )

        # Allow SOCMind platform
        if platform_ip:
            subprocess.run(
                ["netsh", "advfirewall", "firewall", "add", "rule",
                 "name=SOCMind Agent Outbound", "dir=out", "action=allow",
                 f"remoteip={platform_ip}", "protocol=tcp", "remoteport=443"],
                check=True, capture_output=True,
            )
            subprocess.run(
                ["netsh", "advfirewall", "firewall", "add", "rule",
                 "name=SOCMind Agent Inbound", "dir=in", "action=allow",
                 f"remoteip={platform_ip}", "protocol=tcp"],
                check=True, capture_output=True,
            )

        # Allow DNS
        for dns in dns_servers:
            subprocess.run(
                ["netsh", "advfirewall", "firewall", "add", "rule",
                 "name=SOCMind DNS Allow", "dir=out", "action=allow",
                 f"remoteip={dns}", "protocol=udp", "remoteport=53"],
                check=True, capture_output=True,
            )

        # Allow loopback
        subprocess.run(
            ["netsh", "advfirewall", "firewall", "add", "rule",
             "name=SOCMind Loopback", "dir=out", "action=allow",
             "remoteip=127.0.0.1"],
            check=True, capture_output=True,
        )

        with open(ISOLATION_STATE_FILE, "w") as f:
            json.dump(state, f)

        return {
            "success": True,
            "details": f"Host ISOLATED via Windows Firewall. Whitelisted: platform={platform_ip}, DNS={dns_servers}. All other traffic BLOCKED.",
            "rollback_available": True,
        }

    except subprocess.CalledProcessError as e:
        return {"success": False, "details": f"Firewall command failed: {e.stderr.decode() if e.stderr else str(e)}"}
    except Exception as e:
        return {"success": False, "details": str(e)}


def _get_dns_servers() -> list:
    """Get system DNS servers."""
    dns_servers = []
    system = platform.system().lower()

    if system == "linux":
        try:
            with open("/etc/resolv.conf", "r") as f:
                for line in f:
                    if line.strip().startswith("nameserver"):
                        dns_servers.append(line.strip().split()[1])
        except Exception:
            pass

    if system == "windows":
        try:
            result = subprocess.run(
                ["powershell", "-Command",
                 "Get-DnsClientServerAddress -AddressFamily IPv4 | Select-Object -ExpandProperty ServerAddresses"],
                capture_output=True, text=True, timeout=10,
            )
            for line in result.stdout.strip().split("\n"):
                ip = line.strip()
                if ip:
                    dns_servers.append(ip)
        except Exception:
            pass

    # Fallback: common DNS
    if not dns_servers:
        dns_servers = ["8.8.8.8", "8.8.4.4"]

    return dns_servers[:4]  # Limit to 4


def execute(action: dict, dry_run: bool = False) -> dict:
    # Resolve platform IP for whitelisting
    platform_ip = _resolve_platform_ip(action)
    dns_servers = _get_dns_servers()

    if dry_run:
        return {
            "success": True,
            "details": (
                f"DRY-RUN: Would isolate host. "
                f"Whitelist: platform={platform_ip}, DNS={dns_servers}, loopback. "
                f"All other traffic would be DROPPED."
            ),
            "dry_run": True,
        }

    system = platform.system().lower()

    if system == "linux":
        return _isolate_linux(platform_ip, dns_servers)
    elif system == "windows":
        return _isolate_windows(platform_ip, dns_servers)
    else:
        return {"success": False, "details": f"Unsupported OS: {system}"}
