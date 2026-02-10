---
name: executive-review
description: "**WORKFLOW SKILL** — Analyze demo videos, meeting recordings, documents, and presentations through executive personas to anticipate questions, concerns, and follow-ups. USE FOR: exec review prep, anticipating leadership questions, demo preparation, stakeholder meeting prep. DO NOT USE FOR: simple transcription (use Whisper directly), document summarization, code review. INVOKES: Python scripts, Whisper, ffmpeg, opencv."
---

# Executive Review

Analyze content through executive personas to prepare for presentations, demos, and stakeholder meetings.

## Prerequisites

- **Python 3.10+** with deps: `pip install -r requirements.txt`
- **ffmpeg**: `choco install ffmpeg` / `brew install ffmpeg` / `apt install ffmpeg`
- **Poppler** (optional, for PDF images): `choco install poppler` / `brew install poppler`

## Workflow

### Step 1: Identify Content

Ask the user for their file: video (.mp4, .webm, .mov), audio (.mp3, .wav), document (.pdf, .docx, .md, .txt), or presentation (.pptx).

### Step 2: Video Frame Analysis (Video Only)

Ask if they want frame extraction for visual analysis. Options:
- `--frames --rapid` — every 10s (fast-changing demos)
- `--frames` — every 15s (standard)
- No frames — faster processing

When frames are extracted, **view each frame image** with vision capability and incorporate visual observations into the analysis.

### Step 3: Select Personas

Ask which persona(s) to analyze as: **CEO**, **CFO**, **CTO**, **VP of Product**, **CISO**, **VP of Operations**. Multiple allowed. If user provides their role, recommend personas per the table in [references/personas.md](references/personas.md).

### Step 4: Extract Content

Create a timestamped output folder and run extraction:

```bash
# Without frames
python scripts/extract_only.py <file> -o output/<timestamp>/extracted.json

# With frames
python scripts/extract_only.py <file> --frames --output-dir output/<timestamp> -o output/<timestamp>/extracted.json
```

Output JSON contains: `text`, `segments`, `slides`, `image_paths`. If `image_paths` present, view frames with vision capability.

### Step 5: Content-Aware Analysis (CRITICAL)

**You must analyze the actual extracted content** — never use generic template questions.

For each persona, read the content and identify:
- **Specific claims** → What evidence would this executive want?
- **Technical details** → What needs clarification?
- **Numbers/metrics** → What validation is needed?
- **Gaps** → What's missing that they'd ask about?

See [references/analysis-guide.md](references/analysis-guide.md) for per-persona analysis templates and examples of content-specific vs generic questions.

### Step 6: Generate Report

Save to `output/<timestamp>/executive-review.md`. See [references/report-template.md](references/report-template.md) for the full report structure.

### Step 7: Present Results

Share the report, highlighting the most critical content-specific questions and preparation items.

## CLI Reference

```bash
# Extraction only (recommended for agent analysis)
python scripts/extract_only.py <file> [--output/-o FILE] [--frames/-f] [--frame-interval N] [--whisper-model/-m MODEL] [--output-dir DIR]

# Full pipeline (template-based, less recommended)
python scripts/run.py <file> [--personas/-p LIST] [--all-personas/-a] [--user-type/-u TYPE] [--frames/-f] [--output/-o FILE]
```

## References

- [Personas](references/personas.md) — Detailed persona descriptions and role-based recommendations
- [Question Patterns](references/question-patterns.md) — Common executive question patterns by category
- [Analysis Guide](references/analysis-guide.md) — Per-persona analysis templates and content-specific examples
- [Report Template](references/report-template.md) — Full Markdown report structure

## Related Skills

- **copilot-pr-analysis** — Analyze Copilot PR sessions for effectiveness metrics
- **sprint-update-memo** — Generate Sprint update memos for stakeholders
