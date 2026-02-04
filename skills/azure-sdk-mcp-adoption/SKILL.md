---
name: azure-sdk-mcp-adoption
description: Generate adoption reports correlating Azure SDK MCP tool usage with monthly releases.
---

# Azure SDK MCP Adoption Report

Generates reports showing which Azure SDK packages used MCP tools during development and calculates adoption rates.

## Quick Start

```bash
cd .github/skills/azure-sdk-mcp-adoption
pnpm install
node src/run.js
```

**Prerequisites:**
- Node.js 18+ and pnpm
- Azure CLI authenticated: `az login --scope https://kusto.kusto.windows.net/.default`

## Usage

```bash
# Full pipeline with defaults (current month, 3 months telemetry)
node src/run.js

# Custom date range
node src/run.js --start 2025-12-01 --end 2026-01-17 --month 2026-01

# Run specific steps
node src/run.js --step correlate --step report

# Show help
node src/run.js --help
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
src/
├── run.js              # Pipeline orchestrator
├── fetch-telemetry.js  # Kusto queries
├── fetch-releases.js   # GitHub data fetching
├── correlate.js        # Matching logic
├── report.js           # Markdown generation
├── utils.js            # Shared utilities
└── constants.js        # Configuration values
```
