---
name: azure-sdk-mcp-adoption
description: "**ANALYSIS SKILL** - Generate adoption reports correlating Azure SDK MCP tool usage with monthly SDK releases. USE FOR: MCP adoption metrics, Azure SDK tool usage analysis, SDK release correlation reports, MCP adoption rates by language. DO NOT USE FOR: PR analysis (use copilot-pr-analysis), sprint updates (use sprint-update-memo). INVOKES: Kusto (Azure Data Explorer), GitHub REST API."
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

## Quick Start

```bash
cd skills/azure-sdk-mcp-adoption
pnpm install
node scripts/run.js
```

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

See [references/data-sources.md](references/data-sources.md) for details on data sources, key metrics, and file structure.

## Related Skills

- For PR-level Copilot analysis: `copilot-pr-analysis`
- For Sprint status reporting: `sprint-update-memo`
