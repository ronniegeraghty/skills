# Sprint Update Memo Skill - Requirements Document

## References

- [Agent Skills Specification](https://agentskills.io/specification)
- [Skills CLI (npx skills)](https://github.com/vercel-labs/skills)
- [GitHub CLI Documentation](https://cli.github.com/manual/)
- [GitHub Projects API (GraphQL)](https://docs.github.com/en/graphql/reference/objects#projectv2)

---

## 1. Skill Overview

| Field | Value |
|-------|-------|
| **Name** | `sprint-update-memo` |
| **Classification** | `**WORKFLOW SKILL**` |
| **Purpose** | Generate formatted Sprint update memos for the Azure SDK Tools Agent Developer Inner Loop project by querying the GitHub Project, analyzing Sprint progress, and producing a structured Markdown report. |

### Description (for SKILL.md frontmatter)

```yaml
description: |
  **WORKFLOW SKILL** - Generate Sprint update memos for the AzSDK Tools Agent Inner Loop project.
  USE FOR: "write sprint update", "generate sprint memo", "sprint report", "sprint summary", 
  "create sprint update", "what happened this sprint", "sprint status report".
  DO NOT USE FOR: viewing individual issues (use gh CLI directly), updating issue status 
  (use gh CLI), creating new issues (use gh CLI).
  INVOKES: GitHub CLI (`gh`) for project data retrieval.
  FOR SINGLE OPERATIONS: Use `gh project item-list` or `gh api graphql` directly for quick queries.
```

---

## 2. Use Cases

### Primary Use Case
A Team Lead or Project Manager needs to generate a bi-weekly/tri-weekly Sprint update memo summarizing:
- What was accomplished during the Sprint
- Overall project health (RAG status)
- Work in progress and planned next steps
- Risks and mitigations
- Value delivered to customers

### User Workflow
1. User invokes the skill (optionally specifying Sprint number and/or particular highlights)
2. Agent prompts for any specific items to highlight (if not provided)
3. Agent queries GitHub Project for Sprint data
4. Agent determines current Sprint (if not specified) and confirms with user
5. Agent analyzes issues: status distribution, blocked items, completed work
6. Agent generates structured Markdown memo
7. Agent presents draft executive summary for user feedback
8. Agent saves final memo to output directory

### Target Users
- Team Leads
- Project Managers
- Product Managers
- Stakeholders wanting project status

---

## 3. Triggers (USE FOR)

| Trigger Phrase | Description |
|----------------|-------------|
| "write sprint update" | Primary trigger for generating memo |
| "generate sprint memo" | Alternative phrasing |
| "sprint report" | Status report request |
| "sprint summary" | Summary generation |
| "create sprint update" | Creation-focused request |
| "what happened this sprint" | Retrospective request |
| "sprint status report" | Status-focused request |
| "AzSDK sprint update" | Project-specific request |
| "inner loop sprint memo" | Team-specific request |

---

## 4. Anti-Triggers (DO NOT USE FOR)

| Scenario | Alternative |
|----------|-------------|
| View individual GitHub issues | Use `gh issue view` directly |
| Update issue status | Use `gh issue edit` directly |
| Create new issues | Use `gh issue create` directly |
| Query project without generating memo | Use `gh project item-list` directly |
| Modify Sprint/iteration assignments | Use GitHub Projects UI or API directly |

---

## 5. GitHub Project Structure

### Project Details
- **Organization**: Azure
- **Project Number**: 865
- **Project URL**: https://github.com/orgs/Azure/projects/865

### Fields

| Field Name | Field Type | Values/Description |
|------------|------------|-------------------|
| **Title** | Text | Issue title |
| **Assignees** | User list | Assigned team members |
| **Status** | Single Select | `Todo`, `In Progress`, `Done`, `Needs Triage`, `Blocked` |
| **Labels** | Labels | See Labels section below |
| **Sprint** | Iteration | Format: "Sprint N" (e.g., "Sprint 12"); includes `startDate` and `duration` |
| **Epic** | Single Select | Category/stage of developer inner loop (see below) |
| **Language** | Single Select | `.NET`, `Java`, `Python`, `JS`, `Go`, `C++`, `Rust`, `Cross Language`, `Eng Sys` |
| **Category** | Single Select | `Pain Point`, `Activity`, `Tool`, `Work item` |
| **Priority** | Number | Priority ranking |
| **Cost (days)** | Number | Estimated effort |

### Epic Values (Inner Loop Stages)
These map to the "Category" column in the memo table:

| Epic Value | Display Name for Memo |
|------------|----------------------|
| `0.5 TypeSpec` | TypeSpec Authoring |
| `1. Env Setup` | Environment Setup |
| `2. Generating` | SDK Generation |
| `3. Customizing TypeSpec/Library` | SDK Code Customization |
| `4. Testing` | Testing |
| `5. Samples` | Samples & Sample Generation |
| `6. Package Metadata & Docs Updates` | Package Metadata & Docs Updates |
| `7. Validating` | Validation |
| `8. Releasing` | Releasing |
| `99. Operations` | Integration & AI Tooling |

### Labels to Track

| Label | Meaning | Memo Usage |
|-------|---------|------------|
| `bug bash` | Issue discovered during bug bash | Populate "Bug Bash" column with ✅ |
| `Scenario 1`, `Scenario 2`, etc. | Scenario categorization | Include in notes if relevant |
| `Mgmt` | Management plane related | Include in notes if relevant |
| `azsdk-cli` | Related to CLI mode | Include in notes if relevant |
| `Central-EngSys` | Central Engineering Systems | Include in notes if relevant |
| `design discussion` | Design conversation, not implementation | Note in status or skip from main work items |

### Sprint Field Structure
From GraphQL API:
```json
{
  "title": "Sprint 12",
  "startDate": "2026-01-19",
  "duration": 21
}
```
- Sprint end date = startDate + duration days
- Current Sprint determined by: `startDate <= today < startDate + duration`

---

## 6. Memo Structure (Output Format)

### Document Header
```markdown
# AzSDK Tools Agent - Inner Loop

## Sprint [N] Update

[Month Day, Year]
```

### Sections

#### 1. Executive Summary
- 2-4 paragraph overview of Sprint accomplishments
- Key highlights and achievements
- Important upcoming work
- **User can provide specific items to include**
- **Agent drafts first, user can refine**

#### 2. Overall Project RAG Status
Format:
```markdown
## Overall Project RAG Status

🟢 **Green** — [1-2 sentence justification]
```

RAG Determination Logic:
| Status | Criteria |
|--------|----------|
| 🟢 **Green** | ≥80% of Sprint items Done, 0 Blocked items |
| 🟡 **Yellow** | 60-79% Done, OR 1-2 Blocked items with mitigations |
| 🔴 **Red** | <60% Done, OR 3+ Blocked items, OR critical blockers |

#### 3. Milestones & Progress
Table format:
```markdown
## Milestones & Progress

| Category | Task | Status | Bug Bash | Notes |
|----------|------|--------|----------|-------|
| Environment Setup | Tool installation verification | ✅ Done | ✅ | Fixed command validation |
```

**Status Emojis:**
| Status Value | Display |
|--------------|---------|
| Done | ✅ Done |
| In Progress | 🔄 In Progress |
| Todo | 📝 To Do |
| Blocked | 🚫 Blocked |
| Needs Triage | (skip or note as unplanned) |

**Column Details:**
- **Category**: Derived from `Epic` field, mapped to friendly names
- **Task**: Issue title (cleaned up if needed)
- **Status**: Status emoji + text
- **Bug Bash**: ✅ if issue has `bug bash` label, empty otherwise
- **Notes**: 
  - For Blocked: What's blocking it
  - For Done: Brief summary of accomplishment
  - For In Progress: Progress notes if available
  - Include scenario labels if present

#### 4. Value Delivered
- Focus on **customer-facing value** from completed work
- Synthesized from Done items, not 1:1 mapping
- Group related accomplishments into value statements
- Format: Bolded category followed by description

```markdown
## Value Delivered

- **Stability & Reliability**: Azure service teams experience fewer blockers...
- **Faster Environment Setup**: Service teams can quickly verify...
```

#### 5. Risks & Mitigations
Table format:
```markdown
## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| [Risk description] | [Impact on team/project] | [Mitigation strategy] |
```

- Derived from **Blocked** items
- Agent analyzes blocked items to identify risks
- User can add additional risks

#### 6. Next Steps
```markdown
## Next Steps (Sprint [N+1] Focus)

- **[Category/Theme]**: Description of planned work
- ...
```

Sources for next steps:
1. Items in next Sprint iteration (if populated)
2. Items in current Sprint still `In Progress` or `Todo`
3. User-provided priorities

---

## 7. CLI Commands Reference

### List Project Fields
```bash
gh project field-list 865 --owner Azure --format json
```

### Get Sprint Iterations (GraphQL)
```bash
gh api graphql -f query='
query {
  organization(login: "Azure") {
    projectV2(number: 865) {
      field(name: "Sprint") {
        ... on ProjectV2IterationField {
          configuration {
            iterations {
              id
              title
              startDate
              duration
            }
            completedIterations {
              id
              title
              startDate
              duration
            }
          }
        }
      }
    }
  }
}'
```

### Get Project Items with All Fields (GraphQL)
```bash
gh api graphql -f query='
query($cursor: String) {
  organization(login: "Azure") {
    projectV2(number: 865) {
      items(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          sprint: fieldValueByName(name: "Sprint") {
            ... on ProjectV2ItemFieldIterationValue {
              title
              startDate
              duration
            }
          }
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
            }
          }
          epic: fieldValueByName(name: "Epic") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
            }
          }
          content {
            ... on Issue {
              title
              number
              url
              body
              labels(first: 10) {
                nodes {
                  name
                }
              }
            }
            ... on DraftIssue {
              title
              body
            }
          }
        }
      }
    }
  }
}'
```

### Data Fetching Strategy

**Note**: GitHub Projects V2 API does not support server-side filtering by iteration/Sprint. However, we can optimize:

1. **Paginate efficiently**: Fetch 100 items per request (max allowed)
2. **Client-side filtering**: Filter items by Sprint title after fetching
3. **Target Sprints only**: Only keep items where `sprint.title` matches:
   - Current Sprint (e.g., "Sprint 12")
   - Next Sprint (e.g., "Sprint 13") - for Next Steps section
4. **Include Draft Issues**: Include DraftIssues that have a valid `status` field

**Filtering Logic**:
```typescript
// After fetching all paginated items
const targetSprints = ["Sprint 12", "Sprint 13"];
const filteredItems = allItems.filter(item => 
  item.sprint && targetSprints.includes(item.sprint.title) && item.status
);
```

---

## 8. User Interaction Flow

### Step 1: Initial Prompt Handling
- If user provides Sprint number → use it
- If user provides highlights/notes → capture for executive summary
- If neither provided → proceed to Step 2

### Step 2: Gather User Input (if needed)
```
Before generating the Sprint update memo, I have a few questions:

1. Which Sprint should I generate the report for? 
   (Current Sprint appears to be Sprint 12: Jan 19 - Feb 9, 2026)

2. Are there any specific accomplishments, highlights, or items you'd 
   like me to make sure are included in the executive summary?

3. Any known risks or concerns you'd like me to address?
```

### Step 3: Data Collection
1. Query GitHub Project for Sprint iterations (active + completed)
2. Identify target Sprint (current or user-specified) and next Sprint
3. Fetch all project items with pagination (100 per request)
4. Filter client-side to items in target Sprint and next Sprint
5. Include both Issues and DraftIssues that have a valid status

### Step 4: Analysis
1. Calculate status distribution (Done, In Progress, Todo, Blocked)
2. Determine RAG status based on completion percentage and blocked items
3. Group items by Epic/Category
4. Identify blocked items for Risks section
5. Identify value-delivering accomplishments from Done items

### Step 5: Draft Generation
1. Generate executive summary draft
2. Present to user for feedback
3. Incorporate feedback
4. Generate full memo

### Step 6: Output
- Save to: `skills/sprint-update-memo/output/AzSDK-Tools-Agent-Sprint-[N]-Update.md`
- Present summary to user

---

## 9. Output Location & Naming

| Item | Value |
|------|-------|
| **Directory** | `skills/sprint-update-memo/output/` |
| **Filename** | `AzSDK-Tools-Agent-Sprint-[N]-Update.md` |
| **Example** | `AzSDK-Tools-Agent-Sprint-12-Update.md` |

---

## 10. Dependencies

### Required
- **GitHub CLI (`gh`)**: Must be installed and authenticated with `read:project` scope
  - Verify: `gh auth status`
  - Add scope: `gh auth refresh -s read:project`

### Authentication Scopes
- `read:project` - Required for accessing GitHub Projects

---

## 11. Testing Plan

### Trigger Tests (SHOULD trigger skill)
```yaml
shouldTriggerPrompts:
  - "write the sprint update memo"
  - "generate sprint 12 update"
  - "create the AzSDK sprint summary"
  - "what did we accomplish this sprint"
  - "sprint status report for inner loop"
  - "help me write the sprint update"
  - "I need to create the sprint memo"
  - "generate the sprint report"
```

### Anti-Trigger Tests (should NOT trigger skill)
```yaml
shouldNotTriggerPrompts:
  - "list all issues in the project"
  - "show me blocked issues"
  - "update issue 12345 status"
  - "create a new issue for testing"
  - "what sprint are we in"
  - "move this issue to done"
  - "assign this to me"
  - "check the project board"
```

### Integration Tests
1. **Sprint Detection**: Verify correct identification of current Sprint
2. **Data Fetch**: Verify all items for a Sprint are retrieved (pagination)
3. **Status Mapping**: Verify correct emoji mapping for each status
4. **Epic Mapping**: Verify Epic values map to correct category names
5. **Label Detection**: Verify bug bash and scenario labels are detected
6. **RAG Calculation**: Verify RAG status is calculated correctly
7. **Output Generation**: Verify Markdown is valid and properly formatted

---

## 12. Script Requirements

### Languages
- **Primary**: TypeScript (consistent with other skills in repo)
- **Cross-platform**: PowerShell (`run.ps1`) and Bash (`run.sh`) entry points

### Script Structure
```
scripts/
├── run.ts          # Main entry point
├── run.ps1         # PowerShell wrapper
├── run.sh          # Bash wrapper
├── constants.ts    # Project configuration, field mappings
├── types.ts        # TypeScript interfaces
├── fetch-sprints.ts    # Sprint iteration fetching
├── fetch-items.ts      # Project item fetching with pagination
├── analyze.ts      # Status analysis, RAG calculation
├── report.ts       # Markdown generation
└── utils.ts        # Shared utilities
```

### Key Interfaces
```typescript
interface SprintIteration {
  id: string;
  title: string;       // "Sprint 12"
  startDate: string;   // "2026-01-19"
  duration: number;    // 21 (days)
}

interface ProjectItem {
  id: string;
  title: string;
  status: 'Todo' | 'In Progress' | 'Done' | 'Needs Triage' | 'Blocked';
  epic: string | null;
  sprint: SprintIteration | null;
  labels: string[];
  issueNumber?: number;
  issueUrl?: string;
  body?: string;
}

interface SprintAnalysis {
  sprintNumber: number;
  startDate: Date;
  endDate: Date;
  items: ProjectItem[];
  statusCounts: Record<string, number>;
  ragStatus: 'Green' | 'Yellow' | 'Red';
  ragReason: string;
  blockedItems: ProjectItem[];
  completedItems: ProjectItem[];
  inProgressItems: ProjectItem[];
  todoItems: ProjectItem[];
}
```

---

## 13. Requirements Checklist

- [x] Links to [Agent Skills Specification](https://agentskills.io/specification)
- [x] GitHub CLI preferred (no MCP dependency)
- [x] Non-trivial scripts: TypeScript with PowerShell and Bash wrappers planned
- [x] Test scenarios documented
- [x] GitHub Project structure documented with field details
- [x] User interaction flow defined
- [x] Output format and location specified
- [x] Status emoji mappings defined
- [x] RAG status calculation logic defined
- [x] Epic to Category mappings defined
- [x] Labels to track identified
- [x] CLI commands for data fetching documented

---

## 14. Design Decisions

1. **Draft Issues**: Draft issues (not linked to repos) **should be included** in the memo if they have a valid status. They won't have issue numbers/URLs but are still valid work items.

2. **Efficient Data Fetching**: With 845+ items in the project, fetch only items for the **current Sprint and next Sprint** using filtering. This reduces API calls and processing time significantly.

---

## 15. Open Questions / Notes

1. **Executive Summary AI Generation**: The agent will synthesize the executive summary from completed work. User feedback loop is critical for accuracy.

2. **Historical Reports**: Consider allowing generation of reports for past Sprints (already supported via Sprint number parameter).

3. **Template Customization**: Future enhancement could allow users to provide a custom template.
