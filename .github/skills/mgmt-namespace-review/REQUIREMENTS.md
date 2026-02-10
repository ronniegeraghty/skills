# MGMT Plane Namespace Review Skill - Requirements

## References

- [Agent Skills Specification](https://agentskills.io/specification)
- [GitHub CLI Manual](https://cli.github.com/manual/)
- [GitHub Projects API](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)
- [Microsoft Graph API - Mail](https://learn.microsoft.com/en-us/graph/outlook-mail-concept-overview)
- [Microsoft Graph API - Teams Chat](https://learn.microsoft.com/en-us/graph/api/chat-post-messages)

---

## 1. Skill Overview

| Field | Value |
|-------|-------|
| **Name** | `mgmt-namespace-review` |
| **Classification** | `**WORKFLOW SKILL**` |
| **Purpose** | Automate the Azure SDK Management Plane Namespace Review process, from initial validation through architect approval |

### Description (for SKILL.md frontmatter)

```yaml
description: |
  **WORKFLOW SKILL** - Orchestrates the Azure SDK Management Plane Namespace Review process.
  USE FOR: "update namespace reviews", "process mgmt namespace reviews", "check namespace review status", "mgmt plane review".
  DO NOT USE FOR: creating new namespace review issues (manual), individual GitHub operations (use gh CLI directly).
  INVOKES: GitHub CLI for issue/project management, Microsoft Graph API for Teams/email.
  FOR SINGLE OPERATIONS: Use `gh issue` or `gh project` commands directly.
```

---

## 2. Use Cases

### Primary Trigger

User says: **"update management plane namespace reviews"** (or similar phrases)

The skill will:
1. Find all open issues with `mgmt-namespace-review` label in `Azure/azure-sdk` and `Azure/azure-sdk-pr`
2. For each issue, determine its current phase based on state
3. Perform the appropriate actions to advance each issue to the next phase

### Trigger Phrases

- "update namespace reviews"
- "process mgmt namespace reviews"
- "check namespace review status"
- "update mgmt plane reviews"
- "process management plane namespace reviews"

### Anti-Triggers (DO NOT USE FOR)

- Creating new namespace review issues (manual process)
- Single GitHub issue operations (use `gh issue` directly)
- Querying single email threads (use Outlook directly)
- Looking up project status without processing (use `gh project` directly)

---

## 3. Phase Detection Logic

The skill **infers the current phase** from issue state rather than explicit tracking.

| Phase | Detection Criteria | Actions |
|-------|-------------------|---------|
| **1. Initial Review** | Has `mgmt-namespace-review` label AND Arthur (`@ArthurMa1978`) is NOT assigned | Validate namespaces + API spec link → If valid: assign Arthur, Teams DM, project → "In Progress" |
| **2. Awaiting MGMT Approval** | Arthur IS assigned AND NO `mgmt-namespace-ready` label AND no approval comment from Arthur | No action (waiting for Arthur) |
| **3. Ready for Architect Review** | Has `mgmt-namespace-ready` label OR Arthur commented approval (LGTM, looks good, approved, etc.) | Add 3-day notice comment, send architect email, project → "Watch" |
| **4. Watching for Objections** | Project status is "Watch" AND within 3 business days of architect email | Check email thread for objections, relay any to issue author |
| **5. Ready to Close** | Project status is "Watch" AND 3+ business days passed AND no unresolved objections | Send approval email to thread, comment on issue, close issue (auto-moves to "Done") |

### Phase Detection Pseudocode

```
for each open issue with label 'mgmt-namespace-review':
    if '@ArthurMa1978' not in assignees:
        → Phase 1: Initial Review
    elif 'mgmt-namespace-ready' not in labels AND no_arthur_approval_comment:
        → Phase 2: Awaiting MGMT Approval (skip)
    elif project_status != 'Watch':
        → Phase 3: Ready for Architect Review
    elif business_days_since_architect_email < 3:
        → Phase 4: Watching (check for objections)
    else:
        → Phase 5: Ready to Close
```

---

## 4. Namespace Pattern Validation (Strict)

All 5 tier-1 languages must have namespaces that match these exact patterns:

| Language | Pattern | Example | Case |
|----------|---------|---------|------|
| **.NET** | `Azure.ResourceManager.{ResourceProviderName}` | `Azure.ResourceManager.RedHatOpenShift` | PascalCase |
| **Java** | `azure-resourcemanager-{resourceprovidername}` + `(com.azure.resourcemanager.{resourceprovidername})` | `azure-resourcemanager-redhatopenshift (com.azure.resourcemanager.redhatopenshift)` | lowercase |
| **Go/Golang** | `sdk/resourcemanager/{resourceprovidername}/arm{resourceprovidername}` | `sdk/resourcemanager/redhatopenshift/armredhatopenshift` | lowercase |
| **JavaScript** | `@azure/arm-{resourceprovidername}` | `@azure/arm-redhatopenshift` | lowercase |
| **Python** | `azure-mgmt-{resourceprovidername}` | `azure-mgmt-redhatopenshift` | lowercase |

### Validation Rules

1. **All 5 languages must be present** in the issue body
2. **Each namespace must match its pattern** exactly (correct prefix, correct case)
3. **Resource provider name must be consistent** across all languages (accounting for case differences)
4. **API spec link required** - Issue must contain a link to `github.com/Azure/azure-rest-api-specs`
5. **No "azure" in resource provider name** - The word "azure" already appears in the prefix of all namespace patterns, so it must NOT appear in the `{resourceprovidername}` portion. This prevents redundant names like `Azure.ResourceManager.AzureStorage` or `@azure/arm-azurestorage`.

### On Validation Failure

Post a comment on the issue mentioning the author (`@{author}`) listing:
- Which languages are missing
- Which namespaces don't match the expected pattern
- Whether the API spec link is missing
- Whether "azure" appears in the resource provider name (should be removed)

---

## 5. GitHub Repositories

| Repository | Purpose |
|------------|---------|
| `Azure/azure-sdk` | Primary repo for namespace review issues |
| `Azure/azure-sdk-pr` | Secondary repo for namespace review issues |

### GitHub Labels

| Label | Meaning |
|-------|---------|
| `mgmt-namespace-review` | Issue is a namespace review request |
| `mgmt-namespace-ready` | Arthur has approved the namespaces |

### GitHub Project

| Field | Value |
|-------|-------|
| **URL** | `https://github.com/orgs/Azure/projects/424/` |
| **Organization** | `Azure` |
| **Project Number** | `424` |

#### Project Status Values

| Status | When Set | How Set |
|--------|----------|---------|
| **To Do** | Initial (automatic) | Issues enter here automatically |
| **In Progress** | After initial review passes and Arthur assigned | Skill sets via GraphQL |
| **Watch** | After architect email sent | Skill sets via GraphQL |
| **Done** | When issue closed | Automatic on close |

---

## 6. External Integrations

### 6.1 GitHub CLI (`gh`)

**Required scope:** `gh auth refresh -s project`

#### Issue Operations

```bash
# List open namespace review issues
gh issue list --repo Azure/azure-sdk --label mgmt-namespace-review --state open --json number,title,assignees,labels,body,author,url

# Add assignee
gh issue edit {number} --repo Azure/azure-sdk --add-assignee ArthurMa1978

# Add comment
gh issue comment {number} --repo Azure/azure-sdk --body "Comment text"

# Close issue
gh issue close {number} --repo Azure/azure-sdk
```

#### Project Operations (via GraphQL)

```bash
# Get project ID and field IDs
gh api graphql -f query='
  query {
    organization(login: "Azure") {
      projectV2(number: 424) {
        id
        fields(first: 20) {
          nodes {
            ... on ProjectV2SingleSelectField {
              id
              name
              options { id name }
            }
          }
        }
      }
    }
  }'

# Update item status
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: "PROJECT_ID"
        itemId: "ITEM_ID"
        fieldId: "STATUS_FIELD_ID"
        value: { singleSelectOptionId: "OPTION_ID" }
      }
    ) {
      projectV2Item { id }
    }
  }'
```

### 6.2 Microsoft Graph API

**Authentication:** Azure AD app registration with delegated permissions

#### Required Permissions

| Permission | Type | Purpose |
|------------|------|---------|
| `Mail.Send` | Delegated | Send emails to architect board |
| `Mail.Read` | Delegated | Read email threads for objections |
| `ChatMessage.Send` | Delegated | Send Teams DM to Arthur |
| `Chat.ReadWrite` | Delegated | Create/access 1:1 chat with Arthur |

#### Setup Requirements

1. Register app in Microsoft corporate Azure AD tenant
2. Request above Graph API permissions
3. Use device code flow or interactive auth for initial login
4. Store refresh token securely for subsequent runs

#### Send Email

```http
POST https://graph.microsoft.com/v1.0/me/sendMail
Content-Type: application/json

{
  "message": {
    "subject": "MGMT Plane Namespace Review for {ResourceProviderName}",
    "body": {
      "contentType": "HTML",
      "content": "..."
    },
    "toRecipients": [{ "emailAddress": { "address": "azsdkarch@microsoft.com" }}],
    "ccRecipients": [
      { "emailAddress": { "address": "azsdkarch-help@microsoft.com" }},
      { "emailAddress": { "address": "arthurma@microsoft.com" }},
      { "emailAddress": { "address": "micnash@microsoft.com" }}
    ]
  }
}
```

#### Send Teams Message

```http
# First, get or create 1:1 chat with Arthur
POST https://graph.microsoft.com/v1.0/chats
{
  "chatType": "oneOnOne",
  "members": [
    { "@odata.type": "#microsoft.graph.aadUserConversationMember", "roles": ["owner"], "user@odata.bind": "https://graph.microsoft.com/v1.0/users/arthurma@microsoft.com" },
    { "@odata.type": "#microsoft.graph.aadUserConversationMember", "roles": ["owner"], "user@odata.bind": "https://graph.microsoft.com/v1.0/users/{current-user}" }
  ]
}

# Then send message
POST https://graph.microsoft.com/v1.0/chats/{chat-id}/messages
{
  "body": { "content": "Hi Arthur, new namespace review: {issue-url}" }
}
```

#### Search Emails

```http
GET https://graph.microsoft.com/v1.0/me/messages?$filter=subject eq 'MGMT Plane Namespace Review for {ResourceProviderName}'&$orderby=receivedDateTime desc
```

---

## 7. Email Templates

### 7.1 Architect Review Email (Initial)

**To:** azsdkarch@microsoft.com  
**CC:** azsdkarch-help@microsoft.com, arthurma@microsoft.com, micnash@microsoft.com  
**Subject:** MGMT Plane Namespace Review for {ResourceProviderName}

```
Hi Architects,

This is an FYI email for our MGMT Plane namespace review process.

GitHub Issue: {issue-url}

The namespaces below have been approved by the MGMT Plane team and the service partner teams. You have until EOB on {deadline-date} to object to any of the proposed names. If there are no objections, the names will be considered approved.

Note: Some of the libraries listed below have already been released in varying states, as indicated.

Proposed Namespaces:
.NET: {dotnet-namespace}
Java: {java-namespace}
JavaScript: {js-namespace}
Python: {python-namespace}
Go/Golang: {go-namespace}

Let me know if there are any questions or objections.

Thanks,
Ronnie
```

### 7.2 Architect Approval Email (After 3 Business Days)

**Reply to same thread**

```
Hi All,

Since there have been no objections to the proposed package names below, they are now considered approved.

Thanks,
Ronnie
```

---

## 8. Issue Comment Templates

### 8.1 Moving to Architect Review

```markdown
We'll now move to the Architect Review. The architects will have 3 business days to make any objections to the package names. If there are no objections or all objections are handled, I'll update this issue stating that the names have been approved.

📧 Architect review email sent with subject: **"MGMT Plane Namespace Review for {ResourceProviderName}"**
⏰ Review deadline: EOB {deadline-date}
```

### 8.2 Validation Failed

```markdown
@{author} - I found some issues during the initial review of this namespace request:

**Missing Namespaces:**
{list of missing languages}

**Pattern Mismatches:**
{list of namespace pattern issues}

**Missing API Spec Link:**
{if applicable: "Please include a link to the service's API specification in the Azure/azure-rest-api-specs repository."}

Please update the issue with the missing information.
```

### 8.3 Objection Received

```markdown
@{author} - An objection was raised during the architect review:

> {objection text}
> — {architect name}

Please address this objection. The review deadline has been extended to allow for resolution.
```

### 8.4 Names Approved (Closing)

```markdown
🎉 The proposed namespace names have been approved by the Architecture Board with no objections.

You may proceed with package development using these names:
- **.NET:** {dotnet-namespace}
- **Java:** {java-namespace}
- **JavaScript:** {js-namespace}
- **Python:** {python-namespace}
- **Go:** {go-namespace}

Closing this issue.
```

---

## 9. Business Day Calculation

### Rules

1. **Exclude weekends** - Saturday and Sunday
2. **Exclude US Federal Holidays:**
   - New Year's Day (January 1)
   - Martin Luther King Jr. Day (3rd Monday of January)
   - Presidents' Day (3rd Monday of February)
   - Memorial Day (Last Monday of May)
   - Juneteenth (June 19)
   - Independence Day (July 4)
   - Labor Day (1st Monday of September)
   - Columbus Day (2nd Monday of October)
   - Veterans Day (November 11)
   - Thanksgiving Day (4th Thursday of November)
   - Christmas Day (December 25)
3. **Exclude Microsoft-specific holidays:**
   - Day after Thanksgiving
   - December 24 (Christmas Eve, when observed)
   - Week between Christmas and New Year's (typically Dec 26-31)

### Deadline Calculation

Given email sent date, calculate deadline = email date + 3 business days (end of day)

---

## 10. Teams Message Template

**To:** Arthur Ma (arthurma@microsoft.com) - Direct 1:1 chat

```
Hi Arthur! 👋

A new MGMT Plane Namespace Review has been submitted and needs your review:

📋 **Issue:** {issue-title}
🔗 **Link:** {issue-url}

Please review the proposed namespaces and either:
- Add the `mgmt-namespace-ready` label if approved
- Comment with any concerns

Thanks!
```

---

## 11. CLI Tools Required

| Tool | Purpose | Installation |
|------|---------|--------------|
| `gh` | GitHub CLI for issues and projects | `winget install GitHub.cli` or `brew install gh` |
| Node.js | Script runtime | `winget install OpenJS.NodeJS.LTS` |

---

## 12. Testing Plan

### Trigger Tests (Should Trigger)

```yaml
shouldTriggerPrompts:
  - "update namespace reviews"
  - "process mgmt namespace reviews"
  - "check namespace review status"
  - "update mgmt plane reviews"
  - "run namespace review workflow"
```

### Anti-Trigger Tests (Should NOT Trigger)

```yaml
shouldNotTriggerPrompts:
  - "create a new namespace review issue"
  - "list all issues in azure-sdk"
  - "send email to architects"
  - "close issue #1234"
  - "what is the status of issue 5678"
```

### Validation Tests

- [ ] Namespace pattern matching for all 5 languages
- [ ] Business day calculation (including holidays)
- [ ] Phase detection logic accuracy
- [ ] GitHub Project status updates via GraphQL
- [ ] Graph API authentication flow
- [ ] Email thread search by subject

### Integration Tests

- [ ] Mock GitHub API responses for issue queries
- [ ] Mock Graph API for email send/read
- [ ] Mock Graph API for Teams chat creation/message
- [ ] End-to-end phase transition testing

---

## 13. Requirements Checklist

- [x] Links to [Agent Skills Specification](https://agentskills.io/specification)
- [x] MCP tools listed (GitHub CLI, Microsoft Graph API)
- [x] CLI fallback commands documented
- [x] Test scenarios documented
- [x] Phase detection logic defined
- [x] Email templates provided
- [x] Issue comment templates provided
- [x] Business day calculation rules defined
- [x] All external integrations documented
- [x] TypeScript implementation completed

---

## 14. Planning Decisions (Resolved)

| Decision | Resolution |
|----------|------------|
| **Graph API Authentication** | Device code flow with token caching. Check for `GRAPH_ACCESS_TOKEN` env var for CI/CD. |
| **Azure AD App Registration** | App does NOT exist. README includes step-by-step setup instructions for creating the app in Azure AD with required permissions. |
| **Error Handling** | Skip failed issues and continue processing others. Log the issue number, phase, and error message. Include failures in final report summary. |
| **Parallel Processing** | Sequential processing to simplify error handling and avoid rate limits. |
| **Logging/Reporting** | Yes - output a summary report with: issues processed, actions taken, issues skipped, errors encountered. |
| **Dry-Run Mode** | Implemented `--dry-run` flag that validates issues and logs intended actions without making any changes to GitHub, Teams, or email. |
