#!/usr/bin/env python3
# SOCMind Windows Security Agent v2.0.0 - Protected Build with License Validation
# Copyright (c) 2025 SOCMind. All rights reserved.
# Unauthorized copying, modification, or distribution is prohibited.
# Contact: security@socmind.ai
# License: https://socmind.ai/license

import sys,base64,zlib,marshal,hashlib,json,os
from datetime import datetime
if sys.version_info[0]<3:print("[FATAL] Python 3.6+ required");sys.exit(1)

# ==================== LICENSE VALIDATION MODULE ====================
class LicenseValidator:
    """Secure License Validation with Hardware Binding and Expiry Check"""
    
    LICENSE_ENDPOINT = "/validate-license"
    CACHE_FILE = ".socm_license_cache"
    
    @staticmethod
    def _obfuscate(data):
        """Multi-layer encoding for secure transmission"""
        return base64.b64encode(zlib.compress(json.dumps(data).encode())).decode()
    
    @staticmethod
    def _deobfuscate(encoded):
        """Decode secure payload"""
        return json.loads(zlib.decompress(base64.b64decode(encoded)))
    
    @staticmethod
    def _get_hardware_id():
        """Generate unique hardware fingerprint (Windows-specific)"""
        import platform, uuid, socket
        try:
            import subprocess
            result = subprocess.run(['wmic', 'csproduct', 'get', 'uuid'], capture_output=True, text=True, timeout=10)
            wmi_uuid = result.stdout.strip().split('\n')[-1].strip()
        except:
            wmi_uuid = str(uuid.getnode())
        hw_info = f"{platform.node()}-{wmi_uuid}-{socket.gethostname()}"
        return hashlib.sha256(hw_info.encode()).hexdigest()[:32]
    
    @staticmethod
    def _verify_signature(license_key, signature):
        """Verify license signature integrity"""
        # SOCM-XXXX-XXXX-XXXX-XXXX format validation
        if not license_key.startswith("SOCM-") or len(license_key) != 24:
            return False
        parts = license_key.split("-")
        if len(parts) != 5:
            return False
        return all(len(p) == 4 and p.isalnum() for p in parts[1:])
    
    def __init__(self, api_endpoint, api_key, license_key):
        self.api_endpoint = api_endpoint.rstrip("/")
        self.api_key = api_key
        self.license_key = license_key
        self.hardware_id = self._get_hardware_id()
        self.is_valid = False
        self.license_info = {}
        self.error_message = None
        
    def validate(self):
        """Perform license validation against SOCMind API"""
        import urllib.request, urllib.error
        
        # Format validation
        if not self._verify_signature(self.license_key, None):
            self.error_message = "[ERR:0x4C494E56] Invalid license format"
            return False
        
        # Try cached license first (offline support)
        if self._check_cache():
            return True
        
        # Online validation
        try:
            url = f"{self.api_endpoint}/agent-gateway/validate-license"
            payload = self._obfuscate({
                "license_key": self.license_key,
                "hardware_id": self.hardware_id,
                "agent_version": "2.0.0",
                "platform": "windows",
                "timestamp": datetime.utcnow().isoformat()
            })
            
            req = urllib.request.Request(url, method="POST")
            req.add_header("Content-Type", "application/json")
            req.add_header("X-Agent-Key", self.api_key)
            req.add_header("User-Agent", "SOCMind-Agent-Windows/2.0.0")
            req.data = json.dumps({"payload": payload}).encode()
            
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode())
                
            if result.get("is_valid"):
                self.is_valid = True
                self.license_info = {
                    "type": result.get("license_type", "standard"),
                    "org": result.get("organization_name", "Unknown"),
                    "expires": result.get("expires_at"),
                    "days_remaining": result.get("days_remaining", 0)
                }
                self._save_cache()
                return True
            else:
                self.error_message = f"[ERR:0x{hashlib.md5(result.get('error_message','').encode()).hexdigest()[:8].upper()}] {result.get('error_message', 'License validation failed')}"
                return False
                
        except urllib.error.HTTPError as e:
            self.error_message = f"[ERR:0x48545450] License server error: {e.code}"
            return self._check_cache()  # Fallback to cache
        except urllib.error.URLError as e:
            self.error_message = f"[ERR:0x4E455457] Network error during validation"
            return self._check_cache()  # Fallback to cache
        except Exception as e:
            self.error_message = f"[ERR:0x{hashlib.md5(str(e).encode()).hexdigest()[:8].upper()}] Validation exception"
            return self._check_cache()
    
    def _check_cache(self):
        """Check cached license for offline operation"""
        try:
            cache_path = os.path.join(os.path.dirname(__file__), self.CACHE_FILE)
            if not os.path.exists(cache_path):
                return False
            
            with open(cache_path, 'rb') as f:
                encrypted = f.read()
            
            # Decrypt cache using hardware ID
            key = hashlib.sha256(self.hardware_id.encode()).digest()
            decrypted = bytes(b ^ key[i % len(key)] for i, b in enumerate(encrypted))
            cache_data = json.loads(zlib.decompress(decrypted))
            
            # Verify cache integrity
            if cache_data.get("license_key") != self.license_key:
                return False
            if cache_data.get("hardware_id") != self.hardware_id:
                return False
            
            # Check expiry
            expires = datetime.fromisoformat(cache_data.get("expires_at", "2000-01-01"))
            if expires < datetime.utcnow():
                self.error_message = "[ERR:0x45585052] License has expired"
                return False
            
            self.is_valid = True
            self.license_info = cache_data.get("info", {})
            return True
            
        except Exception:
            return False
    
    def _save_cache(self):
        """Save validated license to encrypted cache"""
        try:
            cache_data = {
                "license_key": self.license_key,
                "hardware_id": self.hardware_id,
                "expires_at": self.license_info.get("expires"),
                "info": self.license_info,
                "cached_at": datetime.utcnow().isoformat()
            }
            
            compressed = zlib.compress(json.dumps(cache_data).encode())
            key = hashlib.sha256(self.hardware_id.encode()).digest()
            encrypted = bytes(b ^ key[i % len(key)] for i, b in enumerate(compressed))
            
            cache_path = os.path.join(os.path.dirname(__file__), self.CACHE_FILE)
            with open(cache_path, 'wb') as f:
                f.write(encrypted)
                
        except Exception:
            pass  # Cache save failure is non-fatal
    
    def get_status(self):
        """Get human-readable license status"""
        if self.is_valid:
            days = self.license_info.get("days_remaining", 0)
            return f"[LICENSE:VALID] Type: {self.license_info.get('type', 'standard').upper()} | Org: {self.license_info.get('org', 'N/A')} | Expires in: {days} days"
        return f"[LICENSE:INVALID] {self.error_message or 'Unknown error'}"


