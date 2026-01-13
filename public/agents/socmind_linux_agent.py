#!/usr/bin/env python3
"""
SOCMind Linux Security Agent
Collects Linux logs and sends to SOCMind API
Supports: auth.log, syslog, audit.log, secure

Installation:
    pip install requests

Usage:
    sudo python3 socmind_linux_agent.py

To run as systemd service:
    1. Copy to /opt/socmind/agent.py
    2. Create service file (see below)
    3. sudo systemctl enable socmind-agent
    4. sudo systemctl start socmind-agent

Service file (/etc/systemd/system/socmind-agent.service):
    [Unit]
    Description=SOCMind Linux Security Agent
    After=network.target

    [Service]
    Type=simple
    ExecStart=/usr/bin/python3 /opt/socmind/agent.py
    Restart=always
    RestartSec=10

    [Install]
    WantedBy=multi-user.target
"""

import os
import sys
import time
import socket
import json
import re
import logging
from datetime import datetime
from pathlib import Path
from collections import deque

try:
    import requests
except ImportError:
    print("Error: requests not installed. Run: pip install requests")
    sys.exit(1)

# ============== CONFIGURATION ==============
# Update these values with your SOCMind API details

SOCMIND_API = "https://kglmzurhiiuhxmzykkqv.supabase.co/functions/v1/agent-gateway/ingest"
AGENT_KEY = "YOUR_AGENT_API_KEY"  # Get from SOCMind Data Sources page

# Log files to monitor
LOG_FILES = [
    "/var/log/auth.log",      # Debian/Ubuntu authentication
    "/var/log/secure",         # RHEL/CentOS authentication
    "/var/log/syslog",         # System logs
    "/var/log/messages",       # System messages
    "/var/log/audit/audit.log" # Audit logs
]

# Collection interval in seconds
POLL_INTERVAL = 10

# Maximum lines to read per file per interval
MAX_LINES_PER_FILE = 100

# ============== PATTERNS ==============
# Security-relevant patterns with severity and MITRE mapping

LOG_PATTERNS = {
    # Authentication
    r"Failed password": {
        "severity": 4, 
        "type": "auth_failure",
        "mitre": "T1110",
        "desc": "Failed authentication attempt"
    },
    r"Accepted password": {
        "severity": 2, 
        "type": "auth_success",
        "mitre": None,
        "desc": "Successful authentication"
    },
    r"Accepted publickey": {
        "severity": 2, 
        "type": "auth_success",
        "mitre": None,
        "desc": "SSH key authentication"
    },
    r"Invalid user": {
        "severity": 4, 
        "type": "invalid_user",
        "mitre": "T1110.001",
        "desc": "Invalid username attempt"
    },
    r"authentication failure": {
        "severity": 4, 
        "type": "auth_failure",
        "mitre": "T1110",
        "desc": "Authentication failure"
    },
    r"COMMAND=": {
        "severity": 3, 
        "type": "sudo_command",
        "mitre": "T1548.003",
        "desc": "Sudo command executed"
    },
    r"session opened": {
        "severity": 2, 
        "type": "session_start",
        "mitre": None,
        "desc": "User session started"
    },
    r"session closed": {
        "severity": 1, 
        "type": "session_end",
        "mitre": None,
        "desc": "User session ended"
    },
    
    # User Management
    r"new user": {
        "severity": 4, 
        "type": "user_created",
        "mitre": "T1136.001",
        "desc": "New user account created"
    },
    r"new group": {
        "severity": 3, 
        "type": "group_created",
        "mitre": "T1136",
        "desc": "New group created"
    },
    r"delete user": {
        "severity": 4, 
        "type": "user_deleted",
        "mitre": None,
        "desc": "User account deleted"
    },
    r"password changed": {
        "severity": 3, 
        "type": "password_change",
        "mitre": "T1098",
        "desc": "Password changed"
    },
    
    # SSH
    r"Disconnected from": {
        "severity": 2, 
        "type": "ssh_disconnect",
        "mitre": None,
        "desc": "SSH session disconnected"
    },
    r"Connection closed": {
        "severity": 2, 
        "type": "connection_closed",
        "mitre": None,
        "desc": "Connection closed"
    },
    r"Did not receive identification": {
        "severity": 3, 
        "type": "ssh_scan",
        "mitre": "T1046",
        "desc": "Possible SSH scanning"
    },
    r"Bad protocol version": {
        "severity": 3, 
        "type": "ssh_probe",
        "mitre": "T1046",
        "desc": "SSH protocol probe"
    },
    
    # System
    r"Started": {
        "severity": 1, 
        "type": "service_start",
        "mitre": None,
        "desc": "Service started"
    },
    r"Stopped": {
        "severity": 2, 
        "type": "service_stop",
        "mitre": None,
        "desc": "Service stopped"
    },
    r"segfault": {
        "severity": 4, 
        "type": "crash",
        "mitre": None,
        "desc": "Process crash"
    },
    r"Out of memory": {
        "severity": 4, 
        "type": "oom",
        "mitre": None,
        "desc": "Out of memory condition"
    },
    
    # Audit
    r"type=EXECVE": {
        "severity": 3, 
        "type": "process_exec",
        "mitre": "T1059",
        "desc": "Process execution"
    },
    r"type=SYSCALL": {
        "severity": 2, 
        "type": "syscall",
        "mitre": None,
        "desc": "System call"
    },
    r"type=USER_AUTH": {
        "severity": 3, 
        "type": "auth_audit",
        "mitre": None,
        "desc": "User authentication audit"
    },
}

