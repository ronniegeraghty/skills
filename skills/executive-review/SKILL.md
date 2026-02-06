---
name: executive-review
description: |
  **WORKFLOW SKILL** - Analyze demo videos, meeting recordings, documents, and presentations through executive personas to anticipate questions, concerns, and follow-ups.
  
  USE FOR: "review my demo", "what would a CTO ask about this", "executive feedback on presentation", "analyze this video for leadership", "prepare for exec review", "anticipate executive questions".
  
  DO NOT USE FOR: simple transcription only (use whisper directly), document summarization without exec lens (use a summarizer), editing content (use editor tools).
  
  INVOKES: Python scripts for transcription (whisper), frame extraction (opencv/ffmpeg), document parsing (python-pptx, PyMuPDF, python-docx).
---

# Executive Review

Analyze content through the perspective of executive personas to prepare for presentations, demos, and stakeholder meetings.

## When to Use This Skill

Use this skill when a user wants to:
- Prepare for a demo or presentation to executives
- Anticipate questions leadership might ask
- Get executive-level feedback on documents or recordings
- Review meeting recordings from an executive perspective
- Prepare for stakeholder presentations

### Trigger Examples

```
"Review my demo video as a CTO"
"What would executives ask about this presentation?"
"Analyze this recording for leadership feedback"
"Prepare me for questions from the CFO"
"Executive review of this technical document"
```

### Do NOT Use For

- Simple transcription (use Whisper directly)
- General document summarization (use summarization tools)
- Editing or modifying content
- Technical debugging or code review

## Prerequisites

### Required

- **Python 3.10+**: Required for running extraction scripts
- **ffmpeg**: Required for video/audio processing
  - Windows: `choco install ffmpeg`
  - macOS: `brew install ffmpeg`
  - Linux: `apt install ffmpeg`

### Optional

- **Poppler**: Required only for PDF slide image extraction
  - Windows: `choco install poppler`
  - macOS: `brew install poppler`
  - Linux: `apt install poppler-utils`

### Python Dependencies

Install with: `pip install -r requirements.txt`

```
openai-whisper>=20231117
opencv-python>=4.8.0
ffmpeg-python>=0.2.0
python-pptx>=0.6.21
python-docx>=1.0.0
PyMuPDF>=1.23.0
pdf2image>=1.16.3
Pillow>=10.0.0
pydantic>=2.0.0
```

## Supported Content Types

| Type | Extensions | Extraction Method |
|------|------------|-------------------|
| **Video** | .mp4, .webm, .mov, .avi, .mkv | Whisper transcription + optional frame extraction |
| **Audio** | .mp3, .wav, .m4a, .flac | Whisper transcription |
| **Documents** | .pdf, .docx, .md, .txt | Text + image extraction |
| **Presentations** | .pptx | Text + notes + slide images |

## Executive Personas

Six executive personas are available, each with distinct focus areas:

| Persona | Focus Areas | Best For |
|---------|-------------|----------|
| **CEO** | Strategic vision, market fit, competitive advantage | High-level strategic presentations |
| **CFO** | ROI, TCO, budget, financial risk | Budget proposals, cost justifications |
| **CTO** | Architecture, scalability, integration, technical debt | Technical demos, architecture reviews |
| **VP of Product** | User value, roadmap impact, feature prioritization | Product demos, feature presentations |
| **CISO** | Security, compliance, data privacy, attack surface | Security reviews, compliance demos |
| **VP of Operations** | Implementation, rollout, training, change management | Operational proposals, rollout plans |

### Persona Selection by User Type

| User Type | Recommended Personas |
|-----------|---------------------|
| Sales Engineer | CTO, CISO |
| Product Manager | CEO, VP of Product |
| Developer | CTO, VP of Operations |
| Technical Writer | CEO, CFO |
| Marketing | CEO, CFO |
| Solutions Architect | CTO, CISO, VP of Operations |

## Workflow

Follow these steps when a user invokes this skill:

### Step 1: Identify the Content

Ask the user for the file they want reviewed:
- Video file (demo recording, meeting)
- Audio file (podcast, meeting audio)
- Document (proposal, technical doc)
- Presentation (pitch deck, slides)

### Step 2: Ask About Video Frame Analysis (Video Only)

**IMPORTANT**: If the content is a video, ask the user:

> "Would you like me to extract and analyze video frames? This helps capture visual elements like UI demos, diagrams, and slides shown in the video, but takes longer to process. Would you like to enable frame analysis?"

If they say **yes**, also ask about the content type:

> "Is this a fast-changing demo (UI interactions, rapid navigation) or a slower presentation? I can adjust the frame capture rate:
> - **Rapid demo** (--rapid): Captures every 10 seconds for fast-changing content
> - **Standard** (default): Captures every 15 seconds for normal demos
> - **Presentation**: Captures every 30 seconds for slow-changing slides"

**Frame Extraction Options:**
- If **rapid demo**: Use `--frames --rapid` flags (10 second intervals)
- If **standard/normal**: Use `--frames` flag (15 second intervals)
- If **no frame analysis**: Skip frame extraction for faster processing

