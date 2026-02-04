# Skills

A collection of [Agent Skills](https://agentskills.io/) for AI coding agents.

Skills are folders of instructions, scripts, and resources that AI agents can load to improve performance on specialized tasks.

> **Note:** For the Agent Skills specification, see [agentskills.io/specification](https://agentskills.io/specification).

## Structure

```
skills/
├── .claude-plugin/
│   └── marketplace.json    # Plugin marketplace configuration
├── skills/
│   ├── azure-sdk-mcp-adoption/
│   │   └── SKILL.md
│   ├── copilot-pr-analysis/
│   │   └── SKILL.md
│   └── template/
│       └── SKILL.md
└── README.md
```

## Available Skills

| Skill | Description |
|-------|-------------|
| [azure-sdk-mcp-adoption](skills/azure-sdk-mcp-adoption) | Generate adoption reports correlating Azure SDK MCP tool usage with monthly releases |
| [copilot-pr-analysis](skills/copilot-pr-analysis) | Analyze Copilot coding agent PR sessions to understand resource and tool usage patterns |

## Installation

### Claude Code

```bash
/plugin marketplace add rgeraghty/skills
/plugin install analysis-skills@rgeraghty-skills
```

### GitHub Copilot

Clone this repo and add the skills directory to your Copilot configuration, or copy individual skills to:
- **Project skills**: `.github/skills/` in your repository
- **Personal skills**: `~/.copilot/skills/`

## Creating a New Skill

1. Copy the `skills/_template/` directory and rename it
2. Update the `SKILL.md` frontmatter with your skill's `name` and `description`
3. Add your instructions in the Markdown body
4. Optionally add `scripts/`, `references/`, or `assets/` directories

### SKILL.md Format

```markdown
---
name: your-skill-name
description: A clear description of what this skill does and when to use it.
---

# Your Skill Name

Instructions for the agent to follow...
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Lowercase alphanumeric with hyphens, max 64 chars, must match directory name |
| `description` | Yes | What the skill does and when to use it, max 1024 chars |
| `license` | No | License name or reference to LICENSE file |
| `compatibility` | No | Environment requirements (products, packages, network access) |
| `metadata` | No | Additional key-value metadata |

## Resources

- [Agent Skills Specification](https://agentskills.io/specification)
- [Anthropic Skills Repository](https://github.com/anthropics/skills)
- [Microsoft Agent Skills](https://github.com/microsoft/agent-skills)
