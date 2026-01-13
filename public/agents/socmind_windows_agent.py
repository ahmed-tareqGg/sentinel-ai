#!/usr/bin/env python3
"""
SOCMind Windows Security Agent
Collects Windows Event Logs and sends to SOCMind API
Supports: Security, System, Application logs

Installation:
    pip install pywin32 requests

Usage:
    python socmind_windows_agent.py

To run as Windows Service:
    1. pip install pyinstaller
    2. pyinstaller --onefile socmind_windows_agent.py
    3. sc create SOCMindAgent binPath= "C:\SOCMind\socmind_windows_agent.exe"
    4. sc start SOCMindAgent
"""

import sys
import time
import socket
import json
import logging
from datetime import datetime
from pathlib import Path

try:
    import win32evtlog
    import win32evtlogutil
    import win32con
except ImportError:
    print("Error: pywin32 not installed. Run: pip install pywin32")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("Error: requests not installed. Run: pip install requests")
    sys.exit(1)

# ============== CONFIGURATION ==============
# Update these values with your SOCMind API details

SOCMIND_API = "https://kglmzurhiiuhxmzykkqv.supabase.co/functions/v1/agent-gateway/ingest"
AGENT_KEY = "YOUR_AGENT_API_KEY"  # Get from SOCMind Data Sources page

# Log types to collect
LOG_TYPES = ["Security", "System", "Application"]

# Collection interval in seconds
POLL_INTERVAL = 10

# Security Event IDs to monitor (high priority)
SECURITY_EVENT_IDS = {
    # Authentication
    4624: {"severity": 2, "type": "auth_success", "desc": "Successful logon"},
    4625: {"severity": 4, "type": "auth_failure", "desc": "Failed logon"},
    4634: {"severity": 1, "type": "logoff", "desc": "Logoff"},
    4648: {"severity": 3, "type": "explicit_creds", "desc": "Explicit credentials logon"},
    4672: {"severity": 3, "type": "special_privileges", "desc": "Special privileges assigned"},
    
    # Account Management
    4720: {"severity": 4, "type": "user_created", "desc": "User account created"},
    4722: {"severity": 3, "type": "user_enabled", "desc": "User account enabled"},
    4724: {"severity": 4, "type": "password_reset", "desc": "Password reset attempted"},
    4725: {"severity": 3, "type": "user_disabled", "desc": "User account disabled"},
    4726: {"severity": 4, "type": "user_deleted", "desc": "User account deleted"},
    4728: {"severity": 4, "type": "group_member_added", "desc": "Member added to security group"},
    4732: {"severity": 4, "type": "local_group_add", "desc": "Member added to local group"},
    4756: {"severity": 4, "type": "universal_group_add", "desc": "Member added to universal group"},
    
    # Policy & System
    4697: {"severity": 4, "type": "service_installed", "desc": "Service installed"},
    4698: {"severity": 4, "type": "scheduled_task", "desc": "Scheduled task created"},
    4719: {"severity": 5, "type": "audit_policy_change", "desc": "Audit policy changed"},
    4738: {"severity": 3, "type": "user_changed", "desc": "User account changed"},
    4740: {"severity": 4, "type": "account_locked", "desc": "Account locked out"},
    
    # Process & Object
    4688: {"severity": 2, "type": "process_created", "desc": "New process created"},
    4689: {"severity": 1, "type": "process_terminated", "desc": "Process terminated"},
    4663: {"severity": 3, "type": "object_access", "desc": "Object access attempted"},
    
    # Firewall
    5156: {"severity": 2, "type": "network_connection", "desc": "Network connection allowed"},
    5157: {"severity": 3, "type": "network_blocked", "desc": "Network connection blocked"},
}

# ============== LOGGING ==============
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('socmind_agent.log')
    ]
)
logger = logging.getLogger('SOCMindAgent')

