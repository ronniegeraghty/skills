#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Run the Sprint Update Memo skill pipeline.

.DESCRIPTION
    PowerShell wrapper for running the Sprint Update Memo skill.
    Ensures pnpm dependencies are installed and runs the TypeScript pipeline.

.PARAMETER Sprint
    Optional Sprint number to generate report for (e.g., 12).

.PARAMETER NoPrompt
    Skip interactive prompts, use defaults.

.EXAMPLE
    .\run.ps1
    # Interactive mode

.EXAMPLE
    .\run.ps1 -Sprint 12
    # Generate report for Sprint 12

.EXAMPLE
    .\run.ps1 -Sprint 12 -NoPrompt
    # Non-interactive mode for Sprint 12
#>

param(
    [Parameter(Mandatory = $false)]
    [int]$Sprint,

    [Parameter(Mandatory = $false)]
    [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"

# Navigate to skill directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillDir = Split-Path -Parent $scriptDir
Push-Location $skillDir

try {
    # Ensure dependencies are installed
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing dependencies..." -ForegroundColor Cyan
        pnpm install
    }

    # Build arguments
    $args = @()
    if ($Sprint) {
        $args += "--sprint"
        $args += $Sprint.ToString()
    }
    if ($NoPrompt) {
        $args += "--no-prompt"
    }

    # Run the pipeline
    Write-Host "Running Sprint Update Memo pipeline..." -ForegroundColor Cyan
    pnpm exec tsx scripts/run.ts @args
}
finally {
    Pop-Location
}
