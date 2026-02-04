---
name: azure-sdk-mcp-adoption
description: |
  **ANALYSIS SKILL** - Generate adoption reports correlating Azure SDK MCP tool usage with monthly SDK releases.
  USE FOR: "MCP adoption report", "SDK tool usage metrics", "Azure SDK adoption analysis", "correlate MCP usage with releases", "generate adoption metrics".
  DO NOT USE FOR: querying raw telemetry (use Kusto directly), fetching single release data (use GitHub API), general SDK documentation.
  INVOKES: `scripts/run.js` pipeline with Kusto queries and GitHub API for data collection.
  FOR SINGLE OPERATIONS: Use Azure CLI or GitHub CLI directly for one-off queries.
---

# Azure SDK MCP Adoption Report

## When to Use This Skill

Activate when user wants to:
- Generate adoption metrics for Azure SDK MCP tools
- Correlate SDK package releases with MCP tool usage
- Analyze adoption rates by language, release type, or plane
- Create reports showing MCP tool impact on SDK development

## Prerequisites

- Node.js 18+ and pnpm
- Azure CLI authenticated: `az login --scope https://kusto.kusto.windows.net/.default`
- Access to `ddazureclients.kusto.windows.net` Kusto cluster

## Overview

Generates reports showing which Azure SDK packages used MCP tools during development and calculates adoption rates.

## Quick Start

```bash
cd skills/azure-sdk-mcp-adoption
pnpm install
node scripts/run.js
```

**Prerequisites:**
- Node.js 18+ and pnpm
- Azure CLI authenticated: `az login --scope https://kusto.kusto.windows.net/.default`

## Usage

```bash
# Full pipeline with defaults (current month, 3 months telemetry)
node scripts/run.js

# Custom date range
node scripts/run.js --start 2025-12-01 --end 2026-01-17 --month 2026-01

# Run specific steps
node scripts/run.js --step correlate --step report

# Show help
node scripts/run.js --help
```

## Pipeline Steps

| Step | Description | Output |
|------|-------------|--------|
| fetch-telemetry | Query Kusto for MCP tool calls | telemetry.json |
| fetch-releases | Download release data from GitHub | releases.json |
| correlate | Match releases with MCP usage | correlation.json |
| report | Generate markdown report | report.md, summary.json |

## Output

Each run creates a timestamped folder in `output/` containing:
- **report.md** - Human-readable report with charts
- **summary.json** - Machine-readable metrics
- **telemetry.json** - Raw telemetry data
- **releases.json** - Raw release data
- **correlation.json** - Matched data

## Key Metrics

- **Adoption Rate**: Percentage of releases that had MCP tool usage
- **By Language**: JS, Python, .NET, Java, Go, etc.
- **By Type**: GA (stable) vs Beta releases
- **By Plane**: Management vs Data plane packages

## Data Sources

| Source | Details |
|--------|---------|
| Kusto | `ddazureclients.kusto.windows.net` / `AzSdkToolsMcp` / `RawEventsDependencies` |
| GitHub | `Azure/azure-sdk` repository `/_data/releases/YYYY-MM/{language}.yml` |

## File Structure

```
scripts/
├── run.js              # Pipeline orchestrator
├── fetch-telemetry.js  # Kusto queries
├── fetch-releases.js   # GitHub data fetching
├── correlate.js        # Matching logic
├── report.js           # Markdown generation
├── utils.js            # Shared utilities
└── constants.js        # Configuration values
```
