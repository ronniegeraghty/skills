# Executive Review Skill - Requirements

## Skill Overview

| Field | Value |
|-------|-------|
| **Name** | `executive-review` |
| **Classification** | **WORKFLOW SKILL** |
| **Purpose** | Analyze videos, audio, documents, and presentations through the lens of executive personas to anticipate questions, concerns, and follow-ups |

### Description (for SKILL.md frontmatter)

```yaml
description: |
  **WORKFLOW SKILL** - Analyze demo videos, meeting recordings, documents, and presentations through executive personas to anticipate questions and concerns.
  USE FOR: "review my demo", "what would a CTO ask about this", "executive feedback on presentation", "analyze this video for leadership", "prepare for exec review".
  DO NOT USE FOR: simple transcription only (use whisper directly), document summarization without exec lens (use summarizer), editing content (use editor tools).
  INVOKES: Python scripts for transcription (whisper), frame extraction (opencv/ffmpeg), document parsing (python-pptx, PyMuPDF, python-docx).
  FOR SINGLE OPERATIONS: Use whisper directly for transcription-only tasks.
```

---

## Use Cases

### Primary Scenarios

| Scenario | Description | Typical Input |
|----------|-------------|---------------|
| **Demo Preparation** | Review a recorded demo before presenting to executives | Video file (.mp4, .mov, .webm) |
| **Meeting Analysis** | Analyze recorded meeting for executive-level concerns | Video/audio file |
| **Document Review** | Get executive perspective on technical documents | PDF, DOCX, MD, TXT |
| **Pitch Deck Analysis** | Review presentation for executive audience | PPTX, PDF |
| **Pre-Stakeholder Prep** | Anticipate questions before important meetings | Any supported format |

### User Types

| User Type | Primary Use Case | Typical Persona Selection |
|-----------|------------------|---------------------------|
| **Sales Engineer** | Prepare for customer executive demos | CTO, CISO |
| **Product Manager** | Internal leadership review | CEO, VP of Product |
| **Developer** | Get feedback on technical demos | CTO, VP of Operations |
| **Technical Writer** | Ensure docs address exec concerns | CFO, CEO |
| **Marketing** | Review pitch deck effectiveness | CEO, CFO |
| **Solutions Architect** | Prepare for technical design reviews | CTO, CISO, VP of Operations |

---

## Triggers

### USE FOR (Should Trigger)

```yaml
shouldTriggerPrompts:
  - "review my demo video"
  - "what would a CTO ask about this presentation"
  - "analyze this recording for executive feedback"
  - "prepare me for questions from leadership"
  - "executive review of this document"
  - "what concerns would a CFO have about this"
  - "help me prepare for my demo to the VP"
  - "review this pitch deck as an executive"
  - "anticipate questions for this meeting recording"
  - "get executive perspective on this proposal"
```

### DO NOT USE FOR (Anti-Triggers)

```yaml
shouldNotTriggerPrompts:
  - "transcribe this video"  # Use whisper directly
  - "summarize this document"  # Use general summarizer
  - "edit this presentation"  # Use editing tools
  - "convert this video to audio"  # Use ffmpeg directly
  - "extract text from PDF"  # Use PyMuPDF directly
  - "fix the slides"  # Use presentation editors
  - "translate this transcript"  # Use translation tools
```

---

## Executive Personas

### All Personas (Include All)

| Persona | Focus Areas | Question Style | Key Concerns |
|---------|-------------|----------------|--------------|
| **CEO** | Strategic vision, market fit, competitive advantage, company alignment | "How does this align with our 3-year roadmap?" | Big picture, market positioning, strategic value |
| **CFO** | Cost, ROI, budget impact, financial risk, TCO | "What's the total cost of ownership? Payback period?" | Numbers, financial justification, budget allocation |
| **CTO** | Technical architecture, scalability, security, integration, technical debt | "How does this integrate with our existing stack?" | Technical feasibility, maintainability, architecture |
| **VP of Product** | User value, roadmap impact, feature prioritization, customer needs | "What problem does this solve for users?" | Product-market fit, user experience, prioritization |
| **CISO** | Security, compliance, data privacy, risk assessment, attack surface | "What's the attack surface? Is this SOC2 compliant?" | Security posture, compliance, data protection |
| **VP of Operations** | Efficiency, implementation, training, change management, rollout | "What's the rollout plan? Training requirements?" | Operational impact, implementation complexity, support |

