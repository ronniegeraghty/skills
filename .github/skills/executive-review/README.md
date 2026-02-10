# Executive Review Skill

Analyze demo videos, meeting recordings, documents, and presentations through executive personas to anticipate questions, concerns, and follow-ups.

## Overview

The Executive Review skill helps you prepare for presentations and demos by analyzing your content through the lens of different executive perspectives. It generates potential questions, concerns, and recommendations that executives might raise.

## Features

- **Multi-format Support**: Videos, audio, documents (PDF, DOCX, MD, TXT), and presentations (PPTX)
- **Six Executive Personas**: CEO, CFO, CTO, VP of Product, CISO, VP of Operations
- **Video Frame Analysis**: Optional extraction and analysis of video frames
- **Local Processing**: All extraction done locally using Python libraries
- **Markdown Reports**: Structured output with questions, concerns, and checklists

## Quick Start

### Prerequisites

1. Python 3.10 or higher
2. ffmpeg (for video/audio processing)

### Installation

```bash
# Navigate to the skill directory
cd skills/executive-review

# Install Python dependencies
pip install -r requirements.txt
```

### Basic Usage

```bash
# Analyze a video with specific personas
python scripts/run.py demo.mp4 --personas cto,ciso

# Analyze a document with all personas
python scripts/run.py proposal.pdf --all-personas

# Analyze a video with frame extraction
python scripts/run.py demo.mp4 --personas ceo --frames
```

## Executive Personas

| Persona | Focus |
|---------|-------|
| **CEO** | Strategic vision, market positioning, competitive advantage |
| **CFO** | ROI, total cost of ownership, budget, financial risk |
| **CTO** | Architecture, scalability, integration, technical debt |
| **VP of Product** | User value, roadmap impact, product-market fit |
| **CISO** | Security, compliance, data privacy, attack surface |
| **VP of Operations** | Implementation, rollout, training, change management |

## CLI Reference

```
usage: run.py [-h] [--personas PERSONAS | --all-personas] [--user-type USER_TYPE]
              [--frames] [--frame-interval FRAME_INTERVAL]
              [--whisper-model {tiny,base,small,medium,large}]
              [--output OUTPUT] [--no-appendix] [--check-deps] [--verbose]
              file

Arguments:
  file                  Path to file to analyze

Options:
  --personas, -p        Comma-separated list of personas
  --all-personas, -a    Use all executive personas
  --user-type, -u       User type for persona recommendations
  --frames, -f          Enable frame extraction for video
  --frame-interval      Seconds between frame captures (default: 30)
  --whisper-model, -m   Whisper model (tiny/base/small/medium/large)
  --output, -o          Output file path
  --no-appendix         Exclude transcript from report
  --check-deps          Check dependencies and exit
  --verbose, -v         Verbose output
```

## Output

Reports are saved as Markdown files with:

1. **Header**: File info, content type, metadata
2. **Content Summary**: Key topics and visual elements
3. **Persona Analyses**: Questions, concerns, risks per persona
4. **Preparation Checklist**: Consolidated action items

## Examples

### Sales Engineer Preparing for Customer Demo

```bash
python scripts/run.py customer_demo.mp4 --user-type sales --frames
```

Uses CTO + CISO personas (recommended for sales engineers).

### Product Manager Preparing for Leadership

```bash
python scripts/run.py roadmap_presentation.pptx --user-type product
```

Uses CEO + VP of Product personas.

### Comprehensive Review

```bash
python scripts/run.py pitch_deck.pdf --all-personas -o leadership_prep.md
```

Analyzes through all six executive personas.

## Documentation

- [SKILL.md](SKILL.md) - Complete skill specification for agents
- [references/personas.md](references/personas.md) - Detailed persona descriptions
- [references/question-patterns.md](references/question-patterns.md) - Common question patterns

## License

MIT
