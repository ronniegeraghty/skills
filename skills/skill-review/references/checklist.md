# Skill Review Compliance Checklist

Use this checklist when reviewing an Agent Skill. Mark each item **Pass** or **Fail**.

## Frontmatter (Items 1–9)

1. `name` field exists and is lowercase alphanumeric + hyphens
2. `name` matches the directory name
3. `description` field exists and uses an inline quoted string (NOT YAML `|` or `>` multiline)
4. `description` is 150–1024 characters
5. `description` starts with a classification prefix: `**WORKFLOW SKILL**`, `**UTILITY SKILL**`, or `**ANALYSIS SKILL**`
6. `description` contains `USE FOR:` with 3+ trigger phrases
7. `description` contains `DO NOT USE FOR:` with redirects to other skills/tools
8. `description` contains `INVOKES:` listing tools, CLIs, or APIs
9. No other frontmatter fields besides `name` and `description`

## Body Structure (Items 10–14)

10. H1 heading matches or clearly relates to the skill name
11. Contains a "When to Use" or equivalent section (can be implicit in description)
12. Contains a "Prerequisites" section listing dependencies
13. Contains a workflow or pipeline steps section
14. Contains a "Related Skills" section with cross-references

## Token Budget (Items 15–18)

15. SKILL.md body is ≤ 500 tokens soft limit (~2000 characters)
16. SKILL.md body is ≤ 5000 tokens hard limit (~20000 characters)
17. Each `references/*.md` file is ≤ 1000 tokens soft limit (~4000 characters)
18. Each `references/*.md` file is ≤ 5000 tokens hard limit (~20000 characters)

## Directory Structure (Items 19–22)

19. Skill lives in `skills/<name>/` directory
20. `SKILL.md` exists at root of skill directory
21. Heavy content is in `references/` not inline in SKILL.md
22. Scripts (if any) are in `scripts/` directory

## Routing & Conflicts (Items 23–25)

23. USE FOR phrases don't overlap with other skills' triggers
24. DO NOT USE FOR phrases redirect to specific alternatives
25. No duplicate content across the SKILL.md and reference files

## Scripts (Items 26–28)

26. Scripts use ESM (`"type": "module"` in package.json) if Node.js
27. Entry point has a shebang line (`#!/usr/bin/env node` or similar)
28. Cross-platform run scripts exist (`.sh` and `.ps1`) if applicable
