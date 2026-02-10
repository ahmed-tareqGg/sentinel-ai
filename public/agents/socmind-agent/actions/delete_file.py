"""
SOCMind Action – Delete File
Removes a file from the filesystem (with optional quarantine).
"""

import os
import shutil
from datetime import datetime, timezone

ACTION_TYPE = "delete_file"

QUARANTINE_DIR = "/var/socmind/quarantine"


def execute(action: dict, dry_run: bool = False) -> dict:
    target = action.get("target", "")
    quarantine_first = action.get("quarantine", True)

    if not target:
        return {"success": False, "details": "No target file specified"}

    if not os.path.exists(target):
        return {"success": False, "details": f"File not found: {target}"}

    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would delete file {target}", "dry_run": True}

    try:
        if quarantine_first:
            os.makedirs(QUARANTINE_DIR, exist_ok=True)
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            basename = os.path.basename(target)
            quarantine_path = os.path.join(QUARANTINE_DIR, f"{timestamp}_{basename}.quarantined")
            shutil.move(target, quarantine_path)
            os.chmod(quarantine_path, 0o000)
            return {
                "success": True,
                "details": f"File quarantined: {target} -> {quarantine_path}",
                "rollback_available": True,
            }
        else:
            os.remove(target)
            return {
                "success": True,
                "details": f"File deleted: {target}",
                "rollback_available": False,
            }

    except PermissionError:
        return {"success": False, "details": f"Permission denied: {target}"}
    except Exception as e:
        return {"success": False, "details": str(e)}
