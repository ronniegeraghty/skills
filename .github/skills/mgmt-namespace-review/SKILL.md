---
name: mgmt-namespace-review
description: "**WORKFLOW SKILL** — Orchestrate the Azure SDK Management Plane Namespace Review process: fetch issues, validate namespaces, assign reviewers, notify architects, and close approved reviews. USE FOR: namespace review processing, namespace review status checks, management plane review updates. DO NOT USE FOR: SDK adoption metrics (use azure-sdk-mcp-adoption), PR analysis (use copilot-pr-analysis). INVOKES: GitHub CLI (gh), Microsoft Graph API."
---

# MGMT Plane Namespace Review Workflow

Automates the Azure SDK Management Plane Namespace Review process by fetching issues, validating namespaces, assigning reviewers, sending notifications, and closing approved reviews.

## Prerequisites

- Node.js 18+ and pnpm
- GitHub CLI authenticated: `gh auth login` (with `project` scope: `gh auth refresh -s project`)
- Microsoft Graph API app configured (see README.md for Azure AD setup)
- Access to Azure/azure-sdk and Azure/azure-sdk-pr repositories

## Quick Start

```bash
cd skills/mgmt-namespace-review
pnpm install
pnpm start           # Process all open namespace reviews
pnpm start:dry       # Dry run - validate without changes
```

## Pipeline Steps

1. **fetch-issues** — Query open issues with `mgmt-namespace-review` label from both repos
2. **validate** — Check namespace patterns match tier-1 language conventions
3. **process** — Detect phase and perform appropriate actions for each issue
4. **report** — Generate summary of actions taken and any errors

## Output

Results are written to `output/{timestamp}/`:
- `issues.json` — Fetched issues with current state
- `actions.json` — Actions taken per issue
- `report.md` — Human-readable summary
- `errors.json` — Any errors encountered

## References

- [Phase Detection & Namespace Patterns](references/workflow-details.md) — Phase detection table, namespace patterns, environment variables, troubleshooting

## Related Skills

- **azure-sdk-mcp-adoption** — MCP adoption metrics and SDK release correlation
- **sprint-update-memo** — Generate Sprint update memos for stakeholders
