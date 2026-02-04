# Copilot PR Analysis Skill

A GitHub Copilot Agent Skill that analyzes Copilot coding agent PR sessions to understand what resources (instruction files, skills, MCP configurations) and tools correlate with successful vs. unsuccessful pull requests.

## Purpose

When Copilot coding agent creates PRs, it uses various resources from the repository:
- Custom instructions (`.github/copilot-instructions.md`)
- Skills (`.github/skills/*`)
- MCP server configurations
- README files and documentation

This skill analyzes which of these resources and MCP tools are associated with:
- **Merged PRs** (successful outcomes)
- **Abandoned PRs** (closed without merge or stale)

The insights help you optimize your Copilot configuration for better success rates.

## Quick Start

```bash
cd .github/skills/copilot-pr-analysis
pnpm install
node src/run.js --repos owner/repo1,owner/repo2
```

## Prerequisites

- **Node.js 18+** and **pnpm**
- **GitHub CLI** authenticated: `gh auth login`
- **Access** to repositories with Copilot coding agent activity
- **gh agent-task** command available (GitHub CLI v2.80.0+)

## Usage

### Full Pipeline

```bash
# Analyze one repository
node src/run.js --repos Azure/azure-sdk-for-js

# Analyze multiple repositories
node src/run.js --repos Azure/azure-sdk-for-js,Azure/azure-sdk-for-python,Azure/azure-sdk-for-net

# Custom parameters
node src/run.js --repos owner/repo --since 2025-11-01 --stale-days 7
```

### Individual Steps

```bash
# Run only specific steps (useful for re-generating reports)
node src/run.js --step analyze --step report

# Each step can also be run standalone
node src/fetch-prs.js --repos owner/repo
node src/fetch-sessions.js
node src/analyze.js
node src/report.js
```

## Pipeline Steps

| Step | Script | Description | Input | Output |
|------|--------|-------------|-------|--------|
| 1. fetch-prs | `fetch-prs.js` | Query GitHub for Copilot PRs | GitHub API | `prs.json` |
| 2. fetch-sessions | `fetch-sessions.js` | Fetch session logs via `gh agent-task` | `prs.json` | `sessions.json` |
| 3. analyze | `analyze.js` | Extract resources/tools, calculate correlations | `sessions.json` | `analysis.json` |
| 4. report | `report.js` | Generate markdown report with charts | `analysis.json` | `report.md` |

## Output

Each run creates a timestamped folder in `output/` containing:

```
output/2026-01-21T10-30-00/
├── prs.json           # Raw PR data with status classification
├── sessions.json      # Session logs and extracted metadata
├── analysis.json      # Correlation analysis results
├── report.md          # Human-readable report with charts
└── summary.json       # Quick summary for automation
```

### Report Contents

The generated `report.md` includes:

1. **Overview** - Key metrics and PR outcome distribution
2. **Key Insights** - Patterns found in the data
3. **Resource Analysis** - Which instruction files correlate with success
4. **MCP Tool Analysis** - Which tools are associated with outcomes
5. **Repository Breakdown** - Per-repo metrics and top resources
6. **Recommendations** - Actionable suggestions for improvement

## How It Works

### PR Classification

PRs are classified into three categories:

| Status | Criteria |
|--------|----------|
| **Merged** | PR was merged into base branch |
| **Abandoned** | PR was closed without merge OR open but no activity for 14+ days |
| **Active** | PR is open with recent activity (excluded from analysis) |

### Resource Detection

The skill looks for these resource patterns in session logs:

- `.github/copilot-instructions.md`
- `.copilot/*.md`
- `.github/skills/*/SKILL.md`
- `.github/copilot/mcp.json`
- `README.md`, `CONTRIBUTING.md`
- Custom agent definitions

### MCP Tool Detection

MCP tools are identified by:
- Known tool names (e.g., `github_search_code`, `read_file`)
- Tool call patterns in logs (e.g., "Calling tool: X")

### Correlation Analysis

For each resource/tool, the skill calculates:
- **Merged Count** - How many merged PRs used this resource
- **Abandoned Count** - How many abandoned PRs used it
- **Success Score** - `(merged% - abandoned%)` weighted by usage

High positive scores indicate success factors; negative scores indicate potential problems.

## Configuration

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--repos, -r` | Comma-separated list of repos | Required |
| `--since` | Start date for PR query | 90 days ago |
| `--stale-days` | Days of inactivity for "abandoned" | 14 |
| `--step` | Run specific step(s) only | All steps |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | Token for API access (falls back to gh CLI) |
| `STALE_DAYS` | Override default stale days threshold |

## Troubleshooting

### "gh agent-task: command not found"

Update GitHub CLI to v2.80.0 or later:
```bash
gh upgrade
```

### "No session logs available"

Session logs may not be available if:
- The PR was created before session logging was enabled
- The session has expired
- You don't have access to view the session

### "No Copilot PRs found"

Copilot PRs are identified by branch names starting with `copilot/`. Ensure:
- The repository has Copilot coding agent enabled
- PRs have been created within the date range
- You have read access to the repository

## Example Output

```markdown
## Key Insights

### ✅ Resources Associated with Successful PRs

| Resource | Category | Success Score | Rate |
|----------|----------|---------------|------|
| `.github/copilot-instructions.md` | copilot-instructions | 🟢 35.2 | 85% merged |
| `.github/skills/sdk-helper/SKILL.md` | skills | 🟢 28.1 | 78% merged |

### ❌ Resources Associated with Abandoned PRs

| Resource | Category | Success Score | Rate |
|----------|----------|---------------|------|
| `outdated-guide.md` | documentation | 🔴 -42.3 | 71% abandoned |
```

## Contributing

To improve this skill:

1. Add new resource patterns to `constants.js`
2. Add known MCP tools to the `KNOWN_MCP_TOOLS` array
3. Enhance parsing logic in `fetch-sessions.js`
4. Add new insight types in `analyze.js`

## License

ISC
