#!/usr/bin/env npx tsx
/**
 * Generate Markdown Sprint update memo.
 *
 * This script reads analysis.json and generates a formatted Markdown memo.
 *
 * Usage:
 *   pnpm exec tsx scripts/report.ts
 */

import {
  CATEGORY_ORDER,
  EPIC_TO_CATEGORY,
  RAG_EMOJI,
  STATUS_EMOJI,
  TRACKED_LABELS,
} from "./constants.ts";
import type {
  MemoData,
  MilestoneRow,
  ProjectItem,
  RAGStatus,
  RiskRow,
  StatusCounts,
} from "./types.ts";
import {
  formatDateLong,
  getOutputFilePath,
  logInfo,
  logSection,
  logSuccess,
  readOutputJson,
  writeMarkdown,
} from "./utils.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Input data from analysis.json.
 */
interface AnalysisInput {
  sprintNumber: number;
  sprintTitle: string;
  startDate: string;
  endDate: string;
  totalItems: number;
  statusCounts: StatusCounts;
  ragStatus: RAGStatus;
  ragReason: string;
  completionPercentage: number;
  itemsByEpic: Record<string, ProjectItem[]>;
  blockedItems: ProjectItem[];
  completedItems: ProjectItem[];
  inProgressItems: ProjectItem[];
  todoItems: ProjectItem[];
  nextSprintItems: ProjectItem[];
  bugBashItems: ProjectItem[];
  stats: {
    totalDone: number;
    totalInProgress: number;
    totalTodo: number;
    totalBlocked: number;
    bugBashCount: number;
  };
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Get status display string with emoji.
 */
function getStatusDisplay(status: string | null): string {
  if (!status) return "❓ Unknown";
  return STATUS_EMOJI[status] || status;
}

/**
 * Get category display name from Epic.
 */
function getCategoryName(epic: string): string {
  return EPIC_TO_CATEGORY[epic] || epic;
}

/**
 * Check if item has bug bash label.
 */
function hasBugBashLabel(item: ProjectItem): boolean {
  return item.labels.some(
    (label) => label.toLowerCase() === TRACKED_LABELS.BUG_BASH.toLowerCase()
  );
}

/**
 * Get scenario labels from item.
 */
function getScenarioLabels(item: ProjectItem): string[] {
  return item.labels.filter((label) =>
    label.toLowerCase().startsWith(TRACKED_LABELS.SCENARIO_PREFIX.toLowerCase())
  );
}

/**
 * Extract a brief summary from issue body content.
 * Looks for key information like problem description, solution, or outcome.
 */
function extractSummaryFromBody(body: string | undefined, maxLength: number = 100): string {
  if (!body) return "";

  // Clean up the body - remove markdown headers, links, and excessive whitespace
  let cleaned = body
    .replace(/^#+\s+.*$/gm, "") // Remove headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Convert links to text
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/`[^`]+`/g, "") // Remove inline code
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

  // Try to find meaningful content
  // Look for "What", "Problem", "Solution", "Done", "Completed", "Fixed" patterns
  const meaningfulPatterns = [
    /(?:completed|done|fixed|resolved|implemented|added|updated|created)[:.\s]+([^.\n]+)/i,
    /(?:what|problem|issue|bug)[:.\s]+([^.\n]+)/i,
    /(?:solution|fix|resolution)[:.\s]+([^.\n]+)/i,
  ];

  for (const pattern of meaningfulPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1] && match[1].length > 10) {
      const summary = match[1].trim();
      if (summary.length <= maxLength) {
        return summary;
      }
      return summary.substring(0, maxLength - 3) + "...";
    }
  }

  // If no pattern matches, take first meaningful line
  const lines = cleaned.split("\n").filter((l) => l.trim().length > 10);
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.length <= maxLength) {
      return firstLine;
    }
    return firstLine.substring(0, maxLength - 3) + "...";
  }

  return "";
}

/**
 * Generate notes for an item based on its status, labels, and body content.
 */
function generateNotes(item: ProjectItem): string {
  const notes: string[] = [];

  // Add scenario labels
  const scenarios = getScenarioLabels(item);
  if (scenarios.length > 0) {
    notes.push(scenarios.join(", "));
  }

  // Add special labels
  if (item.labels.includes(TRACKED_LABELS.MGMT)) {
    notes.push("Management plane");
  }
  if (item.labels.includes(TRACKED_LABELS.AZSDK_CLI)) {
    notes.push("CLI mode");
  }
  if (item.labels.includes(TRACKED_LABELS.CENTRAL_ENGSYS)) {
    notes.push("Central Eng Sys");
  }

  // For blocked items, try to extract blocker info from body
  if (item.status === "Blocked") {
    const blockerInfo = extractBlockerFromBody(item.body);
    if (blockerInfo) {
      notes.push(`⚠️ ${blockerInfo}`);
    } else {
      notes.push("⚠️ Blocked - needs resolution");
    }
  }

  // For completed items, try to add a brief summary of what was done
  if (item.status === "Done" && notes.length === 0) {
    const summary = extractSummaryFromBody(item.body, 60);
    if (summary) {
      notes.push(summary);
    }
  }

  return notes.join("; ");
}

/**
 * Extract blocker information from issue body.
 */
function extractBlockerFromBody(body: string | undefined): string | null {
  if (!body) return null;

  // Look for "blocked by", "waiting on", "depends on" patterns
  const blockerPatterns = [
    /blocked\s+(?:by|on)[:.\s]+([^.\n]+)/i,
    /waiting\s+(?:on|for)[:.\s]+([^.\n]+)/i,
    /depends\s+on[:.\s]+([^.\n]+)/i,
    /blocker[:.\s]+([^.\n]+)/i,
  ];

  for (const pattern of blockerPatterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      const blocker = match[1].trim();
      if (blocker.length > 80) {
        return blocker.substring(0, 77) + "...";
      }
      return blocker;
    }
  }

  return null;
}

/**
 * Generate milestone rows from items grouped by Epic.
 */
function generateMilestones(
  itemsByEpic: Record<string, ProjectItem[]>
): MilestoneRow[] {
  const rows: MilestoneRow[] = [];

  // Process in category order
  for (const epic of CATEGORY_ORDER) {
    const items = itemsByEpic[epic];
    if (!items || items.length === 0) continue;

    const categoryName = getCategoryName(epic);

    // Sort items: Done first, then In Progress, then Todo, then Blocked
    const sortedItems = [...items].sort((a, b) => {
      const order: Record<string, number> = {
        Done: 0,
        "In Progress": 1,
        Todo: 2,
        Blocked: 3,
        "Needs Triage": 4,
      };
      const aOrder = order[a.status || ""] ?? 5;
      const bOrder = order[b.status || ""] ?? 5;
      return aOrder - bOrder;
    });

    for (const item of sortedItems) {
      // Skip Needs Triage items
      if (item.status === "Needs Triage") continue;

      rows.push({
        category: categoryName,
        task: item.title,
        status: getStatusDisplay(item.status),
        bugBash: hasBugBashLabel(item) ? "✅" : "",
        notes: generateNotes(item),
        issueUrl: item.issueUrl,
      });
    }
  }

  // Handle uncategorized items
  const uncategorized = itemsByEpic["Uncategorized"];
  if (uncategorized && uncategorized.length > 0) {
    for (const item of uncategorized) {
      if (item.status === "Needs Triage") continue;

      rows.push({
        category: "Other",
        task: item.title,
        status: getStatusDisplay(item.status),
        bugBash: hasBugBashLabel(item) ? "✅" : "",
        notes: generateNotes(item),
        issueUrl: item.issueUrl,
      });
    }
  }

  return rows;
}

/**
 * Generate risk rows from blocked items with content from issue body.
 */
function generateRisks(blockedItems: ProjectItem[]): RiskRow[] {
  if (blockedItems.length === 0) {
    return [
      {
        risk: "No significant risks identified",
        impact: "N/A",
        mitigation: "Continue monitoring Sprint progress",
      },
    ];
  }

  return blockedItems.map((item) => {
    // Try to extract blocker details from body
    const blockerInfo = extractBlockerFromBody(item.body);
    const impactInfo = extractImpactFromBody(item.body);
    const mitigationInfo = extractMitigationFromBody(item.body);

    return {
      risk: blockerInfo 
        ? `${item.title}: ${blockerInfo}`
        : `"${item.title}" is blocked`,
      impact: impactInfo || "Delays Sprint completion and dependent work",
      mitigation: mitigationInfo || "Investigating blockers and escalating as needed",
    };
  });
}

/**
 * Extract impact information from issue body.
 */
function extractImpactFromBody(body: string | undefined): string | null {
  if (!body) return null;

  const impactPatterns = [
    /impact[:.\s]+([^.\n]+)/i,
    /affects[:.\s]+([^.\n]+)/i,
    /consequence[:.\s]+([^.\n]+)/i,
  ];

  for (const pattern of impactPatterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      const impact = match[1].trim();
      if (impact.length > 80) {
        return impact.substring(0, 77) + "...";
      }
      return impact;
    }
  }

  return null;
}

/**
 * Extract mitigation information from issue body.
 */
function extractMitigationFromBody(body: string | undefined): string | null {
  if (!body) return null;

  const mitigationPatterns = [
    /mitigation[:.\s]+([^.\n]+)/i,
    /workaround[:.\s]+([^.\n]+)/i,
    /next\s+step[s]?[:.\s]+([^.\n]+)/i,
    /plan[:.\s]+([^.\n]+)/i,
  ];

  for (const pattern of mitigationPatterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      const mitigation = match[1].trim();
      if (mitigation.length > 80) {
        return mitigation.substring(0, 77) + "...";
      }
      return mitigation;
    }
  }

  return null;
}

/**
 * Generate next steps from in-progress, todo, and next Sprint items.
 */
function generateNextSteps(
  inProgressItems: ProjectItem[],
  todoItems: ProjectItem[],
  nextSprintItems: ProjectItem[],
  nextSprintNumber: number
): string[] {
  const steps: string[] = [];

  // Group in-progress items by category
  const inProgressByCategory = new Map<string, string[]>();
  for (const item of inProgressItems) {
    const category = getCategoryName(item.epic || "Other");
    const existing = inProgressByCategory.get(category) || [];
    existing.push(item.title);
    inProgressByCategory.set(category, existing);
  }

  // Add in-progress work
  for (const [category, items] of inProgressByCategory) {
    if (items.length === 1) {
      steps.push(`**${category}**: Complete ${items[0]}`);
    } else {
      steps.push(`**${category}**: Complete ${items.length} in-progress items`);
    }
  }

  // Group todo items by category
  const todoByCategory = new Map<string, string[]>();
  for (const item of todoItems) {
    const category = getCategoryName(item.epic || "Other");
    const existing = todoByCategory.get(category) || [];
    existing.push(item.title);
    todoByCategory.set(category, existing);
  }

  // Add todo work (top priorities)
  for (const [category, items] of todoByCategory) {
    if (items.length <= 2) {
      for (const item of items) {
        steps.push(`**${category}**: ${item}`);
      }
    } else {
      steps.push(`**${category}**: ${items.length} items planned`);
    }
  }

  // Add next Sprint items if available
  if (nextSprintItems.length > 0) {
    const nextByCategory = new Map<string, number>();
    for (const item of nextSprintItems) {
      const category = getCategoryName(item.epic || "Other");
      nextByCategory.set(category, (nextByCategory.get(category) || 0) + 1);
    }

    steps.push(`\n*Sprint ${nextSprintNumber} planned work:*`);
    for (const [category, count] of nextByCategory) {
      steps.push(`**${category}**: ${count} item${count > 1 ? "s" : ""} planned`);
    }
  }

  // Default if no steps
  if (steps.length === 0) {
    steps.push("Continue Sprint work and address any blockers");
    steps.push("Plan and prioritize next Sprint items");
  }

  return steps;
}

/**
 * Generate executive summary with 3-5 full paragraphs based on issue content.
 */
function generateExecutiveSummary(
  analysis: AnalysisInput,
  _highlights?: string
): string[] {
  const { 
    stats, 
    sprintNumber, 
    completionPercentage, 
    ragStatus,
    completedItems,
    inProgressItems,
    blockedItems,
  } = analysis;

  const paragraphs: string[] = [];

  // -------------------------------------------------------------------------
  // Paragraph 1: Sprint Overview and Status
  // -------------------------------------------------------------------------
  let p1 = "";
  
  if (ragStatus === "Green") {
    p1 = `The team delivered strong results in Sprint ${sprintNumber}, completing ${stats.totalDone} work items representing ${completionPercentage}% of the planned scope. `;
  } else if (ragStatus === "Yellow") {
    p1 = `The team made steady progress in Sprint ${sprintNumber}, completing ${stats.totalDone} work items representing ${completionPercentage}% of the planned scope. `;
  } else {
    p1 = `The team faced challenges in Sprint ${sprintNumber}, completing ${stats.totalDone} work items representing ${completionPercentage}% of the planned scope. `;
  }
  
  if (stats.bugBashCount > 0) {
    p1 += `Notably, ${stats.bugBashCount} items from the bug bash were addressed, demonstrating responsiveness to user feedback.`;
  } else {
    p1 += `The work focused on advancing key initiatives across multiple workstreams.`;
  }
  paragraphs.push(p1);

  // -------------------------------------------------------------------------
  // Paragraph 2: Key Completed Work (using actual issue content)
  // -------------------------------------------------------------------------
  const completedSummaries = summarizeCompletedWork(completedItems);
  if (completedSummaries.length > 0) {
    let p2 = "Key accomplishments this Sprint include ";
    p2 += completedSummaries.join(". ") + ". ";
    p2 += `These improvements strengthen the developer experience and move the team closer to its goals for the quarter.`;
    paragraphs.push(p2);
  }

  // -------------------------------------------------------------------------
  // Paragraph 3: Current Focus and In-Progress Work
  // -------------------------------------------------------------------------
  if (stats.totalInProgress > 0) {
    const inProgressSummaries = summarizeInProgressWork(inProgressItems);
    let p3 = `Currently, ${stats.totalInProgress} items are actively being worked on. `;
    if (inProgressSummaries.length > 0) {
      p3 += `Active focus areas include ${inProgressSummaries.join(", ")}. `;
    }
    if (stats.totalTodo > 0) {
      p3 += `Additionally, ${stats.totalTodo} items remain in the backlog ready to be picked up as capacity allows.`;
    }
    paragraphs.push(p3);
  }

  // -------------------------------------------------------------------------
  // Paragraph 4: Risks, Blockers, and Challenges
  // -------------------------------------------------------------------------
  if (blockedItems.length > 0 || ragStatus === "Red") {
    let p4 = "";
    if (blockedItems.length > 0) {
      const blockerSummaries = summarizeBlockedWork(blockedItems);
      p4 = `The team is managing ${blockedItems.length} blocked item${blockedItems.length > 1 ? "s" : ""} that require attention. `;
      if (blockerSummaries.length > 0) {
        p4 += `Blocked work includes ${blockerSummaries.join("; ")}. `;
      }
      p4 += `The team is actively working to resolve these blockers to minimize impact on delivery timelines.`;
    } else if (ragStatus === "Red") {
      p4 = `While no items are formally blocked, the Sprint completion rate of ${completionPercentage}% indicates the team encountered unanticipated complexity or scope changes. The team is reviewing Sprint planning processes to improve predictability in future iterations.`;
    }
    if (p4) paragraphs.push(p4);
  }

  // -------------------------------------------------------------------------
  // Paragraph 5: Looking Ahead
  // -------------------------------------------------------------------------
  let p5 = `Looking ahead, the team will focus on completing the ${stats.totalInProgress} in-progress items and advancing the remaining ${stats.totalTodo} planned tasks. `;
  
  // Identify top priority areas from in-progress work
  const priorityAreas = identifyPriorityAreas(inProgressItems);
  if (priorityAreas.length > 0) {
    p5 += `Priority areas for the coming week include ${priorityAreas.join(", ")}. `;
  }
  p5 += `The team remains committed to delivering value to service teams and improving the developer inner loop experience.`;
  paragraphs.push(p5);

  return paragraphs;
}

/**
 * Summarize completed work using issue titles, descriptions, and comments.
 */
function summarizeCompletedWork(items: ProjectItem[]): string[] {
  const summaries: string[] = [];
  
  // Group by Epic to create themed summaries
  const byEpic = new Map<string, ProjectItem[]>();
  for (const item of items) {
    const epic = item.epic || "Other";
    const existing = byEpic.get(epic) || [];
    existing.push(item);
    byEpic.set(epic, existing);
  }
  
  // Create summary for each area with significant work
  for (const [epic, epicItems] of byEpic) {
    if (epicItems.length === 0) continue;
    
    const categoryName = getCategoryName(epic);
    const summary = createWorkSummary(categoryName, epicItems);
    if (summary) {
      summaries.push(summary);
    }
  }
  
  return summaries.slice(0, 4); // Limit to top 4 themes
}

/**
 * Create a summary statement for a category's completed work.
 */
function createWorkSummary(categoryName: string, items: ProjectItem[]): string | null {
  if (items.length === 0) return null;
  
  // Extract key themes from issue content
  const themes = extractWorkThemes(items);
  
  if (items.length === 1) {
    const item = items[0];
    const description = extractShortDescription(item);
    if (description) {
      return `${description} (${categoryName})`;
    }
    return `completing ${cleanTitle(item.title).toLowerCase()} in ${categoryName}`;
  }
  
  if (themes.length > 0) {
    return `${categoryName} improvements including ${themes.slice(0, 2).join(" and ")}`;
  }
  
  return `${items.length} ${categoryName.toLowerCase()} enhancements`;
}

/**
 * Extract key themes from a list of items based on their content.
 */
function extractWorkThemes(items: ProjectItem[]): string[] {
  const themes: string[] = [];
  
  for (const item of items) {
    const theme = extractThemeFromItem(item);
    if (theme && !themes.includes(theme)) {
      themes.push(theme);
    }
  }
  
  return themes;
}

/**
 * Extract a concise theme description from an item.
 */
function extractThemeFromItem(item: ProjectItem): string | null {
  // Use the cleaned title as theme
  const cleaned = cleanTitle(item.title);
  if (cleaned.length > 10 && cleaned.length < 60) {
    return sanitizeForProse(cleaned.toLowerCase());
  }
  return null;
}

/**
 * Extract a short description from an item's body or title.
 */
function extractShortDescription(item: ProjectItem): string | null {
  // Clean up the title and use it
  const title = cleanTitle(item.title);
  const sanitized = sanitizeForProse(title);
  if (sanitized.length > 10 && sanitized.length < 80) {
    return sanitized.charAt(0).toLowerCase() + sanitized.slice(1);
  }
  return null;
}

/**
 * Sanitize text for use in prose (remove markdown, links, code, etc.)
 */
function sanitizeForProse(text: string): string {
  return text
    // Remove markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove URLs
    .replace(/https?:\/\/[^\s)]+/g, "")
    // Remove markdown formatting
    .replace(/[*_`#]+/g, "")
    // Remove parenthetical content that's empty or just has url fragments
    .replace(/\(\s*\)/g, "")
    .replace(/\([^)]*github[^)]*\)/gi, "")
    // Clean up multiple spaces
    .replace(/\s+/g, " ")
    // Remove leading/trailing punctuation and spaces
    .replace(/^[\s.,;:\-]+/, "")
    .replace(/[\s.,;:\-]+$/, "")
    .trim();
}

