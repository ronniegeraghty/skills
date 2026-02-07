---
name: sprint-update-memo
description: "Generate Sprint update memos for the AzSDK Tools Agent Inner Loop project. Use for sprint updates, reports, summaries, and status reports. Invokes GitHub CLI for project data retrieval."
---

# Sprint Update Memo Skill

## When to Use This Skill

Activate when user wants to:
- Generate a Sprint update memo for the AzSDK Tools Agent Inner Loop team
- Create a status report for stakeholders on Sprint progress
- Summarize accomplishments, risks, and next steps for a Sprint
- Prepare executive summary of Sprint work

## Prerequisites

- GitHub CLI (`gh`) authenticated with `read:project` scope
  - Verify: `gh auth status`
  - Add scope if needed: `gh auth refresh -s read:project`
- Access to Azure organization GitHub Projects

## Overview

This skill queries the Azure SDK Tools Agent Developer Inner Loop GitHub Project (#865), analyzes Sprint data, and generates a formatted Markdown memo including:

- Executive Summary
- Overall Project RAG Status (Red/Yellow/Green)
- Milestones & Progress table
- Value Delivered to customers
- Risks & Mitigations
- Next Steps

## Quick Start

```bash
cd skills/sprint-update-memo
pnpm install
pnpm start
```

Or run directly:
```bash
pnpm exec tsx scripts/run.ts
```

## Usage

```bash
# Interactive mode (prompts for Sprint and highlights)
pnpm start

# Specify Sprint number
pnpm start -- --sprint 12

# Non-interactive with Sprint number
pnpm start -- --sprint 12 --no-prompt
```

## Pipeline Steps

The skill runs these steps in order:

1. **fetch-sprints** - Retrieves Sprint iterations from GitHub Project
2. **fetch-items** - Fetches project items with pagination, filters by Sprint
3. **analyze** - Calculates RAG status, groups by category, identifies blockers
4. **report** - Generates formatted Markdown memo

## Output

Generated memos are saved to:
```
output/AzSDK-Tools-Agent-Sprint-[N]-Update.md
```

## GitHub Project Details

- **Organization**: Azure
- **Project Number**: 865
- **URL**: https://github.com/orgs/Azure/projects/865

### Fields Used

| Field | Purpose |
|-------|---------|
| Sprint | Iteration field for Sprint assignment |
| Status | Todo, In Progress, Done, Blocked, Needs Triage |
| Epic | Category/stage of developer inner loop |
| Labels | bug bash, Scenario X, Mgmt, azsdk-cli, etc. |

## Memo Structure

### Header
```markdown
# AzSDK Tools Agent - Inner Loop
## Sprint [N] Update
[Date]
```

### Sections
1. **Executive Summary** - Key accomplishments and highlights
2. **Overall Project RAG Status** - 🟢 Green / 🟡 Yellow / 🔴 Red with justification
3. **Milestones & Progress** - Table with Category, Task, Status, Bug Bash, Notes
4. **Value Delivered** - Customer-facing value from completed work
5. **Risks & Mitigations** - Table of risks, impacts, and mitigations
6. **Next Steps** - Planned work for next Sprint

### Status Emojis
| Status | Display |
|--------|---------|
| Done | ✅ Done |
| In Progress | 🔄 In Progress |
| Todo | 📝 To Do |
| Blocked | 🚫 Blocked |

### RAG Status Logic
| Status | Criteria |
|--------|----------|
| 🟢 Green | ≥80% Done, 0 Blocked |
| 🟡 Yellow | 60-79% Done, or 1-2 Blocked |
| 🔴 Red | <60% Done, or 3+ Blocked |

## Troubleshooting

### Authentication Issues
```bash
# Check authentication status
gh auth status

# Add project read scope
gh auth refresh -s read:project
```

### No Items Found for Sprint
- Verify Sprint name matches exactly (e.g., "Sprint 12")
- Check that items have Status field populated
- Try running with `--sprint` flag to specify Sprint number

## Related Documentation

- [REQUIREMENTS.md](./REQUIREMENTS.md) - Detailed requirements and specifications
- [GitHub Projects API](https://docs.github.com/en/graphql/reference/objects#projectv2)
