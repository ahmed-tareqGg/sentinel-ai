# SOCMind Agent - Cisco Plugin
# Copyright (c) 2025 SOCMind. All rights reserved.

import re
from typing import Optional, Dict
from .base import BasePlugin, NormalizedLog

class CiscoPlugin(BasePlugin):
    """
    Parser for Cisco security devices.
    
    Supported devices:
    - Cisco ASA (Adaptive Security Appliance)
    - Cisco Firepower (FTD)
    - Cisco ISE (Identity Services Engine)
    - Cisco Meraki
    
    Formats:
    - Syslog (RFC 3164/5424)
    - EMBLEM format
    """
    
    VENDOR_NAME = "cisco"
    VENDOR_TYPE = "firewall"
    SUPPORTED_FORMATS = ["syslog", "emblem"]
    
    # ASA message severity (embedded in message ID)
    # %ASA-<severity>-<message_id>
    ASA_SEVERITY_MAP = {
        '0': 5, '1': 5, '2': 4, '3': 4,
        '4': 3, '5': 2, '6': 2, '7': 1,
    }
    
    # Common ASA message IDs and their meanings
    ASA_MESSAGES = {
        '106001': ('connection_blocked', 'Inbound TCP connection denied'),
        '106002': ('connection_blocked', 'Outbound TCP connection denied'),
        '106006': ('connection_blocked', 'Deny inbound UDP'),
        '106007': ('connection_blocked', 'Deny inbound UDP'),
        '106014': ('connection_blocked', 'Deny inbound ICMP'),
        '106015': ('connection_blocked', 'Deny TCP (no connection)'),
        '106021': ('connection_blocked', 'Deny protocol reverse path check'),
        '106023': ('connection_blocked', 'Deny protocol by access-group'),
        '106100': ('policy_check', 'Access list hit'),
        '110002': ('nat_failure', 'NAT failed'),
        '111008': ('login_success', 'User logged in'),
        '111009': ('login_failed', 'User login failed'),
        '113004': ('login_success', 'AAA user authentication successful'),
        '113005': ('login_failed', 'AAA user authentication rejected'),
        '113012': ('login_failed', 'AAA user rejected'),
        '113019': ('login_success', 'Group policy applied'),
        '302013': ('connection_opened', 'Built TCP connection'),
        '302014': ('connection_closed', 'Teardown TCP connection'),
        '302015': ('connection_opened', 'Built UDP connection'),
        '302016': ('connection_closed', 'Teardown UDP connection'),
        '302020': ('connection_opened', 'Built ICMP connection'),
        '302021': ('connection_closed', 'Teardown ICMP connection'),
        '313001': ('connection_blocked', 'Denied ICMP type'),
        '313005': ('connection_blocked', 'No matching connection'),
        '400001': ('ips_alert', 'IPS signature detected'),
        '430001': ('threat_detected', 'Firepower threat detected'),
        '430002': ('malware_detected', 'Malware detected'),
        '430003': ('exploit_attempt', 'Intrusion detected'),
        '710003': ('login_failed', 'TCP access denied'),
        '713228': ('vpn_connection', 'IPSec tunnel created'),
        '713229': ('vpn_disconnect', 'IPSec tunnel deleted'),
        '716038': ('vpn_connection', 'WebVPN session started'),
        '716039': ('vpn_disconnect', 'WebVPN session ended'),
        '722022': ('vpn_connection', 'AnyConnect session started'),
        '722023': ('vpn_disconnect', 'AnyConnect session ended'),
        '722051': ('vpn_connection', 'VPN group-policy applied'),
        '733100': ('port_scan', 'Object dropped - scanning threshold exceeded'),
    }
    
    def can_parse(self, raw_log: str) -> bool:
        """Check if log is from Cisco."""
        indicators = [
            '%ASA-', '%FTD-', '%FWSM-', '%PIX-',
            'Cisco', 'ASA', 'Firepower',
            '%SEC-', '%SNORT-',
        ]
        return any(ind in raw_log for ind in indicators)
    
    def parse(self, raw_log: str) -> Optional[NormalizedLog]:
        """Parse Cisco log."""
        try:
            # Extract ASA/FTD message pattern
            asa_match = re.search(r'%(ASA|FTD|FWSM|PIX)-(\d)-(\d+):\s*(.+)', raw_log)
            
            if asa_match:
                return self._parse_asa(raw_log, asa_match)
            
            # Try generic Cisco syslog
            return self._parse_generic(raw_log)
            
        except Exception as e:
            return None
    
    def _parse_asa(self, raw_log: str, match) -> Optional[NormalizedLog]:
        """Parse Cisco ASA/FTD format."""
        device = match.group(1)
        severity = match.group(2)
        msg_id = match.group(3)
        message = match.group(4)
        
        # Get event type from message ID
        event_info = self.ASA_MESSAGES.get(msg_id, ('unknown', message[:100]))
        event_type = event_info[0]
        
        # Extract IPs
        src_ip = None
        dst_ip = None
        src_port = None
        dst_port = None
        
        # Pattern: src X.X.X.X/port dst Y.Y.Y.Y/port
        ip_pattern = r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})[:/]?(\d+)?'
        
        src_match = re.search(r'(?:src|from|faddr)\s+' + ip_pattern, message, re.I)
        if src_match:
            src_ip = src_match.group(1)
            src_port = self._safe_int(src_match.group(2))
        
        dst_match = re.search(r'(?:dst|to|laddr)\s+' + ip_pattern, message, re.I)
        if dst_match:
            dst_ip = dst_match.group(1)
            dst_port = self._safe_int(dst_match.group(2))
        
        # Extract user
        user_match = re.search(r'(?:user|User)\s*[=:]?\s*<?(\S+@?\S*)>?', message)
        user = user_match.group(1) if user_match else None
        
        # Map MITRE
        mitre = self.map_mitre(event_type)
        
        # Determine action
        action = 'deny'
        if 'Built' in message or 'connection' in message.lower():
            action = 'allow'
        if 'Deny' in message or 'denied' in message.lower():
            action = 'deny'
        
        normalized = NormalizedLog(
            timestamp=self._extract_timestamp(raw_log),
            log_type=f"cisco_{device.lower()}",
            message=f"[{msg_id}] {message[:450]}",
            severity=self.ASA_SEVERITY_MAP.get(severity, 3),
            source_vendor=self.VENDOR_NAME,
            source_type=self.VENDOR_TYPE,
            source_ip=src_ip,
            source_port=src_port,
            source_user=user,
            destination_ip=dst_ip,
            destination_port=dst_port,
            event_type=event_type,
            event_action=action,
            event_outcome='failure' if action == 'deny' else 'success',
            protocol=self._extract_protocol(message),
            mitre_technique=mitre['technique'],
            mitre_tactic=mitre['tactic'],
            mitre_name=mitre['name'],
            raw_log={'original': raw_log[:2000], 'msg_id': msg_id, 'device': device},
        )
        
        self.add_tags(normalized)
        return normalized
    
    def _parse_generic(self, raw_log: str) -> Optional[NormalizedLog]:
        """Parse generic Cisco syslog."""
        # Extract basic info
        src_ip = self.extract_ip(raw_log)
        
        normalized = NormalizedLog(
            timestamp=self._extract_timestamp(raw_log),
            log_type="cisco_generic",
            message=raw_log[:500],
            severity=2,
            source_vendor=self.VENDOR_NAME,
            source_type=self.VENDOR_TYPE,
            source_ip=src_ip,
            event_type='unknown',
            event_action='info',
            raw_log={'original': raw_log[:2000]},
        )
        
        self.add_tags(normalized)
        return normalized
    
    def _extract_timestamp(self, log: str) -> str:
        """Extract timestamp from Cisco log."""
        # Cisco format: "Jan 01 12:34:56" or "2024-01-01T12:34:56"
        patterns = [
            r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})',
            r'([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, log)
            if match:
                return self.parse_timestamp(match.group(1))
        
        return self.parse_timestamp('')
    
    def _extract_protocol(self, message: str) -> Optional[str]:
        """Extract protocol from message."""
        message_lower = message.lower()
        for proto in ['tcp', 'udp', 'icmp', 'gre', 'esp', 'ah']:
            if proto in message_lower:
                return proto.upper()
        return None
    
    def _safe_int(self, value) -> Optional[int]:
        try:
            return int(value) if value else None
        except (ValueError, TypeError):
            return None
