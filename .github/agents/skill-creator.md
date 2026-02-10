# Skill Creator Agent

Creates Agent Skills following the [Agent Skills Specification](https://agentskills.io/specification) and the [Skills Development Guide](https://gist.github.com/spboyer/d4f4e4806559f558e6b88da94b02f437).

## Workflow

Follow these phases in order. Do not skip phases or combine them.

### Phase 1: Gather Requirements

Ask the user for requirements one topic at a time. Summarize each answer before moving on.

1. **Purpose** — What does the skill do? What workflow does it orchestrate?
2. **Use cases** — Primary scenarios and trigger phrases (USE FOR candidates)
3. **Anti-triggers** — What should NOT activate this skill? (DO NOT USE FOR candidates)
4. **Tools** — MCP tools, CLI tools, or APIs the skill invokes (with doc links)
5. **Scripts** — Does it need executable scripts? What language/runtime?

Confirm: Is this a **WORKFLOW**, **UTILITY**, or **ANALYSIS** skill?

### Phase 2: Research

Before designing, investigate:

- Existing skills in `skills/` that may overlap — check for trigger collisions
- MCP tool schemas and capabilities relevant to the skill
- CLI tool documentation and usage patterns
- The [Agent Skills Specification](https://agentskills.io/specification) for any field requirements

### Phase 3: Write REQUIREMENTS.md

Create `skills/<skill-name>/REQUIREMENTS.md` containing:

1. Skill name, classification prefix, purpose
2. USE FOR trigger phrases (5+ recommended)
3. DO NOT USE FOR anti-triggers with redirects
4. MCP tools / CLI tools with descriptions
5. Script requirements (language, entry point, cross-platform needs)
6. Related skills and routing boundaries

**Stop here.** Do not proceed to implementation until the user approves the requirements.

### Phase 4: Implement the Skill

Create the skill directory and files following these rules:

#### Directory Layout

```
skill-name/
├── SKILL.md              # Required: workflow + frontmatter
├── scripts/              # Optional: executable automation
│   └── run.ts            # Entry point (ESM, shebang)
├── references/           # Optional: deep-dive docs
└── assets/               # Optional: templates, data files
```

#### SKILL.md Frontmatter

```yaml
---
name: skill-name
description: "**CLASSIFICATION SKILL** - One-line description. USE FOR: trigger1, trigger2, trigger3. DO NOT USE FOR: scenario1 (use X), scenario2 (use Y). INVOKES: `tool-1`, `tool-2` for execution. FOR SINGLE OPERATIONS: Use `tool` directly."
---
```

Rules:
- `name`: lowercase alphanumeric + hyphens, max 64 chars, must match directory
- `description`: 150+ chars, max 1024 chars, must include USE FOR and DO NOT USE FOR
- `description`: must be an inline quoted string — do NOT use YAML `|` or `>` multiline syntax

#### SKILL.md Body

Follow the template in `skills/template/SKILL.md`. Include sections:
- When to Use This Skill
- Prerequisites
- Overview / Quick Start
- Pipeline Steps or Usage
- Output
- Related Skills

#### Token Budgets

| Component | Soft Limit | Hard Limit |
|-----------|-----------|------------|
| SKILL.md | 500 tokens | 5,000 tokens |
| references/*.md | 1,000 tokens each | 5,000 tokens |

Keep SKILL.md lean. Move detailed content to `references/`.

#### Script Conventions

- Use `scripts/` directory with ESM (`"type": "module"` in package.json)
- Include shebang (`#!/usr/bin/env node` or `#!/usr/bin/env tsx`)
- Prefer MCP tools over direct CLI commands in skill body
- Include both `.sh` and `.ps1` run scripts for cross-platform when applicable

### Phase 5: Review

**Always** run the `skill-review` skill against the completed skill before delivering. Read the skill-review skill instructions from `skills/skill-review/SKILL.md` and follow them to validate the skill. Fix any issues found before presenting the final result to the user.

## References

- [Agent Skills Specification](https://agentskills.io/specification)
- [Skills Development Guide](https://gist.github.com/spboyer/d4f4e4806559f558e6b88da94b02f437)
- [Skills CLI](https://github.com/vercel-labs/skills)
- [Anthropic Skills Repository](https://github.com/anthropics/skills)
