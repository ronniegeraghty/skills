# Executive Review Skill - Implementation Plan

## Overview

This plan details building a **WORKFLOW SKILL** that analyzes videos, audio, documents, and presentations through executive personas (CEO, CFO, CTO, VP of Product, CISO, VP of Operations) to generate question/concern reports.

**Architecture**: All-Python implementation for simplicity — single runtime, no inter-process communication, and all heavy-lifting libraries (Whisper, PyMuPDF, python-pptx, opencv) are already Python.

---

## File Structure

```
executive-review/
├── SKILL.md                      # Skill definition and workflow instructions
├── REQUIREMENTS.md               # Requirements (already created)
├── PLAN.md                       # This file
├── README.md                     # Usage documentation
├── pyproject.toml                # Python project configuration
├── requirements.txt              # Python dependencies
├── scripts/
│   ├── run.py                    # Main entry point / orchestrator
│   ├── types.py                  # Pydantic models / dataclasses
│   ├── constants.py              # Personas, file types, prompts
│   ├── utils.py                  # Utility functions
│   ├── detect.py                 # Content type detection
│   ├── extract.py                # All extraction (transcript, frames, docs, pptx)
│   ├── analyze.py                # Executive persona analysis
│   ├── report.py                 # Markdown report generation
│   ├── run.sh                    # Bash wrapper
│   └── run.ps1                   # PowerShell wrapper
│
└── references/
    ├── personas.md               # Detailed persona descriptions
    └── question-patterns.md      # Common executive question patterns
```

---

## Implementation Phases

### Phase 1: Foundation (Core Setup)
**Goal**: Establish project structure and configuration

| Step | Task | Files | Dependencies |
|------|------|-------|--------------|
| 1.1 | Create pyproject.toml with metadata | `pyproject.toml` | None |
| 1.2 | Create requirements.txt | `requirements.txt` | None |
| 1.3 | Create Python types (dataclasses/Pydantic) | `scripts/types.py` | None |
| 1.4 | Create constants (personas, file types) | `scripts/constants.py` | 1.3 |
| 1.5 | Create utility functions | `scripts/utils.py` | 1.3 |

### Phase 2: Content Detection & Extraction
**Goal**: Build all content extraction capabilities

| Step | Task | Files | Dependencies |
|------|------|-------|--------------|
| 2.1 | Create content type detector | `scripts/detect.py` | Phase 1 |
| 2.2 | Create unified extraction module | `scripts/extract.py` | Phase 1 |
|     | - Whisper transcription | (in extract.py) | |
|     | - Video frame extraction | (in extract.py) | |
|     | - Document extraction (PDF, DOCX, MD, TXT) | (in extract.py) | |
|     | - Presentation extraction (PPTX) | (in extract.py) | |

### Phase 3: Analysis & Reporting
**Goal**: Implement executive persona analysis and report generation

| Step | Task | Files | Dependencies |
|------|------|-------|--------------|
| 3.1 | Create analysis engine | `scripts/analyze.py` | Phase 1, 2 |
| 3.2 | Create report generator | `scripts/report.py` | Phase 1 |
| 3.3 | Create main orchestrator | `scripts/run.py` | 3.1, 3.2 |
| 3.4 | Create shell wrappers | `scripts/run.sh`, `scripts/run.ps1` | 3.3 |

### Phase 4: Skill Definition & Documentation
**Goal**: Create SKILL.md and supporting documentation

| Step | Task | Files | Dependencies |
|------|------|-------|--------------|
| 4.1 | Create SKILL.md with workflow | `SKILL.md` | Phase 1-3 |
| 4.2 | Create personas reference | `references/personas.md` | None |
| 4.3 | Create question patterns reference | `references/question-patterns.md` | None |
| 4.4 | Create README | `README.md` | Phase 1-3 |

---

## Detailed Task Specifications

### Phase 1: Foundation

#### 1.1 pyproject.toml
```toml
[project]
name = "executive-review"
version = "0.1.0"
description = "Analyze content through executive personas"
requires-python = ">=3.10"

[project.scripts]
executive-review = "scripts.run:main"
```

