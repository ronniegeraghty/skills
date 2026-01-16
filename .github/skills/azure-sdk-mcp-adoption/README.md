# Azure SDK MCP Adoption Skill

## Objectives

This Copilot agent skill correlates Azure SDK MCP tool usage with monthly Azure SDK releases to:

- Identify which released packages used MCP tools during the target month
- Show which tools were used per package and how many times
- Identify which MCP client was used
- Compute adoption metrics including percent of released libraries using MCP
- Provide a split between data plane and management plane libraries

## Data Sources

### Kusto Telemetry
- **Cluster**: https://ddazureclients.kusto.windows.net/
- **Database**: AzSdkToolsMcp
- **Table**: RawEventsDependencies

### Release Notes
- **Repository**: https://github.com/Azure/azure-sdk
- **Path**: /_data/releases
- **Structure**: Monthly directories (YYYY-MM) with YAML files per language

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Scaffold skill directory and pnpm workspace | ✅ Complete |
| 2 | Explore Kusto data shape and discover MCP client field | 🔄 In Progress |
| 3 | Explore release notes YAML schema | ⬜ Not Started |
| 4 | Implement Kusto data retrieval script | ⬜ Not Started |
| 5 | Implement release notes parsing script | ⬜ Not Started |
| 6 | Implement correlation logic | ⬜ Not Started |
| 7 | Compute metrics and generate outputs | ⬜ Not Started |

## Key Decisions

- Using Node.js with ES modules
- Using pnpm for package management
- Package name is the primary join key between telemetry and releases

## Assumptions

- Package names in Kusto telemetry match package names in release YAML files
- A package "used MCP" if there is at least one ToolExecuted event

## Open Questions

- [ ] What field in customDimensions identifies the MCP client?
- [ ] What is the exact YAML schema for release notes?
- [ ] How to classify packages as data plane vs management plane?

## Usage

```bash
pnpm install
pnpm start --month 2025-06
```

## Outputs

- **Markdown Report**: `output/report-YYYY-MM.md`
- **JSON Summary**: `output/summary-YYYY-MM.json`
