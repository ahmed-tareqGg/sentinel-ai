

# SOAR Execution Pipeline — Implementation Plan

## 5 Fixes to Implement

### 1. Fix `approved_by` in Approvals.tsx (line 84)
Replace hardcoded `'current_user'` string with the actual authenticated user UUID (`userData?.user?.id`). The `userData` is already fetched on line 94.

**File:** `src/pages/Approvals.tsx` — move the `getUser()` call before the approval update, use real UUID.

### 2. Add action aliases in Executor dispatch (line 1181)
The frontend sends action types that have no direct handler in the executor. Add aliases after the dispatch table:

| Frontend action_type | Maps to executor handler |
|---|---|
| `forensic_analysis` | `collect_forensics` |
| `reset_credentials` | `rotate_credentials` |
| `geo_block` | `block_ip` |
| `create_ticket` | `notify_user` |
| `investigate_data` | `notify_user` |
| `interview_user` | `notify_user` |
| `network_forensics` | `collect_forensics` |

Add alias resolution before `dispatch.get(action_type)` so unknown frontend names route to the correct handler.

**File:** `public/agents/socmind-executor.py` — add `ACTION_ALIASES` dict and resolve before dispatch lookup.

### 3. Endpoint validation in `cmd_configure` (line 1288)
- Auto-detect if user swapped API Key and Endpoint (key starts with `http`, endpoint starts with `socm_`) and auto-swap.
- Strip trailing `/agent-gateway` from endpoint if accidentally included (prevents double path).
- Show format hints in prompts.

**File:** `public/agents/socmind-executor.py` — enhance `cmd_configure()`.

### 4. Save iptables backup to file (line 440-441)
Currently `iptables-save` output is stored in a variable only. Save to `/tmp/socmind-iptables-backup.rules` so it survives process crashes.

**File:** `public/agents/socmind-executor.py` — add file write after `iptables-save`.

### 5. Add `test-connection` CLI command
New command that tests connectivity to `/agent-gateway/heartbeat` and `/agent-gateway/poll-actions`, showing HTTP status codes and response bodies for debugging.

**File:** `public/agents/socmind-executor.py` — add `cmd_test_connection()` and wire to CLI.

## Summary
- **2 files** modified: `src/pages/Approvals.tsx`, `public/agents/socmind-executor.py`
- No database changes needed
- No new dependencies

