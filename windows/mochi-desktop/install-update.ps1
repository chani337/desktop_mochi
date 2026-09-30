# Parameters are passed as environment values, never interpolated as PowerShell code.
$ErrorActionPreference = 'Stop'
$mochiProcess = $null
try {
    $mochiProcess = Get-Process -Id ([int]$env:MOCHI_UPDATE_PID) -ErrorAction Stop
    $null = $mochiProcess.Handle
    if (-not [IO.File]::Exists($env:MOCHI_UPDATE_INSTALLER)) { throw 'Downloaded installer is missing.' }
    [IO.File]::WriteAllText($env:MOCHI_UPDATE_READY, 'ready')
    # Hold this exact process object so PID reuse cannot target another application.
    if (-not $mochiProcess.WaitForExit(30000)) { throw 'Mochi did not exit within 30 seconds. Installation was not started.' }
    Start-Process -FilePath $env:MOCHI_UPDATE_INSTALLER -ArgumentList @('--updated', '/S', '--force-run') -ErrorAction Stop | Out-Null
    [IO.File]::WriteAllText($env:MOCHI_UPDATE_LOG, 'Installer started after Mochi exited.')
} catch {
    [IO.File]::WriteAllText($env:MOCHI_UPDATE_LOG, $_.Exception.Message)
    # Recover the existing application if the installer could not be launched.
    if ($null -ne $mochiProcess -and $mochiProcess.HasExited -and [IO.File]::Exists($env:MOCHI_UPDATE_APP)) {
        Start-Process -FilePath $env:MOCHI_UPDATE_APP
    }
    exit 1
} finally {
    if (Test-Path -LiteralPath $env:MOCHI_UPDATE_READY) { Remove-Item -LiteralPath $env:MOCHI_UPDATE_READY -Force }
}
