# SOCMind Agent - Base Plugin & Manager
# Copyright (c) 2025 SOCMind. All rights reserved.

import re
import json
import hashlib
from datetime import datetime
from typing import Dict, List, Optional, Any, Type
from dataclasses import dataclass, field, asdict
from abc import ABC, abstractmethod

# ============================================================
# MITRE ATT&CK Mapping Database
# ============================================================
MITRE_MAPPINGS = {
    # Authentication & Access
    'login_failed': {'technique': 'T1110', 'tactic': 'Credential Access', 'name': 'Brute Force'},
    'login_success': {'technique': 'T1078', 'tactic': 'Defense Evasion', 'name': 'Valid Accounts'},
    'privilege_escalation': {'technique': 'T1068', 'tactic': 'Privilege Escalation', 'name': 'Exploitation for Privilege Escalation'},
    'account_created': {'technique': 'T1136', 'tactic': 'Persistence', 'name': 'Create Account'},
    'account_modified': {'technique': 'T1098', 'tactic': 'Persistence', 'name': 'Account Manipulation'},
    'password_change': {'technique': 'T1098', 'tactic': 'Persistence', 'name': 'Account Manipulation'},
    
    # Network
    'port_scan': {'technique': 'T1046', 'tactic': 'Discovery', 'name': 'Network Service Discovery'},
    'connection_blocked': {'technique': 'T1071', 'tactic': 'Command and Control', 'name': 'Application Layer Protocol'},
    'dns_query': {'technique': 'T1071.004', 'tactic': 'Command and Control', 'name': 'DNS'},
    'dns_tunneling': {'technique': 'T1572', 'tactic': 'Command and Control', 'name': 'Protocol Tunneling'},
    'lateral_movement': {'technique': 'T1021', 'tactic': 'Lateral Movement', 'name': 'Remote Services'},
    'c2_communication': {'technique': 'T1071', 'tactic': 'Command and Control', 'name': 'Application Layer Protocol'},
    'data_exfiltration': {'technique': 'T1041', 'tactic': 'Exfiltration', 'name': 'Exfiltration Over C2 Channel'},
    
    # Malware & Threats
    'malware_detected': {'technique': 'T1204', 'tactic': 'Execution', 'name': 'User Execution'},
    'ransomware': {'technique': 'T1486', 'tactic': 'Impact', 'name': 'Data Encrypted for Impact'},
    'exploit_attempt': {'technique': 'T1190', 'tactic': 'Initial Access', 'name': 'Exploit Public-Facing Application'},
    'web_attack': {'technique': 'T1190', 'tactic': 'Initial Access', 'name': 'Exploit Public-Facing Application'},
    'sql_injection': {'technique': 'T1190', 'tactic': 'Initial Access', 'name': 'Exploit Public-Facing Application'},
    'xss_attack': {'technique': 'T1189', 'tactic': 'Initial Access', 'name': 'Drive-by Compromise'},
    
    # Endpoint
    'process_execution': {'technique': 'T1059', 'tactic': 'Execution', 'name': 'Command and Scripting Interpreter'},
    'powershell_execution': {'technique': 'T1059.001', 'tactic': 'Execution', 'name': 'PowerShell'},
    'file_created': {'technique': 'T1105', 'tactic': 'Command and Control', 'name': 'Ingress Tool Transfer'},
    'file_modified': {'technique': 'T1565', 'tactic': 'Impact', 'name': 'Data Manipulation'},
    'registry_modified': {'technique': 'T1112', 'tactic': 'Defense Evasion', 'name': 'Modify Registry'},
    'service_created': {'technique': 'T1543', 'tactic': 'Persistence', 'name': 'Create or Modify System Process'},
    
    # Policy & Config
    'policy_violation': {'technique': 'T1562', 'tactic': 'Defense Evasion', 'name': 'Impair Defenses'},
    'config_change': {'technique': 'T1562.001', 'tactic': 'Defense Evasion', 'name': 'Disable or Modify Tools'},
    'vpn_connection': {'technique': 'T1133', 'tactic': 'Persistence', 'name': 'External Remote Services'},
    
    # Default
    'unknown': {'technique': 'T1059', 'tactic': 'Execution', 'name': 'Command and Scripting Interpreter'},
}


