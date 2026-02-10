"""
SOCMind Action – Lock User Account
Temporarily disables a user account on the local system.
"""

import subprocess
import platform
import threading

ACTION_TYPE = "lock_user"


def execute(action: dict, dry_run: bool = False) -> dict:
    target = action.get("target", "")
    duration = action.get("duration_seconds", action.get("duration", 0))
    if not target:
        return {"success": False, "details": "No target user specified"}

    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would lock user '{target}' for {duration}s", "dry_run": True}

    system = platform.system().lower()

    try:
        if system == "linux":
            subprocess.run(["passwd", "-l", target], check=True, capture_output=True)
            details = f"User '{target}' locked"
            rollback = True

            if duration and int(duration) > 0:
                # Schedule auto-unlock
                def auto_unlock():
                    import time
                    time.sleep(int(duration))
                    subprocess.run(["passwd", "-u", target], capture_output=True)
                    print(f"[ACTION] Auto-unlocked user '{target}'")

                t = threading.Thread(target=auto_unlock, daemon=True)
                t.start()
                details += f" (auto-unlock in {duration}s)"

            return {"success": True, "details": details, "rollback_available": rollback}

        elif system == "windows":
            subprocess.run(
                ["net", "user", target, "/active:no"],
                check=True, capture_output=True,
            )
            details = f"User '{target}' disabled"

            if duration and int(duration) > 0:
                def auto_enable():
                    import time
                    time.sleep(int(duration))
                    subprocess.run(["net", "user", target, "/active:yes"], capture_output=True)
                    print(f"[ACTION] Auto-enabled user '{target}'")

                t = threading.Thread(target=auto_enable, daemon=True)
                t.start()
                details += f" (auto-enable in {duration}s)"

            return {"success": True, "details": details, "rollback_available": True}

        else:
            return {"success": False, "details": f"Unsupported OS: {system}"}

    except subprocess.CalledProcessError as e:
        return {"success": False, "details": f"Failed: {e.stderr.decode() if e.stderr else str(e)}"}
    except Exception as e:
        return {"success": False, "details": str(e)}
