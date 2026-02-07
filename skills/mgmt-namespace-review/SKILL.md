---
name: mgmt-namespace-review
description: "Orchestrates the Azure SDK Management Plane Namespace Review process. Use for updating, processing, or checking namespace review status. Invokes GitHub CLI and Microsoft Graph API."
---

# MGMT Plane Namespace Review Workflow

## When to Use This Skill

Activate when user wants to:
- Update/process management plane namespace reviews
- Check status of namespace review issues
- Process all open namespace review requests
- Move namespace reviews through approval phases

## Prerequisites

- Node.js 18+ and pnpm
- GitHub CLI authenticated: `gh auth login` (with `project` scope: `gh auth refresh -s project`)
- Microsoft Graph API app configured (see README.md for Azure AD setup)
- Access to Azure/azure-sdk and Azure/azure-sdk-pr repositories

## Overview

Automates the Azure SDK Management Plane Namespace Review process by:
1. Finding open issues with `mgmt-namespace-review` label
2. Validating namespace patterns for all 5 tier-1 languages
3. Assigning reviewers and updating GitHub Project status
4. Sending Teams notifications and architect review emails
5. Monitoring for objections and closing approved reviews

## Quick Start

```bash
cd skills/mgmt-namespace-review
pnpm install
pnpm start
```

## Usage

```bash
# Process all open namespace reviews
pnpm start

# Dry run - validate and log without making changes
pnpm start:dry

# Or using tsx directly
tsx scripts/run.ts
tsx scripts/run.ts --dry-run
```

## Pipeline Steps

1. **fetch-issues** - Query open issues with `mgmt-namespace-review` label from both repos
2. **validate** - Check namespace patterns match tier-1 language conventions
3. **process** - Detect phase and perform appropriate actions for each issue
4. **report** - Generate summary of actions taken and any errors

## Phase Detection

The skill determines each issue's phase based on current state:

| Phase | Detection | Actions |
|-------|-----------|---------|
| Initial Review | Arthur not assigned | Validate namespaces, assign Arthur, Teams DM, project → "In Progress" |
| Awaiting MGMT | Arthur assigned, no ready label | Skip (waiting) |
| Architect Review | Has ready label or Arthur approved | Email architects, project → "Watch" |
| Watching | Project in "Watch", within 3 days | Check email for objections |
| Ready to Close | 3+ business days, no objections | Send approval email, close issue |

## Namespace Patterns

All 5 tier-1 languages must have namespaces matching these patterns:

- **.NET:** `Azure.ResourceManager.{Name}` (PascalCase)
- **Java:** `azure-resourcemanager-{name} (com.azure.resourcemanager.{name})` (lowercase)
- **Go:** `sdk/resourcemanager/{name}/arm{name}` (lowercase)
- **JavaScript:** `@azure/arm-{name}` (lowercase)
- **Python:** `azure-mgmt-{name}` (lowercase)

**Note:** The word "azure" must NOT appear in the resource provider name portion.

## Output

Results are written to `output/{timestamp}/`:
- `issues.json` - Fetched issues with current state
- `actions.json` - Actions taken per issue
- `report.md` - Human-readable summary
- `errors.json` - Any errors encountered

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GRAPH_CLIENT_ID` | Azure AD app client ID | Yes |
| `GRAPH_TENANT_ID` | Azure AD tenant ID | Yes |
| `GRAPH_ACCESS_TOKEN` | Pre-authenticated token (CI/CD) | No |
| `DRY_RUN` | Set to "true" to skip mutations | No |

## Troubleshooting

### GitHub Project Access
Ensure you have the `project` scope: `gh auth refresh -s project`

### Graph API Authentication
Run the skill interactively first to complete device code auth. Tokens are cached to `~/.mgmt-namespace-review/token-cache.json`.

### Rate Limits
Issues are processed sequentially to avoid GitHub API rate limits.
