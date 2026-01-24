#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SOCMind Universal Agent v2.2.0
Copyright (c) 2025 SOCMind. All rights reserved.

Universal security agent with plugin system for multi-vendor log collection.

Supported Sources:
- Windows Event Logs
- Linux Syslog/Auth
- Firewalls (Fortinet, Palo Alto, Cisco, Sophos, Check Point)
- EDR/NDR/Cloud via API

Features:
- Plugin-based vendor parsing
- MITRE ATT&CK mapping
- Syslog listener (UDP/TCP)
- License validation
- Offline caching
"""

import os
import sys
import json
import time
import socket
import hashlib
import threading
import configparser
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

try:
    import requests
except ImportError:
    print("[WARN] 'requests' not installed. Run: pip install requests")
    requests = None

# ============================================================
# Configuration
# ============================================================
AGENT_VERSION = "2.2.0"
CONFIG_FILE = "agent.conf"
CACHE_FILE = ".socm_license_cache"
LOG_BATCH_SIZE = 100
COLLECTION_INTERVAL = 60  # seconds
HEARTBEAT_INTERVAL = 30  # seconds

# ============================================================
# Plugin System Import
# ============================================================
PLUGINS_AVAILABLE = False
try:
    from plugins import PluginManager, NormalizedLog
    from plugins.syslog_listener import SyslogListener, SyslogMessage
    PLUGINS_AVAILABLE = True
except ImportError:
    print("[INFO] Plugins not found, using built-in parsing only")


# ============================================================
# Utility Functions
# ============================================================
def get_hardware_id() -> str:
    """Generate unique hardware fingerprint."""
    components = []
    
    # Machine ID
    for path in ['/etc/machine-id', '/var/lib/dbus/machine-id']:
        try:
            with open(path) as f:
                components.append(f.read().strip())
                break
        except:
            pass
    
    # Hostname
    components.append(socket.gethostname())
    
    # MAC address
    try:
        import uuid
        mac = ':'.join(['{:02x}'.format((uuid.getnode() >> i) & 0xff) for i in range(0, 48, 8)][::-1])
        components.append(mac)
    except:
        pass
    
    raw = '-'.join(components)
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def parse_config(path: str) -> Dict[str, Any]:
    """Parse agent configuration file."""
    config = {}
    
    if not os.path.exists(path):
        return config
    
    parser = configparser.ConfigParser()
    parser.read(path)
    
    # Flatten sections
    for section in parser.sections():
        for key, value in parser.items(section):
            config[key] = value
    
    # Handle TOML-like format
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#') and not line.startswith('['):
                    key, val = line.split('=', 1)
                    config[key.strip()] = val.strip().strip('"').strip("'")
    except:
        pass
    
    return config


def save_config(path: str, config: Dict[str, str]):
    """Save configuration to file."""
    with open(path, 'w') as f:
        f.write("[agent]\n")
        for key, value in config.items():
            f.write(f"{key} = {value}\n")


# ============================================================
# License Validator
# ============================================================
class LicenseValidator:
    """Validate agent license with caching support."""
    
    def __init__(self, api_endpoint: str, api_key: str, license_key: str):
        self.api_endpoint = api_endpoint.rstrip('/')
        self.api_key = api_key
        self.license_key = license_key
        self.hardware_id = get_hardware_id()
        self.is_valid = False
        self.license_info = {}
        self.error_message = ""
    
    def validate(self) -> bool:
        """Validate license online or from cache."""
        if not self._check_format():
            self.error_message = "Invalid license format"
            return False
        
        # Try online validation
        if requests and self._validate_online():
            self._save_cache()
            return True
        
        # Fallback to cache
        if self._check_cache():
            print("[LICENSE] Using cached validation")
            return True
        
        return False
    
    def _check_format(self) -> bool:
        """Verify license key format: SOCM-XXXX-XXXX-XXXX-XXXX"""
        if not self.license_key or not self.license_key.startswith('SOCM-'):
            return False
        parts = self.license_key.split('-')
        return len(parts) == 5 and all(len(p) == 4 for p in parts[1:])
    
    def _validate_online(self) -> bool:
        """Validate license against API."""
        try:
            url = f"{self.api_endpoint}/agent-gateway/validate-license"
            
            payload = json.dumps({
                'license_key': self.license_key,
                'hardware_id': self.hardware_id,
                'agent_version': AGENT_VERSION,
                'platform': sys.platform,
                'timestamp': datetime.utcnow().isoformat() + 'Z',
            })
            
            import base64
            encoded = base64.b64encode(payload.encode()).decode()
            
            response = requests.post(
                url,
                json={'payload': encoded},
                headers={
                    'Content-Type': 'application/json',
                    'X-Agent-Key': self.api_key,
                    'User-Agent': f'SOCMind-Agent/{AGENT_VERSION}',
                },
                timeout=30,
            )
            
            data = response.json()
            
            if data.get('is_valid'):
                self.is_valid = True
                self.license_info = data
                print(f"[LICENSE:VALID] Type: {data.get('license_type')} | Org: {data.get('organization_name')} | Days: {data.get('days_remaining')}")
                return True
            else:
                self.error_message = data.get('error_message', 'Validation failed')
                print(f"[LICENSE:INVALID] {self.error_message}")
                return False
                
        except Exception as e:
            self.error_message = f"Network error: {e}"
            print(f"[LICENSE:ERROR] {self.error_message}")
            return False
    
    def _check_cache(self) -> bool:
        """Check cached license."""
        try:
            if not os.path.exists(CACHE_FILE):
                return False
            
            with open(CACHE_FILE) as f:
                import base64
                data = json.loads(base64.b64decode(f.read()).decode())
            
            # Verify hardware binding
            if data.get('hardware_id') != self.hardware_id:
                return False
            
            # Check expiry
            expires = datetime.fromisoformat(data['expires_at'].replace('Z', '+00:00'))
            if expires < datetime.now(expires.tzinfo):
                return False
            
            self.is_valid = True
            self.license_info = data
            return True
            
        except Exception:
            return False
    
    def _save_cache(self):
        """Save license to cache."""
        try:
            import base64
            data = {
                **self.license_info,
                'hardware_id': self.hardware_id,
                'cached_at': datetime.utcnow().isoformat() + 'Z',
            }
            encoded = base64.b64encode(json.dumps(data).encode()).decode()
            with open(CACHE_FILE, 'w') as f:
                f.write(encoded)
        except Exception:
            pass


# ============================================================
# Log Collectors
# ============================================================
class LinuxLogCollector:
    """Collect logs from Linux systems."""
    
    LOG_FILES = [
        ('/var/log/auth.log', 'auth'),
        ('/var/log/secure', 'auth'),
        ('/var/log/syslog', 'system'),
        ('/var/log/messages', 'system'),
        ('/var/log/kern.log', 'kernel'),
    ]
    
    def __init__(self):
        self.file_positions = {}
    
    def collect(self, max_lines: int = 100) -> List[Dict]:
        """Collect new log entries."""
        logs = []
        
        for path, log_type in self.LOG_FILES:
            if not os.path.exists(path):
                continue
            
            try:
                logs.extend(self._read_file(path, log_type, max_lines // len(self.LOG_FILES)))
            except Exception as e:
                print(f"[WARN] Cannot read {path}: {e}")
        
        return logs
    
    def _read_file(self, path: str, log_type: str, max_lines: int) -> List[Dict]:
        """Read new lines from log file."""
        logs = []
        
        pos = self.file_positions.get(path, 0)
        
        try:
            with open(path, 'r') as f:
                f.seek(0, 2)  # End
                end_pos = f.tell()
                
                if pos > end_pos:
                    pos = 0  # File rotated
                
                f.seek(pos)
                lines = f.readlines()[-max_lines:]
                
                self.file_positions[path] = f.tell()
                
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    
                    logs.append({
                        'log_type': log_type,
                        'timestamp': datetime.utcnow().isoformat() + 'Z',
                        'message': line[:500],
                        'severity': self._infer_severity(line),
                        'source_ip': socket.gethostname(),
                        'raw_log': {'file': path, 'line': line[:1000]},
                    })
                    
        except Exception:
            pass
        
        return logs
    
    def _infer_severity(self, line: str) -> int:
        """Infer severity from log content."""
        line_lower = line.lower()
        
        if any(w in line_lower for w in ['failed', 'failure', 'denied', 'error']):
            return 4
        if any(w in line_lower for w in ['warning', 'warn']):
            return 3
        if any(w in line_lower for w in ['success', 'accepted']):
            return 2
        
        return 2


# ============================================================
# Universal Agent
# ============================================================
class UniversalAgent:
    """
    SOCMind Universal Agent with plugin support.
    
    Modes:
    - local: Collect local system logs
    - syslog: Listen for syslog from network devices
    - hybrid: Both local + syslog
    """
    
    def __init__(self, config: Dict[str, str]):
        self.config = config
        self.api_endpoint = config.get('api_endpoint', config.get('SOCMIND_API_ENDPOINT', ''))
        self.api_key = config.get('api_key', config.get('SOCMIND_API_KEY', ''))
        self.license_key = config.get('license_key', '')
        
        self.mode = config.get('mode', 'local')  # local, syslog, hybrid
        self.running = False
        
        # Collectors
        self.local_collector = LinuxLogCollector() if sys.platform != 'win32' else None
        
        # Plugin manager
        self.plugin_manager = PluginManager() if PLUGINS_AVAILABLE else None
        
        # Syslog listener
        self.syslog_listener = None
        self.syslog_logs = []
        self.syslog_lock = threading.Lock()
        
        # Stats
        self.stats = {
            'logs_sent': 0,
            'incidents_created': 0,
            'errors': 0,
        }
    
    def start(self):
        """Start the agent."""
        print(f"""
