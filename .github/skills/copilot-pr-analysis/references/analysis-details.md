# Analysis Details

## Resources Tracked

- **Instruction files** (`.github/copilot-instructions.md`, `.copilot/`, etc.)
- **Skills** (`.github/skills/*`)
- **MCP server configurations**
- **Custom agent definitions**

## Tools Tracked

- **MCP tools** called during sessions
- **Built-in Copilot tools** (file operations, search, etc.)

## PR Classifications

- **Merged** - Successfully completed and merged
- **Abandoned** - Closed without merge OR no activity for 14+ days (configurable via `STALE_DAYS`)
- **Active** - Currently open with recent activity (excluded from analysis)

## Report Insights

The generated report shows:

1. **Success Factors** - Resources/tools most correlated with merged PRs
2. **Failure Patterns** - Resources/tools most common in abandoned PRs
3. **Recommendations** - Actionable insights for improving Copilot performance
4. **Per-Repo Breakdown** - Metrics by repository
