---
name: azure-sdk-mcp-adoption
description: Generate adoption reports correlating Azure SDK MCP tool usage with monthly Azure SDK releases. Use this when asked to analyze MCP tool adoption, generate SDK release adoption metrics, or understand which Azure SDK packages used MCP tools.
---

# Azure SDK MCP Adoption Report

This skill generates reports showing which Azure SDK packages used MCP (Model Context Protocol) tools during their development cycle and correlates this with monthly release data.

## Key Metrics

- **Release-Based Adoption Rate**: Percentage of SDK releases that had MCP tool usage during development
- **Tool Usage**: Which MCP tools are being used and their success rates
- **Client Distribution**: Which MCP clients (VS Code, Copilot, JetBrains) are being adopted
- **Language Breakdown**: Adoption metrics per SDK language (JS, Python, .NET, Java, Go, etc.)

## When to Use

Use this skill when:
- Asked to generate MCP adoption metrics for a specific month or date range
- Analyzing which SDK packages used MCP tools
- Understanding client adoption (VS Code, Copilot, JetBrains, etc.)
- Viewing tool-by-tool usage and success rates
- Correlating package releases with MCP activity
- **Determining what percentage of releases used MCP tools**

## Prerequisites

1. Azure CLI authenticated with Kusto access:
   ```bash
   az login --scope https://kusto.kusto.windows.net/.default
   ```
2. Node.js 18+ and pnpm installed
3. Run `pnpm install` in this skill's directory

## Quick Start

Generate a complete adoption report with default settings (2 months back from the current release cycle, ending on the 16th):

```bash
cd .github/skills/azure-sdk-mcp-adoption
pnpm install
node src/run.js
```

Each run creates a timestamped output folder (e.g., `output/2026-01-16T13-19-41/`) to preserve historical reports.

### Run Script Options

```bash
# Run with custom date range
node src/run.js --start 2025-12-01 --end 2026-01-17

# Run with specific release months
node src/run.js --month 2025-12 --month 2026-01

# Run only specific steps
node src/run.js --step correlate --step report

# Show help
node src/run.js --help
```

Available steps: `fetch-telemetry`, `fetch-releases`, `correlate`, `report`

## Individual Commands

### 1. Fetch Telemetry from Kusto

```bash
pnpm fetch:telemetry -- --start 2025-12-01 --end 2026-01-17
```

**Options:**
- `--start YYYY-MM-DD` - Start date for telemetry query (default: 2 months before release cycle end)
- `--end YYYY-MM-DD` - End date for telemetry query (default: end of 16th of current month)

**Outputs:** `output/{timestamp}/telemetry.json`

### 2. Fetch Release Data from GitHub

```bash
pnpm fetch:releases -- --month 2025-12 --month 2026-01
```

**Options:**
- `--month YYYY-MM` - Month to fetch releases for (can specify multiple)
- `--language js,python` - Comma-separated languages (default: all)

**Outputs:** `output/{timestamp}/releases.json`

### 3. Correlate Data

```bash
pnpm correlate
```

Matches telemetry package usage with release data and calculates the **release-based adoption rate** - what percentage of actual releases had MCP tool usage during development.

**Outputs:** `output/{timestamp}/correlation.json`

### 4. Generate Report

```bash
pnpm report
```

Generates a markdown report with embedded charts (via QuickChart.io).

**Outputs:**
- `output/{timestamp}/report.md` - Human-readable markdown report with charts
- `output/{timestamp}/summary.json` - Machine-readable JSON summary

## Pipeline Behavior

When running scripts in sequence, they share data through:
1. The `AZSDK_MCP_RUN_ID` environment variable (within a single shell session)
2. Automatic discovery of files in the most recent run directories

This means you can run scripts individually and they'll find the data from previous runs.

## Data Sources

### Kusto Telemetry
- **Cluster**: `https://ddazureclients.kusto.windows.net/`
- **Database**: `AzSdkToolsMcp`
- **Table**: `RawEventsDependencies`

**Key fields from `customDimensions`:**
| Field | Description |
|-------|-------------|
| `clientname` | MCP client (VS Code, Copilot, etc.) |
| `clientversion` | Client version |
| `toolname` | MCP tool name (e.g., `azsdk_verify_setup`) |
| `package_name` | Azure SDK package name |
| `operation_status` | Succeeded/Failed |
| `language` | Programming language |

### Release Notes
- **Repository**: `https://github.com/Azure/azure-sdk`
- **Monthly releases**: `/_data/releases/YYYY-MM/{language}.yml`
- **Package catalog**: `/_data/releases/latest/{language}-packages.csv`

## Report Contents

### Executive Summary
- Total tool calls, unique tools, unique clients
- Packages with MCP activity and recent releases
- **Release-based adoption rate (e.g., "31 of 391 releases had MCP usage")**
- Date range and release months covered

### Release-Based MCP Adoption
- **Overall adoption rate**: What % of releases had MCP tool usage
- **By Language**: Adoption rates per SDK language with charts
- **By Version Type**: GA (Stable) and Beta release adoption
- **Release Details**: List of specific packages with MCP usage

### Client Adoption
- Usage by MCP client (VS Code, Copilot, JetBrains, etc.)
- Version breakdown per client
- User counts
- Pie chart visualization

### Tool Usage
- Top tools by call count with horizontal bar chart
- Success rates and average durations (color-coded: green/yellow/red)
- Categorization (generation, validation, versioning, ci-cd, packaging)

### Package Correlation
- Packages with both MCP usage and recent releases
- Language breakdown
- Release version types (GA, Beta)

### Insights & Recommendations
- Key findings
- Tools needing attention (low success rates)
- Growth opportunities

## Charts

The report includes embedded charts via [QuickChart.io](https://quickchart.io):

- **Release Adoption by Language** - Stacked bar chart showing with/without MCP usage
- **Version Type Adoption** - Bar chart of adoption rates by release type (Beta/GA)
- **Client Distribution** - Pie chart of MCP client usage
- **Tool Usage** - Horizontal bar chart of top tools with success rate indicators

## Example Output

```markdown
## Executive Summary

| Metric | Value |
|--------|-------|
| **Total MCP Tool Calls** | 3,914 |
| **Unique Tools Used** | 51 |
| **Unique MCP Clients** | 6 |
| **Total SDK Releases** | 391 |
| **Releases with MCP Usage** | 31 (7.93%) |
```

## File Structure

```
azure-sdk-mcp-adoption/
├── SKILL.md           # This file - skill instructions
├── package.json       # Dependencies and scripts
├── src/
│   ├── run.js               # Unified runner script (invokes all steps)
│   ├── fetch-telemetry.js   # Query Kusto for MCP tool events
│   ├── fetch-releases.js    # Fetch releases from GitHub
│   ├── correlate.js         # Match telemetry with releases
│   ├── report.js            # Generate markdown report with charts
│   ├── utils.js             # Shared utilities
│   └── explore-kusto.js     # Utility to explore schema
└── output/                   # Generated reports (git-ignored)
    └── {timestamp}/          # Each run creates a new folder
        ├── telemetry.json
        ├── releases.json
        ├── correlation.json
        ├── report.md
        └── summary.json
```
