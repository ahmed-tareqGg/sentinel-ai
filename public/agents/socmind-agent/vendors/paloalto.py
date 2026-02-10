"""
SOCMind Vendor Plugin – Palo Alto Networks
Parses PAN-OS syslog messages (CSV format) and maps to MITRE ATT&CK.
"""

VENDOR_NAME = "paloalto"
SUPPORTED_LOG_TYPES = ["TRAFFIC", "THREAT", "SYSTEM", "CONFIG"]

MITRE_MAPPING = {
    "spyware": {"tactic": "Command and Control", "technique": "T1071"},
    "vulnerability": {"tactic": "Initial Access", "technique": "T1190"},
    "virus": {"tactic": "Execution", "technique": "T1204"},
    "wildfire": {"tactic": "Execution", "technique": "T1059"},
    "url": {"tactic": "Initial Access", "technique": "T1566.002"},
    "flood": {"tactic": "Impact", "technique": "T1498"},
    "scan": {"tactic": "Reconnaissance", "technique": "T1595"},
    "data": {"tactic": "Exfiltration", "technique": "T1041"},
}


def parse(raw_log: str) -> dict:
    """Parse a PAN-OS CSV syslog message."""
    parsed = {"vendor": VENDOR_NAME, "raw": raw_log}

    fields = raw_log.split(",")
    if len(fields) < 15:
        parsed["message"] = raw_log[:200]
        parsed["severity"] = 2
        return parsed

    log_type = fields[3] if len(fields) > 3 else "TRAFFIC"
    parsed["log_type"] = log_type.lower()

    if log_type == "THREAT":
        parsed["src_ip"] = fields[7] if len(fields) > 7 else ""
        parsed["dst_ip"] = fields[8] if len(fields) > 8 else ""
        parsed["user"] = fields[12] if len(fields) > 12 else ""
        threat_type = fields[30] if len(fields) > 30 else ""
        parsed["subtype"] = threat_type
        parsed["severity"] = _map_severity(fields[29] if len(fields) > 29 else "medium")
        parsed["message"] = fields[33] if len(fields) > 33 else raw_log[:200]

        for key, mitre in MITRE_MAPPING.items():
            if key in threat_type.lower():
                parsed["mitre_tactic"] = mitre["tactic"]
                parsed["mitre_technique"] = mitre["technique"]
                break

    elif log_type == "TRAFFIC":
        parsed["src_ip"] = fields[7] if len(fields) > 7 else ""
        parsed["dst_ip"] = fields[8] if len(fields) > 8 else ""
        parsed["action"] = fields[29] if len(fields) > 29 else ""
        parsed["severity"] = 2
        parsed["message"] = f"Traffic {parsed['action']} from {parsed['src_ip']} to {parsed['dst_ip']}"

    return parsed


def _map_severity(level: str) -> int:
    severity_map = {
        "critical": 5, "high": 4, "medium": 3, "low": 2, "informational": 1,
    }
    return severity_map.get(level.lower(), 2)
