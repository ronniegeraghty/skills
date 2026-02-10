# Report Template

Use this Markdown template for executive review reports. Save to `output/<timestamp>/executive-review.md`.

## Output Directory Structure

```
output/
└── YYYY-MM-DD-HH-MM-SS/
    ├── extracted.json
    ├── frames/                  # If frame extraction enabled
    │   ├── frame_0000_00m00s.jpg
    │   └── ...
    └── executive-review.md
```

## Report Template

```markdown
# Executive Review: [Filename]

**Reviewed**: [Date]
**Content Type**: [Video/Audio/Document/Presentation]
**Duration/Pages**: [Length]

---

## Content Summary

[Write a 2-3 paragraph summary of what the content actually covers,
including specific features, claims, and demonstrations shown]

### Key Topics Covered
- [Specific topic 1 from the content]
- [Specific topic 2 from the content]
- [Specific topic 3 from the content]

---

## Executive Analysis: [Persona Name]

### Persona Perspective
> [Brief description of how this persona views the content]

### Content-Specific Questions

1. **[Specific question based on actual content]**
   - *Context*: [What in the content triggered this question]
   - *Why they'd ask*: [Their concern]
   - *How to prepare*: [Specific preparation advice]

2. **[Another specific question]**
   ...

### Concerns Based on This Content

| Concern | From Content | Severity | Why It Matters |
|---------|--------------|----------|----------------|
| [Specific concern] | "[Quote or reference from content]" | High/Med/Low | [Explanation] |

### Expected Follow-ups

- [ ] [Specific follow-up based on content gaps]
- [ ] [Another specific follow-up]

### Recommendations

1. [Specific recommendation based on what was/wasn't covered]
2. [Another specific recommendation]

---

## [Repeat for each persona]

---

## Preparation Checklist

### Must Address (Critical gaps in the content)
- [ ] [Specific item based on content analysis]

### Should Prepare (Likely questions based on claims made)
- [ ] [Specific item]

### Have Ready (Supporting data for claims)
- [ ] [Specific item]
```

## Examples

### Example 1: Demo Video CTO Review

**User**: "I have a demo video I need to show to our CTO next week."

1. Ask about frame analysis
2. Extract: `python scripts/extract_only.py demo.mp4 -o output/<ts>/extracted.json`
3. Read extracted JSON, identify technical claims, integration points, performance claims
4. Generate CTO-specific questions referencing actual content
5. Create and share report

### Example 2: CFO Proposal Review

**User**: "What questions would a CFO have about this proposal?"

1. Extract: `python scripts/extract_only.py proposal.pdf -o output/<ts>/extracted.json`
2. Identify financial claims: cost savings, timelines, resources, ROI projections
3. For each claim, generate validation questions (e.g., "reduces time by 80%" → "What's the dollar value?")
4. Create and share report

### Example 3: Multi-Persona Leadership Review

**User**: "I'm presenting to the entire leadership team."

1. Extract content
2. Analyze through each persona lens: CEO (strategy), CFO (financials), CTO (architecture), VP Product (user value), CISO (security), VP Ops (rollout)
3. Generate persona-specific questions referencing actual content
4. Create consolidated report
