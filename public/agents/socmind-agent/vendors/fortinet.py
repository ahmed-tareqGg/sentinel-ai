"""
SOCMind Vendor Plugin – Fortinet FortiGate
Parses FortiGate syslog messages and maps to MITRE ATT&CK.
"""

import re

VENDOR_NAME = "fortinet"
SUPPORTED_LOG_TYPES = ["traffic", "utm", "event", "security"]

MITRE_MAPPING = {
    "attack": {"tactic": "Initial Access", "technique": "T1190"},
    "virus": {"tactic": "Execution", "technique": "T1204"},
    "webfilter": {"tactic": "Command and Control", "technique": "T1071"},
    "ips": {"tactic": "Initial Access", "technique": "T1190"},
    "anomaly": {"tactic": "Discovery", "technique": "T1046"},
    "dns": {"tactic": "Command and Control", "technique": "T1071.004"},
    "ssl": {"tactic": "Credential Access", "technique": "T1557"},
}


def parse(raw_log: str) -> dict:
    """Parse a FortiGate syslog message into normalized format."""
    parsed = {"vendor": VENDOR_NAME, "raw": raw_log}

    # Extract key=value pairs
    fields = {}
    for match in re.finditer(r'(\w+)="?([^"\s]+)"?', raw_log):
        fields[match.group(1)] = match.group(2)

    parsed["src_ip"] = fields.get("srcip", "")
    parsed["dst_ip"] = fields.get("dstip", "")
    parsed["action"] = fields.get("action", "")
    parsed["log_type"] = fields.get("type", "traffic")
    parsed["subtype"] = fields.get("subtype", "")
    parsed["severity"] = _map_severity(fields.get("level", "notice"))
    parsed["message"] = fields.get("msg", raw_log[:200])
    parsed["policy_id"] = fields.get("policyid", "")
    parsed["user"] = fields.get("user", "")
    parsed["hostname"] = fields.get("devname", "")

    # MITRE mapping
    subtype = parsed["subtype"].lower()
    if subtype in MITRE_MAPPING:
        parsed["mitre_tactic"] = MITRE_MAPPING[subtype]["tactic"]
        parsed["mitre_technique"] = MITRE_MAPPING[subtype]["technique"]

    return parsed


def _map_severity(level: str) -> int:
    """Map FortiGate log levels to SOCMind severity (1-5)."""
    severity_map = {
        "emergency": 5, "alert": 5, "critical": 5,
        "error": 4, "warning": 3, "notice": 2,
        "information": 1, "debug": 1,
    }
    return severity_map.get(level.lower(), 2)
