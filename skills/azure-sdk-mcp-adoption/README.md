# Azure SDK MCP Adoption Skill

A Copilot agent skill that correlates Azure SDK MCP tool usage with monthly releases to generate adoption reports.

## Purpose

- Identify which released packages used MCP tools during development
- Calculate adoption rates by language, version type, and plane
- Track which MCP tools and clients are being used

## Quick Start

```bash
pnpm install
node src/run.js --help
```

See [SKILL.md](SKILL.md) for detailed usage instructions.

## Data Sources

- **Kusto**: `ddazureclients.kusto.windows.net` / `AzSdkToolsMcp`
- **GitHub**: `Azure/azure-sdk` repository release YAML files
