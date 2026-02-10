#!/usr/bin/env python3
"""
Executive Review Skill - Main Orchestrator

This script coordinates the entire executive review workflow:
1. Detect content type
2. Extract content (transcript, text, images)
3. Analyze through executive personas
4. Generate markdown report

Usage:
    python scripts/run.py <file_path> [options]

Examples:
    python scripts/run.py demo.mp4 --personas cto,ciso --frames
    python scripts/run.py proposal.pdf --personas ceo,cfo
    python scripts/run.py slides.pptx --all-personas
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.analyze import analyze_content, get_persona
from scripts.constants import (
    DEFAULT_FRAME_INTERVAL_SECONDS,
    DEFAULT_OUTPUT_DIR,
    EXECUTIVE_PERSONAS,
    RAPID_DEMO_FRAME_INTERVAL_SECONDS,
    REPORT_FILENAME_TEMPLATE,
    USER_TYPE_PERSONA_DEFAULTS,
    WHISPER_AVAILABLE_MODELS,
    WHISPER_DEFAULT_MODEL,
)
from scripts.detect import detect_content_type, get_file_info, validate_file
from scripts.extract import extract_content
from scripts.report import generate_report, save_report
from scripts.types import ContentType, PersonaType, UserPreferences, UserType
from scripts.utils import (
    ensure_directory,
    get_content_type_display,
    get_output_directory,
    get_timestamp,
    print_header,
    print_status,
    validate_dependencies,
)


def parse_personas(persona_str: str) -> list[PersonaType]:
    """Parse comma-separated persona string into list of PersonaType."""
    personas = []
    for p in persona_str.lower().split(","):
        p = p.strip()
        # Handle various input formats
        persona_map = {
            "ceo": PersonaType.CEO,
            "cfo": PersonaType.CFO,
            "cto": PersonaType.CTO,
            "vp_product": PersonaType.VP_PRODUCT,
            "vpproduct": PersonaType.VP_PRODUCT,
            "vp-product": PersonaType.VP_PRODUCT,
            "product": PersonaType.VP_PRODUCT,
            "ciso": PersonaType.CISO,
            "security": PersonaType.CISO,
            "vp_operations": PersonaType.VP_OPERATIONS,
            "vpoperations": PersonaType.VP_OPERATIONS,
            "vp-operations": PersonaType.VP_OPERATIONS,
            "operations": PersonaType.VP_OPERATIONS,
            "ops": PersonaType.VP_OPERATIONS,
        }
        if p in persona_map:
            personas.append(persona_map[p])
        else:
            print_status(f"Unknown persona: {p}", "warning")

    return personas


def parse_user_type(user_type_str: str) -> Optional[UserType]:
    """Parse user type string into UserType enum."""
    user_type_map = {
        "sales": UserType.SALES_ENGINEER,
        "sales_engineer": UserType.SALES_ENGINEER,
        "product": UserType.PRODUCT_MANAGER,
        "product_manager": UserType.PRODUCT_MANAGER,
        "pm": UserType.PRODUCT_MANAGER,
        "developer": UserType.DEVELOPER,
        "dev": UserType.DEVELOPER,
        "writer": UserType.TECHNICAL_WRITER,
        "technical_writer": UserType.TECHNICAL_WRITER,
        "marketing": UserType.MARKETING,
        "solutions": UserType.SOLUTIONS_ARCHITECT,
        "solutions_architect": UserType.SOLUTIONS_ARCHITECT,
        "sa": UserType.SOLUTIONS_ARCHITECT,
    }
    return user_type_map.get(user_type_str.lower().strip())


def create_argument_parser() -> argparse.ArgumentParser:
    """Create and configure argument parser."""
    parser = argparse.ArgumentParser(
        description="Executive Review Skill - Analyze content through executive personas",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run.py demo.mp4 --personas cto,ciso
  python run.py proposal.pdf --all-personas
  python run.py slides.pptx --personas ceo,cfo --user-type sales

Supported file types:
  Video: .mp4, .webm, .mov, .avi, .mkv
  Audio: .mp3, .wav, .m4a, .flac
  Documents: .pdf, .docx, .md, .txt
  Presentations: .pptx

Available personas:
  ceo, cfo, cto, vp_product (or product), ciso (or security), 
  vp_operations (or operations, ops)
        """,
    )

    parser.add_argument(
        "file",
        type=Path,
        help="Path to the file to analyze",
    )

    # Persona selection
    persona_group = parser.add_mutually_exclusive_group()
    persona_group.add_argument(
        "--personas",
        "-p",
        type=str,
        help="Comma-separated list of personas (e.g., cto,ciso)",
    )
    persona_group.add_argument(
        "--all-personas",
        "-a",
        action="store_true",
        help="Use all available executive personas",
    )

    # User type for persona recommendations
    parser.add_argument(
        "--user-type",
        "-u",
        type=str,
        help="User type for persona recommendations (sales, product, developer, etc.)",
    )

    # Video-specific options
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

    # Whisper options
    parser.add_argument(
        "--whisper-model",
        "-m",
        type=str,
        default=WHISPER_DEFAULT_MODEL,
        choices=WHISPER_AVAILABLE_MODELS,
        help=f"Whisper model for transcription (default: {WHISPER_DEFAULT_MODEL})",
    )

    # Output options
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        help="Output file path (default: output/<timestamp>/report.md)",
    )
    parser.add_argument(
        "--no-appendix",
        action="store_true",
        help="Exclude full transcript/text from report",
    )

    # Other options
    parser.add_argument(
        "--check-deps",
        action="store_true",
        help="Check dependencies and exit",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose output",
    )

    return parser


