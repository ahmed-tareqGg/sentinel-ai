"""
SOCMind Action – Unisolate Host (Rollback)
Restores network connectivity by reverting iptables/firewall to pre-isolation state.
"""

import subprocess
import platform
import json
import os

ACTION_TYPE = "unisolate_host"

ISOLATION_STATE_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    ".isolation_state.json",
)


def execute(action: dict, dry_run: bool = False) -> dict:
    if not os.path.exists(ISOLATION_STATE_FILE):
        return {"success": False, "details": "No isolation state found. Host may not be isolated."}

    with open(ISOLATION_STATE_FILE, "r") as f:
        state = json.load(f)

    if dry_run:
        return {
            "success": True,
            "details": f"DRY-RUN: Would restore network from isolation (isolated at {state.get('isolated_at', 'unknown')})",
            "dry_run": True,
        }

    system = platform.system().lower()

    try:
        if system == "linux":
            backup = state.get("iptables_backup", "")
            if backup:
                # Restore from saved rules
                proc = subprocess.run(
                    ["iptables-restore"],
                    input=backup, text=True,
                    capture_output=True,
                )
                if proc.returncode != 0:
                    # Fallback: just flush all rules
                    subprocess.run(["iptables", "-F"], capture_output=True)
                    subprocess.run(["iptables", "-P", "INPUT", "ACCEPT"], capture_output=True)
                    subprocess.run(["iptables", "-P", "OUTPUT", "ACCEPT"], capture_output=True)
            else:
                subprocess.run(["iptables", "-F"], capture_output=True)
                subprocess.run(["iptables", "-P", "INPUT", "ACCEPT"], capture_output=True)
                subprocess.run(["iptables", "-P", "OUTPUT", "ACCEPT"], capture_output=True)

        elif system == "windows":
            fw_backup = state.get("fw_backup_path", "")
            if fw_backup and os.path.exists(fw_backup):
                subprocess.run(
                    ["netsh", "advfirewall", "import", fw_backup],
                    check=True, capture_output=True,
                )
            else:
                # Reset to defaults
                subprocess.run(
                    ["netsh", "advfirewall", "set", "allprofiles", "firewallpolicy",
                     "blockinbound,allowoutbound"],
                    capture_output=True,
                )
                # Remove SOCMind isolation rules
                for name in ["SOCMind Agent Outbound", "SOCMind Agent Inbound",
                             "SOCMind DNS Allow", "SOCMind Loopback"]:
                    subprocess.run(
                        ["netsh", "advfirewall", "firewall", "delete", "rule", f"name={name}"],
                        capture_output=True,
                    )
        else:
            return {"success": False, "details": f"Unsupported OS: {system}"}

        # Clean up state file
        os.remove(ISOLATION_STATE_FILE)

        return {
            "success": True,
            "details": f"Host UNISOLATED. Network connectivity restored (was isolated at {state.get('isolated_at', 'unknown')}).",
        }

    except Exception as e:
        return {"success": False, "details": f"Unisolation failed: {str(e)}"}
