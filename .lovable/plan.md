

# Fix: Windows Agent TLS Connection Error + Pending Logs

## Problem

The Windows agent shows: `[ERR] Failed to send logs: The underlying connection was closed: A connection that was expected to be kept alive was closed by the server.`

This is a known PowerShell issue -- it defaults to TLS 1.0, but the server (Supabase Edge Functions) requires TLS 1.2+.

## Solution

### 1. Fix Windows Agent TLS (public/agents/socmind-agent-windows.ps1)

Add TLS 1.2 enforcement at the top of the script, before any HTTP calls:

```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
```

This single line fixes the connection error for all `Invoke-RestMethod` calls.

### 2. Mark Old Pending Logs as Ignored (Database)

Run a SQL update to clear existing `pending` logs that are stuck (same fix as before), so only new logs from the fixed agent get processed:

```sql
UPDATE raw_logs
SET processing_status = 'ignored',
    error_message = 'Skipped - pre-fix batch'
WHERE processing_status = 'pending';
```

## Technical Details

| File | Change |
|------|--------|
| `public/agents/socmind-agent-windows.ps1` | Add `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12` near the top of the script (after the param block) |
| Database migration | Mark stuck `pending` logs as `ignored` |

## After the Fix

1. Re-download the Windows agent from the Data Sources page
2. Re-run `.\socmind-agent-windows.ps1 run`
3. Logs should now flow successfully to the platform

