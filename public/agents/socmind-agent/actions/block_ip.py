"""
SOCMind Action – Block IP
Blocks an IP address using iptables (Linux) or netsh (Windows).
"""

import subprocess
import platform

ACTION_TYPE = "block_ip"


def execute(action: dict, dry_run: bool = False) -> dict:
    target = action.get("target", "")
    if not target:
        return {"success": False, "details": "No target IP specified"}

    if dry_run:
        return {
            "success": True,
            "details": f"DRY-RUN: Would block IP {target}",
            "dry_run": True,
        }

    system = platform.system().lower()

    try:
        if system == "linux":
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
            return {
                "success": True,
                "details": f"Blocked IP {target} via Windows Firewall",
                "rollback_available": True,
            }

        else:
            return {"success": False, "details": f"Unsupported OS: {system}"}

    except subprocess.CalledProcessError as e:
        return {"success": False, "details": f"Command failed: {e.stderr.decode() if e.stderr else str(e)}"}
    except Exception as e:
        return {"success": False, "details": str(e)}
