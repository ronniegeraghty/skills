---
name: audio-to-remotion
description: "Create Remotion videos from audio or video files with automatic transcription and optional captions. Requires remotion-best-practices skill for Remotion patterns."
---

# Audio to Remotion

Transform audio/video files into Remotion videos with automatic transcription and optional captions.

## Prerequisites

**Skill dependency:**
- **`remotion-best-practices`** — Load for Remotion patterns, especially:
  - `rules/subtitles.md` — Caption type definition
  - `rules/transcribe-captions.md` — Transcription workflow
  - `rules/display-captions.md` — Rendering captions
  - `rules/audio.md` — Audio handling
  - `rules/sequencing.md` — Timeline composition

**System requirements:**
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

**Key distinction:**
- **Transcript** (with timestamps) → Used to CREATE the Remotion video structure
- **Captions** → OPTIONAL display of subtitles in the rendered video

## Step 1: Convert Audio

Convert input to 16kHz WAV (required for Whisper.cpp):

```bash
# From MP3
ffmpeg -i audio.mp3 -ar 16000 audio.wav -y

# From MP4 (extract audio)
ffmpeg -i video.mp4 -ar 16000 -vn audio.wav -y
```

## Step 2: Transcribe

### Primary: openai-whisper (Python CLI)

Clean CLI-based transcription:

```bash
# Install (one-time)
pip install openai-whisper

# Transcribe with word timestamps
whisper audio.wav --model medium --language en --word_timestamps True --output_format json --output_dir ./
```

This creates `audio.json` with timestamps. Convert to Remotion format:

```bash
python -c "
import json
with open('audio.json') as f: data = json.load(f)
transcript = [{'text': w['word'], 'startMs': int(w['start']*1000), 'endMs': int(w['end']*1000), 'timestampMs': int(w['start']*1000), 'confidence': w.get('probability')} for s in data['segments'] for w in s.get('words', [])]
with open('public/transcript.json', 'w') as f: json.dump(transcript, f, indent=2)
print(f'Saved {len(transcript)} words to public/transcript.json')
"
```

### Fallback: @remotion/install-whisper-cpp

Use if user wants **faster transcription** or **better performance** — whisper.cpp is optimized C++ and significantly faster than Python whisper. Also provides native Remotion integration (requires creating a helper script):

```bash
npx remotion add @remotion/install-whisper-cpp
```

```javascript
// transcribe.mjs
import path from "path";
import { downloadWhisperModel, installWhisperCpp, transcribe, toCaptions } from "@remotion/install-whisper-cpp";
import fs from "fs";

const whisperPath = path.join(process.cwd(), "whisper.cpp");
const inputFile = process.argv[2] || "audio.wav";

await installWhisperCpp({ to: whisperPath, version: "1.5.5" });
await downloadWhisperModel({ model: "medium.en", folder: whisperPath });

const result = await transcribe({
  model: "medium.en",
  whisperPath,
  whisperCppVersion: "1.5.5",
  inputPath: inputFile,
  tokenLevelTimestamps: true,
});

const { captions } = toCaptions({ whisperCppOutput: result });
fs.writeFileSync("public/transcript.json", JSON.stringify(captions, null, 2));
console.log(`Transcript saved to public/transcript.json (${captions.length} segments)`);
```

Run with: `node transcribe.mjs audio.wav`

## Step 3: Ask User

Before generating the Remotion composition, ask:

1. **"What audio or video file do you want to transcribe?"**
2. **"Do you want captions/subtitles displayed in the video?"** (Optional)
3. If yes: **"What caption style?"** (word-by-word, sentence blocks, karaoke)
4. **"What visual style for the video?"** (waveform, static background, animated)

## Step 4: Generate Remotion Composition

Load `remotion-best-practices` skill, then create composition using the **transcript** to structure the video.

The transcript provides timing data for:
- Setting video duration based on audio length
- Syncing visual elements to speech
- Creating scene breaks at natural pauses
- Animating elements in time with narration

```typescript
import { Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Load transcript for timing data
const transcript: Caption[] = require("./transcript.json");

// Calculate total duration from transcript
const durationMs = transcript[transcript.length - 1]?.endMs || 0;

export const AudioVideo: React.FC<{ showCaptions?: boolean }> = ({ 
  showCaptions = false  // Captions are OPTIONAL
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  // Use transcript for timing-based animations
  const currentSegment = transcript.find(
    (t) => currentTimeMs >= t.startMs && currentTimeMs < t.endMs
  );

  return (
    <div style={{ flex: 1, backgroundColor: "#000" }}>
      <Audio src={staticFile("audio.wav")} />
      
      {/* OPTIONAL: Display captions if user requested */}
      {showCaptions && currentSegment && (
        <div style={{
          position: "absolute",
          bottom: 100,
          width: "100%",
          textAlign: "center",
          color: "#fff",
          fontSize: 48,
        }}>
          {currentSegment.text}
        </div>
      )}
    </div>
  );
};
```

## Transcript Type Reference

The transcript uses Remotion's Caption type for timing data:

```typescript
type Caption = {
  text: string;        // Transcribed word/phrase
  startMs: number;     // Start time (milliseconds)
  endMs: number;       // End time (milliseconds)
  timestampMs: number | null;
  confidence: number | null;
};
```

**Usage:**
- **Transcript** → Timing data to structure and animate the video
- **Captions** (optional) → Display subtitles if user requests

## Model Selection

| Model | Size | Speed | Accuracy | Use When |
|-------|------|-------|----------|----------|
| `tiny.en` | 75MB | Fastest | Lower | Quick tests |
| `base.en` | 142MB | Fast | Good | Short clips |
| `small.en` | 466MB | Medium | Better | General use |
| `medium.en` | 1.5GB | Slower | Best | Production |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Audio must be 16kHz WAV" | Run ffmpeg conversion first |
| Whisper.cpp build fails | Check C++ compiler installed |
| Missing timestamps | Enable `tokenLevelTimestamps: true` |
| Python Whisper slow | Use smaller model or whisper.cpp instead |
