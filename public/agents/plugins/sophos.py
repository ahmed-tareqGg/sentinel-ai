# SOCMind Agent - Sophos Plugin
# Copyright (c) 2025 SOCMind. All rights reserved.

import re
from typing import Optional, Dict
from .base import BasePlugin, NormalizedLog

class SophosPlugin(BasePlugin):
    """
    Parser for Sophos security products.
    
    Supported products:
    - Sophos XG Firewall
    - Sophos UTM (SG)
    - Sophos Central
    - Sophos Intercept X (EDR)
    
    Formats:
    - Key-value syslog
    - JSON
    """
    
    VENDOR_NAME = "sophos"
    VENDOR_TYPE = "firewall"
    SUPPORTED_FORMATS = ["syslog", "json", "kv"]
    
    SEVERITY_MAP = {
        'emergency': 5, 'alert': 5, 'critical': 5,
        'error': 4, 'warning': 3, 'notice': 2,
        'information': 1, 'debug': 1,
    }
    
    # Log type to event mapping
    LOG_TYPE_MAP = {
        'firewall': 'connection',
        'ips': 'exploit_attempt',
        'antivirus': 'malware_detected',
        'atp': 'threat_detected',
        'sandstorm': 'malware_detected',
        'waf': 'web_attack',
        'authentication': 'login',
        'admin': 'config_change',
        'vpn': 'vpn_connection',
    }
    
    def can_parse(self, raw_log: str) -> bool:
        """Check if log is from Sophos."""
        indicators = [
            'device="SFW"', 'device_name=', 'Sophos',
            'log_type=', 'log_component=', 'srczonetype=',
            'XG Firewall', 'Sophos UTM',
        ]
        return any(ind in raw_log for ind in indicators)
    
    def parse(self, raw_log: str) -> Optional[NormalizedLog]:
        """Parse Sophos log."""
        try:
            fields = self._parse_kv(raw_log)
            
            if not fields:
                return None
            
            # Determine log type
            log_type = fields.get('log_type', fields.get('log_component', 'firewall')).lower()
            
            # Get event type
            event_type = self.LOG_TYPE_MAP.get(log_type, 'unknown')
            
            # Handle action-based event refinement
            action = fields.get('fw_rule_type', fields.get('action', '')).lower()
            if 'deny' in action or 'drop' in action:
                event_type = 'connection_blocked'
            
            # Map MITRE
            mitre = self.map_mitre(event_type)
            
            # Build message
            src = fields.get('src_ip', fields.get('srcip', 'unknown'))
            dst = fields.get('dst_ip', fields.get('dstip', 'unknown'))
            msg = fields.get('message', f"{action} {src} -> {dst}")
            
            normalized = NormalizedLog(
                timestamp=self.parse_timestamp(fields.get('date_time', fields.get('timestamp', ''))),
                log_type=f"sophos_{log_type}",
                message=msg[:500],
                severity=self._map_severity(fields),
                source_vendor=self.VENDOR_NAME,
                source_type=self.VENDOR_TYPE,
                source_ip=fields.get('src_ip', fields.get('srcip')),
                source_port=self._safe_int(fields.get('src_port', fields.get('srcport'))),
                source_user=fields.get('user_name', fields.get('user')),
                destination_ip=fields.get('dst_ip', fields.get('dstip')),
                destination_port=self._safe_int(fields.get('dst_port', fields.get('dstport'))),
                event_type=event_type,
                event_action=action if action else 'info',
                event_outcome='failure' if 'deny' in action or 'drop' in action else 'success',
                protocol=fields.get('protocol', fields.get('proto')),
                application=fields.get('application', fields.get('app_name')),
                threat_name=fields.get('threat_name', fields.get('virus')),
                threat_category=fields.get('category', fields.get('classification')),
                url=fields.get('url', fields.get('domain')),
                mitre_technique=mitre['technique'],
                mitre_tactic=mitre['tactic'],
                mitre_name=mitre['name'],
                raw_log={'original': raw_log[:2000], 'fields': fields},
            )
            
            self.add_tags(normalized)
            return normalized
            
        except Exception as e:
            return None
    
    def _parse_kv(self, log: str) -> Dict[str, str]:
        """Parse key=value format."""
        fields = {}
        
        # Handle quoted and unquoted values
        pattern = r'(\w+)=(?:"([^"]*)"|(\S+))'
        matches = re.findall(pattern, log)
        
        for key, quoted_val, unquoted_val in matches:
            fields[key.lower()] = quoted_val if quoted_val else unquoted_val
        
        return fields
    
    def _map_severity(self, fields: Dict) -> int:
        """Map Sophos severity to 1-5 scale."""
        level = fields.get('log_subtype', fields.get('priority', 'information')).lower()
        
        if level in self.SEVERITY_MAP:
            return self.SEVERITY_MAP[level]
        
        # Infer from log type
        log_type = fields.get('log_type', '').lower()
        if log_type in ['ips', 'atp', 'sandstorm']:
            return 4
        if log_type == 'antivirus':
            return 5
        
        return 2
    
    def _safe_int(self, value) -> Optional[int]:
        try:
            return int(value) if value else None
        except (ValueError, TypeError):
            return None
