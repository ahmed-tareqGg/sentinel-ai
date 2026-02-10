"""
SOCMind Agent – Request Signer
Signs API requests to prevent tampering and replay attacks.
"""

import hmac
import hashlib
import time
import json


def sign_payload(payload: dict, secret_key: str) -> dict:
    """
    Sign a payload with HMAC-SHA256.
    Adds timestamp and signature to the payload.
    """
    timestamp = str(int(time.time()))
    payload_copy = {**payload, "_timestamp": timestamp}

    # Create canonical string from sorted keys
    canonical = json.dumps(payload_copy, sort_keys=True, separators=(",", ":"))

    # Generate HMAC signature
    signature = hmac.new(
        secret_key.encode("utf-8"),
        canonical.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    payload_copy["_signature"] = signature
    return payload_copy


def verify_signature(payload: dict, secret_key: str, max_age_seconds: int = 300) -> bool:
    """
    Verify the HMAC signature of a received payload.
    Also checks timestamp to prevent replay attacks.
    """
    signature = payload.pop("_signature", None)
    timestamp = payload.get("_timestamp", "0")

    if not signature:
        return False

    # Check timestamp freshness
    try:
        payload_time = int(timestamp)
        current_time = int(time.time())
        if abs(current_time - payload_time) > max_age_seconds:
            return False
    except (ValueError, TypeError):
        return False

    # Recompute signature
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    expected = hmac.new(
        secret_key.encode("utf-8"),
        canonical.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(signature, expected)


def generate_hardware_id() -> str:
    """Generate a unique hardware fingerprint for license binding."""
    import platform
    import socket
    import uuid

    components = []
    components.append(platform.node())
    components.append(str(uuid.getnode()))  # MAC address as int
    components.append(platform.system())
    components.append(platform.machine())

    try:
        components.append(socket.gethostname())
    except Exception:
        pass

    combined = "-".join(components)
    return hashlib.sha256(combined.encode()).hexdigest()[:32]