╔══════════════════════════════════════════════════════════╗
║           SOCMind Universal Agent v{AGENT_VERSION}              ║
║                                                          ║
║  Mode: {self.mode.upper():<51}║
║  Plugins: {'ENABLED' if self.plugin_manager else 'DISABLED':<49}║
╚══════════════════════════════════════════════════════════╝
        """)
        
        # Validate license
        validator = LicenseValidator(self.api_endpoint, self.api_key, self.license_key)
        if not validator.validate():
            print(f"[FATAL] License validation failed: {validator.error_message}")
            return False
        
        self.running = True
        
        # Start syslog listener if needed
        if self.mode in ['syslog', 'hybrid'] and PLUGINS_AVAILABLE:
            self._start_syslog_listener()
        
        # Start heartbeat thread
        heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        heartbeat_thread.start()
        
        # Main collection loop
        print(f"[INFO] Starting log collection (Ctrl+C to stop)...")
        self._collection_loop()
        
        return True
    
    def stop(self):
        """Stop the agent."""
        self.running = False
        if self.syslog_listener:
            self.syslog_listener.stop()
        print(f"[INFO] Agent stopped. Stats: {self.stats}")
    
    def _start_syslog_listener(self):
        """Start syslog listener for network devices."""
        port = int(self.config.get('syslog_port', '514'))
        protocol = self.config.get('syslog_protocol', 'udp')
        
        self.syslog_listener = SyslogListener(port=port, protocol=protocol)
        self.syslog_listener.start(callback=self._handle_syslog)
        
        print(f"[SYSLOG] Listening on {protocol.upper()}:{port}")
    
    def _handle_syslog(self, msg: 'SyslogMessage'):
        """Handle incoming syslog message."""
        with self.syslog_lock:
            # Parse with plugin system
            if self.plugin_manager:
                vendor_hint = self.config.get('vendor')
                normalized = self.plugin_manager.parse(msg.raw, vendor_hint)
                
                if normalized:
                    self.syslog_logs.append(normalized.to_ingest_format())
                else:
                    # Fallback to raw
                    self.syslog_logs.append({
                        'log_type': 'syslog',
                        'timestamp': msg.timestamp if 'T' in msg.timestamp else datetime.utcnow().isoformat() + 'Z',
                        'message': msg.message[:500],
                        'severity': 8 - msg.severity,  # Invert syslog severity
                        'source_ip': msg.source_ip,
                        'raw_log': {'hostname': msg.hostname, 'app': msg.app_name, 'raw': msg.raw[:1000]},
                    })
    
    def _collection_loop(self):
        """Main log collection loop."""
        last_validation = time.time()
        
        while self.running:
            try:
                logs = []
                
                # Collect local logs
                if self.mode in ['local', 'hybrid'] and self.local_collector:
                    logs.extend(self.local_collector.collect())
                
                # Collect syslog logs
                if self.mode in ['syslog', 'hybrid']:
                    with self.syslog_lock:
                        logs.extend(self.syslog_logs)
                        self.syslog_logs = []
                
                # Send batch
                if logs:
                    self._send_logs(logs[:LOG_BATCH_SIZE])
                
                # Periodic license re-validation (hourly)
                if time.time() - last_validation > 3600:
                    validator = LicenseValidator(self.api_endpoint, self.api_key, self.license_key)
                    if not validator.validate():
                        print("[FATAL] License expired or invalid")
                        self.running = False
                        break
                    last_validation = time.time()
                
                time.sleep(COLLECTION_INTERVAL)
                
            except KeyboardInterrupt:
                print("\n[INFO] Shutting down...")
                self.stop()
                break
            except Exception as e:
                print(f"[ERROR] Collection error: {e}")
                self.stats['errors'] += 1
                time.sleep(10)
    
    def _send_logs(self, logs: List[Dict]):
        """Send logs to gateway."""
        if not logs or not requests:
            return
        
        try:
            url = f"{self.api_endpoint}/agent-gateway/ingest"
            
            response = requests.post(
                url,
                json={'logs': logs},
                headers={
                    'Content-Type': 'application/json',
                    'X-Agent-Key': self.api_key,
                    'User-Agent': f'SOCMind-Agent/{AGENT_VERSION}',
                },
                timeout=60,
            )
            
            data = response.json()
            
            processed = data.get('processed', 0)
            incidents = data.get('incidents_created', 0)
            
            self.stats['logs_sent'] += processed
            self.stats['incidents_created'] += incidents
            
            print(f"[OK] Sent {len(logs)} logs -> {processed} processed, {incidents} incidents")
            
        except Exception as e:
            print(f"[ERROR] Failed to send logs: {e}")
            self.stats['errors'] += 1
    
    def _heartbeat_loop(self):
        """Send periodic heartbeats."""
        while self.running:
            try:
                self._send_heartbeat()
                time.sleep(HEARTBEAT_INTERVAL)
            except Exception:
                pass
    
    def _send_heartbeat(self):
        """Send heartbeat to gateway."""
        if not requests:
            return
        
        try:
            url = f"{self.api_endpoint}/agent-gateway/heartbeat"
            
            requests.post(
                url,
                json={
                    'hostname': socket.gethostname(),
                    'status': 'active',
                    'logs_sent': self.stats['logs_sent'],
                    'ip_address': socket.gethostbyname(socket.gethostname()),
                    'os': sys.platform,
                    'agent_version': AGENT_VERSION,
                    'mode': self.mode,
                },
                headers={
                    'X-Agent-Key': self.api_key,
                    'Content-Type': 'application/json',
                },
                timeout=10,
            )
        except Exception:
            pass


# ============================================================
# CLI Commands
# ============================================================
def cmd_configure():
    """Interactive configuration."""
    print("""
