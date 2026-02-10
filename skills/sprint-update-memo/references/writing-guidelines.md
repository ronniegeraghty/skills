# Writing Guidelines

Style guide, memo structure, RAG status logic, and troubleshooting for Sprint update memos.

## Memo Structure

### Header
```markdown
# AzSDK Tools Agent - Inner Loop
## Sprint [N] Update
[Date]
```

### Sections
1. **Executive Summary** — Key accomplishments and highlights
2. **Overall Project RAG Status** — 🟢 Green / 🟡 Yellow / 🔴 Red with justification
3. **Milestones & Progress** — Table with Category, Task, Status, Bug Bash, Notes
4. **Value Delivered** — Customer-facing value from completed work
5. **Risks & Mitigations** — Table of risks, impacts, and mitigations
6. **Next Steps** — Planned work for next Sprint

## Writing Style

### Executive Summary
- Write as **3-4 flowing paragraphs**, not titled sections with "**Title:** content" format
- **Do not include specific numeric stats** like "completed 28 of 36 items" — keep it qualitative
- Introduce demo videos naturally in the text, e.g., "To showcase where we are, the team recorded a [demo video](link) that walks through..."
- Group related topics together rather than giving each its own titled section
- Focus on **why accomplishments matter**, not just what was done
- Link to key issues when mentioning specific work items

### RAG Status
- Keep it brief — a single sentence explaining the status is sufficient
- Mention key milestones achieved as justification
- Avoid bullet points; use flowing prose

### Value Delivered
- Be specific about what improvements were made
- Avoid vague statements like "Enhanced general experience with 2 improvements"
- Instead, write: "SDK generation workflow is now more reliable with git worktree support and centralized tsp-client execution"

### Next Steps
- List actual work items, not just counts like "14 items planned"
- Group by category and include links to issues
- Mark items already in progress

### General
- Avoid raw data dumps or note-like formatting
- Write for an executive audience who wants to understand impact, not implementation details
- Use consistent emoji and formatting throughout

## Status Emojis

| Status | Display |
|--------|---------|
| Done | ✅ Done |
| In Progress | 🔄 In Progress |
| Todo | 📝 To Do |
| Blocked | 🚫 Blocked |

## RAG Status Logic

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