**VIEWING FRAMES**: When frames are extracted, they are saved to a folder named `<filename>_extracted/`. You MUST use your vision capability to view and analyze these frames. For each significant frame:
1. Open/view the frame image
2. Describe what UI elements, diagrams, or visuals are shown
3. Include visual observations in your analysis (e.g., "The demo shows a terminal with the agent generating code in real-time")

### Step 3: Select Executive Personas

Ask which executive perspective(s) they want:

> "Which executive persona(s) would you like me to analyze this as? Options:
> - **CEO**: Strategic vision, market positioning
> - **CFO**: Financial justification, ROI
> - **CTO**: Technical architecture, scalability
> - **VP of Product**: User value, roadmap fit
> - **CISO**: Security and compliance
> - **VP of Operations**: Implementation and rollout
> 
> You can select multiple (e.g., 'CTO and CISO') or I can recommend based on your role."

If user provides their role, use the persona recommendations from the table above.

### Step 4: Extract Content

**IMPORTANT - Output Organization:**
Each executive review session should be organized in a timestamped folder under `output/`. Use the format `YYYY-MM-DD-HH-MM-SS` for the folder name.

```
output/
└── 2026-02-05-15-30-00/
    ├── extracted.json          # Extraction output
    ├── frames/                  # Extracted video frames (if enabled)
    │   ├── frame_0000_00m00s.jpg
    │   ├── frame_0001_00m15s.jpg
    │   └── ...
    └── executive-review.md     # Final report
```

Run the extraction script, specifying the timestamped output directory:

```bash
# First, create a timestamped output directory
# Example: output/2026-02-05-15-30-00/

# For video (without frames)
python scripts/extract_only.py <file> -o output/<timestamp>/extracted.json

# For video (with standard frames - every 15 seconds)
python scripts/extract_only.py <file> --frames --output-dir output/<timestamp> -o output/<timestamp>/extracted.json

# For video (with rapid demo frames - every 10 seconds)
python scripts/extract_only.py <file> --frames --rapid --output-dir output/<timestamp> -o output/<timestamp>/extracted.json

# For video (with custom frame interval)
python scripts/extract_only.py <file> --frames --frame-interval 5 --output-dir output/<timestamp> -o output/<timestamp>/extracted.json

# For documents/presentations
python scripts/extract_only.py <file> -o output/<timestamp>/extracted.json
```

This will output JSON containing:
- `text`: Full transcript or extracted text
- `segments`: Timestamped segments (for video/audio)
- `slides`: Slide content with notes (for presentations)
- `image_paths`: Paths to extracted frames/images (VIEW THESE with vision capability!)

**IMPORTANT - Viewing Extracted Frames:**
When `image_paths` are included in the output, you MUST view each frame using your vision capability. Open the images from the `output/<timestamp>/frames/` folder and analyze what is shown visually. Include these observations in your executive analysis.

### Step 5: Perform Content-Aware Analysis (CRITICAL)

**YOU (the agent) must analyze the extracted content yourself.** Do NOT use generic template questions. Read the actual content and generate specific, contextual questions.

For each selected persona, analyze the ACTUAL content and generate:

#### 5a. Content-Specific Questions

Read the transcript/text and identify:
- **Specific claims made** → What evidence would this executive want?
- **Technical details mentioned** → What would they want clarified?
- **Numbers/metrics cited** → What validation would they need?
- **Gaps in the content** → What's missing that they'd ask about?

**Example for a demo about "Azure SDK tools agent that automates SDK generation":**

❌ WRONG (generic): "What's the ROI?"
✅ RIGHT (content-specific): "You mentioned reducing SDK generation from one week to two hours - what's the cost savings per service team annually?"

❌ WRONG (generic): "How does this scale?"
✅ RIGHT (content-specific): "You showed the agent handling 5 language SDKs - how does it perform when a service has 20+ API operations?"

#### 5b. Analysis Template Per Persona

For each persona, think through:

**CEO Analysis:**
- What strategic claims are made? (e.g., "North Star", "one workflow")
- How does this position against competitors?
- What's the company-wide impact mentioned?
- What stakeholder benefits are claimed but not proven?

**CFO Analysis:**
- What cost/time savings are claimed? (e.g., "one week to two hours")
- Are there hidden costs not mentioned?
- What's the investment required vs. return?
- What financial risks if this fails?

**CTO Analysis:**
- What technical architecture is described/implied?
- What integrations are mentioned? (e.g., "TypeSpec", "MCP server", "GitHub PRs")
- What could break at scale?
- What technical debt might this create?

**VP of Product Analysis:**
- What user problems are being solved?
- Who are the actual users? (e.g., "service teams")
- What's the adoption path mentioned?
- What's MVP vs. full vision?

**CISO Analysis:**
- What data/systems does this touch?
- What access does the agent need?
- What could go wrong security-wise?
- What compliance implications?

**VP of Operations Analysis:**
- What's the rollout complexity?
- What training is needed?
- What's the support burden?
- What change management is required?

### Step 6: Generate the Report