# IP extraction pattern
IP_PATTERN = re.compile(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})')

# ============== LOGGING ==============
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/var/log/socmind-agent.log') if os.access('/var/log', os.W_OK) 
        else logging.FileHandler('socmind_agent.log')
    ]
)
logger = logging.getLogger('SOCMindAgent')

# ============== AGENT CLASS ==============
class SOCMindLinuxAgent:
    def __init__(self):
        self.hostname = socket.gethostname()
        self.ip_address = self._get_ip()
        self.file_positions = {}  # Track read position per file
        self.session = requests.Session()
        self.session.headers.update({
            "x-agent-key": AGENT_KEY,
            "Content-Type": "application/json"
        })
        
        # Initialize file positions
        for log_file in LOG_FILES:
            if os.path.exists(log_file):
                try:
                    self.file_positions[log_file] = os.path.getsize(log_file)
                except:
                    self.file_positions[log_file] = 0
    
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
    
    def _extract_ips(self, message):
        """Extract source and destination IPs from log message"""
        ips = IP_PATTERN.findall(message)
        src_ip = None
        dst_ip = None
        
        # Common patterns
        if "from " in message.lower() and ips:
            src_ip = ips[0]
        if len(ips) > 1:
            dst_ip = ips[1]
        
        return src_ip, dst_ip
    
    def _classify_log(self, message):
        """Classify log message using patterns"""
        for pattern, info in LOG_PATTERNS.items():
            if re.search(pattern, message, re.IGNORECASE):
                return info
        
        # Default classification
        return {
            "severity": 2,
            "type": "system_event",
            "mitre": None,
            "desc": "System event"
        }
    
    def _parse_log_line(self, line, log_file):
        """Parse a log line into SOCMind format"""
        # Skip empty lines
        line = line.strip()
        if not line:
            return None
        
        # Classify the log
        classification = self._classify_log(line)
        
        # Skip low-severity events
        if classification["severity"] < 2:
            return None
        
        # Extract IPs
        src_ip, dst_ip = self._extract_ips(line)
        
        # Determine log type from file
        log_type = "system"
        if "auth" in log_file or "secure" in log_file:
            log_type = "auth"
        elif "audit" in log_file:
            log_type = "audit"
        
        return {
            "source": "linux",
            "host": self.hostname,
            "host_ip": self.ip_address,
            "log_type": log_type,
            "event_type": classification["type"],
            "severity": classification["severity"],
            "message": line[:500],
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "mitre_technique": classification["mitre"],
            "timestamp": datetime.utcnow().isoformat(),
            "raw": {
                "file": log_file,
                "line": line[:1000]
            }
        }
    
    def collect_logs(self):
        """Collect new log entries from all monitored files"""
        logs = []
        
        for log_file in LOG_FILES:
            if not os.path.exists(log_file):
                continue
            
            try:
                current_size = os.path.getsize(log_file)
                last_position = self.file_positions.get(log_file, 0)
                
                # Check for log rotation
                if current_size < last_position:
                    last_position = 0
                
                # Skip if no new data
                if current_size <= last_position:
                    continue
                
                with open(log_file, 'r', errors='ignore') as f:
                    f.seek(last_position)
                    lines = f.readlines()
                    
                    # Limit lines per interval
                    for line in lines[-MAX_LINES_PER_FILE:]:
                        parsed = self._parse_log_line(line, log_file)
                        if parsed:
                            logs.append(parsed)
                    
                    self.file_positions[log_file] = f.tell()
                
                logger.debug(f"Read {len(lines)} lines from {log_file}")
                
            except PermissionError:
                logger.warning(f"Permission denied: {log_file}")
            except Exception as e:
                logger.error(f"Error reading {log_file}: {e}")
        
        return logs
    
    def send_logs(self, logs):
        """Send collected logs to SOCMind API"""
        if not logs:
            return True
        
        try:
            payload = {
                "logs": logs,
                "source": "linux_agent",
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
                "agent_type": "linux",
                "version": "1.0.0"
            }, timeout=10)
        except:
            pass
    
    def run(self):
        """Main agent loop"""
        logger.info(f"🚀 SOCMind Linux Agent started")
        logger.info(f"   Host: {self.hostname} ({self.ip_address})")
        logger.info(f"   API: {SOCMIND_API}")
        logger.info(f"   Monitoring: {[f for f in LOG_FILES if os.path.exists(f)]}")
        
        # Check permissions
        if os.geteuid() != 0:
            logger.warning("⚠️  Running without root - some logs may not be accessible")
        
        heartbeat_counter = 0
        
        while True:
            try:
                logs = self.collect_logs()
                
                if logs:
                    self.send_logs(logs)
                
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
                time.sleep(30)

# ============== MAIN ==============
if __name__ == "__main__":
    if "YOUR_AGENT_API_KEY" in AGENT_KEY:
        print("⚠️  Please configure your Agent API Key!")
        print("   1. Go to SOCMind Dashboard → Data Sources")
        print("   2. Add a new Linux Agent")
        print("   3. Copy the API key and update AGENT_KEY in this script")
        sys.exit(1)
    
    agent = SOCMindLinuxAgent()
    agent.run()
