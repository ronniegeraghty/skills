---
name: copilot-pr-analysis
description: |
  **ANALYSIS SKILL** - Analyze Copilot coding agent PR sessions to correlate resources and MCP tools with PR outcomes (merged vs abandoned).
  USE FOR: "analyze Copilot PRs", "PR success factors", "Copilot session analysis", "which skills help PRs merge", "Copilot adoption insights".
  DO NOT USE FOR: creating PRs (use GitHub CLI), managing Copilot settings, single PR review (use GitHub web UI).
  INVOKES: `scripts/run.js` pipeline with GitHub CLI for PR/session data collection.
  FOR SINGLE OPERATIONS: Use `gh pr list` or GitHub API directly for one-off queries.
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

## Overview

Generates reports analyzing which resources and tools Copilot coding agent uses when completing PRs, correlating usage patterns with PR outcomes (merged vs abandoned).

## Quick Start

```bash
cd skills/copilot-pr-analysis
pnpm install
node scripts/run.js --repos Azure/azure-sdk-for-js,Azure/azure-sdk-for-python
```

**Prerequisites:**
- Node.js 18+ and pnpm
- GitHub CLI (`gh`) authenticated: `gh auth login`
- Access to repositories with Copilot coding agent activity

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

## What This Skill Analyzes

### Resources Tracked
- **Instruction files** (`.github/copilot-instructions.md`, `.copilot/`, etc.)
- **Skills** (`.github/skills/*`)
- **MCP server configurations**
- **Custom agent definitions**

### Tools Tracked
- **MCP tools** called during sessions
- **Built-in Copilot tools** (file operations, search, etc.)

### PR Classifications
- **Merged** - Successfully completed and merged
- **Abandoned** - Closed without merge OR no activity for 14+ days (configurable)
- **Active** - Currently open with recent activity (excluded from analysis)

## Report Insights

The generated report shows:
1. **Success Factors** - Resources/tools most correlated with merged PRs
2. **Failure Patterns** - Resources/tools most common in abandoned PRs
3. **Recommendations** - Actionable insights for improving Copilot performance
4. **Per-Repo Breakdown** - Metrics by repository

## Configuration

Environment variables:
- `GITHUB_TOKEN` - Token for API access (optional, falls back to `gh` CLI auth)
- `STALE_DAYS` - Days of inactivity before PR is considered abandoned (default: 14)
