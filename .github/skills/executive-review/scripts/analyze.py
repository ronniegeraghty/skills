"""
Executive persona analysis module for the Executive Review skill.

Analyzes content through the lens of different executive personas
to generate questions, concerns, and recommendations.
"""

from typing import Optional

from .constants import (
    CONTENT_SUMMARY_PROMPT,
    EXECUTIVE_PERSONAS,
    PERSONA_ANALYSIS_PROMPT,
)
from .types import (
    AnalysisResult,
    Concern,
    ExecutivePersona,
    ExtractionResult,
    PersonaType,
    Question,
    QuestionCategory,
    Recommendation,
    Risk,
    Severity,
    UserPreferences,
)
from .utils import print_status, truncate_text


def get_persona(persona_type: PersonaType) -> ExecutivePersona:
    """
    Get an executive persona by type.

    Args:
        persona_type: The type of persona to retrieve

    Returns:
        ExecutivePersona definition
    """
    return EXECUTIVE_PERSONAS[persona_type]


def build_content_summary_prompt(content: ExtractionResult) -> str:
    """
    Build a prompt for summarizing content.

    Args:
        content: Extracted content to summarize

    Returns:
        Formatted prompt string
    """
    # Truncate content if too long
    text = truncate_text(content.text, max_length=10000)

    return CONTENT_SUMMARY_PROMPT.format(content=text)


def build_persona_analysis_prompt(
    persona: ExecutivePersona,
    content: ExtractionResult,
    content_summary: str,
) -> str:
    """
    Build a prompt for persona-based analysis.

    Args:
        persona: The executive persona to analyze as
        content: Extracted content
        content_summary: Pre-generated summary of the content

    Returns:
        Formatted prompt string
    """
    # Truncate content if too long
    text = truncate_text(content.text, max_length=8000)

    return PERSONA_ANALYSIS_PROMPT.format(
        persona_title=persona.title,
        persona_name=persona.name,
        focus_areas=", ".join(persona.focus_areas),
        perspective=persona.perspective,
        key_concerns="\n".join(f"- {c}" for c in persona.key_concerns),
        content_summary=content_summary,
        content=text,
    )


def analyze_for_persona(
    content: ExtractionResult,
    persona: ExecutivePersona,
    content_summary: Optional[str] = None,
) -> AnalysisResult:
    """
    Generate analysis for a single executive persona.

    This function creates a structured analysis of how a specific
    executive would view the content, including questions they would
    ask, concerns they would raise, and recommendations.

    Note: This is a template implementation. In production, this would
    call an LLM API. For agent usage, the agent will perform this
    analysis using its own capabilities.

    Args:
        content: Extracted content to analyze
        persona: Executive persona to analyze as
        content_summary: Optional pre-generated summary

    Returns:
        AnalysisResult with questions, concerns, and recommendations
    """
    print_status(f"Analyzing as {persona.title}...", "progress")

    # Generate analysis based on persona focus areas
    # This is a template - the actual analysis would be done by the agent
    # or by calling an LLM API

    questions = _generate_persona_questions(persona, content)
    concerns = _generate_persona_concerns(persona, content)
    followups = _generate_persona_followups(persona)
    risks = _generate_persona_risks(persona, content)
    recommendations = _generate_persona_recommendations(persona)

    return AnalysisResult(
        persona=persona,
        questions=questions,
        concerns=concerns,
        followups=followups,
        risks=risks,
        recommendations=recommendations,
    )


def _generate_persona_questions(
    persona: ExecutivePersona, content: ExtractionResult
) -> list[Question]:
    """Generate questions based on persona's key concerns."""
    questions = []

    # Map persona concerns to question categories
    category_map = {
        PersonaType.CEO: QuestionCategory.STRATEGIC,
        PersonaType.CFO: QuestionCategory.FINANCIAL,
        PersonaType.CTO: QuestionCategory.TECHNICAL,
        PersonaType.VP_PRODUCT: QuestionCategory.STRATEGIC,
        PersonaType.CISO: QuestionCategory.SECURITY,
        PersonaType.VP_OPERATIONS: QuestionCategory.OPERATIONAL,
    }

    default_category = category_map.get(persona.type, QuestionCategory.STRATEGIC)

    for concern in persona.key_concerns[:5]:
        questions.append(
            Question(
                text=concern,
                category=default_category,
                reasoning=f"As {persona.title}, this is a core area of responsibility.",
                suggested_response=(
                    f"Prepare data and examples that address this from a "
                    f"{persona.title} perspective, focusing on {persona.focus_areas[0]}."
                ),
            )
        )

    return questions


