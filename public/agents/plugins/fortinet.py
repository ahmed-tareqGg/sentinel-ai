# SOCMind Agent - Fortinet Plugin
# Copyright (c) 2025 SOCMind. All rights reserved.

import re
from typing import Optional, Dict
from .base import BasePlugin, NormalizedLog

class FortinetPlugin(BasePlugin):
    """
    Parser for Fortinet FortiGate logs.
    
    Supported formats:
    - Key-value syslog format
    - CEF format
    
    Log types:
    - Traffic logs (forward, local, multicast)
    - UTM logs (virus, webfilter, ips, app-ctrl)
    - Event logs (system, router, vpn, user)
    """
    
    VENDOR_NAME = "fortinet"
    VENDOR_TYPE = "firewall"
    SUPPORTED_FORMATS = ["syslog", "cef", "kv"]
    
    # FortiGate severity mapping (0-7 -> 1-5)
    SEVERITY_MAP = {
        'emergency': 5, 'alert': 5, 'critical': 5,
        'error': 4, 'warning': 3, 'notice': 2,
        'information': 2, 'debug': 1,
        '0': 5, '1': 5, '2': 4, '3': 4,
        '4': 3, '5': 2, '6': 2, '7': 1,
    }
    
    # Event type to MITRE mapping
    EVENT_MITRE_MAP = {
        'traffic:forward': ('T1071', 'Command and Control', 'Application Layer Protocol'),
        'traffic:denied': ('T1071', 'Command and Control', 'Application Layer Protocol'),
        'utm:virus': ('T1204', 'Execution', 'User Execution'),
        'utm:ips': ('T1190', 'Initial Access', 'Exploit Public-Facing Application'),
        'utm:webfilter': ('T1189', 'Initial Access', 'Drive-by Compromise'),
        'utm:app-ctrl': ('T1071', 'Command and Control', 'Application Layer Protocol'),
        'event:vpn': ('T1133', 'Persistence', 'External Remote Services'),
        'event:user': ('T1078', 'Defense Evasion', 'Valid Accounts'),
        'event:system': ('T1562', 'Defense Evasion', 'Impair Defenses'),
    }
    
    def can_parse(self, raw_log: str) -> bool:
        """Check if log is from FortiGate."""
        indicators = [
            'devname=', 'devid=FG', 'logid=', 
            'type=traffic', 'type=utm', 'type=event',
            'FortiGate', 'Fortigate',
        ]
        return any(ind in raw_log for ind in indicators)
    
    def parse(self, raw_log: str) -> Optional[NormalizedLog]:
        """Parse FortiGate log."""
        try:
            # Parse key=value pairs
            fields = self._parse_kv(raw_log)
            
            if not fields:
                return None
            
            # Determine log type
            log_type = fields.get('type', 'traffic')
            subtype = fields.get('subtype', '')
            event_key = f"{log_type}:{subtype}" if subtype else log_type
            
            # Map MITRE
            mitre = self.EVENT_MITRE_MAP.get(event_key, ('T1059', 'Execution', 'Command and Scripting Interpreter'))
            
            # Build message
            action = fields.get('action', fields.get('status', 'unknown'))
            src = fields.get('srcip', fields.get('srcaddr', 'unknown'))
            dst = fields.get('dstip', fields.get('dstaddr', 'unknown'))
            msg = fields.get('msg', f"{action} {src} -> {dst}")
            
            # Create normalized log
            normalized = NormalizedLog(
                timestamp=self.parse_timestamp(fields.get('date', '') + ' ' + fields.get('time', '')),
                log_type=f"fortinet_{log_type}",
                message=msg[:500],
                severity=self._map_severity(fields),
                source_vendor=self.VENDOR_NAME,
                source_type=self.VENDOR_TYPE,
                source_ip=fields.get('srcip', fields.get('srcaddr')),
                source_port=self._safe_int(fields.get('srcport')),
                source_user=fields.get('user', fields.get('srcuser')),
                destination_ip=fields.get('dstip', fields.get('dstaddr')),
                destination_port=self._safe_int(fields.get('dstport')),
                event_type=event_key,
                event_action=action,
                event_outcome='success' if action in ['accept', 'pass', 'allow'] else 'failure',
                protocol=fields.get('proto', fields.get('service')),
                application=fields.get('app', fields.get('appcat')),
                threat_name=fields.get('attack', fields.get('virus')),
                threat_category=fields.get('attackid', fields.get('virusid')),
                url=fields.get('url', fields.get('hostname')),
                mitre_technique=mitre[0],
                mitre_tactic=mitre[1],
                mitre_name=mitre[2],
                raw_log={'original': raw_log[:2000], 'fields': fields},
            )
            
            self.add_tags(normalized)
            return normalized
            
        except Exception as e:
            return None
    
    def _parse_kv(self, log: str) -> Dict[str, str]:
        """Parse key=value format."""
        fields = {}
        
        # Handle quoted values
        pattern = r'(\w+)=(?:"([^"]*)"|(\S+))'
        matches = re.findall(pattern, log)
        
        for key, quoted_val, unquoted_val in matches:
            fields[key.lower()] = quoted_val if quoted_val else unquoted_val
        
        return fields
    
    def _map_severity(self, fields: Dict) -> int:
        """Map FortiGate severity to 1-5 scale."""
        level = fields.get('level', fields.get('pri', '6')).lower()
        
        if level in self.SEVERITY_MAP:
            return self.SEVERITY_MAP[level]
        
        # Infer from action/type
        action = fields.get('action', '').lower()
        if action in ['deny', 'blocked', 'dropped']:
            return 4
        if fields.get('attack') or fields.get('virus'):
            return 5
        
        return 2
    
    def _safe_int(self, value) -> Optional[int]:
        """Safely convert to int."""
        try:
            return int(value) if value else None
        except (ValueError, TypeError):
            return None
