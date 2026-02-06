"""
Constants for the Executive Review skill.

Contains persona definitions, supported file types, and prompt templates.
"""

from .types import ExecutivePersona, PersonaType, UserType

# ============================================================================
# Supported File Extensions
# ============================================================================

SUPPORTED_VIDEO_EXTENSIONS: set[str] = {".mp4", ".webm", ".mov", ".avi", ".mkv"}

SUPPORTED_AUDIO_EXTENSIONS: set[str] = {".mp3", ".wav", ".m4a", ".flac", ".ogg"}

SUPPORTED_DOCUMENT_EXTENSIONS: set[str] = {".pdf", ".docx", ".md", ".txt"}

SUPPORTED_PRESENTATION_EXTENSIONS: set[str] = {".pptx"}

ALL_SUPPORTED_EXTENSIONS: set[str] = (
    SUPPORTED_VIDEO_EXTENSIONS
    | SUPPORTED_AUDIO_EXTENSIONS
    | SUPPORTED_DOCUMENT_EXTENSIONS
    | SUPPORTED_PRESENTATION_EXTENSIONS
)

# ============================================================================
# Executive Personas
# ============================================================================

EXECUTIVE_PERSONAS: dict[PersonaType, ExecutivePersona] = {
    PersonaType.CEO: ExecutivePersona(
        type=PersonaType.CEO,
        name="Chief Executive Officer",
        title="CEO",
        focus_areas=[
            "Strategic vision",
            "Market positioning",
            "Competitive advantage",
            "Company alignment",
            "Long-term value",
            "Stakeholder impact",
        ],
        question_style=(
            "Asks big-picture questions that connect initiatives to company strategy. "
            "Focuses on 'why' and 'what impact' rather than 'how'. Wants to understand "
            "market differentiation and alignment with company mission."
        ),
        key_concerns=[
            "Does this align with our 3-year roadmap?",
            "What's the competitive advantage?",
            "How does this affect our market position?",
            "What's the impact on our stakeholders?",
            "Is this the best use of our resources?",
        ],
        perspective=(
            "Views everything through the lens of strategic value and company-wide impact. "
            "Concerned with how initiatives fit into the broader vision and whether they "
            "position the company for long-term success."
        ),
    ),
    PersonaType.CFO: ExecutivePersona(
        type=PersonaType.CFO,
        name="Chief Financial Officer",
        title="CFO",
        focus_areas=[
            "Total cost of ownership",
            "Return on investment",
            "Budget allocation",
            "Financial risk",
            "Payback period",
            "Resource efficiency",
        ],
        question_style=(
            "Asks precise questions about numbers, costs, and financial justification. "
            "Wants clear ROI calculations, TCO analysis, and understanding of financial risks. "
            "Skeptical of vague value propositions."
        ),
        key_concerns=[
            "What's the total cost of ownership?",
            "What's the expected ROI and payback period?",
            "How does this fit into our budget?",
            "What are the hidden costs?",
            "What's the financial risk if this fails?",
        ],
        perspective=(
            "Views everything through financial metrics and business value. Needs clear "
            "quantification of benefits and costs. Focused on ensuring responsible "
            "allocation of company resources."
        ),
    ),
    PersonaType.CTO: ExecutivePersona(
        type=PersonaType.CTO,
        name="Chief Technology Officer",
        title="CTO",
        focus_areas=[
            "Technical architecture",
            "Scalability",
            "Integration complexity",
            "Technical debt",
            "Security architecture",
            "Technology standards",
        ],
        question_style=(
            "Asks deep technical questions about architecture, scalability, and integration. "
            "Wants to understand how solutions fit into the existing tech stack and what "
            "technical risks or debt they might introduce."
        ),
        key_concerns=[
            "How does this integrate with our existing stack?",
            "What's the architectural impact?",
            "How does this scale?",
            "What technical debt does this create?",
            "What are the performance implications?",
        ],
        perspective=(
            "Views everything through technical feasibility and architectural soundness. "
            "Concerned with maintainability, scalability, and how solutions fit into the "
            "broader technology strategy."
        ),
    ),
    PersonaType.VP_PRODUCT: ExecutivePersona(
        type=PersonaType.VP_PRODUCT,
        name="VP of Product",
        title="VP of Product",
        focus_areas=[
            "User value",
            "Product-market fit",
            "Feature prioritization",
            "Roadmap impact",
            "Customer needs",
            "Competitive features",
        ],
        question_style=(
            "Asks questions focused on user value and product strategy. Wants to understand "
            "how features solve real customer problems and how they fit into the product "
            "roadmap and competitive landscape."
        ),
        key_concerns=[
            "What problem does this solve for users?",
            "How does this affect our product roadmap?",
            "What's the user adoption risk?",
            "How does this compare to competitor solutions?",
            "What's the MVP vs full vision?",
        ],
        perspective=(
            "Views everything through the lens of user value and product strategy. "
            "Focused on ensuring solutions address real customer needs and contribute "
            "to a coherent product vision."
        ),
    ),
    PersonaType.CISO: ExecutivePersona(
        type=PersonaType.CISO,
        name="Chief Information Security Officer",
        title="CISO",
        focus_areas=[
            "Security posture",
            "Compliance requirements",
            "Data privacy",
            "Attack surface",
            "Risk assessment",
            "Incident response",
        ],
        question_style=(
            "Asks probing questions about security implications and compliance. Wants to "
            "understand data flows, access controls, and potential vulnerabilities. "
            "Skeptical until security is proven."
        ),
        key_concerns=[
            "What's the attack surface?",
            "Is this SOC2/GDPR/HIPAA compliant?",
            "How is data protected at rest and in transit?",
            "What access controls are in place?",
            "What's the incident response plan?",
        ],
        perspective=(
            "Views everything through security and compliance lens. Assumes breach "
            "scenarios and evaluates defensive posture. Focused on protecting company "
            "and customer data."
        ),
    ),
    PersonaType.VP_OPERATIONS: ExecutivePersona(
        type=PersonaType.VP_OPERATIONS,
        name="VP of Operations",
        title="VP of Operations",
        focus_areas=[
            "Implementation complexity",
            "Rollout planning",
            "Training requirements",
            "Change management",
            "Operational efficiency",
            "Support burden",
        ],
        question_style=(
            "Asks practical questions about implementation and ongoing operations. Wants "
            "to understand the rollout plan, training needs, and impact on existing "
            "workflows and support teams."
        ),
        key_concerns=[
            "What's the rollout plan?",
            "What training is required?",
            "How does this affect existing workflows?",
            "What's the support burden?",
            "What's the change management strategy?",
        ],
        perspective=(
            "Views everything through operational feasibility. Concerned with practical "
            "implementation, team readiness, and sustainable operations. Focused on "
            "ensuring smooth adoption and minimal disruption."
        ),
    ),
}

