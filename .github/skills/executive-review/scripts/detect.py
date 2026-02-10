"""
Content type detection for the Executive Review skill.

Detects file types and validates files for processing.
"""

from pathlib import Path
from typing import Optional

from .constants import (
    ALL_SUPPORTED_EXTENSIONS,
    SUPPORTED_AUDIO_EXTENSIONS,
    SUPPORTED_DOCUMENT_EXTENSIONS,
    SUPPORTED_PRESENTATION_EXTENSIONS,
    SUPPORTED_VIDEO_EXTENSIONS,
)
from .types import ContentType
from .utils import get_file_extension


def detect_content_type(file_path: Path) -> Optional[ContentType]:
    """
    Detect the content type of a file based on its extension.

    Args:
        file_path: Path to the file

    Returns:
        ContentType if recognized, None otherwise
    """
    ext = get_file_extension(file_path)

    if ext in SUPPORTED_VIDEO_EXTENSIONS:
        return ContentType.VIDEO
    elif ext in SUPPORTED_AUDIO_EXTENSIONS:
        return ContentType.AUDIO
    elif ext in SUPPORTED_DOCUMENT_EXTENSIONS:
        return ContentType.DOCUMENT
    elif ext in SUPPORTED_PRESENTATION_EXTENSIONS:
        return ContentType.PRESENTATION

    return None


def validate_file(file_path: Path) -> tuple[bool, str]:
    """
    Validate that a file exists, is readable, and is a supported type.

    Args:
        file_path: Path to the file

    Returns:
        Tuple of (is_valid, message)
    """
    # Check if path exists
    if not file_path.exists():
        return False, f"File not found: {file_path}"

    # Check if it's a file (not a directory)
    if not file_path.is_file():
        return False, f"Path is not a file: {file_path}"

    # Check if file is readable
    try:
        with open(file_path, "rb") as f:
            f.read(1)  # Try to read first byte
    except PermissionError:
        return False, f"Permission denied: {file_path}"
    except IOError as e:
        return False, f"Cannot read file: {file_path} - {e}"

    # Check if extension is supported
    ext = get_file_extension(file_path)
    if ext not in ALL_SUPPORTED_EXTENSIONS:
        supported_list = ", ".join(sorted(ALL_SUPPORTED_EXTENSIONS))
        return False, f"Unsupported file type: {ext}. Supported types: {supported_list}"

    # Check if file is not empty
    if file_path.stat().st_size == 0:
        return False, f"File is empty: {file_path}"

    return True, "File is valid"


def get_file_info(file_path: Path) -> dict:
    """
    Get detailed information about a file.

    Args:
        file_path: Path to the file

    Returns:
        Dictionary with file information
    """
    stat = file_path.stat()

    info = {
        "path": str(file_path.absolute()),
        "name": file_path.name,
        "extension": get_file_extension(file_path),
        "size_bytes": stat.st_size,
        "content_type": None,
        "is_valid": False,
        "validation_message": "",
    }

    # Detect content type
    content_type = detect_content_type(file_path)
    if content_type:
        info["content_type"] = content_type.value

    # Validate file
    is_valid, message = validate_file(file_path)
    info["is_valid"] = is_valid
    info["validation_message"] = message

    return info


def get_supported_extensions_by_type() -> dict[str, list[str]]:
    """
    Get a dictionary of supported extensions grouped by content type.

    Returns:
        Dictionary mapping content type names to lists of extensions
    """
    return {
        "video": sorted(SUPPORTED_VIDEO_EXTENSIONS),
        "audio": sorted(SUPPORTED_AUDIO_EXTENSIONS),
        "document": sorted(SUPPORTED_DOCUMENT_EXTENSIONS),
        "presentation": sorted(SUPPORTED_PRESENTATION_EXTENSIONS),
    }


def suggest_content_type_for_extension(ext: str) -> Optional[str]:
    """
    Suggest a content type for an unsupported extension.

    Args:
        ext: File extension (with or without leading dot)

    Returns:
        Suggested content type or None
    """
    ext = ext.lower() if ext.startswith(".") else f".{ext.lower()}"

    # Common video formats not in our list
    video_like = {".wmv", ".flv", ".m4v", ".3gp", ".ts"}
    if ext in video_like:
        return "video (unsupported format, consider converting to MP4)"

    # Common audio formats not in our list
    audio_like = {".aac", ".wma", ".aiff"}
    if ext in audio_like:
        return "audio (unsupported format, consider converting to MP3)"

    # Common document formats not in our list
    doc_like = {".doc", ".rtf", ".odt", ".pages"}
    if ext in doc_like:
        return "document (unsupported format, consider converting to PDF or DOCX)"

    # Common presentation formats not in our list
    pres_like = {".ppt", ".odp", ".key"}
    if ext in pres_like:
        return "presentation (unsupported format, consider converting to PPTX)"

    return None
