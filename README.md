# AI Skills

A collection of [GitHub Copilot Agent Skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) for various AI workflows.

Agent Skills are folders of instructions, scripts, and resources that Copilot can load when relevant to improve its performance in specialized tasks.

## Structure

```
ai-skills/
└── .github/
    └── skills/
        └── <skill-name>/
            ├── SKILL.md      # Required: skill instructions with YAML frontmatter
            └── ...           # Optional: scripts, examples, resources
```

## Creating a New Skill

1. Create a subdirectory under `.github/skills/` with your skill name (lowercase, hyphens for spaces)
2. Add a `SKILL.md` file with YAML frontmatter and instructions
3. Optionally add scripts, examples, or other resources

### SKILL.md Format

```markdown
---
name: your-skill-name
description: Description of what the skill does and when Copilot should use it.
---

Your detailed instructions for Copilot to follow...
```

## Usage

- **Project skills**: Store in `.github/skills/` for repository-specific skills
- **Personal skills**: Store in `~/.copilot/skills/` for skills shared across projects

Copilot automatically loads relevant skills based on your prompt and the skill's description.

## Resources

- [Official Documentation](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)
- [Agent Skills Standard](https://github.com/agentskills/agentskills)
- [Anthropic Skills Examples](https://github.com/anthropics/skills)
- [Awesome Copilot Collection](https://github.com/github/awesome-copilot)
