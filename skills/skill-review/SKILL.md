---
name: skill-review
description: "**ANALYSIS SKILL** — Review and score Agent Skills for compliance with the Agent Skills Specification and development best practices. USE FOR: review skill, check skill quality, score skill, validate skill, audit SKILL.md. DO NOT USE FOR: creating new skills (use skill-creator agent), writing code, deploying."
---

# Skill Review

Review and score an Agent Skill for compliance with the [Agent Skills Specification](https://agentskills.io/specification) and the [Skills Development Guide](https://gist.github.com/spboyer/d4f4e4806559f558e6b88da94b02f437).

## Steps

1. **Read** the target skill's `SKILL.md` and any `references/*.md` files.
2. **Run the checklist** in [references/checklist.md](references/checklist.md) — mark each item Pass/Fail.
3. **Score** using the table below.
4. **Report** — list every failing item with a one-line fix suggestion.
5. **Fix** — if instructed, apply the suggested fixes.

## Scoring

| Level | Criteria |
|-------|----------|
| **Low** | description < 150 chars OR no trigger keywords |
| **Medium** | description ≥ 150 chars + trigger keywords present |
| **Medium-High** | Medium + USE FOR and DO NOT USE FOR in description |
| **High** | Medium-High + INVOKES / FOR SINGLE OPERATIONS + classification prefix |

Target: **Medium-High** or better.

## References

- [Compliance Checklist](references/checklist.md) — 28-item checklist covering frontmatter, body, tokens, directory, routing, scripts
