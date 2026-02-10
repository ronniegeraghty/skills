# Workflow Details

Phase detection, namespace patterns, environment variables, and troubleshooting for the MGMT Plane Namespace Review workflow.

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
