"""
Utility functions for the Executive Review skill.
"""

import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from .types import ContentType


def get_timestamp() -> str:
    """Get a formatted timestamp for filenames."""
    return datetime.now().strftime("%Y-%m-%dT%H-%M-%S")


def ensure_directory(path: Path) -> Path:
    """Ensure a directory exists, creating it if necessary."""
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_output_directory(base_path: Optional[Path] = None) -> Path:
    """Get or create the output directory."""
    if base_path is None:
        base_path = Path.cwd() / "output"
    return ensure_directory(base_path / get_timestamp())


def format_duration(seconds: float) -> str:
    """Format duration in seconds to human-readable string."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)

    if hours > 0:
        return f"{hours}h {minutes}m {secs}s"
    elif minutes > 0:
        return f"{minutes}m {secs}s"
    else:
        return f"{secs}s"


def format_file_size(bytes: int) -> str:
    """Format file size in bytes to human-readable string."""
    for unit in ["B", "KB", "MB", "GB"]:
        if bytes < 1024:
            return f"{bytes:.1f} {unit}"
        bytes /= 1024
    return f"{bytes:.1f} TB"


def get_file_extension(path: Path) -> str:
    """Get lowercase file extension including the dot."""
    return path.suffix.lower()


def is_video_file(path: Path) -> bool:
    """Check if a file is a video file."""
    from .constants import SUPPORTED_VIDEO_EXTENSIONS

    return get_file_extension(path) in SUPPORTED_VIDEO_EXTENSIONS


def is_audio_file(path: Path) -> bool:
    """Check if a file is an audio file."""
    from .constants import SUPPORTED_AUDIO_EXTENSIONS

    return get_file_extension(path) in SUPPORTED_AUDIO_EXTENSIONS


def is_document_file(path: Path) -> bool:
    """Check if a file is a document file."""
    from .constants import SUPPORTED_DOCUMENT_EXTENSIONS

    return get_file_extension(path) in SUPPORTED_DOCUMENT_EXTENSIONS


def is_presentation_file(path: Path) -> bool:
    """Check if a file is a presentation file."""
    from .constants import SUPPORTED_PRESENTATION_EXTENSIONS

    return get_file_extension(path) in SUPPORTED_PRESENTATION_EXTENSIONS


def check_ffmpeg_installed() -> bool:
    """Check if ffmpeg is installed and accessible."""
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.returncode == 0
    except (subprocess.SubprocessError, FileNotFoundError):
        return False


def check_poppler_installed() -> bool:
    """Check if poppler (pdftoppm) is installed and accessible."""
    try:
        # Try pdftoppm on Unix, or check for poppler path on Windows
        cmd = "pdftoppm" if sys.platform != "win32" else "pdftoppm"
        result = subprocess.run(
            [cmd, "-v"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.returncode == 0
    except (subprocess.SubprocessError, FileNotFoundError):
        return False


def get_video_duration(file_path: Path) -> Optional[float]:
    """Get the duration of a video file in seconds using ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "quiet",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(file_path),
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return float(data["format"]["duration"])
    except (subprocess.SubprocessError, json.JSONDecodeError, KeyError, ValueError):
        pass
    return None


def get_audio_duration(file_path: Path) -> Optional[float]:
    """Get the duration of an audio file in seconds."""
    return get_video_duration(file_path)  # ffprobe works for audio too


def truncate_text(text: str, max_length: int = 1000, suffix: str = "...") -> str:
    """Truncate text to a maximum length."""
    if len(text) <= max_length:
        return text
    return text[: max_length - len(suffix)] + suffix


def clean_text(text: str) -> str:
    """Clean extracted text by normalizing whitespace."""
    # Replace multiple whitespace with single space
    import re

    text = re.sub(r"\s+", " ", text)
    # Strip leading/trailing whitespace
    text = text.strip()
    return text


def save_json(data: Any, path: Path) -> None:
    """Save data as JSON file."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str, ensure_ascii=False)


def load_json(path: Path) -> Any:
    """Load data from JSON file."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def print_status(message: str, level: str = "info") -> None:
    """Print a status message with formatting."""
    icons = {
        "info": "ℹ️",
        "success": "✅",
        "warning": "⚠️",
        "error": "❌",
        "progress": "🔄",
    }
    icon = icons.get(level, "•")
    print(f"{icon} {message}")


def print_header(title: str) -> None:
    """Print a formatted header."""
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}\n")


def validate_dependencies() -> dict[str, bool]:
    """Validate that all required dependencies are available."""
    results = {
        "ffmpeg": check_ffmpeg_installed(),
        "poppler": check_poppler_installed(),
    }

    # Check Python packages
    packages = [
        "whisper",
        "cv2",
        "pptx",
        "docx",
        "fitz",
        "PIL",
        "pydantic",
    ]

    for package in packages:
        try:
            __import__(package)
            results[package] = True
        except ImportError:
            results[package] = False

    return results


def get_content_type_display(content_type: ContentType) -> str:
    """Get display name for content type."""
    return {
        ContentType.VIDEO: "Video",
        ContentType.AUDIO: "Audio",
        ContentType.DOCUMENT: "Document",
        ContentType.PRESENTATION: "Presentation",
    }.get(content_type, "Unknown")