╔══════════════════════════════════════════════════════════╗
║           SOCMind Agent - Configuration                  ║
╚══════════════════════════════════════════════════════════╝
    """)
    
    existing = parse_config(CONFIG_FILE)
    
    api_endpoint = input(f"API Endpoint [{existing.get('api_endpoint', '')}]: ").strip()
    api_endpoint = api_endpoint or existing.get('api_endpoint', '')
    
    api_key = input(f"API Key [{existing.get('api_key', '')[:12] + '...' if existing.get('api_key') else ''}]: ").strip()
    api_key = api_key or existing.get('api_key', '')
    
    license_key = input(f"License Key [{existing.get('license_key', '')[:9] + '...' if existing.get('license_key') else ''}]: ").strip()
    license_key = license_key or existing.get('license_key', '')
    
    mode = input(f"Mode (local/syslog/hybrid) [{existing.get('mode', 'local')}]: ").strip()
    mode = mode or existing.get('mode', 'local')
    
    syslog_port = input(f"Syslog Port [{existing.get('syslog_port', '514')}]: ").strip()
    syslog_port = syslog_port or existing.get('syslog_port', '514')
    
    vendor = input(f"Vendor hint (fortinet/paloalto/cisco/sophos/checkpoint) [{existing.get('vendor', '')}]: ").strip()
    vendor = vendor or existing.get('vendor', '')
    
    config = {
        'api_endpoint': api_endpoint,
        'api_key': api_key,
        'license_key': license_key,
        'mode': mode,
        'syslog_port': syslog_port,
        'vendor': vendor,
    }
    
    save_config(CONFIG_FILE, config)
    print("[OK] Configuration saved")
    
    # Validate license
    print("\n[INFO] Validating license...")
    validator = LicenseValidator(api_endpoint, api_key, license_key)
    if validator.validate():
        print("[OK] License valid! Run './socmind-universal-agent.py run' to start")
    else:
        print(f"[WARN] License validation failed: {validator.error_message}")


def cmd_run():
    """Run the agent."""
    config = parse_config(CONFIG_FILE)
    
    if not config.get('api_endpoint') or not config.get('api_key'):
        print("[FATAL] Not configured. Run './socmind-universal-agent.py configure' first")
        return
    
    # Prompt for license if missing
    if not config.get('license_key'):
        print("[INFO] License key not configured")
        license_key = input("Enter license key (SOCM-XXXX-XXXX-XXXX-XXXX): ").strip()
        if not license_key:
            print("[FATAL] License key required")
            return
        config['license_key'] = license_key
        save_config(CONFIG_FILE, config)
    
    agent = UniversalAgent(config)
    agent.start()


def cmd_status():
    """Show agent status."""
    config = parse_config(CONFIG_FILE)
    
    print("""