/**
 * Clean an issue title by removing tags and prefixes.
 */
function cleanTitle(title: string): string {
  return title
    .replace(/^\[.*?\]\s*/g, "") // Remove [Epic], [Bug Bash], etc.
    .replace(/^(?:Task|Activity|Epic)[:.\s]*/i, "") // Remove Task:, Activity:, etc.
    .trim();
}

/**
 * Summarize in-progress work areas.
 */
function summarizeInProgressWork(items: ProjectItem[]): string[] {
  const areas = new Map<string, number>();
  
  for (const item of items) {
    const category = getCategoryName(item.epic || "Other");
    areas.set(category, (areas.get(category) || 0) + 1);
  }
  
  const summaries: string[] = [];
  for (const [category, count] of areas) {
    if (count === 1) {
      summaries.push(category.toLowerCase());
    } else {
      summaries.push(`${category.toLowerCase()} (${count} items)`);
    }
  }
  
  return summaries.slice(0, 3);
}

/**
 * Summarize blocked work.
 */
function summarizeBlockedWork(items: ProjectItem[]): string[] {
  return items.slice(0, 2).map(item => {
    const title = cleanTitle(item.title);
    if (title.length > 50) {
      return title.substring(0, 47) + "...";
    }
    return title;
  });
}

/**
 * Identify priority focus areas from in-progress items.
 */