# ============== AGENT CLASS ==============
class SOCMindWindowsAgent:
    def __init__(self):
        self.hostname = socket.gethostname()
        self.ip_address = self._get_ip()
        self.bookmarks = {}  # Track last read position per log
        self.session = requests.Session()
        self.session.headers.update({
            "x-agent-key": AGENT_KEY,
            "Content-Type": "application/json"
        })
        
    def _get_ip(self):
        """Get local IP address"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
    def _parse_event(self, event, log_type):
        """Parse Windows event into SOCMind format"""
        event_id = event.EventID & 0xFFFF
        
        # Get event metadata
        event_info = SECURITY_EVENT_IDS.get(event_id, {
            "severity": 2,
            "type": "system_event",
            "desc": "System event"
        })
        
        # Build message from event data
        message_parts = []
        if event.StringInserts:
            message_parts = [str(s) for s in event.StringInserts if s]
        
        message = " | ".join(message_parts[:5]) if message_parts else event_info["desc"]
        
        # Extract source/destination IPs if present
        src_ip = None
        dst_ip = None
        for part in message_parts:
            if "Source Network Address:" in str(part):
                src_ip = str(part).replace("Source Network Address:", "").strip()
            if "Destination Address:" in str(part):
                dst_ip = str(part).replace("Destination Address:", "").strip()
        
        return {
            "source": "windows",
            "host": self.hostname,
            "host_ip": self.ip_address,
            "log_type": log_type.lower(),
            "event_id": event_id,
            "event_type": event_info["type"],
            "severity": event_info["severity"],
            "message": message[:500],  # Limit message length
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "timestamp": event.TimeGenerated.isoformat() if hasattr(event.TimeGenerated, 'isoformat') else str(event.TimeGenerated),
            "raw": {
                "event_id": event_id,
                "event_category": event.EventCategory,
                "event_type": event.EventType,
                "source_name": event.SourceName,
                "strings": message_parts[:10]
            }
        }
    
    def collect_logs(self, log_type):
        """Collect events from specified Windows Event Log"""
        logs = []
        
        try:
            handle = win32evtlog.OpenEventLog(None, log_type)
            flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ
            
            # Get bookmark or start fresh
            total_records = win32evtlog.GetNumberOfEventLogRecords(handle)
            
            events = win32evtlog.ReadEventLog(handle, flags, 0)
            
            for event in events[:50]:  # Limit to 50 events per batch
                event_id = event.EventID & 0xFFFF
                
                # For Security log, only process known important events
                if log_type == "Security" and event_id not in SECURITY_EVENT_IDS:
                    continue
                
                # For other logs, filter by severity
                if log_type != "Security" and event.EventType < win32con.EVENTLOG_WARNING_TYPE:
                    continue
                
                parsed = self._parse_event(event, log_type)
                logs.append(parsed)
            
            win32evtlog.CloseEventLog(handle)
            
        except Exception as e:
            logger.error(f"Error collecting {log_type} logs: {e}")
        
        return logs
    
    def send_logs(self, logs):
        """Send collected logs to SOCMind API"""
        if not logs:
            return True
        
        try:
            payload = {
                "logs": logs,
                "source": "windows_agent",
                "agent_version": "1.0.0",
                "batch_time": datetime.utcnow().isoformat()
            }
            
            response = self.session.post(
                SOCMIND_API,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"✅ Sent {len(logs)} logs - Processed: {result.get('processed', 0)}")
                return True
            else:
                logger.error(f"❌ API error {response.status_code}: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Network error: {e}")
            return False
    
    def send_heartbeat(self):
        """Send agent heartbeat"""
        try:
            heartbeat_url = SOCMIND_API.replace("/ingest", "/heartbeat")
            self.session.post(heartbeat_url, json={
                "status": "online",
                "hostname": self.hostname,
                "ip": self.ip_address,
                "agent_type": "windows",
                "version": "1.0.0"
            }, timeout=10)
        except:
            pass  # Heartbeat failures are non-critical
    
    def run(self):
        """Main agent loop"""
        logger.info(f"🚀 SOCMind Windows Agent started")
        logger.info(f"   Host: {self.hostname} ({self.ip_address})")
        logger.info(f"   API: {SOCMIND_API}")
        logger.info(f"   Monitoring: {', '.join(LOG_TYPES)}")
        
        heartbeat_counter = 0
        
        while True:
            try:
                all_logs = []
                
                for log_type in LOG_TYPES:
                    logs = self.collect_logs(log_type)
                    all_logs.extend(logs)
                    logger.debug(f"Collected {len(logs)} from {log_type}")
                
                if all_logs:
                    self.send_logs(all_logs)
                
                # Send heartbeat every 6 intervals
                heartbeat_counter += 1
                if heartbeat_counter >= 6:
                    self.send_heartbeat()
                    heartbeat_counter = 0
                
                time.sleep(POLL_INTERVAL)
                
            except KeyboardInterrupt:
                logger.info("Agent stopped by user")
                break
            except Exception as e:
                logger.error(f"Agent error: {e}")
                time.sleep(30)  # Wait before retry

# ============== MAIN ==============
if __name__ == "__main__":
    # Validate configuration
    if "YOUR_AGENT_API_KEY" in AGENT_KEY:
        print("⚠️  Please configure your Agent API Key!")
        print("   1. Go to SOCMind Dashboard → Data Sources")
        print("   2. Add a new Windows Agent")
        print("   3. Copy the API key and update AGENT_KEY in this script")
        sys.exit(1)
    
    agent = SOCMindWindowsAgent()
    agent.run()