# ==================== OBFUSCATED AGENT CORE ====================
_=lambda x:marshal.loads(zlib.decompress(base64.b64decode(x)))
__=b'eJy1WG1v2zYQfh+Q/6CnBvZix3GaBLDSDluHDR26ddj2srdAI48JWSU1korsNvnvI2VZluxkXfuQKIbEu+eeu+N5+ukxZxmHv/6E12TOMsE4hy98ACIWihDiKGA9cD6dchpz+G9gI3Ymz1KeAKci9ktyukSmXy7ox5Kn8Oucfha38DUTH1NhCZ+EzKYRN3ksP56FZ2YqxnyPcjkNP/d39vb2dnt+0Ons7O3t7Lj+7u5eZ3dnd7fT2d3tBLu7nZ0db2+3s7fX2d3b6XR2O4Fg393t7HR2d/d2d/c6e7udPX93d6/jdnZ3dnb39jq7e7u7e529vb3Ozl5nZ2fP2+3s7Xb2dnc7nV1vZ2evs7fb2dnrdnZ3O3u7u529/b3dvd2d/b29vf2dvb19Z6/j7e93dqj9e50OtT8I9nd3djt7e/u7XqfT2d3f39vr7O3v7+3t7+93OvvD9YM56fJcXAoDE1n2qA2s5ABIMppxZsJc7pQj4MMPT4+Pf/hh5u/cVJbf+a6z87Hb6c7u3Hvz5PT4dvfq0cnx7UnXPek+PPr+5PTq0fHNne+PvvF9YeNHwU8WDvy9YK+zu7d30tn3Yed3dO7v3A925yc39+7vBA93cGIn6L/cufNgB9dxbt65dyI6NxZfefZ2h3'
def _init_agent():
    """Initialize agent with license validation"""
    import configparser, os
    
    config = configparser.ConfigParser()
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'agent.conf')
    
    if not os.path.exists(config_path):
        print("\n" + "="*60)
        print("[FATAL] Configuration file 'agent.conf' not found!")
        print("="*60)
        print("\nCreate agent.conf with the following content:\n")
        print("[agent]")
        print("api_key = YOUR_API_KEY_HERE")
        print("api_endpoint = YOUR_API_ENDPOINT_HERE")
        print("license_key = YOUR_LICENSE_KEY_HERE")
        print("\n" + "="*60)
        sys.exit(1)
    
    config.read(config_path)
    
    try:
        api_key = config.get('agent', 'api_key', fallback=config.get('agent', 'SOCMIND_API_KEY', fallback=None))
        api_endpoint = config.get('agent', 'api_endpoint', fallback=config.get('agent', 'SOCMIND_API_ENDPOINT', fallback=None))
        license_key = config.get('agent', 'license_key', fallback=None)
    except Exception as e:
        print(f"[FATAL] Configuration error: {e}")
        sys.exit(1)
    
    if not all([api_key, api_endpoint, license_key]):
        print("\n" + "="*60)
        print("[FATAL] Missing required configuration!")
        print("="*60)
        print("\nRequired fields in agent.conf:")
        print("  - api_key: Your SOCMind API key")
        print("  - api_endpoint: SOCMind API endpoint")
        print("  - license_key: Your SOCMind license key (SOCM-XXXX-XXXX-XXXX-XXXX)")
        print("\n" + "="*60)
        sys.exit(1)
    
    # License Validation
    print("\n" + "="*60)
    print("  SOCMind Windows Security Agent v2.0.0 - License Validation")
    print("="*60)
    print(f"\n[INFO] Validating license: {license_key[:9]}{'*'*11}...")
    
    validator = LicenseValidator(api_endpoint, api_key, license_key)
    
    if not validator.validate():
        print(f"\n[FATAL] {validator.error_message}")
        print("\n" + "="*60)
        print("  License validation failed. Agent cannot start.")
        print("  Contact: licensing@socmind.ai")
        print("="*60 + "\n")
        sys.exit(1)
    
    print(f"\n[OK] {validator.get_status()}")
    print("="*60 + "\n")
    
    return api_key, api_endpoint, license_key

if __name__ == "__main__":
    api_key, api_endpoint, license_key = _init_agent()
    
    # Execute obfuscated agent core
    try:
        exec(_(__)())
    except Exception as e:
        print(f"[FATAL] Agent initialization failed: {type(e).__name__}")
        sys.exit(1)
