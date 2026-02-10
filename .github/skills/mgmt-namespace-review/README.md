# MGMT Namespace Review Skill

Automates the Azure SDK Management Plane Namespace Review process, from initial validation through architect approval.

## Overview

This skill orchestrates the namespace review workflow:

1. **Initial Review** - Validates namespace patterns and API spec links
2. **MGMT Approval** - Assigns Arthur Ma for management plane review
3. **Architect Review** - Sends email to architecture board with 3-business-day review window
4. **Watching** - Monitors for objections during review period
5. **Closing** - Approves names and closes issues after successful review

## Quick Start

```bash
cd skills/mgmt-namespace-review
pnpm install

# Run with dry-run first to see what would happen
pnpm start:dry

# Run for real
pnpm start
```

## Prerequisites

### Required

- **Node.js 18+** and **pnpm**
- **GitHub CLI** authenticated with project scope:
  ```bash
  gh auth login
  gh auth refresh -s project
  ```

### Optional (for Teams/Email)

- **Azure AD App Registration** (see setup below)
- Environment variables set for Graph API

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GRAPH_CLIENT_ID` | Azure AD app client ID | For Teams/email |
| `GRAPH_TENANT_ID` | Azure AD tenant ID | For Teams/email |
| `GRAPH_ACCESS_TOKEN` | Pre-authenticated token (CI/CD) | Optional |
| `SKIP_GRAPH_API` | Set to `true` to skip Teams/email | Optional |
| `DRY_RUN` | Set to `true` for dry run mode | Optional |

## Azure AD App Setup

To enable Teams messages and email functionality, you need to register an Azure AD application.

### Step 1: Register the Application

1. Go to the [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure:
   - **Name:** `MGMT Namespace Review Skill`
   - **Supported account types:** `Accounts in this organizational directory only`
   - **Redirect URI:** Leave blank (we use device code flow)
5. Click **Register**

### Step 2: Note the Application Details

After registration, note these values from the **Overview** page:
- **Application (client) ID** → Use as `GRAPH_CLIENT_ID`
- **Directory (tenant) ID** → Use as `GRAPH_TENANT_ID`

### Step 3: Configure API Permissions

1. Go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph** → **Delegated permissions**
3. Add these permissions:
   - `Mail.Send` - Send emails
   - `Mail.Read` - Read emails (for objection checking)
   - `Chat.ReadWrite` - Create and access chats
   - `ChatMessage.Send` - Send Teams messages
   - `User.Read` - Read user profile
4. Click **Add permissions**
5. Click **Grant admin consent for [Your Organization]** (requires admin)

### Step 4: Enable Public Client Flow

1. Go to **Authentication**
2. Under **Advanced settings**, set **Allow public client flows** to **Yes**
3. Click **Save**

### Step 5: Set Environment Variables

```bash
# Add to your shell profile (.bashrc, .zshrc, PowerShell profile)
export GRAPH_CLIENT_ID="your-client-id-here"
export GRAPH_TENANT_ID="your-tenant-id-here"
```

Or create a `.env` file in the skill directory (don't commit this!):
```
GRAPH_CLIENT_ID=your-client-id-here
GRAPH_TENANT_ID=your-tenant-id-here
```

### Step 6: First-Time Authentication

On first run, you'll see a device code prompt:
```
📱 AUTHENTICATION REQUIRED
============================================================
To sign in, use a web browser to open the page https://microsoft.com/devicelogin 
and enter the code XXXXXXXX to authenticate.
============================================================
```

Follow the instructions to authenticate. Tokens are cached for subsequent runs.

## Usage

### Full Pipeline

```bash
# Process all open namespace review issues
pnpm start

# Dry run - see what would happen without making changes
pnpm start:dry
```

### Individual Steps

```bash
# Just fetch issues
tsx scripts/fetch-issues.ts

# Just validate (requires issues.json from fetch)
tsx scripts/validate.ts

# Just process (requires issues.json from fetch)
tsx scripts/process.ts

# Just generate report (requires issues.json, actions.json, errors.json)
tsx scripts/report.ts
```

### CLI Options

```bash
tsx scripts/run.ts --help      # Show help
tsx scripts/run.ts --dry-run   # Dry run mode
tsx scripts/run.ts -n          # Short form for dry run
```

## Output

Each run creates a timestamped folder in `output/`:

```
output/2026-02-05T10-30-00/
├── issues.json      # Fetched and enriched issues
├── actions.json     # Actions taken
├── errors.json      # Errors encountered
├── report.json      # Structured report
└── report.md        # Human-readable report
```

## Namespace Patterns

The skill validates that all 5 tier-1 languages have correctly formatted namespaces:

| Language | Pattern | Example |
|----------|---------|---------|
| .NET | `Azure.ResourceManager.{Name}` | `Azure.ResourceManager.RedHatOpenShift` |
| Java | `azure-resourcemanager-{name} (com.azure.resourcemanager.{name})` | `azure-resourcemanager-redhatopenshift (...)` |
| Go | `sdk/resourcemanager/{name}/arm{name}` | `sdk/resourcemanager/redhatopenshift/armredhatopenshift` |
| JavaScript | `@azure/arm-{name}` | `@azure/arm-redhatopenshift` |
| Python | `azure-mgmt-{name}` | `azure-mgmt-redhatopenshift` |

**Note:** The word "azure" should NOT appear in the resource provider name (it's already in the prefix).

## Phase Detection

The skill automatically detects which phase each issue is in:

| Phase | Detection | Actions |
|-------|-----------|---------|
| Initial Review | Arthur not assigned | Validate, assign Arthur, Teams DM |
| Awaiting MGMT | Arthur assigned, no approval | Skip (waiting) |
| Architect Review | Arthur approved | Email architects, set Watch status |
| Watching | Status = Watch, < 3 days | Check for objections |
| Ready to Close | Status = Watch, 3+ days | Send approval email, close |

## GitHub Project Integration

Issues are tracked in [Azure SDK Namespace Reviews Project #424](https://github.com/orgs/Azure/projects/424/).

Status values:
- **To Do** - Initial state
- **In Progress** - After initial review, assigned to Arthur
- **Watch** - After architect email sent, monitoring for objections
- **Done** - After issue closed (automatic)

## Troubleshooting

### "GraphQL: Resource not accessible"

Ensure you have the project scope:
```bash
gh auth refresh -s project
```

### "GRAPH_CLIENT_ID and GRAPH_TENANT_ID environment variables are required"

Set up Azure AD app and environment variables. Or to skip Teams/email:
```bash
SKIP_GRAPH_API=true pnpm start
```

### "Could not find architect email"

The skill searches for emails by subject. Ensure the original architect email was sent from your account.

### Rate Limiting

Issues are processed sequentially to avoid GitHub API rate limits. For large batches, consider running in smaller groups.

## Development

```bash
# Type check
pnpm run typecheck

# Run tests
pnpm test
```

## License

MIT
