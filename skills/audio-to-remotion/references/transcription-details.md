# Transcription Details

Conversion scripts, whisper.cpp fallback, Remotion composition template, model selection, and troubleshooting.

## Convert Whisper JSON to Remotion Format

After running `whisper audio.wav --model medium --language en --word_timestamps True --output_format json --output_dir ./`, convert the output:

```bash
python -c "
import json
with open('audio.json') as f: data = json.load(f)
transcript = [{'text': w['word'], 'startMs': int(w['start']*1000), 'endMs': int(w['end']*1000), 'timestampMs': int(w['start']*1000), 'confidence': w.get('probability')} for s in data['segments'] for w in s.get('words', [])]
with open('public/transcript.json', 'w') as f: json.dump(transcript, f, indent=2)
print(f'Saved {len(transcript)} words to public/transcript.json')
"
```

## Fallback: @remotion/install-whisper-cpp

Use if the user wants **faster transcription** — whisper.cpp is optimized C++ and significantly faster than Python whisper.

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

## Remotion Composition Template

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

## Caption Type Reference

```typescript
type Caption = {
  text: string;        // Transcribed word/phrase
  startMs: number;     // Start time (milliseconds)
  endMs: number;       // End time (milliseconds)
  timestampMs: number | null;
  confidence: number | null;
};
```

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

- Ensure ffmpeg is on PATH before converting audio
- For large files, use `tiny.en` model first to test, then `medium.en` for production
- If whisper.cpp install fails, fall back to Python whisper
- Remotion requires `public/` directory to exist for static files
