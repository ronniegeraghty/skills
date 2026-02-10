---
name: sprint-update-memo
description: "**WORKFLOW SKILL** — Generate Sprint update memos for the AzSDK Tools Agent Inner Loop project by querying GitHub Projects, analyzing Sprint data, and producing formatted Markdown reports. USE FOR: sprint updates, status reports, sprint summaries, stakeholder updates. DO NOT USE FOR: PR analysis (use copilot-pr-analysis), namespace reviews (use mgmt-namespace-review). INVOKES: GitHub CLI (gh)."
---

# Sprint Update Memo Skill

Generate Sprint update memos by querying the Azure SDK Tools Agent Developer Inner Loop GitHub Project (#865) and producing formatted Markdown reports.

## Prerequisites

- GitHub CLI (`gh`) authenticated with `read:project` scope
  - Verify: `gh auth status`
  - Add scope: `gh auth refresh -s read:project`
- Access to Azure organization GitHub Projects

## Quick Start

```bash
cd skills/sprint-update-memo
pnpm install
pnpm start                         # Interactive mode
pnpm start -- --sprint 12          # Specify Sprint number
pnpm start -- --sprint 12 --no-prompt  # Non-interactive
```

## Pipeline Steps

1. **fetch-sprints** — Retrieve Sprint iterations from GitHub Project
2. **fetch-items** — Fetch project items with pagination, filter by Sprint
3. **analyze** — Calculate RAG status, group by category, identify blockers
4. **report** — Generate formatted Markdown memo

## Output

Generated memos are saved to: `output/AzSDK-Tools-Agent-Sprint-[N]-Update.md`

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

## References

- [Writing Guidelines](references/writing-guidelines.md) — Style guide, memo structure, RAG logic, and troubleshooting
- [Sprint 12 Example](samples/Sprint-12-Update.md) — Example of a well-formatted Sprint update memo
- [REQUIREMENTS.md](REQUIREMENTS.md) — Detailed requirements and specifications

## Related Skills

- **copilot-pr-analysis** — Analyze Copilot PR sessions for effectiveness metrics
- **mgmt-namespace-review** — Namespace review process automation
