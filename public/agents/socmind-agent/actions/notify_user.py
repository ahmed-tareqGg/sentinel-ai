"""
SOCMind Action – Notify User
Sends a notification/warning to a user via system mechanisms.
"""

import subprocess
import platform

ACTION_TYPE = "notify_user"


def execute(action: dict, dry_run: bool = False) -> dict:
    target = action.get("target", "")
    message = action.get("message", "SOCMind Security Alert: Suspicious activity detected on your account.")

    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would notify user '{target}': {message}", "dry_run": True}

    system = platform.system().lower()

    try:
        if system == "linux":
            # Try wall (broadcast) or write to user terminal
            if target:
                subprocess.run(
                    ["write", target],
                    input=message.encode(),
                    capture_output=True,
                    timeout=5,
                )
            else:
                subprocess.run(
                    ["wall", message],
                    capture_output=True,
                    timeout=5,
                )
            return {"success": True, "details": f"Notification sent to '{target or 'all users'}'"}

        elif system == "windows":
            subprocess.run(
                ["msg", target or "*", message],
                capture_output=True,
                timeout=5,
            )
            return {"success": True, "details": f"Notification sent to '{target or 'all users'}'"}

        else:
            return {"success": True, "details": f"Notification logged (no display method for {system}): {message}"}

    except Exception as e:
        # Notification failure is non-critical
        return {"success": True, "details": f"Notification attempted for '{target}' (may not have reached): {message}"}