function identifyPriorityAreas(items: ProjectItem[]): string[] {
  const areas = new Map<string, number>();
  
  for (const item of items) {
    const category = getCategoryName(item.epic || "Other");
    areas.set(category, (areas.get(category) || 0) + 1);
  }
  
  // Sort by count and return top areas
  const sorted = [...areas.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category.toLowerCase());
  
  return sorted;
}

/**
 * Generate value delivered bullet points from completed items.
 * Groups by category and highlights key achievements.
 */
function generateValueDelivered(completedItems: ProjectItem[]): string[] {
  const values: string[] = [];
  
  // Group completed items by Epic/category (using display name)
  const byCategory = new Map<string, ProjectItem[]>();
  for (const item of completedItems) {
    const rawEpic = item.epic || "General";
    // Map to display category name
    const category = EPIC_TO_CATEGORY[rawEpic] || rawEpic.replace(/^\d+\.?\s*/, "").trim() || "General";
    const existing = byCategory.get(category) || [];
    existing.push(item);
    byCategory.set(category, existing);
  }
  
  // Generate value statements for each category with impactful work
  for (const [category, items] of byCategory) {
    const statement = generateCategoryValue(category, items);
    if (statement) {
      values.push(statement);
    }
  }

  return values.slice(0, 8);
}