def check_dependencies() -> bool:
    """Check and report on dependencies."""
    print_header("Dependency Check")

    results = validate_dependencies()
    all_ok = True

    for dep, available in results.items():
        if available:
            print_status(f"{dep}: Available", "success")
        else:
            print_status(f"{dep}: Not found", "error")
            all_ok = False

    return all_ok


def run_review(
    file_path: Path,
    personas: list[PersonaType],
    enable_frames: bool = False,
    frame_interval: int = DEFAULT_FRAME_INTERVAL_SECONDS,
    whisper_model: str = WHISPER_DEFAULT_MODEL,
    output_path: Optional[Path] = None,
    include_appendix: bool = True,
    verbose: bool = False,
) -> Path:
    """
    Run the complete executive review workflow.

    Args:
        file_path: Path to file to analyze
        personas: List of personas to analyze as
        enable_frames: Whether to extract video frames
        frame_interval: Seconds between frame captures
        whisper_model: Whisper model for transcription
        output_path: Optional output file path
        include_appendix: Whether to include appendix
        verbose: Enable verbose output

    Returns:
        Path to generated report
    """
    print_header("Executive Review")

    # Step 1: Validate and detect content type
    print_status("Step 1: Validating file...", "progress")

    is_valid, message = validate_file(file_path)
    if not is_valid:
        print_status(message, "error")
        sys.exit(1)

    content_type = detect_content_type(file_path)
    if not content_type:
        print_status(f"Could not detect content type for: {file_path}", "error")
        sys.exit(1)

    print_status(f"Detected: {get_content_type_display(content_type)}", "success")

    # Step 2: Set up output directory
    if output_path:
        output_dir = output_path.parent
        report_path = output_path
    else:
        output_dir = get_output_directory(Path(DEFAULT_OUTPUT_DIR))
        report_path = output_dir / REPORT_FILENAME_TEMPLATE.format(
            timestamp=get_timestamp()
        )

    ensure_directory(output_dir)

    # Step 3: Extract content
    print_status("Step 2: Extracting content...", "progress")

    content = extract_content(
        file_path=file_path,
        content_type=content_type,
        output_dir=output_dir,
        enable_frames=enable_frames,
        whisper_model=whisper_model,
        frame_interval=frame_interval,
    )

    if verbose:
        print_status(f"Extracted {len(content.text)} characters of text", "info")
        if content.image_paths:
            print_status(f"Extracted {len(content.image_paths)} images/frames", "info")

    # Step 4: Analyze content
    print_status("Step 3: Analyzing through executive personas...", "progress")

    analyses = analyze_content(content, personas)

    # Step 5: Generate report
    print_status("Step 4: Generating report...", "progress")

    report = generate_report(
        content=content,
        analyses=analyses,
        enable_frame_analysis=enable_frames,
        include_appendix=include_appendix,
    )

    # Step 6: Save report
    save_report(report, report_path)

    print_header("Review Complete")
    print_status(f"Report saved: {report_path}", "success")
    print_status(f"Analyzed as: {', '.join(p.value for p in personas)}", "info")

    return report_path


def main():
    """Main entry point."""
    parser = create_argument_parser()
    args = parser.parse_args()

    # Check dependencies if requested
    if args.check_deps:
        success = check_dependencies()
        sys.exit(0 if success else 1)

    # Validate file exists
    if not args.file.exists():
        print_status(f"File not found: {args.file}", "error")
        sys.exit(1)

    # Determine personas to use
    personas: list[PersonaType] = []

    if args.all_personas:
        personas = list(PersonaType)
    elif args.personas:
        personas = parse_personas(args.personas)
    elif args.user_type:
        user_type = parse_user_type(args.user_type)
        if user_type:
            personas = USER_TYPE_PERSONA_DEFAULTS.get(user_type, [])
            print_status(
                f"Using recommended personas for {user_type.value}: "
                f"{', '.join(p.value for p in personas)}",
                "info",
            )
        else:
            print_status(f"Unknown user type: {args.user_type}", "warning")

    # Default to CTO and CEO if no personas specified
    if not personas:
        personas = [PersonaType.CEO, PersonaType.CTO]
        print_status(
            f"Using default personas: {', '.join(p.value for p in personas)}",
            "info",
        )

    # Check if frames should be enabled for video
    content_type = detect_content_type(args.file)
    enable_frames = args.frames

    if content_type == ContentType.VIDEO and not args.frames:
        # In interactive mode, we would ask the user here
        # For CLI, we just note that frames are disabled
        print_status(
            "Frame analysis disabled. Use --frames to enable for video.",
            "info",
        )

    # Determine frame interval
    if args.frame_interval is not None:
        frame_interval = args.frame_interval
    elif args.rapid:
        frame_interval = RAPID_DEMO_FRAME_INTERVAL_SECONDS
        print_status(f"Rapid demo mode: capturing frames every {frame_interval}s", "info")
    else:
        frame_interval = DEFAULT_FRAME_INTERVAL_SECONDS

    # Run the review
    try:
        report_path = run_review(
            file_path=args.file,
            personas=personas,
            enable_frames=enable_frames,
            frame_interval=frame_interval,
            whisper_model=args.whisper_model,
            output_path=args.output,
            include_appendix=not args.no_appendix,
            verbose=args.verbose,
        )
    except KeyboardInterrupt:
        print_status("\nReview cancelled by user", "warning")
        sys.exit(130)
    except Exception as e:
        print_status(f"Error: {e}", "error")
        if args.verbose:
            import traceback

            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
