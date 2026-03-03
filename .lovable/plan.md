

# Fix: Target Resolution & IP Validation in SOAR Pipeline

## Problem
The executor receives invalid targets from the approval workflow:
- `block_ip` gets hostname "AHMEDTAREQ" instead of a real IP
- `isolate_host` gets target "Unknown" when it doesn't need one

The root cause is in `src/pages/Approvals.tsx` lines 109-160 and `supabase/functions/agent-gateway/index.ts` poll-actions response.

## Changes

### 1. Fix target resolution in `src/pages/Approvals.tsx`

**Current behavior (line 109):** Falls back through `action_params.ip → user → host → target → 'unknown'` without validating if the value is actually an IP address.

**Fix:**
- Apply the IP regex validation (`/^(\d{1,3}\.){3}\d{1,3}$/`) to ALL fallback values, not just the incident lookup
- For `block_ip` actions: if no valid IP is found after all resolution attempts, set status to `failed` with error message instead of dispatching with a hostname
- For `isolate_host` actions: set target to empty string (the executor handles self-isolation without needing a target IP)
- For non-IP actions (`disable_user`, `kill_process`, etc.): allow non-IP targets as-is

### 2. Add server-side validation in `agent-gateway/index.ts` poll-actions

Add a final safety check before returning actions to the executor:
- For `block_ip` and `geo_block` action types, validate that the `target` field matches the IP regex
- If invalid, skip the action and log a warning instead of dispatching a broken command
- This acts as a second line of defense even if the frontend logic has bugs

### Summary
- **2 files** modified: `src/pages/Approvals.tsx`, `supabase/functions/agent-gateway/index.ts`
- No database changes
- Prevents hostnames/garbage from being sent as IP targets
- Executor will only receive validated, actionable targets