/**
 * Generate a value statement for a category based on completed items.
 */
function generateCategoryValue(category: string, items: ProjectItem[]): string | null {
  if (items.length === 0) return null;
  
  // Analyze the types of work completed
  const workTypes = analyzeWorkTypes(items);
  
  // Generate statement based on category and work types
  const categoryStatements: Record<string, string> = {
    "TypeSpec Authoring": "Service teams can now author TypeSpec more effectively with enhanced Azure knowledge base support",
    "Environment Setup": "Developers experience smoother environment setup with improved tooling and configuration",
    "SDK Generation": "SDK generation workflow is now more reliable with improved tool coordination",
    "SDK Code Customization": "Teams have better control over SDK customizations with new detection and guidance features",
    "Testing": "Test workflows are more robust with enhanced runner capabilities",
    "Samples & Sample Generation": "Developers can generate samples more efficiently with improved tooling",
    "Package Metadata & Docs Updates": "Package documentation and changelogs are now generated more accurately",
    "Validation": "Validation workflows provide clearer feedback for service teams",
    "Releasing": "Release process is streamlined with new planning and tracking tools",
    "Integration & AI Tooling": "MCP integration is more reliable with improved telemetry and diagnostics",
  };
  
  // Get base statement for category
  let statement = categoryStatements[category];
  
  // If no predefined statement, generate one based on work types
  if (!statement) {
    if (workTypes.fixes > 0) {
      statement = `Users experience improved reliability with ${workTypes.fixes} bug fixes in ${category.toLowerCase()}`;
    } else if (workTypes.features > 0) {
      statement = `New capabilities added for ${category.toLowerCase()} workflows`;
    } else if (workTypes.improvements > 0) {
      statement = `Enhanced ${category.toLowerCase()} experience with ${workTypes.improvements} improvements`;
    } else {
      return null;
    }
  }
  
  return statement;
}