### Persona Selection Rules

- User can select **single persona** for focused analysis
- User can select **multiple personas** for comprehensive review
- Default suggestion based on user type:
  - Sales Engineer → CTO + CISO
  - Product Manager → CEO + VP of Product
  - Developer → CTO + VP of Operations
  - Technical Writer → CEO + CFO
  - Marketing → CEO + CFO

---

## Supported Input Formats

### Video Files

| Format | Extension | Processing |
|--------|-----------|------------|
| MP4 | `.mp4` | Whisper transcription + optional frame extraction |
| WebM | `.webm` | Whisper transcription + optional frame extraction |
| MOV | `.mov` | Whisper transcription + optional frame extraction |
| AVI | `.avi` | Whisper transcription + optional frame extraction |
| MKV | `.mkv` | Whisper transcription + optional frame extraction |

### Audio Files

| Format | Extension | Processing |
|--------|-----------|------------|
| MP3 | `.mp3` | Whisper transcription |
| WAV | `.wav` | Whisper transcription |
| M4A | `.m4a` | Whisper transcription |
| FLAC | `.flac` | Whisper transcription |

### Documents

| Format | Extension | Processing |
|--------|-----------|------------|
| PDF | `.pdf` | Text extraction + image extraction (PyMuPDF) |
| Word | `.docx` | Text extraction (python-docx) |
| Markdown | `.md` | Direct text reading |
| Plain Text | `.txt` | Direct text reading |

### Presentations

| Format | Extension | Processing |
|--------|-----------|------------|
| PowerPoint | `.pptx` | Text + notes extraction (python-pptx) + slide images |
| PDF (slides) | `.pdf` | Text + page images (PyMuPDF + pdf2image) |

---

## Workflow

```
┌─────────────────────────────────────────────────────────┐
│                    USER INPUT                           │
│  Video, Audio, Document, or Presentation file          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              STEP 1: CONTENT DETECTION                  │
│  Identify file type → Route to appropriate extractor   │
│  • Detect: video, audio, document, presentation        │
│  • Validate file exists and is readable                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              STEP 2: USER PREFERENCES                   │
│  ASK USER:                                              │
│  • If video: "Enable frame analysis?" (optional)        │
│  • Select executive persona(s)                          │
│  • User type/context (for tailored output)              │
│  • Any specific focus areas or concerns?                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              STEP 3: CONTENT EXTRACTION                 │
│  Based on file type:                                    │
│  • Video/Audio → Whisper transcription                  │
│  • Video → [IF ENABLED] Frame extraction (opencv/ffmpeg)│
│  • PDF → Text + Images (PyMuPDF)                        │
│  • PPTX → Text + Notes + Slide images (python-pptx)     │
│  • DOCX → Text extraction (python-docx)                 │
│  • MD/TXT → Direct read                                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              STEP 4: CONTENT SUMMARY                    │
│  • Create high-level summary of content                 │
│  • Identify key topics, claims, and demonstrations      │
│  • Note any visual elements (if frame analysis enabled) │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              STEP 5: EXECUTIVE ANALYSIS                 │
│  For each selected persona:                             │
│  • Apply persona lens to content                        │
│  • Generate questions they would ask                    │
│  • Identify concerns and risks                          │
│  • Suggest follow-up topics                             │
│  • Provide preparation recommendations                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              STEP 6: OUTPUT GENERATION                  │
│  Generate structured Markdown report                    │
│  • Save to specified location or display inline         │
└─────────────────────────────────────────────────────────┘
```

