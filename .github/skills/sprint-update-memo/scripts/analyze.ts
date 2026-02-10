#!/usr/bin/env npx tsx
/**
 * Analyze Sprint data and calculate RAG status.
 *
 * This script reads items.json, calculates status distribution,
 * determines RAG status, groups by Epic, and saves to output/analysis.json.
 *
 * Usage:
 *   pnpm exec tsx scripts/analyze.ts
 */

import {
  CATEGORY_ORDER,
  EPIC_TO_CATEGORY,
  RAG_GREEN_THRESHOLD,
  RAG_YELLOW_MAX_BLOCKED,
  RAG_YELLOW_THRESHOLD,
  TRACKED_LABELS,
} from "./constants.ts";
import type {
  ProjectItem,
  RAGStatus,
  StatusCounts,
} from "./types.ts";
import {
  addDays,
  extractSprintNumber,
  logInfo,
  logSection,
  logSuccess,
  parseDate,
  readOutputJson,
  writeOutputJson,
} from "./utils.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Input data from items.json.
 */
interface ItemsInput {
  targetSprint: string;
  nextSprint: string | null;
  targetSprintItems: ProjectItem[];
  nextSprintItems: ProjectItem[];
}

/**
 * Serializable version of SprintAnalysis for JSON output.
 */
interface AnalysisOutput {
  fetchedAt: string;
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
  /** Items with bug bash label */
  bugBashItems: ProjectItem[];
  /** Summary stats for the report */
  stats: {
    totalDone: number;
    totalInProgress: number;
    totalTodo: number;
    totalBlocked: number;
    bugBashCount: number;
  };
}

// -----------------------------------------------------------------------------
// Analysis Functions
// -----------------------------------------------------------------------------

/**
 * Calculate status counts from items.
 */
function calculateStatusCounts(items: ProjectItem[]): StatusCounts {
  const counts: StatusCounts = {
    todo: 0,
    inProgress: 0,
    done: 0,
    blocked: 0,
    needsTriage: 0,
    total: items.length,
  };

  for (const item of items) {
    switch (item.status) {
      case "Todo":
        counts.todo++;
        break;
      case "In Progress":
        counts.inProgress++;
        break;
      case "Done":
        counts.done++;
        break;
      case "Blocked":
        counts.blocked++;
        break;
      case "Needs Triage":
        counts.needsTriage++;
        break;
    }
  }

  return counts;
}

/**
 * Calculate RAG status based on completion percentage and blocked items.
 */
function calculateRAGStatus(counts: StatusCounts): {
  status: RAGStatus;
  reason: string;
  completionPercentage: number;
} {
  // Calculate completion percentage (Done / Total excluding Needs Triage)
  const relevantTotal = counts.total - counts.needsTriage;
  const completionPercentage =
    relevantTotal > 0 ? Math.round((counts.done / relevantTotal) * 100) : 0;

  // Determine RAG status
  let status: RAGStatus;
  let reason: string;

  if (counts.blocked >= 3) {
    // Red: 3+ blocked items
    status = "Red";
    reason = `${counts.blocked} items are blocked, requiring immediate attention`;
  } else if (completionPercentage < RAG_YELLOW_THRESHOLD) {
    // Red: Less than 60% complete
    status = "Red";
    reason = `Only ${completionPercentage}% complete, significantly behind schedule`;
  } else if (
    counts.blocked > RAG_YELLOW_MAX_BLOCKED ||
    completionPercentage < RAG_GREEN_THRESHOLD
  ) {
    // Yellow: 1-2 blocked items OR 60-79% complete
    if (counts.blocked > 0) {
      status = "Yellow";
      reason = `${completionPercentage}% complete with ${counts.blocked} blocked item(s)`;
    } else {
      status = "Yellow";
      reason = `${completionPercentage}% complete, slightly behind target`;
    }
  } else {
    // Green: ≥80% complete and 0 blocked
    status = "Green";
    if (counts.done === relevantTotal) {
      reason = "Sprint fully completed with all items done";
    } else {
      reason = `${completionPercentage}% complete, on track for Sprint goals`;
    }
  }

  return { status, reason, completionPercentage };
}

/**
 * Group items by Epic category.
 */
function groupByEpic(items: ProjectItem[]): Map<string, ProjectItem[]> {
  const groups = new Map<string, ProjectItem[]>();

  // Initialize groups in category order
  for (const epic of CATEGORY_ORDER) {
    groups.set(epic, []);
  }
  groups.set("Uncategorized", []);

  // Group items
  for (const item of items) {
    const epic = item.epic || "Uncategorized";
    const existing = groups.get(epic) || [];
    existing.push(item);
    groups.set(epic, existing);
  }

  // Remove empty groups
  for (const [epic, groupItems] of groups) {
    if (groupItems.length === 0) {
      groups.delete(epic);
    }
  }

  return groups;
}