/**
 * Analyze the types of work in a list of items.
 */
function analyzeWorkTypes(items: ProjectItem[]): { fixes: number; features: number; improvements: number } {
  let fixes = 0;
  let features = 0;
  let improvements = 0;
  
  for (const item of items) {
    const title = item.title.toLowerCase();
    const body = (item.body || "").toLowerCase();
    const combined = `${title} ${body}`;
    
    if (/\b(?:fix|bug|error|issue|fail|crash|broken)\b/.test(combined)) {
      fixes++;
    } else if (/\b(?:add|new|implement|create|introduce|support)\b/.test(combined)) {
      features++;
    } else if (/\b(?:improve|enhance|update|upgrade|refactor|optimize)\b/.test(combined)) {
      improvements++;
    } else {
      improvements++; // Default to improvement
    }
  }
  
  return { fixes, features, improvements };
}

// -----------------------------------------------------------------------------
// Markdown Generation
// -----------------------------------------------------------------------------

/**
 * Generate the complete Markdown memo.
 */
function generateMarkdown(data: MemoData): string {
  const lines: string[] = [];

  // Header
  lines.push("# AzSDK Tools Agent - Inner Loop");
  lines.push("");
  lines.push(`## Sprint ${data.sprintNumber} Update`);
  lines.push("");
  lines.push(data.dateString);
  lines.push("");

  // Executive Summary
  lines.push("## Executive Summary");
  lines.push("");
  for (const paragraph of data.executiveSummary) {
    lines.push(paragraph);
    lines.push("");
  }

  // RAG Status
  lines.push("## Overall Project RAG Status");
  lines.push("");
  lines.push(`${data.ragEmoji} **${data.ragStatus}** — ${data.ragReason}`);
  lines.push("");

  // Milestones & Progress
  lines.push("## Milestones & Progress");
  lines.push("");
  if (data.milestones.some((m) => m.bugBash === "✅")) {
    lines.push(
      "*Bug Bash column indicates work completed based on feedback collected during bug bash.*"
    );
    lines.push("");
  }
  lines.push("| Category | Task | Status | Bug Bash | Notes |");
  lines.push("|----------|------|--------|----------|-------|");
  for (const row of data.milestones) {
    // Make task title a link if URL is available
    const taskDisplay = row.issueUrl 
      ? `[${row.task}](${row.issueUrl})`
      : row.task;
    lines.push(
      `| ${row.category} | ${taskDisplay} | ${row.status} | ${row.bugBash} | ${row.notes} |`
    );
  }
  lines.push("");

  // Value Delivered
  lines.push("## Value Delivered");
  lines.push("");
  if (data.valueDelivered.length > 0) {
    for (const value of data.valueDelivered) {
      lines.push(`- ${value}`);
    }
  } else {
    lines.push("*[Document customer-facing value delivered during this Sprint]*");
  }
  lines.push("");

  // Risks & Mitigations
  lines.push("## Risks & Mitigations");
  lines.push("");
  lines.push("| Risk | Impact | Mitigation |");
  lines.push("|------|--------|------------|");
  for (const row of data.risks) {
    lines.push(`| ${row.risk} | ${row.impact} | ${row.mitigation} |`);
  }
  lines.push("");

  // Next Steps
  lines.push(`## Next Steps (Sprint ${data.nextSprintNumber} Focus)`);
  lines.push("");
  for (const step of data.nextSteps) {
    if (step.startsWith("\n")) {
      lines.push("");
      lines.push(step.trim());
    } else {
      lines.push(`- ${step}`);
    }
  }
  lines.push("");

  return lines.join("\n");
}

