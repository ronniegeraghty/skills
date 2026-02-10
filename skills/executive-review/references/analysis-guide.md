# Analysis Guide

Per-persona analysis templates and examples for content-specific executive review.

## Content-Specific vs Generic Questions

For every claim, detail, metric, or gap in the content, generate questions that reference the ACTUAL content.

**Example for a demo about "Azure SDK tools agent that automates SDK generation":**

❌ WRONG (generic): "What's the ROI?"
✅ RIGHT (content-specific): "You mentioned reducing SDK generation from one week to two hours - what's the cost savings per service team annually?"

❌ WRONG (generic): "How does this scale?"
✅ RIGHT (content-specific): "You showed the agent handling 5 language SDKs - how does it perform when a service has 20+ API operations?"

## Per-Persona Analysis Templates

### CEO Analysis

- What strategic claims are made? (e.g., "North Star", "one workflow")
- How does this position against competitors?
- What's the company-wide impact mentioned?
- What stakeholder benefits are claimed but not proven?

### CFO Analysis

- What cost/time savings are claimed? (e.g., "one week to two hours")
- Are there hidden costs not mentioned?
- What's the investment required vs. return?
- What financial risks if this fails?

### CTO Analysis

- What technical architecture is described/implied?
- What integrations are mentioned? (e.g., "TypeSpec", "MCP server", "GitHub PRs")
- What could break at scale?
- What technical debt might this create?

### VP of Product Analysis

- What user problems are being solved?
- Who are the actual users? (e.g., "service teams")
- What's the adoption path mentioned?
- What's MVP vs. full vision?

### CISO Analysis

- What data/systems does this touch?
- What access does the agent need?
- What could go wrong security-wise?
- What compliance implications?

### VP of Operations Analysis

- What's the rollout complexity?
- What training is needed?
- What's the support burden?
- What change management is required?

## Persona Selection by User Type

| User Type | Recommended Personas |
|-----------|---------------------|
| Sales Engineer | CTO, CISO |
| Product Manager | CEO, VP of Product |
| Developer | CTO, VP of Operations |
| Technical Writer | CEO, CFO |
| Marketing | CEO, CFO |
| Solutions Architect | CTO, CISO, VP of Operations |

## Supported Content Types

| Type | Extensions | Extraction Method |
|------|------------|-------------------|
| **Video** | .mp4, .webm, .mov, .avi, .mkv | Whisper transcription + optional frame extraction |
| **Audio** | .mp3, .wav, .m4a, .flac | Whisper transcription |
| **Documents** | .pdf, .docx, .md, .txt | Text + image extraction |
| **Presentations** | .pptx | Text + notes + slide images |
