# AGENTS.md

This document provides guidance for AI agents working with the skills repository.

## Repository Overview

This repository contains shareable [Agent Skills](https://agentskills.io/) that can be installed across multiple AI coding agents using the `npx skills` CLI.

## Skill Sharing with `npx skills`

Skills in this repository can be installed using the [vercel-labs/skills](https://github.com/vercel-labs/skills) CLI tool.

### Installing Skills from This Repository

```bash
# List available skills
npx skills add ronniegeraghty/skills --list

# Install specific skills
npx skills add ronniegeraghty/skills --skill azure-sdk-mcp-adoption

# Install to specific agents
npx skills add ronniegeraghty/skills -a github-copilot -a claude-code

# Install globally (available across all projects)
npx skills add ronniegeraghty/skills -g

# Non-interactive CI/CD installation
npx skills add ronniegeraghty/skills --skill azure-sdk-mcp-adoption -g -a github-copilot -y
```

### Other CLI Commands

```bash
# List installed skills
npx skills list

# Search for skills
npx skills find azure

# Check for updates
npx skills check

# Update installed skills
npx skills update

# Remove skills
npx skills remove azure-sdk-mcp-adoption

# Create a new skill template
npx skills init my-new-skill
```

### Supported Agents

Skills can be installed to 35+ agents including:
- GitHub Copilot (`.github/skills/`)
- Claude Code (`.claude/skills/`)
- Cursor (`.cursor/skills/`)
- Codex (`.codex/skills/`)
- And many more...

See [vercel-labs/skills README](https://github.com/vercel-labs/skills#supported-agents) for the full list.

## Repository Structure

```
skills/
├── .claude-plugin/
│   └── marketplace.json     # Claude Code plugin marketplace config
├── skills/
│   ├── azure-sdk-mcp-adoption/
│   │   ├── SKILL.md         # Required: skill instructions
│   │   ├── package.json     # Dependencies for scripts
│   │   └── scripts/         # Executable pipeline scripts
│   ├── copilot-pr-analysis/
│   │   ├── SKILL.md
│   │   ├── package.json
│   │   └── scripts/
│   └── template/
│       └── SKILL.md
├── package.json             # Workspace configuration
├── pnpm-workspace.yaml      # pnpm workspace packages
└── README.md
```

## Creating New Skills

1. Copy `skills/template/` to `skills/<skill-name>/`
2. Edit `SKILL.md` frontmatter with `name` and `description`
3. Add instructions in the Markdown body
4. Optionally add `scripts/`, `references/`, or `assets/` directories

### SKILL.md Format

```markdown
---
name: my-skill
description: Clear description of what the skill does and when to use it.
---

# My Skill

Instructions for the agent...
```

### Required Fields

- `name` - Lowercase alphanumeric with hyphens, max 64 chars, must match directory name
- `description` - Max 1024 chars, should include WHEN to use the skill

### Optional Directories

| Directory | Purpose |
|-----------|---------|
| `scripts/` | Executable code (Python, Bash, Node.js) |
| `references/` | Documentation loaded into context as needed |
| `assets/` | Templates, images, data files for output |

## Conventions for Scripts

Skills with executable scripts should:

1. Use `scripts/` directory (not `src/`)
2. Include a `package.json` with `"type": "module"` for ESM
3. Make scripts executable with shebang (`#!/usr/bin/env node`)
4. Include a main entry point (e.g., `run.js`)
5. Document usage in SKILL.md with examples
6. Handle errors gracefully with clear messages

## Related Resources

- [Agent Skills Specification](https://agentskills.io/specification)
- [Skills CLI (npx skills)](https://github.com/vercel-labs/skills)
- [Skills Directory (skills.sh)](https://skills.sh/)
- [Anthropic Skills Repository](https://github.com/anthropics/skills)

## License

MIT