// -----------------------------------------------------------------------------
// Main Function
// -----------------------------------------------------------------------------

/**
 * Generate the Sprint update memo.
 */
export async function report(): Promise<string> {
  logSection("Generating Sprint Update Memo");

  // Read analysis data
  let analysis: AnalysisInput;
  try {
    analysis = readOutputJson<AnalysisInput>("analysis.json");
  } catch (error) {
    throw new Error(`Failed to read analysis.json. Run analyze first.\n${error}`);
  }

  logInfo(`Generating memo for Sprint ${analysis.sprintNumber}`);

  // Generate value delivered from completed items
  const valueDelivered = generateValueDelivered(analysis.completedItems);
  logInfo(`Generated ${valueDelivered.length} value delivered statements`);

  // Prepare memo data
  const memoData: MemoData = {
    sprintNumber: analysis.sprintNumber,
    dateString: formatDateLong(new Date()),
    executiveSummary: generateExecutiveSummary(analysis),
    ragStatus: analysis.ragStatus,
    ragEmoji: RAG_EMOJI[analysis.ragStatus],
    ragReason: analysis.ragReason,
    milestones: generateMilestones(analysis.itemsByEpic),
    valueDelivered,
    risks: generateRisks(analysis.blockedItems),
    nextSteps: generateNextSteps(
      analysis.inProgressItems,
      analysis.todoItems,
      analysis.nextSprintItems,
      analysis.sprintNumber + 1
    ),
    nextSprintNumber: analysis.sprintNumber + 1,
  };

  // Generate Markdown
  const markdown = generateMarkdown(memoData);

  // Save to file
  const outputPath = getOutputFilePath(analysis.sprintNumber);
  writeMarkdown(outputPath, markdown);

  logSuccess(`Memo generated: ${outputPath}`);

  // Print summary
  console.log("\n📋 Memo Summary:");
  console.log(`   Sprint: ${analysis.sprintNumber}`);
  console.log(`   RAG Status: ${memoData.ragEmoji} ${memoData.ragStatus}`);
  console.log(`   Milestones: ${memoData.milestones.length} items`);
  console.log(`   Value Delivered: ${memoData.valueDelivered.length} statements`);
  console.log(`   Risks: ${memoData.risks.length}`);
  console.log(`   Next Steps: ${memoData.nextSteps.length}`);

  return markdown;
}

// -----------------------------------------------------------------------------
// CLI Entry Point
// -----------------------------------------------------------------------------

// Run if executed directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  report().catch((error) => {
    console.error("Error generating report:", error);
    process.exit(1);
  });
}
