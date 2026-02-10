"""
SOCMind Action – Kill Process
Terminates a process by name or PID.
"""

import platform

ACTION_TYPE = "kill_process"

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False


def execute(action: dict, dry_run: bool = False) -> dict:
    target = action.get("target", "")
    if not target:
        return {"success": False, "details": "No target process specified"}

    if dry_run:
        return {"success": True, "details": f"DRY-RUN: Would kill process '{target}'", "dry_run": True}

    if not HAS_PSUTIL:
        # Fallback to OS commands
        import subprocess
        system = platform.system().lower()
        try:
            if system == "linux":
                result = subprocess.run(["pkill", "-f", target], capture_output=True)
                if result.returncode == 0:
                    return {"success": True, "details": f"Killed process: {target}"}
                return {"success": False, "details": f"No process found: {target}"}
            elif system == "windows":
                result = subprocess.run(["taskkill", "/F", "/IM", target], capture_output=True)
                if result.returncode == 0:
                    return {"success": True, "details": f"Killed process: {target}"}
                return {"success": False, "details": f"No process found: {target}"}
        except Exception as e:
            return {"success": False, "details": str(e)}

    # Use psutil for cross-platform process killing
    killed = 0
    for proc in psutil.process_iter(["pid", "name", "cmdline"]):
        try:
            name = proc.info.get("name", "")
            cmdline = " ".join(proc.info.get("cmdline") or [])
            if target.lower() in name.lower() or target.lower() in cmdline.lower():
                proc.kill()
                killed += 1
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    if killed > 0:
        return {"success": True, "details": f"Killed {killed} process(es) matching '{target}'"}
    return {"success": False, "details": f"No process found matching '{target}'"}