**Save the report to the same timestamped folder** as the extracted content:
- Report path: `output/<timestamp>/executive-review.md`

Create a Markdown report with this structure:

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

### Step 7: Present Results

Share the report with the user, highlighting the most critical content-specific questions and preparation items.


## CLI Reference

### Extraction Only (Recommended for Agent Analysis)

```bash
python scripts/extract_only.py <file> [options]

Arguments:
  file                  Path to file to extract content from

Options:
  --output, -o          Output JSON file path (default: stdout)
  --frames, -f          Enable frame extraction for video
  --frame-interval      Seconds between frames (default: 30)
  --whisper-model, -m   Whisper model: tiny, base, small, medium, large
  --output-dir          Directory for extracted frames/images
```

### Full Pipeline (Template-Based - Less Recommended)

```bash
python scripts/run.py <file> [options]

Arguments:
  file                  Path to file to analyze

Options:
  --personas, -p        Comma-separated personas (ceo,cfo,cto,vp_product,ciso,vp_operations)
  --all-personas, -a    Use all executive personas
  --user-type, -u       User type for persona recommendations
  --frames, -f          Enable frame extraction for video
  --frame-interval      Seconds between frames (default: 30)
  --whisper-model, -m   Whisper model: tiny, base, small, medium, large
  --output, -o          Output file path
  --no-appendix         Exclude full transcript from report
  --check-deps          Check dependencies and exit
  --verbose, -v         Enable verbose output
```

**Note**: The `run.py` script generates template-based questions. For content-specific analysis, use `extract_only.py` and have the agent perform the analysis as described in Step 5.

## Output Format

Reports are generated in Markdown with the following structure:

1. **Header** - File info, content type, analysis metadata
2. **Content Summary** - Overview of content, key topics, visual elements
3. **Persona Analysis** (per persona selected):
   - Persona profile
   - Key concerns with severity
   - Questions they would ask (categorized)
   - Expected follow-ups
   - Risks identified
   - Recommendations
4. **Overall Preparation Checklist** - Consolidated action items prioritized

## Examples

### Example 1: Review a Demo Video as CTO

**User**: "I have a demo video I need to show to our CTO next week. Can you help me prepare?"

**Agent Workflow**:

1. Ask about frame analysis:
   > "Would you like me to extract and analyze video frames from your demo?"

2. Extract content:
   ```bash
   python scripts/extract_only.py demo.mp4 -o extracted.json
   ```

3. Read the extracted JSON and analyze the ACTUAL content:
   - Identify technical claims (e.g., "generates SDKs for 5 languages")
   - Find integration points mentioned (e.g., "TypeSpec", "GitHub PRs")
   - Note performance claims (e.g., "under two hours")

4. Generate CTO-specific questions based on content:
   - "You mentioned the agent creates PRs across multiple repos - how does it handle merge conflicts?"
   - "What happens if the TypeSpec validation fails mid-workflow?"
   - "How does the MCP server authenticate with GitHub?"

5. Create and share the report.

### Example 2: CFO Review of a Proposal

**User**: "What questions would a CFO have about this proposal?"

**Agent Workflow**:

1. Extract content:
   ```bash
   python scripts/extract_only.py proposal.pdf -o extracted.json
   ```

2. Read the document and identify financial claims:
   - Cost savings mentioned
   - Timeline claims
   - Resource requirements
   - ROI projections

3. Generate CFO-specific questions based on content:
   - If doc says "reduces time by 80%" → "What's the dollar value of that time savings?"
   - If doc mentions "minimal infrastructure" → "What are the actual infrastructure costs?"
   - If doc claims "quick adoption" → "What's the training cost per team?"

4. Create and share the report.

### Example 3: Multi-Persona Leadership Review

**User**: "I'm presenting to the entire leadership team. Help me prepare."

**Agent Workflow**:

1. Extract content:
   ```bash
   python scripts/extract_only.py presentation.pptx -o extracted.json
   ```

2. For EACH persona, analyze the content differently:
   - **CEO**: Look for strategic alignment claims, competitive positioning
   - **CFO**: Look for financial projections, cost claims
   - **CTO**: Look for technical architecture, scalability claims
   - **VP Product**: Look for user value, roadmap impact
   - **CISO**: Look for security implications, data handling
   - **VP Ops**: Look for rollout plans, training needs

3. Generate persona-specific questions that reference ACTUAL content from the presentation.

4. Create consolidated report with all perspectives.

## MCP Tools (Optional Fallbacks)

For edge cases, these MCP servers can supplement local processing:

| MCP Server | Use Case |
|------------|----------|
| **@anthropic/filesystem** | If Python file I/O has issues |
| **mcp-server-fetch** | If content is at a URL |
| **mcp-server-puppeteer** | For web-based presentations (Google Slides) |
| **mcp-youtube-transcript** | For YouTube video transcripts |

**Recommendation**: Use local Python scripts for all standard processing.

## References

- [Personas Reference](references/personas.md) - Detailed persona descriptions
- [Question Patterns](references/question-patterns.md) - Common executive question patterns
- [Agent Skills Specification](https://agentskills.io/specification)