@dataclass
class NormalizedLog:
    """Unified log schema for all vendors."""
    
    # Core fields
    timestamp: str
    log_type: str
    message: str
    severity: int  # 1-5 scale
    
    # Source info
    source_vendor: str
    source_type: str  # firewall, edr, ndr, cloud
    source_ip: Optional[str] = None
    source_port: Optional[int] = None
    source_hostname: Optional[str] = None
    source_user: Optional[str] = None
    
    # Destination info
    destination_ip: Optional[str] = None
    destination_port: Optional[int] = None
    destination_hostname: Optional[str] = None
    
    # Event details
    event_type: str = 'unknown'
    event_action: Optional[str] = None  # allow, deny, drop, alert
    event_outcome: Optional[str] = None  # success, failure
    
    # Protocol/Application
    protocol: Optional[str] = None
    application: Optional[str] = None
    
    # Security context
    threat_name: Optional[str] = None
    threat_category: Optional[str] = None
    file_hash: Optional[str] = None
    url: Optional[str] = None
    
    # MITRE ATT&CK
    mitre_technique: Optional[str] = None
    mitre_tactic: Optional[str] = None
    mitre_name: Optional[str] = None
    
    # Metadata
    raw_log: Optional[Dict] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {k: v for k, v in asdict(self).items() if v is not None}
    
    def to_ingest_format(self) -> Dict:
        """Convert to format expected by agent-gateway."""
        return {
            'log_type': self.log_type,
            'timestamp': self.timestamp,
            'message': self.message,
            'severity': self.severity,
            'source_ip': self.source_ip or self.source_hostname,
            'destination_ip': self.destination_ip,
            'user': self.source_user,
            'process': self.application,
            'event_id': self.event_type,
            'file_hash': self.file_hash,
            'raw_log': self.raw_log,
            'source_type': self.source_type,
            'vendor': self.source_vendor,
            'mitre_technique': self.mitre_technique,
            'mitre_tactic': self.mitre_tactic,
            'tags': self.tags,
        }


class BasePlugin(ABC):
    """Base class for all vendor plugins."""
    
    VENDOR_NAME: str = "unknown"
    VENDOR_TYPE: str = "unknown"  # firewall, edr, ndr, cloud
    SUPPORTED_FORMATS: List[str] = []  # syslog, cef, leef, json
    
    def __init__(self):
        self.stats = {
            'parsed': 0,
            'failed': 0,
            'high_severity': 0,
        }
    
    @abstractmethod
    def can_parse(self, raw_log: str) -> bool:
        """Check if this plugin can parse the given log."""
        pass
    
    @abstractmethod
    def parse(self, raw_log: str) -> Optional[NormalizedLog]:
        """Parse raw log string into normalized format."""
        pass
    
    def map_severity(self, vendor_severity: Any) -> int:
        """Map vendor-specific severity to 1-5 scale."""
        # Default implementation - override in subclasses
        try:
            sev = int(vendor_severity)
            if sev <= 2:
                return 1
            elif sev <= 4:
                return 2
            elif sev <= 6:
                return 3
            elif sev <= 8:
                return 4
            else:
                return 5
        except (ValueError, TypeError):
            return 2
    
    def map_mitre(self, event_type: str, action: Optional[str] = None) -> Dict[str, str]:
        """Map event type to MITRE ATT&CK technique."""
        event_lower = event_type.lower().replace(' ', '_').replace('-', '_')
        
        # Direct match
        if event_lower in MITRE_MAPPINGS:
            return MITRE_MAPPINGS[event_lower]
        
        # Pattern matching
        for pattern, mapping in MITRE_MAPPINGS.items():
            if pattern in event_lower:
                return mapping
        
        # Default
        return MITRE_MAPPINGS['unknown']
    
    def add_tags(self, log: NormalizedLog) -> None:
        """Add contextual tags to the log."""
        tags = [self.VENDOR_NAME, self.VENDOR_TYPE]
        
        if log.severity >= 4:
            tags.append('high-severity')
        if log.threat_name:
            tags.append('threat-detected')
        if log.event_action == 'deny' or log.event_action == 'block':
            tags.append('blocked')
        if log.mitre_technique:
            tags.append(f'mitre:{log.mitre_technique}')
        
        log.tags = tags
    
    def generate_hash(self, log: NormalizedLog) -> str:
        """Generate deduplication hash for the log."""
        content = f"{log.timestamp}:{log.source_ip}:{log.event_type}:{log.message[:100]}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def parse_timestamp(self, timestamp_str: str) -> str:
        """Parse various timestamp formats to ISO format."""
        formats = [
            '%Y-%m-%dT%H:%M:%S.%fZ',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%d %H:%M:%S',
            '%b %d %H:%M:%S',
            '%b %d %Y %H:%M:%S',
        ]
        
        for fmt in formats:
            try:
                dt = datetime.strptime(timestamp_str.strip(), fmt)
                if dt.year == 1900:
                    dt = dt.replace(year=datetime.now().year)
                return dt.isoformat() + 'Z'
            except ValueError:
                continue
        
        return datetime.utcnow().isoformat() + 'Z'
    
    def extract_ip(self, text: str) -> Optional[str]:
        """Extract first IP address from text."""
        match = re.search(r'\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b', text)
        return match.group(1) if match else None