---

## Output Format

### Markdown Report Structure

```markdown
# Executive Review: [Content Title/Filename]

**Reviewed**: [Date]
**Content Type**: [Video/Audio/Document/Presentation]
**Duration/Pages**: [Length or page count]
**Frame Analysis**: [Enabled/Disabled] (for video only)

---

## Content Summary

[2-3 paragraph summary of the content, key points, and main takeaways]

### Key Topics Covered
- Topic 1
- Topic 2
- Topic 3

### Visual Elements Noted (if applicable)
- Description of key visuals, demos, or diagrams shown

---

## Executive Analysis: [Persona Name]

### Persona Profile
> [Brief description of this executive's perspective and priorities]

### Key Concerns
| Concern | Severity | Why It Matters |
|---------|----------|----------------|
| Concern 1 | High/Medium/Low | Explanation |
| Concern 2 | High/Medium/Low | Explanation |

### Questions They Would Ask

#### Strategic Questions
1. **[Question]**
   - *Why they'd ask*: [Reasoning]
   - *Suggested response*: [How to prepare/answer]

#### Technical Questions
1. **[Question]**
   - *Why they'd ask*: [Reasoning]
   - *Suggested response*: [How to prepare/answer]

#### Financial Questions
1. **[Question]**
   - *Why they'd ask*: [Reasoning]
   - *Suggested response*: [How to prepare/answer]

### Potential Follow-ups
After initial presentation, expect these follow-up requests:
- [ ] Follow-up 1
- [ ] Follow-up 2
- [ ] Follow-up 3

### Risk Areas Identified
| Risk | Impact | Mitigation |
|------|--------|------------|
| Risk 1 | Description | How to address |

### Recommendations for This Audience
1. Recommendation 1
2. Recommendation 2
3. Recommendation 3

---

## [Repeat for additional personas if multiple selected]

---

## Overall Preparation Checklist

Based on analysis across all selected personas:

### Must Address
- [ ] Critical point 1
- [ ] Critical point 2

### Should Prepare
- [ ] Important point 1
- [ ] Important point 2

### Nice to Have
- [ ] Additional point 1
- [ ] Additional point 2

---

## Appendix

### Full Transcript (if applicable)
[Collapsible section with full transcript]

### Extracted Text (if applicable)
[Collapsible section with full document text]
```

---

## Technical Requirements

### Python Dependencies

```txt
# Core - Transcription
openai-whisper>=20231117

# Video/Audio Processing
opencv-python>=4.8.0
ffmpeg-python>=0.2.0

# Document Processing
python-pptx>=0.6.21
python-docx>=1.0.0
PyMuPDF>=1.23.0
pdf2image>=1.16.3

# Image Handling
Pillow>=10.0.0

# Utilities
pathlib
typing
```

### System Dependencies

| Dependency | Purpose | Installation |
|------------|---------|--------------|
| **ffmpeg** | Video/audio processing | `brew install ffmpeg` / `choco install ffmpeg` / `apt install ffmpeg` |
| **Poppler** | PDF to image conversion | `brew install poppler` / `choco install poppler` / `apt install poppler-utils` |

### Optional - For Vision Analysis

| Dependency | Purpose | Notes |
|------------|---------|-------|
| **OpenAI API Key** | GPT-4o for frame/slide image analysis | Required if analyzing visual content |
| **Anthropic API Key** | Claude for frame/slide image analysis | Alternative to OpenAI |

---

## MCP Tools (Optional/Fallback)

These MCP servers can be used as alternatives or supplements to local processing:

| MCP Server | Use Case | When to Use |
|------------|----------|-------------|
| **@anthropic/filesystem** | Read files from disk | If Python file I/O has issues |
| **mcp-server-fetch** | Fetch remote files | If content is at a URL |
| **mcp-server-puppeteer** | Screenshot web presentations | Google Slides, web-based decks |
| **mcp-youtube-transcript** | YouTube video transcripts | If reviewing YouTube content |