/**
 * Convert Map to plain object for JSON serialization.
 */
function mapToObject<T>(map: Map<string, T>): Record<string, T> {
  const obj: Record<string, T> = {};
  for (const [key, value] of map) {
    obj[key] = value;
  }
  return obj;
}

/**
 * Check if an item has the bug bash label.
 */
function hasBugBashLabel(item: ProjectItem): boolean {
  return item.labels.some(
    (label) => label.toLowerCase() === TRACKED_LABELS.BUG_BASH.toLowerCase()
  );
}

/**
 * Get scenario labels from an item.
 */
export function getScenarioLabels(item: ProjectItem): string[] {
  return item.labels.filter((label) =>
    label.toLowerCase().startsWith(TRACKED_LABELS.SCENARIO_PREFIX.toLowerCase())
  );
}

/**
 * Get category display name from Epic.
 */
export function getCategoryName(epic: string | null): string {
  if (!epic) return "Uncategorized";
  return EPIC_TO_CATEGORY[epic] || epic;
}

// -----------------------------------------------------------------------------
// Main Function
// -----------------------------------------------------------------------------

/**
 * Analyze Sprint data.
 */
export async function analyze(): Promise<AnalysisOutput> {
  logSection("Analyzing Sprint Data");

  // Read items data
  let itemsData: ItemsInput;
  try {
    itemsData = readOutputJson<ItemsInput>("items.json");
  } catch (error) {
    throw new Error(`Failed to read items.json. Run fetch-items first.\n${error}`);
  }

  const { targetSprint, targetSprintItems, nextSprintItems } = itemsData;
  logInfo(`Analyzing ${targetSprintItems.length} items in ${targetSprint}`);

  // Extract Sprint info
  const sprintNumber = extractSprintNumber(targetSprint);

  // Get start/end dates from first item with Sprint data
  let startDate = new Date();
  let endDate = new Date();
  const itemWithSprint = targetSprintItems.find((item) => item.sprint);
  if (itemWithSprint?.sprint) {
    startDate = parseDate(itemWithSprint.sprint.startDate);
    endDate = addDays(startDate, itemWithSprint.sprint.duration);
  }

  // Calculate status counts
  const statusCounts = calculateStatusCounts(targetSprintItems);
  console.log("\nStatus Distribution:");
  console.log(`  Done: ${statusCounts.done}`);
  console.log(`  In Progress: ${statusCounts.inProgress}`);
  console.log(`  Todo: ${statusCounts.todo}`);
  console.log(`  Blocked: ${statusCounts.blocked}`);
  console.log(`  Needs Triage: ${statusCounts.needsTriage}`);

  // Calculate RAG status
  const { status: ragStatus, reason: ragReason, completionPercentage } =
    calculateRAGStatus(statusCounts);
  console.log(`\nRAG Status: ${ragStatus}`);
  console.log(`  ${ragReason}`);
  console.log(`  Completion: ${completionPercentage}%`);

  // Group by Epic
  const itemsByEpic = groupByEpic(targetSprintItems);
  console.log("\nItems by Category:");
  for (const [epic, items] of itemsByEpic) {
    const categoryName = getCategoryName(epic);
    console.log(`  ${categoryName}: ${items.length}`);
  }

  // Filter items by status
  const blockedItems = targetSprintItems.filter((item) => item.status === "Blocked");
  const completedItems = targetSprintItems.filter((item) => item.status === "Done");
  const inProgressItems = targetSprintItems.filter(
    (item) => item.status === "In Progress"
  );
  const todoItems = targetSprintItems.filter((item) => item.status === "Todo");

  // Find bug bash items
  const bugBashItems = targetSprintItems.filter(hasBugBashLabel);
  logInfo(`Bug bash items: ${bugBashItems.length}`);

  // Prepare output
  const output: AnalysisOutput = {
    fetchedAt: new Date().toISOString(),
    sprintNumber,
    sprintTitle: targetSprint,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    totalItems: targetSprintItems.length,
    statusCounts,
    ragStatus,
    ragReason,
    completionPercentage,
    itemsByEpic: mapToObject(itemsByEpic),
    blockedItems,
    completedItems,
    inProgressItems,
    todoItems,
    nextSprintItems,
    bugBashItems,
    stats: {
      totalDone: statusCounts.done,
      totalInProgress: statusCounts.inProgress,
      totalTodo: statusCounts.todo,
      totalBlocked: statusCounts.blocked,
      bugBashCount: bugBashItems.length,
    },
  };

  // Save to file
  writeOutputJson("analysis.json", output);
  logSuccess("Sprint analysis complete");

  return output;
}

// -----------------------------------------------------------------------------
// CLI Entry Point
// -----------------------------------------------------------------------------

// Run if executed directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  analyze().catch((error) => {
    console.error("Error analyzing data:", error);
    process.exit(1);
  });
}
