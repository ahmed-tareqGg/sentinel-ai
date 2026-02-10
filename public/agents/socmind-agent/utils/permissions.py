"""
SOCMind Agent – Permissions Manager
Validates that the agent has required OS permissions for actions.
"""

import os
import platform
import subprocess


def check_root() -> bool:
    """Check if the agent is running with root/admin privileges."""
    system = platform.system().lower()

    if system == "linux":
        return os.geteuid() == 0
    elif system == "windows":
        try:
            import ctypes
            return ctypes.windll.shell32.IsUserAnAdmin() != 0
        except Exception:
            return False
    return False


def check_action_permission(action_type: str) -> dict:
    """
    Check if the current user has permission to execute a specific action.
    Returns a dict with 'allowed' and 'reason'.
    """
    requires_root = [
        "block_ip", "unblock_ip", "kill_process", "lock_user",
        "delete_file", "quarantine_file", "stop_service", "start_service",
        "isolate_host", "unisolate_host",
    ]

    no_root_needed = [
        "notify_user", "log",
    ]

    if action_type in no_root_needed:
        return {"allowed": True, "reason": "No elevated permissions required"}

    if action_type in requires_root:
        if check_root():
            return {"allowed": True, "reason": "Running with elevated privileges"}
        else:
            return {
                "allowed": False,
                "reason": f"Action '{action_type}' requires root/admin privileges. "
                          f"Run the agent with sudo (Linux) or as Administrator (Windows).",
            }

    return {"allowed": True, "reason": "Unknown action — allowing by default"}


def validate_environment() -> list:
    """
    Validate that the agent environment is properly configured.
    Returns a list of warnings.
    """
    warnings = []
    system = platform.system().lower()

    if not check_root():
        warnings.append("Agent is NOT running as root/admin — some actions will fail")

    if system == "linux":
        # Check iptables
        try:
            subprocess.run(["which", "iptables"], check=True, capture_output=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            warnings.append("iptables not found — IP blocking will not work")

        # Check systemctl
        try:
            subprocess.run(["which", "systemctl"], check=True, capture_output=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            warnings.append("systemctl not found — service management will not work")

    elif system == "windows":
        # Check netsh
        try:
            subprocess.run(["where", "netsh"], check=True, capture_output=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            warnings.append("netsh not found — firewall management will not work")

    return warnings