#### 1.2 requirements.txt
```txt
# Transcription
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

# Data Models
pydantic>=2.0.0
```

#### 1.3 types.py
Define dataclasses/Pydantic models for:
- `ContentType` (Enum: VIDEO, AUDIO, DOCUMENT, PRESENTATION)
- `ExtractionResult` (text, images, metadata, timestamps)
- `ExecutivePersona` (name, title, focus_areas, question_style, key_concerns)
- `Question` (text, category, reasoning, suggested_response)
- `AnalysisResult` (persona, questions, concerns, followups, risks, recommendations)
- `ReviewReport` (summary, content_type, persona_analyses, checklist)
- `UserPreferences` (personas, enable_frame_analysis, focus_areas, user_type)

#### 1.4 constants.py
Define:
- `SUPPORTED_VIDEO_EXTENSIONS` = {'.mp4', '.webm', '.mov', '.avi', '.mkv'}
- `SUPPORTED_AUDIO_EXTENSIONS` = {'.mp3', '.wav', '.m4a', '.flac'}
- `SUPPORTED_DOCUMENT_EXTENSIONS` = {'.pdf', '.docx', '.md', '.txt'}
- `SUPPORTED_PRESENTATION_EXTENSIONS` = {'.pptx'}
- `EXECUTIVE_PERSONAS` - Dict with all 6 personas and their full configurations
- `USER_TYPE_DEFAULTS` - Persona recommendations by user type
- `ANALYSIS_PROMPTS` - LLM prompt templates for each persona

### Phase 2: Content Detection & Extraction

#### 2.1 detect.py
```python
def detect_content_type(file_path: Path) -> ContentType:
    """Detect content type from file extension."""

def validate_file(file_path: Path) -> tuple[bool, str]:
    """Validate file exists and is readable."""

def get_file_metadata(file_path: Path) -> dict:
    """Get file size, duration (if media), page count (if doc)."""
```

#### 2.2 extract.py
Unified extraction module with functions:

```python
def extract_transcript(file_path: Path, model: str = "base") -> ExtractionResult:
    """Extract transcript from video/audio using Whisper."""

def extract_frames(file_path: Path, interval_seconds: int = 30) -> list[Path]:
    """Extract key frames from video at specified interval."""

def extract_document(file_path: Path) -> ExtractionResult:
    """Extract text and images from PDF, DOCX, MD, or TXT."""

def extract_presentation(file_path: Path) -> ExtractionResult:
    """Extract slides, text, notes, and images from PPTX."""

def extract_content(file_path: Path, content_type: ContentType, 
                   enable_frames: bool = False) -> ExtractionResult:
    """Main extraction dispatcher."""
```

### Phase 3: Analysis & Reporting

#### 3.1 analyze.py
```python
def build_persona_prompt(persona: ExecutivePersona, content: ExtractionResult) -> str:
    """Build analysis prompt for a specific persona."""

def analyze_for_persona(content: ExtractionResult, 
                        persona: ExecutivePersona) -> AnalysisResult:
    """Generate questions and concerns for a single persona."""

def analyze_content(content: ExtractionResult,
                   personas: list[ExecutivePersona],
                   user_context: dict) -> list[AnalysisResult]:
    """Analyze content through multiple executive personas."""
```

#### 3.2 report.py
```python
def format_persona_section(analysis: AnalysisResult) -> str:
    """Format a single persona's analysis as Markdown."""

def generate_checklist(analyses: list[AnalysisResult]) -> str:
    """Generate consolidated preparation checklist."""

def generate_report(content: ExtractionResult,
                   analyses: list[AnalysisResult],
                   options: dict) -> str:
    """Generate complete Markdown report."""

def save_report(report: str, output_path: Path) -> None:
    """Save report to file."""
```

#### 3.3 run.py
Main orchestrator:
```python
def main():
    """Main entry point."""
    # 1. Parse arguments (file path, options)
    # 2. Detect content type
    # 3. Extract content (prompt for frame analysis if video)
    # 4. Get user preferences (personas, focus areas)
    # 5. Run analysis for each persona
    # 6. Generate report
    # 7. Output to file or stdout

if __name__ == "__main__":
    main()
```

