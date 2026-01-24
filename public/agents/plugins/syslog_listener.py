# SOCMind Agent - Syslog Listener
# Copyright (c) 2025 SOCMind. All rights reserved.

"""
UDP/TCP Syslog listener for receiving logs from network devices.

Usage:
    listener = SyslogListener(port=514, protocol='udp')
    listener.start(callback=handle_log)
"""

import socket
import threading
import queue
import re
from datetime import datetime
from typing import Callable, Optional, Dict, Any
from dataclasses import dataclass


@dataclass
class SyslogMessage:
    """Parsed syslog message."""
    facility: int
    severity: int
    timestamp: str
    hostname: str
    app_name: str
    message: str
    raw: str
    source_ip: str
    source_port: int


class SyslogListener:
    """
    Multi-protocol syslog listener supporting UDP and TCP.
    
    Features:
    - RFC 3164 and RFC 5424 parsing
    - CEF/LEEF detection
    - Buffered message queue
    - Graceful shutdown
    """
    
    # Syslog facility names
    FACILITIES = {
        0: 'kern', 1: 'user', 2: 'mail', 3: 'daemon',
        4: 'auth', 5: 'syslog', 6: 'lpr', 7: 'news',
        8: 'uucp', 9: 'cron', 10: 'authpriv', 11: 'ftp',
        16: 'local0', 17: 'local1', 18: 'local2', 19: 'local3',
        20: 'local4', 21: 'local5', 22: 'local6', 23: 'local7',
    }
    
    # Syslog severity names
    SEVERITIES = {
        0: 'emerg', 1: 'alert', 2: 'crit', 3: 'err',
        4: 'warning', 5: 'notice', 6: 'info', 7: 'debug',
    }
    
    def __init__(
        self,
        port: int = 514,
        protocol: str = 'udp',
        bind_address: str = '0.0.0.0',
        buffer_size: int = 65535,
        queue_size: int = 10000,
    ):
        self.port = port
        self.protocol = protocol.lower()
        self.bind_address = bind_address
        self.buffer_size = buffer_size
        self.queue_size = queue_size
        
        self.message_queue = queue.Queue(maxsize=queue_size)
        self.running = False
        self.socket = None
        self.listener_thread = None
        self.processor_thread = None
        self._callback = None
        
        self.stats = {
            'received': 0,
            'parsed': 0,
            'errors': 0,
            'queue_full': 0,
        }
    
    def start(self, callback: Callable[[SyslogMessage], None]):
        """Start the syslog listener."""
        self._callback = callback
        self.running = True
        
        if self.protocol == 'udp':
            self._start_udp()
        else:
            self._start_tcp()
        
        # Start message processor
        self.processor_thread = threading.Thread(target=self._process_queue, daemon=True)
        self.processor_thread.start()
        
        print(f"[SYSLOG] Listening on {self.protocol.upper()} {self.bind_address}:{self.port}")
    
    def stop(self):
        """Stop the syslog listener."""
        self.running = False
        
        if self.socket:
            try:
                self.socket.close()
            except:
                pass
        
        print(f"[SYSLOG] Stopped. Stats: {self.stats}")
    
    def _start_udp(self):
        """Start UDP listener."""
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.bind((self.bind_address, self.port))
        
        self.listener_thread = threading.Thread(target=self._udp_listener, daemon=True)
        self.listener_thread.start()
    
    def _start_tcp(self):
        """Start TCP listener."""
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.bind((self.bind_address, self.port))
        self.socket.listen(100)
        
        self.listener_thread = threading.Thread(target=self._tcp_listener, daemon=True)
        self.listener_thread.start()
    
    def _udp_listener(self):
        """UDP receive loop."""
        while self.running:
            try:
                data, addr = self.socket.recvfrom(self.buffer_size)
                self.stats['received'] += 1
                
                raw = data.decode('utf-8', errors='replace').strip()
                msg = self._parse_syslog(raw, addr[0], addr[1])
                
                if msg:
                    try:
                        self.message_queue.put_nowait(msg)
                        self.stats['parsed'] += 1
                    except queue.Full:
                        self.stats['queue_full'] += 1
                else:
                    self.stats['errors'] += 1
                    
            except Exception as e:
                if self.running:
                    self.stats['errors'] += 1
    
    def _tcp_listener(self):
        """TCP accept loop."""
        while self.running:
            try:
                client, addr = self.socket.accept()
                handler = threading.Thread(
                    target=self._handle_tcp_client,
                    args=(client, addr),
                    daemon=True
                )
                handler.start()
            except Exception as e:
                if self.running:
                    pass
    
    def _handle_tcp_client(self, client: socket.socket, addr: tuple):
        """Handle TCP client connection."""
        buffer = ""
        
        try:
            while self.running:
                data = client.recv(self.buffer_size)
                if not data:
                    break
                
                buffer += data.decode('utf-8', errors='replace')
                
                # Process complete messages (newline-delimited)
                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    self.stats['received'] += 1
                    
                    msg = self._parse_syslog(line.strip(), addr[0], addr[1])
                    if msg:
                        try:
                            self.message_queue.put_nowait(msg)
                            self.stats['parsed'] += 1
                        except queue.Full:
                            self.stats['queue_full'] += 1
                    else:
                        self.stats['errors'] += 1
        finally:
            client.close()
    
    def _process_queue(self):
        """Process messages from queue."""
        while self.running:
            try:
                msg = self.message_queue.get(timeout=1)
                if self._callback:
                    self._callback(msg)
            except queue.Empty:
                continue
            except Exception as e:
                pass
    
    def _parse_syslog(self, raw: str, source_ip: str, source_port: int) -> Optional[SyslogMessage]:
        """Parse syslog message (RFC 3164/5424)."""
        try:
            facility = 1  # user
            severity = 6  # info
            timestamp = datetime.utcnow().isoformat() + 'Z'
            hostname = source_ip
            app_name = ""
            message = raw
            
            # Try to parse PRI
            pri_match = re.match(r'^<(\d+)>(.+)', raw)
            if pri_match:
                pri = int(pri_match.group(1))
                facility = pri >> 3
                severity = pri & 0x07
                raw = pri_match.group(2)
            
            # Try RFC 5424 format
            rfc5424_match = re.match(
                r'^(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+-?\s*(.+)?',
                raw
            )
            
            if rfc5424_match:
                timestamp = rfc5424_match.group(2)
                hostname = rfc5424_match.group(3) if rfc5424_match.group(3) != '-' else source_ip
                app_name = rfc5424_match.group(4) if rfc5424_match.group(4) != '-' else ''
                message = rfc5424_match.group(7) or ''
            else:
                # Try RFC 3164 format
                rfc3164_match = re.match(
                    r'^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.+)',
                    raw
                )
                
                if rfc3164_match:
                    timestamp = rfc3164_match.group(1)
                    hostname = rfc3164_match.group(2)
                    message = rfc3164_match.group(3)
                    
                    # Extract app name
                    app_match = re.match(r'^(\S+?)(?:\[(\d+)\])?:\s*(.+)', message)
                    if app_match:
                        app_name = app_match.group(1)
                        message = app_match.group(3)
            
            return SyslogMessage(
                facility=facility,
                severity=severity,
                timestamp=timestamp,
                hostname=hostname,
                app_name=app_name,
                message=message,
                raw=raw,
                source_ip=source_ip,
                source_port=source_port,
            )
            
        except Exception as e:
            return None
    
    def get_stats(self) -> Dict[str, int]:
        """Get listener statistics."""
        return {
            **self.stats,
            'queue_size': self.message_queue.qsize(),
        }


# Convenience function for quick setup
def create_listener(
    port: int = 514,
    protocol: str = 'udp',
    callback: Optional[Callable] = None
) -> SyslogListener:
    """Create and optionally start a syslog listener."""
    listener = SyslogListener(port=port, protocol=protocol)
    if callback:
        listener.start(callback)
    return listener