╔══════════════════════════════════════════════════════════╗
║           SOCMind Agent - Status                         ║
╚══════════════════════════════════════════════════════════╝
    """)
    
    if not config:
        print("Status: NOT CONFIGURED")
        return
    
    print(f"API Endpoint: {config.get('api_endpoint', 'Not set')}")
    print(f"API Key: {config.get('api_key', '')[:12]}..." if config.get('api_key') else "API Key: Not set")
    print(f"License: {config.get('license_key', '')[:9]}..." if config.get('license_key') else "License: Not set")
    print(f"Mode: {config.get('mode', 'local')}")
    print(f"Syslog Port: {config.get('syslog_port', '514')}")
    print(f"Vendor: {config.get('vendor', 'auto-detect')}")
    print(f"Hardware ID: {get_hardware_id()}")
    print(f"Plugins: {'Available' if PLUGINS_AVAILABLE else 'Not available'}")
    
    if PLUGINS_AVAILABLE:
        pm = PluginManager()
        print("\nRegistered Plugins:")
        for p in pm.list_plugins():
            print(f"  - {p['vendor']} ({p['type']})")


def cmd_test():
    """Test plugin parsing."""
    if not PLUGINS_AVAILABLE:
        print("[ERROR] Plugins not available")
        return
    
    pm = PluginManager()
    
    test_logs = [
        # Fortinet
        'date=2024-01-15 time=10:30:45 devname=FortiGate-100 devid=FG100D type=traffic subtype=forward action=deny srcip=192.168.1.100 dstip=10.0.0.5 srcport=45678 dstport=443',
        # Palo Alto  
        '1,2024/01/15 10:30:45,001234567890,THREAT,vulnerability,1,2024/01/15 10:30:45,192.168.1.100,10.0.0.5,0.0.0.0,0.0.0.0,Test Rule,user@domain.com,,web-browsing,vsys1,trust,untrust,tunnel.1,ethernet1/1,Threat Log,123456,1,54321,443,0,0,0x0,tcp,alert,http://malicious.com/exploit,12345678(signature),any,high,client-to-server',
        # Cisco ASA
        '%ASA-4-106023: Deny tcp src inside:192.168.1.100/45678 dst outside:10.0.0.5/443 by access-group "OUTSIDE_IN"',
    ]
    
    print("Testing plugin parsing:\n")
    
    for log in test_logs:
        result = pm.parse(log)
        if result:
            print(f"✓ {result.source_vendor.upper()}: {result.event_type}")
            print(f"  MITRE: {result.mitre_technique} - {result.mitre_name}")
            print(f"  Severity: {result.severity}")
            print()
        else:
            print(f"✗ Could not parse: {log[:60]}...")
            print()


def cmd_help():
    """Show help."""
    print(f"""
SOCMind Universal Agent v{AGENT_VERSION}
===================================

Commands:
  configure  - Set up API credentials, license, and mode
  run        - Start the agent
  status     - Check agent configuration
  test       - Test plugin parsing
  help       - Show this message

Usage:
  ./socmind-universal-agent.py configure
  ./socmind-universal-agent.py run

Modes:
  local   - Collect local system logs only
  syslog  - Listen for syslog from network devices
  hybrid  - Both local and syslog collection

Supported Vendors:
  - Fortinet (FortiGate)
  - Palo Alto Networks
  - Cisco (ASA, Firepower)
  - Sophos (XG, UTM)
  - Check Point
    """)


# ============================================================
# Main
# ============================================================
if __name__ == '__main__':
    command = sys.argv[1] if len(sys.argv) > 1 else 'help'
    
    commands = {
        'configure': cmd_configure,
        'run': cmd_run,
        'start': cmd_run,
        'status': cmd_status,
        'test': cmd_test,
        'help': cmd_help,
    }
    
    func = commands.get(command.lower(), cmd_help)
    func()
