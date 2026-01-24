# SOCMind Agent - Check Point Plugin
# Copyright (c) 2025 SOCMind. All rights reserved.

import re
from typing import Optional, Dict
from .base import BasePlugin, NormalizedLog

class CheckPointPlugin(BasePlugin):
    """
    Parser for Check Point security products.
    
    Supported products:
    - Check Point Firewall (NGFW)
    - Check Point Threat Prevention
    - Check Point SmartEvent
    
    Formats:
    - Log Exporter (LEA)
    - Syslog CEF
    - OPSEC LEA
    """
    
    VENDOR_NAME = "checkpoint"
    VENDOR_TYPE = "firewall"
    SUPPORTED_FORMATS = ["syslog", "cef", "lea"]
    
    SEVERITY_MAP = {
        'critical': 5, 'high': 4, 'medium': 3,
        'low': 2, 'informational': 1,
    }
    
    # Check Point action to event type
    ACTION_MAP = {
        'accept': 'connection_opened',
        'allow': 'connection_opened',
        'drop': 'connection_blocked',
        'reject': 'connection_blocked',
        'block': 'connection_blocked',
        'prevent': 'threat_detected',
        'detect': 'threat_detected',
        'ask': 'policy_check',
        'key install': 'vpn_connection',
        'encrypt': 'vpn_connection',
        'decrypt': 'vpn_connection',
    }
    
    # Blade to MITRE mapping
    BLADE_MITRE_MAP = {
        'Firewall': ('T1071', 'Command and Control', 'Application Layer Protocol'),
        'Application Control': ('T1071', 'Command and Control', 'Application Layer Protocol'),
        'URL Filtering': ('T1189', 'Initial Access', 'Drive-by Compromise'),
        'Anti-Bot': ('T1071', 'Command and Control', 'Application Layer Protocol'),
        'Anti-Virus': ('T1204', 'Execution', 'User Execution'),
        'IPS': ('T1190', 'Initial Access', 'Exploit Public-Facing Application'),
        'Threat Emulation': ('T1204', 'Execution', 'User Execution'),
        'Threat Extraction': ('T1204', 'Execution', 'User Execution'),
        'Anti-Spam': ('T1566', 'Initial Access', 'Phishing'),
        'VPN': ('T1133', 'Persistence', 'External Remote Services'),
        'Identity Awareness': ('T1078', 'Defense Evasion', 'Valid Accounts'),
        'DLP': ('T1041', 'Exfiltration', 'Exfiltration Over C2 Channel'),
    }
    
    def can_parse(self, raw_log: str) -> bool:
        """Check if log is from Check Point."""
        indicators = [
            'product=', 'Check Point', 'SmartDefense',
            'fw_subproduct=', 'Protection name=',
            'deviceVendor=Check Point',
        ]
        return any(ind in raw_log for ind in indicators)
    
    def parse(self, raw_log: str) -> Optional[NormalizedLog]:
        """Parse Check Point log."""
        try:
            # Parse key=value format
            fields = self._parse_kv(raw_log)
            
            if not fields:
                # Try CEF format
                fields = self._parse_cef(raw_log)
            
            if not fields:
                return None
            
            # Get blade/product
            blade = fields.get('blade', fields.get('product', fields.get('fw_subproduct', 'Firewall')))
            
            # Get action and event type
            action = fields.get('action', fields.get('rule_action', 'unknown')).lower()
            event_type = self.ACTION_MAP.get(action, 'unknown')
            
            # Map MITRE based on blade
            mitre = self.BLADE_MITRE_MAP.get(blade, ('T1071', 'Command and Control', 'Application Layer Protocol'))
            
            # Build message
            src = fields.get('src', fields.get('s_port', 'unknown'))
            dst = fields.get('dst', fields.get('origin', 'unknown'))
            msg = fields.get('message', f"{action}: {src} -> {dst}")
            
            # Protection name for threats
            threat = fields.get('protection_name', fields.get('malware_action', fields.get('attack')))
            if threat:
                msg = f"[{threat}] {msg}"
            
            normalized = NormalizedLog(
                timestamp=self.parse_timestamp(fields.get('time', fields.get('date', ''))),
                log_type=f"checkpoint_{blade.lower().replace(' ', '_')}",
                message=msg[:500],
                severity=self._map_severity(fields, blade),
                source_vendor=self.VENDOR_NAME,
                source_type=self.VENDOR_TYPE,
                source_ip=fields.get('src', fields.get('source')),
                source_port=self._safe_int(fields.get('s_port', fields.get('src_port'))),
                source_user=fields.get('src_user_name', fields.get('user')),
                destination_ip=fields.get('dst', fields.get('destination')),
                destination_port=self._safe_int(fields.get('service', fields.get('dst_port'))),
                event_type=event_type,
                event_action=action,
                event_outcome='failure' if action in ['drop', 'reject', 'block', 'prevent'] else 'success',
                protocol=fields.get('proto', fields.get('protocol')),
                application=fields.get('appi_name', fields.get('app_name')),
                threat_name=threat,
                threat_category=fields.get('protection_type', fields.get('attack_info')),
                url=fields.get('resource', fields.get('url')),
                mitre_technique=mitre[0],
                mitre_tactic=mitre[1],
                mitre_name=mitre[2],
                raw_log={'original': raw_log[:2000], 'fields': fields, 'blade': blade},
            )
            
            self.add_tags(normalized)
            
            # Add blade-specific tag
            normalized.tags.append(f"blade:{blade.lower().replace(' ', '-')}")
            
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
    
    def _parse_cef(self, log: str) -> Dict[str, str]:
        """Parse CEF format."""
        fields = {}
        
        try:
            cef_match = re.search(r'CEF:\d+\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|(.+)', log)
            if cef_match:
                fields['product'] = cef_match.group(2)
                fields['severity'] = cef_match.group(6)
                
                ext = cef_match.group(7)
                for match in re.finditer(r'(\w+)=([^\s]+)', ext):
                    fields[match.group(1).lower()] = match.group(2)
                    
        except Exception:
            pass
        
        return fields
    
    def _map_severity(self, fields: Dict, blade: str) -> int:
        """Map Check Point severity to 1-5 scale."""
        sev = fields.get('severity', fields.get('confidence_level', '')).lower()
        
        if sev in self.SEVERITY_MAP:
            return self.SEVERITY_MAP[sev]
        
        # Infer from action
        action = fields.get('action', '').lower()
        if action in ['drop', 'reject', 'block', 'prevent']:
            return 4
        
        # Infer from blade
        if blade in ['Anti-Virus', 'Threat Emulation', 'Anti-Bot', 'IPS']:
            return 4
        
        return 2
    
    def _safe_int(self, value) -> Optional[int]:
        try:
            return int(value) if value else None
        except (ValueError, TypeError):
            return None