def _generate_persona_concerns(
    persona: ExecutivePersona, content: ExtractionResult
) -> list[Concern]:
    """Generate concerns based on persona's focus areas."""
    concerns = []

    # Generate concerns based on focus areas
    for i, focus_area in enumerate(persona.focus_areas[:3]):
        severity = Severity.HIGH if i == 0 else (Severity.MEDIUM if i == 1 else Severity.LOW)
        concerns.append(
            Concern(
                title=f"{focus_area} Assessment",
                description=f"Content should address {focus_area.lower()} considerations.",
                severity=severity,
                why_it_matters=(
                    f"As {persona.title}, {focus_area.lower()} is a critical "
                    f"factor in evaluating any initiative."
                ),
            )
        )

    return concerns


def _generate_persona_followups(persona: ExecutivePersona) -> list[str]:
    """Generate expected follow-up requests."""
    followups = {
        PersonaType.CEO: [
            "Schedule a strategic alignment review with leadership team",
            "Provide competitive analysis and market positioning data",
            "Present 3-year impact projection",
        ],
        PersonaType.CFO: [
            "Provide detailed TCO breakdown",
            "Submit ROI analysis with assumptions documented",
            "Present budget allocation proposal",
        ],
        PersonaType.CTO: [
            "Provide architectural documentation",
            "Schedule technical deep-dive with engineering team",
            "Present integration assessment and timeline",
        ],
        PersonaType.VP_PRODUCT: [
            "Present user research and feedback data",
            "Provide roadmap impact analysis",
            "Schedule product strategy alignment meeting",
        ],
        PersonaType.CISO: [
            "Submit security assessment documentation",
            "Provide compliance certification details",
            "Present data flow and access control diagrams",
        ],
        PersonaType.VP_OPERATIONS: [
            "Provide implementation timeline and milestones",
            "Submit training and change management plan",
            "Present operational impact assessment",
        ],
    }

    return followups.get(persona.type, ["Schedule follow-up meeting"])


def _generate_persona_risks(
    persona: ExecutivePersona, content: ExtractionResult
) -> list[Risk]:
    """Generate risks from persona's perspective."""
    risks = []

    # Generate 2 risks based on persona focus
    focus_area = persona.focus_areas[0]
    risks.append(
        Risk(
            title=f"{focus_area} Risk",
            impact=f"Failure to address {focus_area.lower()} could impact initiative success.",
            mitigation=(
                f"Ensure {focus_area.lower()} requirements are documented and validated "
                f"before proceeding."
            ),
        )
    )

    return risks


def _generate_persona_recommendations(persona: ExecutivePersona) -> list[Recommendation]:
    """Generate recommendations for presenter."""
    recommendations = [
        Recommendation(
            text=(
                f"Lead with {persona.focus_areas[0].lower()} to capture "
                f"{persona.title} attention."
            ),
            priority=Severity.HIGH,
        ),
        Recommendation(
            text=f"Prepare quantifiable metrics related to {persona.focus_areas[1].lower()}.",
            priority=Severity.MEDIUM,
        ),
        Recommendation(
            text=f"Anticipate questions about {persona.focus_areas[2].lower()}.",
            priority=Severity.MEDIUM,
        ),
    ]

    return recommendations


def analyze_content(
    content: ExtractionResult,
    personas: list[PersonaType],
    preferences: Optional[UserPreferences] = None,
) -> list[AnalysisResult]:
    """
    Analyze content through multiple executive personas.

    Args:
        content: Extracted content to analyze
        personas: List of persona types to analyze as
        preferences: Optional user preferences

    Returns:
        List of AnalysisResult, one per persona
    """
    print_status(f"Analyzing content for {len(personas)} personas", "progress")

    results = []
    for persona_type in personas:
        persona = get_persona(persona_type)
        result = analyze_for_persona(content, persona)
        results.append(result)

    print_status(f"Analysis complete: {len(results)} persona analyses", "success")
    return results


def get_consolidated_questions(analyses: list[AnalysisResult]) -> list[Question]:
    """
    Get all questions from all analyses, deduplicated.

    Args:
        analyses: List of analysis results

    Returns:
        Consolidated list of unique questions
    """
    seen_texts = set()
    questions = []

    for analysis in analyses:
        for question in analysis.questions:
            if question.text not in seen_texts:
                seen_texts.add(question.text)
                questions.append(question)

    return questions


def get_consolidated_concerns(analyses: list[AnalysisResult]) -> list[Concern]:
    """
    Get all concerns from all analyses, sorted by severity.

    Args:
        analyses: List of analysis results

    Returns:
        Consolidated list of concerns, highest severity first
    """
    concerns = []
    for analysis in analyses:
        concerns.extend(analysis.concerns)

    # Sort by severity (HIGH first)
    severity_order = {Severity.HIGH: 0, Severity.MEDIUM: 1, Severity.LOW: 2}
    concerns.sort(key=lambda c: severity_order.get(c.severity, 3))

    return concerns
