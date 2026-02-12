#!/usr/bin/env python3
"""
SOCMind Universal Agent v3.0.0 – Production-Ready Entry Point
Copyright (c) 2025 SOCMind. All rights reserved.
Contact: security@socmind.ai

Capabilities:
  - Log Collector
  - Action Executor
  - Playbook Runner
  - Approval-aware
  - Full Audit Trail
"""

import argparse
import sys
import os
import signal
import time
import yaml
import threading

# Add agent root to path
AGENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AGENT_DIR)

from core.collector import LogCollector
from core.executor import ActionExecutor
from core.heartbeat import HeartbeatService
from core.playbook_engine import PlaybookEngine
from core.approval_client import ApprovalClient
from core.audit_logger import AuditLogger

AGENT_VERSION = "3.0.0"
BANNER = f"""
╔══════════════════════════════════════════════╗
║       SOCMind Universal Agent v{AGENT_VERSION}         ║
║  Collector | Executor | Playbooks | SOAR     ║
╚══════════════════════════════════════════════╝
"""


def load_config(config_path: str) -> dict:
    """Load agent configuration from YAML file."""
    if not os.path.exists(config_path):
        print(f"[ERROR] Config file not found: {config_path}")
        sys.exit(1)
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def cmd_configure(args):
    """Interactive configuration wizard."""
    print(BANNER)
    print("[CONFIG] SOCMind Agent Configuration Wizard\n")

    config_path = os.path.join(AGENT_DIR, "config.yaml")

    api_endpoint = input("  API Endpoint (https://...): ").strip()
    api_key = input("  API Key (socm_...): ").strip()
    license_key = input("  License Key (SOCM-XXXX-XXXX-XXXX-XXXX): ").strip()

    if not all([api_endpoint, api_key, license_key]):
        print("[FATAL] All fields are required!")
        sys.exit(1)

    mode = input("  Mode [executor/collector] (default: executor): ").strip() or "executor"

    config = {
        "agent": {
            "version": AGENT_VERSION,
            "mode": mode,
            "log_level": "INFO",
        },
        "api": {
            "endpoint": api_endpoint,
            "key": api_key,
            "license_key": license_key,
        },
        "collector": {
            "interval_seconds": 60,
            "max_lines_per_source": 50,
            "sources": [
                "/var/log/auth.log",
                "/var/log/syslog",
                "/var/log/secure",
                "/var/log/messages",
            ],
        },
        "executor": {
            "poll_interval_seconds": 10,
            "dry_run": False,
            "allowed_actions": [
                "block_ip",
                "unblock_ip",
                "kill_process",
                "lock_user",
                "delete_file",
                "quarantine_file",
                "stop_service",
                "start_service",
                "isolate_host",
                "unisolate_host",
                "notify_user",
            ],
        },
        "heartbeat": {
            "interval_seconds": 30,
        },
        "playbooks": {
            "enabled": True,
            "directory": os.path.join(AGENT_DIR, "playbooks"),
        },
        "audit": {
            "local_log_path": os.path.join(AGENT_DIR, "audit.log"),
            "send_to_platform": True,
        },
    }

    with open(config_path, "w") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)

    print(f"\n[OK] Configuration saved to {config_path}")
    print("[OK] Run 'python3 agent.py run' to start the agent.")


def cmd_run(args):
    """Start the agent in full operational mode."""
    print(BANNER)

    config_path = args.config or os.path.join(AGENT_DIR, "config.yaml")
    config = load_config(config_path)

    if args.dry_run:
        config.setdefault("executor", {})["dry_run"] = True
        print("[MODE] DRY-RUN — no real actions will be executed\n")
    else:
        print("[MODE] LIVE — actions will be executed on this machine\n")

    # Initialize components
    audit = AuditLogger(config)
    approval = ApprovalClient(config)
    heartbeat = HeartbeatService(config, AGENT_VERSION)
    collector = LogCollector(config, audit)
    executor = ActionExecutor(config, audit, approval)
    playbook_engine = PlaybookEngine(config, executor, audit)

    # Wire playbook engine into the collector for local event evaluation
    collector.playbook_engine = playbook_engine

    # Graceful shutdown
    shutdown_event = threading.Event()

    def signal_handler(sig, frame):
        print("\n[INFO] Shutting down gracefully...")
        shutdown_event.set()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Start heartbeat thread
    heartbeat_thread = threading.Thread(
        target=heartbeat.run, args=(shutdown_event,), daemon=True
    )
    heartbeat_thread.start()

    # Start collector thread
    collector_thread = threading.Thread(
        target=collector.run, args=(shutdown_event,), daemon=True
    )
    collector_thread.start()

    # Start executor thread (polls for SOAR actions)
    executor_thread = threading.Thread(
        target=executor.run, args=(shutdown_event,), daemon=True
    )
    executor_thread.start()

    # Start playbook engine thread
    playbook_thread = threading.Thread(
        target=playbook_engine.run, args=(shutdown_event,), daemon=True
    )
    playbook_thread.start()

    print("[INFO] All services started. Press Ctrl+C to stop.\n")

    # Main loop — wait for shutdown
    while not shutdown_event.is_set():
        shutdown_event.wait(timeout=1)

    print("[INFO] Agent stopped.")


def cmd_status(args):
    """Show current agent status."""
    print(BANNER)
    config_path = args.config or os.path.join(AGENT_DIR, "config.yaml")

    if not os.path.exists(config_path):
        print("[STATUS] NOT CONFIGURED — run 'python3 agent.py configure'")
        return

    config = load_config(config_path)
    api = config.get("api", {})

    print(f"  Endpoint:  {api.get('endpoint', 'N/A')}")
    print(f"  API Key:   {api.get('key', '')[:12]}...")
    print(f"  License:   {api.get('license_key', '')[:9]}...")
    print(f"  Mode:      {config.get('agent', {}).get('mode', 'executor')}")
    print(f"  Dry Run:   {config.get('executor', {}).get('dry_run', False)}")
    print(f"  Playbooks: {config.get('playbooks', {}).get('enabled', False)}")

    audit_path = config.get("audit", {}).get("local_log_path", "")
    if os.path.exists(audit_path):
        with open(audit_path) as f:
            lines = f.readlines()
        print(f"\n  Recent Audit Entries ({len(lines)} total):")
        for line in lines[-5:]:
            print(f"    {line.strip()}")


def main():
    parser = argparse.ArgumentParser(
        prog="socmind-agent",
        description="SOCMind Universal Agent – Collector + Executor + Playbooks",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # configure
    subparsers.add_parser("configure", help="Interactive configuration wizard")

    # run
    run_parser = subparsers.add_parser("run", help="Start the agent")
    run_parser.add_argument("--dry-run", action="store_true", help="Simulation mode")
    run_parser.add_argument("--config", type=str, help="Path to config.yaml")

    # status
    status_parser = subparsers.add_parser("status", help="Show agent status")
    status_parser.add_argument("--config", type=str, help="Path to config.yaml")

    args = parser.parse_args()

    if args.command == "configure":
        cmd_configure(args)
    elif args.command == "run":
        cmd_run(args)
    elif args.command == "status":
        cmd_status(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
