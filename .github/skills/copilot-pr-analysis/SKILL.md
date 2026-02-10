---
name: copilot-pr-analysis
description: "**ANALYSIS SKILL** - Analyze Copilot coding agent PR sessions to correlate resources and MCP tools with PR outcomes (merged vs abandoned). USE FOR: Copilot PR success factors, abandoned PR patterns, MCP tool usage in PRs, coding agent effectiveness metrics. DO NOT USE FOR: MCP adoption by SDK release (use azure-sdk-mcp-adoption), sprint reports (use sprint-update-memo). INVOKES: GitHub CLI (gh)."
---

# Copilot PR Analysis Skill

## When to Use This Skill

Activate when user wants to:
- Analyze which resources/skills correlate with successful Copilot PRs
- Identify patterns in abandoned vs merged pull requests
- Generate insights on Copilot coding agent effectiveness
- Understand MCP tool usage patterns in PR workflows

## Prerequisites

- Node.js 18+ and pnpm
- GitHub CLI (`gh`) authenticated: `gh auth login`
- Access to repositories with Copilot coding agent activity

## Quick Start

```bash
cd skills/copilot-pr-analysis
pnpm install
node scripts/run.js --repos Azure/azure-sdk-for-js,Azure/azure-sdk-for-python
```

## Usage

```bash
# Analyze specific repos
node scripts/run.js --repos owner/repo1,owner/repo2

# Custom date range
node scripts/run.js --repos owner/repo --since 2025-11-01 --stale-days 14

# Run specific steps
node scripts/run.js --repos owner/repo --step fetch-prs --step analyze

# Show help
node scripts/run.js --help
```

## Pipeline Steps

| Step | Description | Output |
|------|-------------|--------|
| fetch-prs | Query GitHub for Copilot-generated PRs | prs.json |
| fetch-sessions | Fetch session logs for each PR | sessions.json |
| analyze | Extract resources/tools and correlate with outcomes | analysis.json |
| report | Generate markdown report with insights | report.md |

## Output

Each run creates a timestamped folder in `output/` containing:
- **prs.json** - Raw PR data with status classification
- **sessions.json** - Session logs and extracted metadata
- **analysis.json** - Correlation analysis results
- **report.md** - Human-readable report with charts and insights

See [references/analysis-details.md](references/analysis-details.md) for tracked resources, PR classifications, and report structure.

## Configuration

- `GITHUB_TOKEN` - Token for API access (optional, falls back to `gh` CLI auth)
- `STALE_DAYS` - Days of inactivity before PR is considered abandoned (default: 14)

## Related Skills

- For SDK-level MCP adoption metrics: `azure-sdk-mcp-adoption`
- For Sprint status reporting: `sprint-update-memo`