#### 3.4 Shell Wrappers

**run.sh**
```bash
#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python "$SCRIPT_DIR/run.py" "$@"
```

**run.ps1**
```powershell
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
python "$ScriptDir\run.py" @args
```

### Phase 4: Skill Definition & Documentation

#### 4.1 SKILL.md Structure
```markdown
---
name: executive-review
description: |
  **WORKFLOW SKILL** - Analyze demo videos, meeting recordings...
---

# Executive Review

## When to Use This Skill
[Trigger scenarios]

## Prerequisites
[Python, ffmpeg, dependencies]

## Workflow Steps
[Detailed step-by-step instructions for the agent]

## Executive Personas
[Brief persona summaries with references]

## Example Usage
[Sample prompts and expected behavior]
```

---

## Design Decisions

### 1. All-Python Architecture
**Decision**: Single Python codebase for all functionality

**Rationale**:
- All heavy-lifting libraries are Python (Whisper, PyMuPDF, python-pptx, opencv)
- Simpler development — one language, one runtime
- No inter-process communication overhead
- Easier debugging and testing
- Type safety via Pydantic/dataclasses
- Faster execution without JSON serialization between processes

### 2. Interactive Prompts via Agent (Not CLI)
**Decision**: Document that the agent should prompt users, not build interactive CLI

**Rationale**:
- Skills are executed by AI agents, not directly by users
- Agent naturally handles conversation flow
- SKILL.md documents when to ask questions (frame analysis, personas)

### 3. Vision API as Optional Enhancement
**Decision**: Implement basic frame extraction first, LLM vision analysis later

**Rationale**:
- Core functionality works without API keys
- Vision analysis adds cost and complexity
- Can be added as Phase 2 enhancement

### 4. Local Processing Preferred
**Decision**: Use local Python libraries, MCP as fallback only

**Rationale**:
- No external API dependencies for core features
- Works offline
- Faster execution
- User controls their data

### 5. Unified Extraction Module
**Decision**: Single `extract.py` with multiple functions instead of separate files

**Rationale**:
- Shared utilities (file handling, error handling)
- Consistent return types
- Easier imports and maintenance
- Fewer files to manage

---

## Dependencies

### Python (requirements.txt)
```
# Transcription
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

# Data Models
pydantic>=2.0.0
```

### System
- Python 3.10+
- ffmpeg
- Poppler (for pdf2image)

---

## Testing Strategy

### Unit Tests
- Content type detection for all supported formats
- Python script execution and JSON parsing
- Report Markdown generation

### Integration Tests
- End-to-end flow with sample files
- Each content type through full pipeline
- Multi-persona analysis

### Trigger Tests (from REQUIREMENTS.md)
- 10 prompts that SHOULD trigger
- 10 prompts that should NOT trigger

---

## Implementation Order

```
Week 1: Phase 1 (Foundation) + Phase 2 (Extraction)
  ├── Day 1-2: Project setup, types, constants
  ├── Day 3-4: Python extraction scripts
  └── Day 5: Content detection, testing

Week 2: Phase 3 (Analysis) + Phase 4 (Documentation)
  ├── Day 1-2: Analysis engine
  ├── Day 3: Report generation
  ├── Day 4: Main orchestrator, testing
  └── Day 5: SKILL.md, references, README
```

---

## Success Criteria

- [ ] All 5 content types extractable (video, audio, PDF, DOCX, PPTX)
- [ ] All 6 executive personas implemented with distinct perspectives
- [ ] Video frame analysis works when enabled
- [ ] Markdown report matches specified format
- [ ] SKILL.md validates against Agent Skills Specification
- [ ] Trigger tests pass (10 should, 10 should not)
- [ ] Works on Windows, macOS, Linux
- [ ] All Python scripts run with `python scripts/run.py`
- [ ] Shell wrappers (run.sh, run.ps1) work correctly
