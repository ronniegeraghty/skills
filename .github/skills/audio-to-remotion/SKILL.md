---
name: audio-to-remotion
description: "**WORKFLOW SKILL** — Create Remotion videos from audio or video files with automatic transcription and optional captions. USE FOR: audio-to-video conversion, podcast visualization, transcription-based video, caption rendering. DO NOT USE FOR: video editing without audio, general Remotion setup (use remotion-best-practices). INVOKES: ffmpeg, Whisper (Python or whisper.cpp), Remotion."
---

# Audio to Remotion

Transform audio/video files into Remotion videos with automatic transcription and optional captions.

## Skill Dependency

**`remotion-best-practices`** must be loaded for Remotion patterns, especially:
- `rules/subtitles.md` — Caption type definition
- `rules/transcribe-captions.md` — Transcription workflow
- `rules/display-captions.md` — Rendering captions
- `rules/audio.md` — Audio handling
- `rules/sequencing.md` — Timeline composition

## Prerequisites

- Node.js 18+
- Python 3.8+ with `pip install openai-whisper`
- ffmpeg (`brew install ffmpeg` / `winget install ffmpeg`)
- Remotion project (`npx create-video@latest`)

## Workflow

```
Input (MP3/MP4/WAV) → ffmpeg (16kHz WAV) → Whisper → Transcript JSON → Remotion
                                                            ↓
                                              [Optional: Display captions?]
```

### Step 1: Convert Audio

```bash
ffmpeg -i input.mp3 -ar 16000 audio.wav -y        # From MP3
ffmpeg -i input.mp4 -ar 16000 -vn audio.wav -y    # From MP4 (extract audio)
```

### Step 2: Transcribe

**Primary (Python CLI):**
```bash
pip install openai-whisper
whisper audio.wav --model medium --language en --word_timestamps True --output_format json --output_dir ./
```

Then convert to Remotion format — see [references/transcription-details.md](references/transcription-details.md) for the conversion script and the whisper.cpp fallback option.

### Step 3: Ask User

1. What audio/video file to transcribe?
2. Display captions/subtitles in the video? (optional)
3. If yes: caption style — word-by-word, sentence blocks, or karaoke?
4. Visual style — waveform, static background, or animated?

### Step 4: Generate Remotion Composition

Load `remotion-best-practices` skill, then create composition using the transcript for timing. See [references/transcription-details.md](references/transcription-details.md) for the TypeScript composition template and Caption type reference.

## References

- [Transcription Details](references/transcription-details.md) — Conversion scripts, whisper.cpp fallback, composition template, model selection, troubleshooting

## Related Skills

- **remotion-best-practices** — Required Remotion patterns and best practices
