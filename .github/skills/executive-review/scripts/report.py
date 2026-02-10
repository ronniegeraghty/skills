"""
Markdown report generation for the Executive Review skill.

Generates structured Markdown reports from analysis results.
"""

from datetime import datetime
from pathlib import Path
from typing import Optional

from .types import (
    AnalysisResult,
    ChecklistItem,
    ContentType,
    ExtractionResult,
    ReviewReport,
    Severity,
)
from .utils import (
    format_duration,
    format_file_size,
    get_content_type_display,
    print_status,
)


def generate_header(
    content: ExtractionResult,
    enable_frame_analysis: bool = False,
) -> str:
    """
    Generate the report header section.

    Args:
        content: Extracted content
        enable_frame_analysis: Whether frame analysis was enabled

    Returns:
        Markdown string for header
    """
    metadata = content.metadata
    lines = [
        f"# Executive Review: {metadata.file_name}",
        "",
        f"**Reviewed**: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}",
        f"**Content Type**: {get_content_type_display(metadata.content_type)}",
        f"**File Size**: {format_file_size(metadata.file_size_bytes)}",
    ]

    # Add duration for video/audio
    if metadata.duration_seconds:
        lines.append(f"**Duration**: {format_duration(metadata.duration_seconds)}")

    # Add page/slide count
    if metadata.page_count:
        lines.append(f"**Pages**: {metadata.page_count}")
    if metadata.slide_count:
        lines.append(f"**Slides**: {metadata.slide_count}")

    # Add language if detected
    if metadata.language:
        lines.append(f"**Language**: {metadata.language.upper()}")

    # Add frame analysis status for video
    if metadata.content_type == ContentType.VIDEO:
        status = "Enabled" if enable_frame_analysis else "Disabled"
        lines.append(f"**Frame Analysis**: {status}")

    lines.append("")
    lines.append("---")
    lines.append("")

    return "\n".join(lines)


def generate_content_summary(
    content: ExtractionResult,
    summary: Optional[str] = None,
    key_topics: Optional[list[str]] = None,
) -> str:
    """
    Generate the content summary section.

    Args:
        content: Extracted content
        summary: Optional pre-generated summary
        key_topics: Optional list of key topics

    Returns:
        Markdown string for content summary
    """
    lines = ["## Content Summary", ""]

    if summary:
        lines.append(summary)
    else:
        # Create a basic summary from the content
        text_preview = content.text[:500] + "..." if len(content.text) > 500 else content.text
        lines.append(f"*{text_preview}*")

    lines.append("")

    if key_topics:
        lines.append("### Key Topics Covered")
        for topic in key_topics:
            lines.append(f"- {topic}")
        lines.append("")

    # Note visual elements if present
    if content.image_paths:
        lines.append("### Visual Elements")
        lines.append(f"- {len(content.image_paths)} images/frames extracted")
        lines.append("")

    # Note slides if present
    if content.slides:
        lines.append("### Presentation Structure")
        for slide in content.slides[:5]:  # Show first 5 slides
            title = slide.title or "Untitled"
            lines.append(f"- Slide {slide.slide_number}: {title}")
        if len(content.slides) > 5:
            lines.append(f"- ... and {len(content.slides) - 5} more slides")
        lines.append("")

    lines.append("---")
    lines.append("")

    return "\n".join(lines)


def generate_persona_section(analysis: AnalysisResult) -> str:
    """
    Generate the analysis section for a single persona.

    Args:
        analysis: Analysis result for one persona

    Returns:
        Markdown string for persona analysis
    """
    persona = analysis.persona
    lines = [
        f"## Executive Analysis: {persona.title}",
        "",
        "### Persona Profile",
        f"> {persona.perspective}",
        "",
    ]

    # Key Concerns Table
    if analysis.concerns:
        lines.append("### Key Concerns")
        lines.append("")
        lines.append("| Concern | Severity | Why It Matters |")
        lines.append("|---------|----------|----------------|")
        for concern in analysis.concerns:
            severity_icon = {
                Severity.HIGH: "🔴 High",
                Severity.MEDIUM: "🟡 Medium",
                Severity.LOW: "🟢 Low",
            }.get(concern.severity, concern.severity.value)
            lines.append(f"| {concern.title} | {severity_icon} | {concern.why_it_matters} |")
        lines.append("")

    # Questions Section
    if analysis.questions:
        lines.append("### Questions They Would Ask")
        lines.append("")

        # Group by category
        categories = {}
        for q in analysis.questions:
            cat = q.category.value.title()
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(q)

        for category, questions in categories.items():
            lines.append(f"#### {category} Questions")
            lines.append("")
            for i, q in enumerate(questions, 1):
                lines.append(f"{i}. **{q.text}**")
                lines.append(f"   - *Why they'd ask*: {q.reasoning}")
                lines.append(f"   - *Suggested response*: {q.suggested_response}")
                lines.append("")

    # Follow-ups
    if analysis.followups:
        lines.append("### Potential Follow-ups")
        lines.append("")
        lines.append("After initial presentation, expect these follow-up requests:")
        lines.append("")
        for followup in analysis.followups:
            lines.append(f"- [ ] {followup}")
        lines.append("")

    # Risks Table
    if analysis.risks:
        lines.append("### Risk Areas Identified")
        lines.append("")
        lines.append("| Risk | Impact | Mitigation |")
        lines.append("|------|--------|------------|")
        for risk in analysis.risks:
            lines.append(f"| {risk.title} | {risk.impact} | {risk.mitigation} |")
        lines.append("")

    # Recommendations
    if analysis.recommendations:
        lines.append("### Recommendations for This Audience")
        lines.append("")
        for i, rec in enumerate(analysis.recommendations, 1):
            priority_icon = {
                Severity.HIGH: "🔴",
                Severity.MEDIUM: "🟡",
                Severity.LOW: "🟢",
            }.get(rec.priority, "•")
            lines.append(f"{i}. {priority_icon} {rec.text}")
        lines.append("")

    lines.append("---")
    lines.append("")

    return "\n".join(lines)


