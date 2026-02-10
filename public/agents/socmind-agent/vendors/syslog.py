"""
SOCMind Vendor Plugin – Generic Syslog Receiver
Listens for syslog messages (UDP/TCP) and routes to vendor-specific parsers.
"""

import socket
import threading
import importlib

VENDOR_NAME = "syslog"
DEFAULT_PORT = 514


class SyslogListener:
    def __init__(self, config: dict, on_log_callback=None):
        self.port = config.get("syslog", {}).get("port", DEFAULT_PORT)
        self.protocol = config.get("syslog", {}).get("protocol", "udp").lower()
        self.callback = on_log_callback
        self._vendors = {}
        self._load_vendors()

    def _load_vendors(self):
        """Load all available vendor parsers."""
        vendor_modules = ["fortinet", "paloalto", "cisco"]
        for name in vendor_modules:
            try:
                mod = importlib.import_module(f"vendors.{name}")
                if hasattr(mod, "parse") and hasattr(mod, "VENDOR_NAME"):
                    self._vendors[mod.VENDOR_NAME] = mod
            except Exception:
                pass

    def start(self, shutdown_event: threading.Event):
        """Start the syslog listener."""
        if self.protocol == "udp":
            self._listen_udp(shutdown_event)
        else:
            self._listen_tcp(shutdown_event)

    def _listen_udp(self, shutdown_event: threading.Event):
        """Listen for syslog messages over UDP."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.settimeout(1.0)
        sock.bind(("0.0.0.0", self.port))

        print(f"[SYSLOG] Listening on UDP:{self.port}")

        while not shutdown_event.is_set():
            try:
                data, addr = sock.recvfrom(65535)
                message = data.decode("utf-8", errors="replace").strip()
                if message:
                    self._process_message(message, addr[0])
            except socket.timeout:
                continue
            except Exception as e:
                print(f"[SYSLOG:ERROR] {e}")

        sock.close()

    def _listen_tcp(self, shutdown_event: threading.Event):
        """Listen for syslog messages over TCP."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.settimeout(1.0)
        sock.bind(("0.0.0.0", self.port))
        sock.listen(10)

        print(f"[SYSLOG] Listening on TCP:{self.port}")

        while not shutdown_event.is_set():
            try:
                conn, addr = sock.accept()
                thread = threading.Thread(
                    target=self._handle_tcp_client,
                    args=(conn, addr, shutdown_event),
                    daemon=True,
                )
                thread.start()
            except socket.timeout:
                continue
            except Exception as e:
                print(f"[SYSLOG:ERROR] {e}")

        sock.close()

    def _handle_tcp_client(self, conn, addr, shutdown_event):
        """Handle a single TCP syslog client connection."""
        try:
            buffer = ""
            while not shutdown_event.is_set():
                data = conn.recv(4096)
                if not data:
                    break
                buffer += data.decode("utf-8", errors="replace")
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.strip()
                    if line:
                        self._process_message(line, addr[0])
        except Exception:
            pass
        finally:
            conn.close()

    def _process_message(self, message: str, source_ip: str):
        """Detect vendor and parse the syslog message."""
        vendor = self._detect_vendor(message)
        parser = self._vendors.get(vendor)

        if parser:
            parsed = parser.parse(message)
        else:
            parsed = {
                "vendor": "generic",
                "message": message[:500],
                "severity": 2,
                "raw": message,
            }

        parsed["source_ip"] = source_ip

        if self.callback:
            self.callback(parsed)

    def _detect_vendor(self, message: str) -> str:
        """Auto-detect vendor from syslog message content."""
        msg_lower = message.lower()

        if "devname=" in msg_lower or "logid=" in msg_lower:
            return "fortinet"
        if "%asa-" in msg_lower or "%ftd-" in msg_lower:
            return "cisco"
        if "paloaltonetworks" in msg_lower or len(message.split(",")) > 20:
            return "paloalto"

        return "generic"
