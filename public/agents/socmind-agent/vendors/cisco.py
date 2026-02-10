"""
SOCMind Vendor Plugin – Cisco ASA / Firepower
Parses Cisco syslog messages and maps to MITRE ATT&CK.
"""

import re

VENDOR_NAME = "cisco"
SUPPORTED_LOG_TYPES = ["ASA", "FTD", "Firepower"]

MITRE_MAPPING = {
    "106023": {"tactic": "Initial Access", "technique": "T1190", "desc": "Denied packet"},
    "106100": {"tactic": "Initial Access", "technique": "T1190", "desc": "ACL hit"},
    "113004": {"tactic": "Credential Access", "technique": "T1110", "desc": "AAA auth failed"},
    "113005": {"tactic": "Credential Access", "technique": "T1110", "desc": "AAA auth rejected"},
    "305011": {"tactic": "Lateral Movement", "technique": "T1021", "desc": "NAT build"},
    "710003": {"tactic": "Credential Access", "technique": "T1110", "desc": "TCP access denied"},
    "733100": {"tactic": "Impact", "technique": "T1498", "desc": "Drop rate exceeded"},
    "419002": {"tactic": "Command and Control", "technique": "T1071", "desc": "Duplicate TCP SYN"},
}


def parse(raw_log: str) -> dict:
    """Parse a Cisco ASA/FTD syslog message."""
    parsed = {"vendor": VENDOR_NAME, "raw": raw_log}

    # Extract message ID: %ASA-4-106023 or %FTD-4-106023
    msg_match = re.search(r'%(ASA|FTD)-(\d)-(\d+)', raw_log)
    if msg_match:
        parsed["log_type"] = msg_match.group(1).lower()
        parsed["severity"] = _cisco_severity(int(msg_match.group(2)))
        msg_id = msg_match.group(3)
        parsed["message_id"] = msg_id

        if msg_id in MITRE_MAPPING:
            m = MITRE_MAPPING[msg_id]
            parsed["mitre_tactic"] = m["tactic"]
            parsed["mitre_technique"] = m["technique"]

    # Extract IPs
    ip_pattern = r'(\d+\.\d+\.\d+\.\d+)'
    ips = re.findall(ip_pattern, raw_log)
    if len(ips) >= 1:
        parsed["src_ip"] = ips[0]
    if len(ips) >= 2:
        parsed["dst_ip"] = ips[1]

    # Extract user
    user_match = re.search(r'user[= ]+["\']?(\S+)["\']?', raw_log, re.IGNORECASE)
    if user_match:
        parsed["user"] = user_match.group(1)

    parsed["message"] = raw_log[:300]

    return parsed


def _cisco_severity(level: int) -> int:
    """Map Cisco severity levels (0-7) to SOCMind severity (1-5)."""
    mapping = {0: 5, 1: 5, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1, 7: 1}
    return mapping.get(level, 2)
