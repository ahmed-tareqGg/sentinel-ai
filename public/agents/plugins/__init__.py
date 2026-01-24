# SOCMind Agent Plugin System
# Copyright (c) 2025 SOCMind. All rights reserved.

"""
Plugin system for parsing and normalizing logs from various security vendors.

Supported Vendors:
- Fortinet (FortiGate)
- Palo Alto Networks
- Cisco (ASA, Firepower)
- Sophos
- Check Point

Each plugin provides:
- Log parsing (Syslog, CEF, LEEF formats)
- Field normalization to unified schema
- Severity mapping (1-5 scale)
- MITRE ATT&CK technique mapping
"""

from .base import BasePlugin, PluginManager, NormalizedLog
from .fortinet import FortinetPlugin
from .paloalto import PaloAltoPlugin
from .cisco import CiscoPlugin
from .sophos import SophosPlugin
from .checkpoint import CheckPointPlugin

__all__ = [
    'BasePlugin',
    'PluginManager', 
    'NormalizedLog',
    'FortinetPlugin',
    'PaloAltoPlugin',
    'CiscoPlugin',
    'SophosPlugin',
    'CheckPointPlugin',
]

__version__ = '1.0.0'
