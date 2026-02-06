#
# Executive Review Skill - PowerShell Wrapper
#
# Usage:
#   .\run.ps1 <file_path> [options]
#
# Examples:
#   .\run.ps1 demo.mp4 -personas cto,ciso -frames
#   .\run.ps1 proposal.pdf -all-personas
#

param(
    [Parameter(Position = 0, Mandatory = $false)]
    [string]$FilePath,
    
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemainingArgs
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Check if Python is available
$pythonCmd = $null

if (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
}
elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
}
else {
    Write-Error "Python is not installed or not in PATH"
    exit 1
}

# Build arguments
$allArgs = @("$ScriptDir\run.py")

if ($FilePath) {
    $allArgs += $FilePath
}

if ($RemainingArgs) {
    $allArgs += $RemainingArgs
}

# Run the main script
& $pythonCmd @allArgs
