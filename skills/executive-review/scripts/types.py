"""
Type definitions for the Executive Review skill.

Uses Pydantic models for validation and serialization.
"""

from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field


class ContentType(str, Enum):
    """Supported content types for analysis."""

    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"
    PRESENTATION = "presentation"


class UserType(str, Enum):
    """Types of users who may use this skill."""

    SALES_ENGINEER = "sales_engineer"
    PRODUCT_MANAGER = "product_manager"
    DEVELOPER = "developer"
    TECHNICAL_WRITER = "technical_writer"
    MARKETING = "marketing"
    SOLUTIONS_ARCHITECT = "solutions_architect"


class PersonaType(str, Enum):
    """Executive persona types."""

    CEO = "ceo"
    CFO = "cfo"
    CTO = "cto"
    VP_PRODUCT = "vp_product"
    CISO = "ciso"
    VP_OPERATIONS = "vp_operations"


class QuestionCategory(str, Enum):
    """Categories for executive questions."""

    STRATEGIC = "strategic"
    TECHNICAL = "technical"
    FINANCIAL = "financial"
    OPERATIONAL = "operational"
    SECURITY = "security"
    TIMELINE = "timeline"
    INTEGRATION = "integration"
    RISK = "risk"


class Severity(str, Enum):
    """Severity levels for concerns."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# ============================================================================
# Extraction Models
# ============================================================================


class TimestampedSegment(BaseModel):
    """A segment of transcript with timing information."""

    start: float = Field(description="Start time in seconds")
    end: float = Field(description="End time in seconds")
    text: str = Field(description="Transcribed text")


class SlideContent(BaseModel):
    """Content extracted from a presentation slide."""

    slide_number: int
    title: Optional[str] = None
    text: str = Field(description="All text content from the slide")
    notes: Optional[str] = Field(default=None, description="Speaker notes")
    image_path: Optional[Path] = Field(default=None, description="Path to slide image")


class ExtractionMetadata(BaseModel):
    """Metadata about the extracted content."""

    file_path: Path
    file_name: str
    file_size_bytes: int
    content_type: ContentType
    extracted_at: datetime = Field(default_factory=datetime.now)
    duration_seconds: Optional[float] = Field(default=None, description="For video/audio")
    page_count: Optional[int] = Field(default=None, description="For documents")
    slide_count: Optional[int] = Field(default=None, description="For presentations")
    language: Optional[str] = Field(default=None, description="Detected language")


class ExtractionResult(BaseModel):
    """Result of content extraction."""

    metadata: ExtractionMetadata
    text: str = Field(description="Full extracted text content")
    segments: Optional[list[TimestampedSegment]] = Field(
        default=None, description="Timestamped segments for audio/video"
    )
    slides: Optional[list[SlideContent]] = Field(
        default=None, description="Slide content for presentations"
    )
    image_paths: list[Path] = Field(
        default_factory=list, description="Paths to extracted images/frames"
    )


# ============================================================================
# Persona Models
# ============================================================================


class ExecutivePersona(BaseModel):
    """Definition of an executive persona."""

    type: PersonaType
    name: str = Field(description="Display name, e.g., 'Chief Executive Officer'")
    title: str = Field(description="Short title, e.g., 'CEO'")
    focus_areas: list[str] = Field(description="Areas this persona focuses on")
    question_style: str = Field(description="How this persona asks questions")
    key_concerns: list[str] = Field(description="Primary concerns")
    perspective: str = Field(description="How they view content")


# ============================================================================
# Analysis Models
# ============================================================================


class Question(BaseModel):
    """A question an executive would ask."""

    text: str = Field(description="The question itself")
    category: QuestionCategory
    reasoning: str = Field(description="Why they would ask this")
    suggested_response: str = Field(description="How to prepare for this question")


class Concern(BaseModel):
    """A concern identified by the executive persona."""

    title: str
    description: str
    severity: Severity
    why_it_matters: str


class Risk(BaseModel):
    """A risk identified in the content."""

    title: str
    impact: str
    mitigation: str


class Recommendation(BaseModel):
    """A recommendation for the presenter."""

    text: str
    priority: Severity


class AnalysisResult(BaseModel):
    """Analysis result for a single persona."""

    persona: ExecutivePersona
    questions: list[Question] = Field(default_factory=list)
    concerns: list[Concern] = Field(default_factory=list)
    followups: list[str] = Field(default_factory=list, description="Expected follow-up requests")
    risks: list[Risk] = Field(default_factory=list)
    recommendations: list[Recommendation] = Field(default_factory=list)


# ============================================================================
# User Preferences
# ============================================================================


class UserPreferences(BaseModel):
    """User preferences for the review."""

    personas: list[PersonaType] = Field(description="Selected executive personas")
    enable_frame_analysis: bool = Field(
        default=False, description="Whether to analyze video frames"
    )
    focus_areas: list[str] = Field(
        default_factory=list, description="Specific areas to focus on"
    )
    user_type: Optional[UserType] = Field(
        default=None, description="Type of user for tailored output"
    )
    output_path: Optional[Path] = Field(
        default=None, description="Where to save the report"
    )


# ============================================================================
# Report Models
# ============================================================================


class ChecklistItem(BaseModel):
    """An item in the preparation checklist."""

    text: str
    priority: Severity


class ReviewReport(BaseModel):
    """Complete review report."""

    title: str
    generated_at: datetime = Field(default_factory=datetime.now)
    content_summary: str
    content_type: ContentType
    metadata: ExtractionMetadata
    key_topics: list[str]
    visual_elements: list[str] = Field(
        default_factory=list, description="Notable visual elements"
    )
    persona_analyses: list[AnalysisResult]
    must_address: list[ChecklistItem] = Field(default_factory=list)
    should_prepare: list[ChecklistItem] = Field(default_factory=list)
    nice_to_have: list[ChecklistItem] = Field(default_factory=list)
