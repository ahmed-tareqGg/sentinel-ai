"""
SOCMind Action – Unblock IP
Removes IP block rules from iptables (Linux) or netsh (Windows).
"""

import subprocess
import platform

ACTION_TYPE = "unblock_ip"


def execute(action: dict, dry_run: bool = False) -> dict:
    target = action.get("target", "")
    if not target:
        return {"success": False, "details": "No target IP specified"}

    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would unblock IP {target}", "dry_run": True}

    system = platform.system().lower()

    try:
        if system == "linux":
            subprocess.run(["iptables", "-D", "INPUT", "-s", target, "-j", "DROP"], capture_output=True)
            subprocess.run(["iptables", "-D", "OUTPUT", "-d", target, "-j", "DROP"], capture_output=True)
            return {"success": True, "details": f"Unblocked IP {target}"}

        elif system == "windows":
            subprocess.run(
                ["netsh", "advfirewall", "firewall", "delete", "rule",
                 f"name=SOCMind Block {target}"],
                capture_output=True,
            )
            return {"success": True, "details": f"Unblocked IP {target} from Windows Firewall"}

        else:
            return {"success": False, "details": f"Unsupported OS: {system}"}

    except Exception as e:
        return {"success": False, "details": str(e)}