def generate_checklist(analyses: list[AnalysisResult]) -> str:
    """
    Generate a consolidated preparation checklist from all analyses.

    Args:
        analyses: List of analysis results

    Returns:
        Markdown string for preparation checklist
    """
    lines = [
        "## Overall Preparation Checklist",
        "",
        "Based on analysis across all selected personas:",
        "",
    ]

    # Collect all recommendations by priority
    must_address = []
    should_prepare = []
    nice_to_have = []

    for analysis in analyses:
        for rec in analysis.recommendations:
            item = f"{rec.text} ({analysis.persona.title})"
            if rec.priority == Severity.HIGH:
                must_address.append(item)
            elif rec.priority == Severity.MEDIUM:
                should_prepare.append(item)
            else:
                nice_to_have.append(item)

    if must_address:
        lines.append("### 🔴 Must Address")
        lines.append("")
        for item in must_address:
            lines.append(f"- [ ] {item}")
        lines.append("")

    if should_prepare:
        lines.append("### 🟡 Should Prepare")
        lines.append("")
        for item in should_prepare:
            lines.append(f"- [ ] {item}")
        lines.append("")

    if nice_to_have:
        lines.append("### 🟢 Nice to Have")
        lines.append("")
        for item in nice_to_have:
            lines.append(f"- [ ] {item}")
        lines.append("")

    lines.append("---")
    lines.append("")

    return "\n".join(lines)


def generate_appendix(content: ExtractionResult, include_full_text: bool = False) -> str:
    """
    Generate the appendix section with optional full transcript/text.

    Args:
        content: Extracted content
        include_full_text: Whether to include full text

    Returns:
        Markdown string for appendix
    """
    if not include_full_text:
        return ""

    lines = ["## Appendix", ""]

    if content.metadata.content_type in [ContentType.VIDEO, ContentType.AUDIO]:
        lines.append("### Full Transcript")
        lines.append("")
        lines.append("<details>")
        lines.append("<summary>Click to expand transcript</summary>")
        lines.append("")
        lines.append("```")
        lines.append(content.text)
        lines.append("```")
        lines.append("")
        lines.append("</details>")
        lines.append("")
    else:
        lines.append("### Extracted Text")
        lines.append("")
        lines.append("<details>")
        lines.append("<summary>Click to expand extracted text</summary>")
        lines.append("")
        lines.append("```")
        lines.append(content.text[:10000])  # Limit to 10k chars
        if len(content.text) > 10000:
            lines.append("... [truncated]")
        lines.append("```")
        lines.append("")
        lines.append("</details>")
        lines.append("")

    return "\n".join(lines)


def generate_report(
    content: ExtractionResult,
    analyses: list[AnalysisResult],
    summary: Optional[str] = None,
    key_topics: Optional[list[str]] = None,
    enable_frame_analysis: bool = False,
    include_appendix: bool = True,
) -> str:
    """
    Generate the complete Markdown report.

    Args:
        content: Extracted content
        analyses: List of analysis results
        summary: Optional content summary
        key_topics: Optional list of key topics
        enable_frame_analysis: Whether frame analysis was enabled
        include_appendix: Whether to include appendix with full text

    Returns:
        Complete Markdown report string
    """
    print_status("Generating report...", "progress")

    sections = [
        generate_header(content, enable_frame_analysis),
        generate_content_summary(content, summary, key_topics),
    ]

    # Add persona sections
    for analysis in analyses:
        sections.append(generate_persona_section(analysis))

    # Add consolidated checklist
    sections.append(generate_checklist(analyses))

    # Add appendix if requested
    if include_appendix:
        sections.append(generate_appendix(content, include_full_text=True))

    report = "\n".join(sections)

    print_status("Report generated successfully", "success")
    return report


def save_report(report: str, output_path: Path) -> Path:
    """
    Save the report to a file.

    Args:
        report: Markdown report content
        output_path: Path to save the report

    Returns:
        Path to saved report
    """
    # Ensure parent directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report)

    print_status(f"Report saved: {output_path}", "success")
    return output_path
