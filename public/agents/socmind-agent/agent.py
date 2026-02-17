#!/usr/bin/env python3
"""
SOCMind Universal Agent v4.0.0 – Production-Ready Entry Point
Copyright (c) 2025 SOCMind. All rights reserved.
Contact: security@socmind.ai

Capabilities:
  - Log Collector
  - Action Executor (SOAR)
  - Playbook Runner
  - Real-Time Threat Detection
  - Network Traffic Monitor
  - File Integrity Monitor (FIM)
  - Auto-Recovery & Offline Mode
  - Approval-aware (Full Human-in-the-Loop)
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
from core.threat_detector import ThreatDetector
from core.network_monitor import NetworkMonitor
from core.file_integrity_monitor import FileIntegrityMonitor
from core.recovery_manager import RecoveryManager

AGENT_VERSION = "4.0.0"
BANNER = f"""
╔══════════════════════════════════════════════════════╗
║          SOCMind Universal Agent v{AGENT_VERSION}              ║
║  Collector | Executor | Threat Detection | FIM       ║
║  Network Monitor | Playbooks | Recovery | SOAR       ║
╚══════════════════════════════════════════════════════╝
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
                "block_ip", "unblock_ip",
                "kill_process", "lock_user",
                "delete_file", "quarantine_file",
                "stop_service", "start_service",
                "isolate_host", "unisolate_host",
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
        "threat_detection": {
            "enabled": True,
            "brute_force_threshold": 5,
            "brute_force_window_seconds": 300,
            "port_scan_threshold": 15,
            "port_scan_window_seconds": 60,
        },
        "network_monitor": {
            "enabled": True,
            "scan_interval_seconds": 30,
            "beacon_threshold": 10,
            "beacon_window_seconds": 300,
            "suspicious_ports": [4444, 5555, 6666, 7777, 8888, 9999, 1337, 31337, 12345, 6667, 6697, 4443, 8443],
        },
        "fim": {
            "enabled": True,
            "scan_interval_seconds": 300,
            "hash_algorithm": "sha256",
        },
        "recovery": {
            "enabled": True,
            "max_queue_size": 10000,
            "retry_interval_seconds": 60,
            "auto_rollback": True,
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

    # Initialize core components
    audit = AuditLogger(config)
    approval = ApprovalClient(config)
    recovery = RecoveryManager(config, audit)
    threat_detector = ThreatDetector(config, audit)
    heartbeat = HeartbeatService(config, AGENT_VERSION)
    collector = LogCollector(config, audit)
    executor = ActionExecutor(config, audit, approval)
    playbook_engine = PlaybookEngine(config, executor, audit)
    network_monitor = NetworkMonitor(config, audit)
    fim = FileIntegrityMonitor(config, audit)

    # Wire components together
    collector.playbook_engine = playbook_engine
    collector.threat_detector = threat_detector  # NEW: real-time detection
    collector.recovery_manager = recovery        # NEW: offline queuing

    # Graceful shutdown
    shutdown_event = threading.Event()

    def signal_handler(sig, frame):
        print("\n[INFO] Shutting down gracefully...")
        recovery.save_state({
            "shutdown_reason": "signal",
            "queue_size": recovery.queue_size,
        })
        shutdown_event.set()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # ── Start all service threads ──
    threads = [
        ("Heartbeat", heartbeat.run),
        ("Collector", collector.run),
        ("Executor", executor.run),
        ("Playbooks", playbook_engine.run),
        ("NetworkMonitor", network_monitor.run),
        ("FIM", fim.run),
    ]

    for name, target in threads:
        t = threading.Thread(target=target, args=(shutdown_event,), daemon=True, name=name)
        t.start()

    print(f"[INFO] All {len(threads)} services started. Press Ctrl+C to stop.\n")

    # ── Main loop — flush queued events + collect alerts ──
    while not shutdown_event.is_set():
        # Flush offline queue if back online
        if recovery.is_online and recovery.queue_size > 0:
            batch = recovery.get_queued_events(batch_size=50)
            if batch:
                try:
                    collector._send_logs(batch)
                    print(f"[RECOVERY] Flushed {len(batch)} queued events")
                except Exception:
                    recovery.requeue_events(batch)

        # Collect network + FIM alerts and send as high-priority logs
        net_alerts = network_monitor.get_pending_alerts()
        fim_alerts = fim.get_pending_alerts()
        threat_alerts = threat_detector.get_pending_alerts()

        all_alerts = net_alerts + fim_alerts + threat_alerts
        if all_alerts:
            alert_logs = []
            for alert in all_alerts:
                alert_logs.append({
                    "log_type": "agent_alert",
                    "timestamp": alert.get("detected_at", ""),
                    "message": f"[{alert['severity'].upper()}] {alert['threat_type']}: {alert['description']}",
                    "severity": {"critical": 5, "high": 4, "medium": 3, "low": 2}.get(alert.get("severity", ""), 3),
                    "raw_log": alert,
                    "source_ip": alert.get("source_ip", alert.get("remote_ip", "")),
                })
            try:
                collector._send_logs(alert_logs)
                print(f"[AGENT] Sent {len(alert_logs)} threat alerts to platform")
            except Exception:
                for log in alert_logs:
                    recovery.queue_event(log)

        shutdown_event.wait(timeout=5)

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

    print(f"  Endpoint:           {api.get('endpoint', 'N/A')}")
    print(f"  API Key:            {api.get('key', '')[:12]}...")
    print(f"  License:            {api.get('license_key', '')[:9]}...")
    print(f"  Mode:               {config.get('agent', {}).get('mode', 'executor')}")
    print(f"  Dry Run:            {config.get('executor', {}).get('dry_run', False)}")
    print(f"  Playbooks:          {config.get('playbooks', {}).get('enabled', False)}")
    print(f"  Threat Detection:   {config.get('threat_detection', {}).get('enabled', True)}")
    print(f"  Network Monitor:    {config.get('network_monitor', {}).get('enabled', True)}")
    print(f"  FIM:                {config.get('fim', {}).get('enabled', True)}")
    print(f"  Auto-Recovery:      {config.get('recovery', {}).get('enabled', True)}")

    # Show offline queue status
    recovery = RecoveryManager(config, type("DummyAudit", (), {"log_event": lambda *a: None})())
    if recovery.queue_size > 0:
        print(f"\n  ⚠️ Offline Queue:   {recovery.queue_size} events pending")

    audit_path = config.get("audit", {}).get("local_log_path", "")
    if os.path.exists(audit_path):
        with open(audit_path) as f:
            lines = f.readlines()
        print(f"\n  Recent Audit Entries ({len(lines)} total):")
        for line in lines[-5:]:
            print(f"    {line.strip()}")


def cmd_rollback(args):
    """Rollback the last reversible action."""
    print(BANNER)
    config_path = args.config or os.path.join(AGENT_DIR, "config.yaml")
    config = load_config(config_path)

    audit = AuditLogger(config)
    approval = ApprovalClient(config)
    executor = ActionExecutor(config, audit, approval)
    recovery = RecoveryManager(config, audit)

    result = recovery.rollback_last_action(executor)
    if result.get("success"):
        print(f"  ✅ Rollback successful: {result.get('details', '')}")
    else:
        print(f"  ❌ Rollback failed: {result.get('details', '')}")


def main():
    parser = argparse.ArgumentParser(
        prog="socmind-agent",
        description="SOCMind Universal Agent – Full Security Operations Platform",
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

    # rollback
    rollback_parser = subparsers.add_parser("rollback", help="Rollback last action")
    rollback_parser.add_argument("--config", type=str, help="Path to config.yaml")

    args = parser.parse_args()

    if args.command == "configure":
        cmd_configure(args)
    elif args.command == "run":
        cmd_run(args)
    elif args.command == "status":
        cmd_status(args)
    elif args.command == "rollback":
        cmd_rollback(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