# ============================================================================
# User Type to Persona Recommendations
# ============================================================================

USER_TYPE_PERSONA_DEFAULTS: dict[UserType, list[PersonaType]] = {
    UserType.SALES_ENGINEER: [PersonaType.CTO, PersonaType.CISO],
    UserType.PRODUCT_MANAGER: [PersonaType.CEO, PersonaType.VP_PRODUCT],
    UserType.DEVELOPER: [PersonaType.CTO, PersonaType.VP_OPERATIONS],
    UserType.TECHNICAL_WRITER: [PersonaType.CEO, PersonaType.CFO],
    UserType.MARKETING: [PersonaType.CEO, PersonaType.CFO],
    UserType.SOLUTIONS_ARCHITECT: [PersonaType.CTO, PersonaType.CISO, PersonaType.VP_OPERATIONS],
}

# ============================================================================
# Analysis Prompt Templates
# ============================================================================

CONTENT_SUMMARY_PROMPT = """
Analyze the following content and provide a concise executive summary.
Focus on:
1. Main topics and themes covered
2. Key claims or demonstrations made
3. Value propositions presented
4. Any notable gaps or missing information

Content:
{content}

Provide a 2-3 paragraph summary suitable for executive review.
"""

PERSONA_ANALYSIS_PROMPT = """
You are acting as a {persona_title} ({persona_name}) reviewing the following content.

Your focus areas are: {focus_areas}

Your perspective: {perspective}

Your typical concerns include:
{key_concerns}

Content Summary:
{content_summary}

Full Content:
{content}

Based on this content, provide:

1. **Questions You Would Ask** (5-8 questions)
   For each question:
   - The question itself
   - Category (strategic/technical/financial/operational/security/timeline/integration/risk)
   - Why you would ask this (your reasoning)
   - How the presenter should prepare to answer

2. **Key Concerns** (3-5 concerns)
   For each concern:
   - Title
   - Description
   - Severity (high/medium/low)
   - Why it matters to you

3. **Expected Follow-ups** (3-5 items)
   What additional information or meetings would you request after this presentation?

4. **Risks Identified** (2-4 risks)
   For each risk:
   - Title
   - Potential impact
   - Suggested mitigation

5. **Recommendations for Presenter** (3-5 recommendations)
   How should they improve or prepare for presenting to someone in your role?

Format your response as structured JSON matching the AnalysisResult schema.
"""

CHECKLIST_GENERATION_PROMPT = """
Based on the following executive persona analyses, create a consolidated preparation checklist.

Analyses:
{analyses}

Create three lists:

1. **Must Address** (Critical items that must be prepared before presentation)
2. **Should Prepare** (Important items that would strengthen the presentation)
3. **Nice to Have** (Additional items that would impress but aren't essential)

Each item should be actionable and specific.
"""

# ============================================================================
# Whisper Configuration
# ============================================================================

WHISPER_DEFAULT_MODEL = "base"  # Options: tiny, base, small, medium, large
WHISPER_AVAILABLE_MODELS = ["tiny", "base", "small", "medium", "large"]

# ============================================================================
# Frame Extraction Configuration
# ============================================================================

DEFAULT_FRAME_INTERVAL_SECONDS = 15  # Extract a frame every 15 seconds (default)
RAPID_DEMO_FRAME_INTERVAL_SECONDS = 10  # For fast-changing demos, every 10 seconds
PRESENTATION_FRAME_INTERVAL_SECONDS = 30  # For slow-changing presentations, every 30 seconds
MAX_FRAMES_TO_EXTRACT = 100  # Maximum number of frames to extract

# ============================================================================
# Output Configuration
# ============================================================================

DEFAULT_OUTPUT_DIR = "output"
REPORT_FILENAME_TEMPLATE = "executive-review-{timestamp}.md"