class PluginManager:
    """Manages vendor plugins and routes logs to appropriate parser."""
    
    def __init__(self):
        self.plugins: Dict[str, BasePlugin] = {}
        self._load_default_plugins()
    
    def _load_default_plugins(self):
        """Load all default vendor plugins."""
        from .fortinet import FortinetPlugin
        from .paloalto import PaloAltoPlugin
        from .cisco import CiscoPlugin
        from .sophos import SophosPlugin
        from .checkpoint import CheckPointPlugin
        
        self.register_plugin(FortinetPlugin())
        self.register_plugin(PaloAltoPlugin())
        self.register_plugin(CiscoPlugin())
        self.register_plugin(SophosPlugin())
        self.register_plugin(CheckPointPlugin())
    
    def register_plugin(self, plugin: BasePlugin):
        """Register a vendor plugin."""
        self.plugins[plugin.VENDOR_NAME.lower()] = plugin
    
    def get_plugin(self, vendor: str) -> Optional[BasePlugin]:
        """Get plugin by vendor name."""
        return self.plugins.get(vendor.lower())
    
    def parse(self, raw_log: str, vendor_hint: Optional[str] = None) -> Optional[NormalizedLog]:
        """Parse a raw log using the appropriate plugin."""
        
        # If vendor hint provided, try that first
        if vendor_hint:
            plugin = self.get_plugin(vendor_hint)
            if plugin and plugin.can_parse(raw_log):
                result = plugin.parse(raw_log)
                if result:
                    plugin.stats['parsed'] += 1
                    if result.severity >= 4:
                        plugin.stats['high_severity'] += 1
                    return result
        
        # Auto-detect vendor
        for name, plugin in self.plugins.items():
            if plugin.can_parse(raw_log):
                result = plugin.parse(raw_log)
                if result:
                    plugin.stats['parsed'] += 1
                    if result.severity >= 4:
                        plugin.stats['high_severity'] += 1
                    return result
                else:
                    plugin.stats['failed'] += 1
        
        return None
    
    def get_stats(self) -> Dict[str, Dict]:
        """Get parsing statistics for all plugins."""
        return {name: plugin.stats for name, plugin in self.plugins.items()}
    
    def list_plugins(self) -> List[Dict]:
        """List all registered plugins."""
        return [
            {
                'vendor': p.VENDOR_NAME,
                'type': p.VENDOR_TYPE,
                'formats': p.SUPPORTED_FORMATS,
            }
            for p in self.plugins.values()
        ]
