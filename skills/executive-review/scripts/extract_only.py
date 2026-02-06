#!/usr/bin/env python3
"""
Executive Review Skill - Content Extraction Only

This script extracts content from files without performing analysis.
The extracted content is output as JSON for the agent to analyze.

Usage:
    python scripts/extract_only.py <file_path> [options]

Examples:
    python scripts/extract_only.py demo.mp4 --output extracted.json
    python scripts/extract_only.py demo.mp4 --frames --rapid    # Fast demo, 10s interval
    python scripts/extract_only.py proposal.pdf
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.constants import (
    DEFAULT_FRAME_INTERVAL_SECONDS,
    RAPID_DEMO_FRAME_INTERVAL_SECONDS,
    WHISPER_AVAILABLE_MODELS,
    WHISPER_DEFAULT_MODEL,
)
from scripts.detect import detect_content_type, validate_file
from scripts.extract import extract_content
from scripts.types import ContentType
from scripts.utils import (
    ensure_directory,
    get_content_type_display,
    print_header,
    print_status,
)


def create_argument_parser() -> argparse.ArgumentParser:
    """Create and configure argument parser."""
    parser = argparse.ArgumentParser(
        description="Extract content from files for executive review analysis",
    )

    parser.add_argument(
        "file",
        type=Path,
        help="Path to the file to extract content from",
    )

    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        help="Output JSON file path (default: stdout)",
    )

    parser.add_argument(
        "--frames",
        "-f",
        action="store_true",
        help="Enable frame extraction for video files",
    )

    parser.add_argument(
        "--rapid",
        "-r",
        action="store_true",
        help=f"Rapid demo mode - capture frames every {RAPID_DEMO_FRAME_INTERVAL_SECONDS}s instead of {DEFAULT_FRAME_INTERVAL_SECONDS}s",
    )

    parser.add_argument(
        "--frame-interval",
        type=int,
        default=None,
        help=f"Seconds between frame captures (default: {DEFAULT_FRAME_INTERVAL_SECONDS}, or {RAPID_DEMO_FRAME_INTERVAL_SECONDS} with --rapid)",
    )

    parser.add_argument(
        "--whisper-model",
        "-m",
        type=str,
        default=WHISPER_DEFAULT_MODEL,
        choices=WHISPER_AVAILABLE_MODELS,
        help=f"Whisper model for transcription (default: {WHISPER_DEFAULT_MODEL})",
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Directory for extracted frames/images",
    )

    return parser


def main():
    """Main entry point."""
    parser = create_argument_parser()
    args = parser.parse_args()

    # Validate file
    is_valid, message = validate_file(args.file)
    if not is_valid:
        print_status(message, "error")
        sys.exit(1)

    # Detect content type
    content_type = detect_content_type(args.file)
    if not content_type:
        print_status(f"Could not detect content type for: {args.file}", "error")
        sys.exit(1)

    print_status(f"Extracting from: {args.file.name}", "progress")
    print_status(f"Content type: {get_content_type_display(content_type)}", "info")

    # Determine frame interval
    if args.frame_interval is not None:
        frame_interval = args.frame_interval
    elif args.rapid:
        frame_interval = RAPID_DEMO_FRAME_INTERVAL_SECONDS
        print_status(f"Rapid demo mode: capturing frames every {frame_interval}s", "info")
    else:
        frame_interval = DEFAULT_FRAME_INTERVAL_SECONDS

    # Set up output directory for frames/images
    output_dir = args.output_dir
    if args.frames and not output_dir:
        output_dir = args.file.parent / f"{args.file.stem}_extracted"
        ensure_directory(output_dir)

    # Extract content
    try:
        result = extract_content(
            file_path=args.file,
            content_type=content_type,
            output_dir=output_dir,
            enable_frames=args.frames,
            whisper_model=args.whisper_model,
            frame_interval=frame_interval,
        )
    except Exception as e:
        print_status(f"Extraction failed: {e}", "error")
        sys.exit(1)

    # Build output JSON
    output = {
        "file_name": result.metadata.file_name,
        "file_path": str(result.metadata.file_path),
        "content_type": result.metadata.content_type.value,
        "extracted_at": datetime.now().isoformat(),
        "text": result.text,
    }

    # Add optional metadata
    if result.metadata.duration_seconds:
        output["duration_seconds"] = result.metadata.duration_seconds
    if result.metadata.page_count:
        output["page_count"] = result.metadata.page_count
    if result.metadata.slide_count:
        output["slide_count"] = result.metadata.slide_count
    if result.metadata.language:
        output["language"] = result.metadata.language

    # Add segments for video/audio
    if result.segments:
        output["segments"] = [
            {"start": s.start, "end": s.end, "text": s.text}
            for s in result.segments
        ]

    # Add slides for presentations
    if result.slides:
        output["slides"] = [
            {
                "slide_number": s.slide_number,
                "title": s.title,
                "text": s.text,
                "notes": s.notes,
            }
            for s in result.slides
        ]

    # Add image paths
    if result.image_paths:
        output["image_paths"] = [str(p) for p in result.image_paths]

    # Output
    json_output = json.dumps(output, indent=2, ensure_ascii=False)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(json_output)
        print_status(f"Saved to: {args.output}", "success")
    else:
        print(json_output)


if __name__ == "__main__":
    main()
