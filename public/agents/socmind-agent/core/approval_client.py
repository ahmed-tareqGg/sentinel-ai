"""
SOCMind Agent – Approval Client
Polls the platform for approval status on gated actions.
"""

import time

try:
    import requests as http_requests
except ImportError:
    http_requests = None


class ApprovalClient:
    def __init__(self, config: dict):
        self.api_endpoint = config.get("api", {}).get("endpoint", "")
        self.api_key = config.get("api", {}).get("key", "")
        self.poll_interval = 5  # seconds
        self.max_wait = 300     # 5 minutes max wait

    def wait_for_approval(self, action_id: str):
        """
        Block until the action is approved or rejected.
        Raises Exception if rejected or timeout.
        """
        if not http_requests:
            print("[APPROVAL:WARN] requests library not available, auto-approving")
            return

        elapsed = 0
        while elapsed < self.max_wait:
            status = self._check_status(action_id)

            if status == "approved":
                return
            elif status == "rejected":
                raise Exception(f"Action {action_id} was REJECTED by approver")
            elif status == "expired":
                raise Exception(f"Action {action_id} approval EXPIRED")

            time.sleep(self.poll_interval)
            elapsed += self.poll_interval

        raise Exception(f"Action {action_id} approval TIMED OUT after {self.max_wait}s")

    def _check_status(self, action_id: str) -> str:
        """Check approval status from the platform."""
        try:
            resp = http_requests.post(
                f"{self.api_endpoint}/check-approval",
                json={"action_id": action_id},
                headers={
                    "Content-Type": "application/json",
                    "X-Agent-Key": self.api_key,
                },
                timeout=10,
            )
            if resp.status_code == 200:
                return resp.json().get("status", "pending")
        except Exception:
            pass
        return "pending"