**Recommendation**: Use local Python scripts for all processing. MCP servers are fallback options for edge cases.

---

## Script Structure

```
executive-review/
├── SKILL.md                    # Skill definition and workflow
├── REQUIREMENTS.md             # This file
├── package.json                # Node.js dependencies (if any CLI wrappers)
├── scripts/
│   ├── requirements.txt        # Python dependencies
│   ├── extract_transcript.py   # Whisper transcription
│   ├── extract_frames.py       # Video frame extraction
│   ├── extract_document.py     # PDF, DOCX, MD, TXT extraction
│   ├── extract_presentation.py # PPTX extraction with images
│   ├── analyze_content.py      # Executive persona analysis
│   ├── generate_report.py      # Markdown report generation
│   └── run.py                  # Main orchestrator
├── scripts/
│   ├── run.sh                  # Bash wrapper
│   └── run.ps1                 # PowerShell wrapper
└── references/
    ├── personas.md             # Detailed persona descriptions
    └── question-patterns.md    # Common executive question patterns
```

---

## Testing Plan

### Trigger Tests

#### Should Trigger (10 prompts)
```yaml
shouldTrigger:
  - "review my demo video as a CTO"
  - "what would executives ask about this presentation"
  - "analyze this meeting recording for leadership"
  - "prepare me for questions from the CFO"
  - "executive review of this technical document"
  - "what concerns would a CISO have about this demo"
  - "help me prepare for my pitch to the VP"
  - "review this proposal from an executive perspective"
  - "anticipate questions for this product demo"
  - "get CEO perspective on this roadmap deck"
```

#### Should NOT Trigger (10 prompts)
```yaml
shouldNotTrigger:
  - "transcribe this video file"
  - "summarize this document for me"
  - "edit my presentation slides"
  - "convert this video to MP3"
  - "extract images from this PDF"
  - "fix typos in my document"
  - "compress this video file"
  - "merge these PDF files"
  - "translate this transcript to Spanish"
  - "create a new presentation"
```

### Functional Tests

| Test | Input | Expected Behavior |
|------|-------|-------------------|
| Video detection | .mp4 file | Routes to Whisper + asks about frame analysis |
| Audio detection | .mp3 file | Routes to Whisper only |
| PDF detection | .pdf file | Routes to PyMuPDF extraction |
| PPTX detection | .pptx file | Routes to python-pptx + slide images |
| Multi-persona | Select CEO + CTO | Generates separate analysis sections |
| Frame analysis opt-out | User declines | Skips frame extraction |
| Missing file | Invalid path | Clear error message |

### Validation Tests

- [ ] SKILL.md frontmatter validates correctly
- [ ] Name matches directory name
- [ ] Description > 150 characters
- [ ] All Python scripts have error handling
- [ ] Both .sh and .ps1 wrappers work

---

## References

- [Agent Skills Specification](https://agentskills.io/specification)
- [Skills CLI (npx skills)](https://github.com/vercel-labs/skills)
- [OpenAI Whisper](https://github.com/openai/whisper)
- [python-pptx Documentation](https://python-pptx.readthedocs.io/)
- [PyMuPDF Documentation](https://pymupdf.readthedocs.io/)
- [OpenCV Python](https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html)

---

## Requirements Checklist

- [x] Links to [Agent Skills Specification](https://agentskills.io/specification)
- [x] Non-trivial scripts include both bash and PowerShell versions
- [x] Local Python processing preferred over MCP tools
- [x] MCP tools listed as optional fallbacks with descriptions
- [x] All 6 executive personas defined with focus areas
- [x] All user types documented with persona recommendations
- [x] Test scenarios documented (trigger and functional)
- [x] Output format specified (Markdown)
- [x] Workflow diagram included
- [x] Dependencies listed (Python + system)
- [x] Video frame analysis marked as optional with user prompt
