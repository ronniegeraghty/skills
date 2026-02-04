---
name: template
description: |
  **WORKFLOW SKILL** - [One-line description of what the skill does].
  USE FOR: "trigger phrase 1", "trigger phrase 2", "trigger phrase 3".
  DO NOT USE FOR: scenario1 (use other-skill), scenario2 (use mcp-tool).
  INVOKES: `mcp-tool-1`, `mcp-tool-2` for execution.
  FOR SINGLE OPERATIONS: Use `mcp-tool` directly for simple queries.
---

# [Skill Title]

## When to Use This Skill

Activate when user wants to:
- Specific action 1
- Specific action 2
- Specific action 3

## Prerequisites

- Required MCP tools: `tool-name`
- Required permissions: list
- Required CLI tools: `cli-name`

## MCP Tools Used

| Step | MCP Tool | Command | Purpose |
|------|----------|---------|---------|  
| 1 | `tool-name` | `command` | Description |

## Steps

### Step 1: Action Name

**Using MCP (Preferred):**
Invoke `tool-name` MCP tool:
- Command: `command_name`
- Parameters: `param1`, `param2`

**CLI Fallback (if MCP unavailable):**
```bash
cli command --option value
```

## Examples

Provide examples of inputs and expected outputs.

## Related Skills

- For X: `other-skill-name`
- For Y: `another-skill-name`
