# Data Sources & Metrics

## Key Metrics

- **Adoption Rate**: Percentage of releases that had MCP tool usage
- **By Language**: JS, Python, .NET, Java, Go, etc.
- **By Type**: GA (stable) vs Beta releases
- **By Plane**: Management vs Data plane packages

## Data Sources

| Source | Details |
|--------|---------|
| Kusto | `ddazureclients.kusto.windows.net` / `AzSdkToolsMcp` / `RawEventsDependencies` |
| GitHub | `Azure/azure-sdk` repository `/_data/releases/YYYY-MM/{language}.yml` |

## File Structure

```
scripts/
├── run.ts              # Pipeline orchestrator
├── fetch-telemetry.ts  # Kusto queries
├── fetch-releases.ts   # GitHub data fetching
├── correlate.ts        # Matching logic
├── report.ts           # Markdown generation
├── utils.ts            # Shared utilities
└── constants.ts        # Configuration values
```
