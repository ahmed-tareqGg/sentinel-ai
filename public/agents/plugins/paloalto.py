# SOCMind Agent - Palo Alto Plugin
# Copyright (c) 2025 SOCMind. All rights reserved.

import re
import csv
from io import StringIO
from typing import Optional, Dict, List
from .base import BasePlugin, NormalizedLog

class PaloAltoPlugin(BasePlugin):
    """
    Parser for Palo Alto Networks PAN-OS logs.
    
    Supported formats:
    - CSV syslog format
    - CEF format
    
    Log types:
    - TRAFFIC
    - THREAT
    - SYSTEM
    - CONFIG
    - GLOBALPROTECT
    - USERID
    """
    
    VENDOR_NAME = "paloalto"
    VENDOR_TYPE = "firewall"
    SUPPORTED_FORMATS = ["syslog", "cef", "csv"]
    
    # PAN-OS severity levels
    SEVERITY_MAP = {
        'critical': 5, 'high': 4, 'medium': 3,
        'low': 2, 'informational': 1,
        '5': 5, '4': 4, '3': 3, '2': 2, '1': 1,
    }
    
    # Log type field positions (for CSV format)
    TRAFFIC_FIELDS = [
        'receive_time', 'serial', 'type', 'subtype', 'time_generated',
        'src', 'dst', 'natsrc', 'natdst', 'rule',
        'srcuser', 'dstuser', 'app', 'vsys', 'from_zone',
        'to_zone', 'inbound_if', 'outbound_if', 'logset', 'sessionid',
        'repeatcnt', 'sport', 'dport', 'natsport', 'natdport',
        'flags', 'proto', 'action', 'bytes', 'bytes_sent',
        'bytes_received', 'packets', 'start', 'elapsed', 'category',
    ]
    
    THREAT_FIELDS = [
        'receive_time', 'serial', 'type', 'subtype', 'time_generated',
        'src', 'dst', 'natsrc', 'natdst', 'rule',
        'srcuser', 'dstuser', 'app', 'vsys', 'from_zone',
        'to_zone', 'inbound_if', 'outbound_if', 'logset', 'sessionid',
        'repeatcnt', 'sport', 'dport', 'natsport', 'natdport',
        'flags', 'proto', 'action', 'misc', 'threatid',
        'category', 'severity', 'direction', 'seqno', 'actionflags',
    ]
    
    # Threat type to MITRE mapping
    THREAT_MITRE_MAP = {
        'vulnerability': ('T1190', 'Initial Access', 'Exploit Public-Facing Application'),
        'spyware': ('T1071', 'Command and Control', 'Application Layer Protocol'),
        'virus': ('T1204', 'Execution', 'User Execution'),
        'wildfire': ('T1204', 'Execution', 'User Execution'),
        'url': ('T1189', 'Initial Access', 'Drive-by Compromise'),
        'flood': ('T1499', 'Impact', 'Endpoint Denial of Service'),
        'scan': ('T1046', 'Discovery', 'Network Service Discovery'),
        'data': ('T1041', 'Exfiltration', 'Exfiltration Over C2 Channel'),
    }
    
    def can_parse(self, raw_log: str) -> bool:
        """Check if log is from Palo Alto."""
        indicators = [
            'PANOS', 'PAN-OS', 'Palo Alto',
            ',TRAFFIC,', ',THREAT,', ',SYSTEM,',
            'deviceVendor=Palo Alto',
        ]
        return any(ind in raw_log for ind in indicators)
    
    def parse(self, raw_log: str) -> Optional[NormalizedLog]:
        """Parse Palo Alto log."""
        try:
            # Determine format and parse
            if ',TRAFFIC,' in raw_log or ',THREAT,' in raw_log:
                fields = self._parse_csv(raw_log)
            elif 'CEF:' in raw_log:
                fields = self._parse_cef(raw_log)
            else:
                fields = self._parse_csv(raw_log)
            
            if not fields:
                return None
            
            log_type = fields.get('type', 'TRAFFIC').upper()
            subtype = fields.get('subtype', '').lower()
            
            # Map MITRE based on threat type
            if log_type == 'THREAT':
                mitre = self.THREAT_MITRE_MAP.get(subtype, ('T1071', 'Command and Control', 'Application Layer Protocol'))
            else:
                mitre = ('T1071', 'Command and Control', 'Application Layer Protocol')
            
            # Build message
            action = fields.get('action', 'unknown')
            src = fields.get('src', 'unknown')
            dst = fields.get('dst', 'unknown')
            threat = fields.get('threatid', fields.get('misc', ''))
            msg = f"{action}: {src} -> {dst}"
            if threat:
                msg += f" [{threat}]"
            
            # Create normalized log
            normalized = NormalizedLog(
                timestamp=self.parse_timestamp(fields.get('receive_time', fields.get('time_generated', ''))),
                log_type=f"paloalto_{log_type.lower()}",
                message=msg[:500],
                severity=self._map_severity(fields),
                source_vendor=self.VENDOR_NAME,
                source_type=self.VENDOR_TYPE,
                source_ip=fields.get('src'),
                source_port=self._safe_int(fields.get('sport')),
                source_user=fields.get('srcuser'),
                destination_ip=fields.get('dst'),
                destination_port=self._safe_int(fields.get('dport')),
                event_type=f"{log_type}:{subtype}" if subtype else log_type,
                event_action=action.lower(),
                event_outcome='success' if action.lower() in ['allow', 'pass'] else 'failure',
                protocol=fields.get('proto'),
                application=fields.get('app'),
                threat_name=fields.get('threatid'),
                threat_category=fields.get('category'),
                url=fields.get('misc') if 'http' in str(fields.get('misc', '')).lower() else None,
                mitre_technique=mitre[0],
                mitre_tactic=mitre[1],
                mitre_name=mitre[2],
                raw_log={'original': raw_log[:2000], 'fields': fields},
            )
            
            self.add_tags(normalized)
            return normalized
            
        except Exception as e:
            return None
    
    def _parse_csv(self, log: str) -> Dict[str, str]:
        """Parse CSV format log."""
        fields = {}
        
        try:
            # Find CSV portion
            csv_start = log.find(',')
            if csv_start == -1:
                return fields
            
            csv_data = log[csv_start:] if not log[0].isdigit() else log
            reader = csv.reader(StringIO(csv_data))
            values = next(reader, [])
            
            # Determine field mapping based on log type
            if ',TRAFFIC,' in log:
                field_names = self.TRAFFIC_FIELDS
            elif ',THREAT,' in log:
                field_names = self.THREAT_FIELDS
            else:
                field_names = self.TRAFFIC_FIELDS
            
            for i, value in enumerate(values):
                if i < len(field_names):
                    fields[field_names[i]] = value
                    
        except Exception:
            pass
        
        return fields
    
    def _parse_cef(self, log: str) -> Dict[str, str]:
        """Parse CEF format log."""
        fields = {}
        
        try:
            # CEF header
            cef_match = re.search(r'CEF:\d+\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|(.+)', log)
            if cef_match:
                fields['type'] = cef_match.group(4)
                fields['severity'] = cef_match.group(6)
                
                # Parse extension
                ext = cef_match.group(7)
                for match in re.finditer(r'(\w+)=([^\s]+)', ext):
                    fields[match.group(1).lower()] = match.group(2)
                    
        except Exception:
            pass
        
        return fields
    
    def _map_severity(self, fields: Dict) -> int:
        """Map Palo Alto severity to 1-5 scale."""
        sev = fields.get('severity', '2').lower()
        
        if sev in self.SEVERITY_MAP:
            return self.SEVERITY_MAP[sev]
        
        # Infer from action
        action = fields.get('action', '').lower()
        if action in ['deny', 'drop', 'block', 'reset-both']:
            return 4
        
        log_type = fields.get('type', '').upper()
        if log_type == 'THREAT':
            return 4
        
        return 2
    
    def _safe_int(self, value) -> Optional[int]:
        try:
            return int(value) if value else None
        except (ValueError, TypeError):
            return None
