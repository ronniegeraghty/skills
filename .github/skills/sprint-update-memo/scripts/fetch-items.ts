#!/usr/bin/env npx tsx
/**
 * Fetch project items from GitHub Project with pagination.
 *
 * This script queries the GitHub Project to get all items,
 * filters by target Sprints, and saves to output/items.json.
 *
 * Usage:
 *   pnpm exec tsx scripts/fetch-items.ts
 *
 * Environment Variables:
 *   TARGET_SPRINT - Sprint title to filter for (e.g., "Sprint 12")
 *   NEXT_SPRINT - Next Sprint title for "Next Steps" section
 */

import { executeGraphQL, ITEMS_QUERY } from "./github.ts";
import type {
  IssueComment,
  LinkedPullRequest,
  ProjectItem,
  ProjectItemsResponse,
  ProjectItemStatus,
  RawProjectItem,
  SprintIteration,
} from "./types.ts";
import {
  logInfo,
  logSection,
  logSuccess,
  logWarning,
  readOutputJson,
  writeOutputJson,
} from "./utils.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Input data from sprints.json.
 */
interface SprintsInput {
  currentSprint: SprintIteration | null;
  nextSprint: SprintIteration | null;
}

/**
 * Output data structure for items.json.
 */
interface ItemsOutput {
  /** Timestamp when data was fetched */
  fetchedAt: string;
  /** Target Sprint for the report */
  targetSprint: string;
  /** Next Sprint (for Next Steps section) */
  nextSprint: string | null;
  /** Total items fetched from project */
  totalItemsFetched: number;
  /** Items in the target Sprint */
  targetSprintItems: ProjectItem[];
  /** Items in the next Sprint */
  nextSprintItems: ProjectItem[];
}

// -----------------------------------------------------------------------------
// Transform Functions
// -----------------------------------------------------------------------------

/**
 * Transform a raw GraphQL project item to a ProjectItem.
 */
function transformItem(raw: RawProjectItem): ProjectItem | null {
  // Skip items with no content
  if (!raw.content) {
    return null;
  }

  const content = raw.content;
  const title = content.title;

  // Skip items without a title
  if (!title) {
    return null;
  }

  // Determine if this is a draft issue
  const isDraft = !content.number;

  // Extract labels
  const labels = content.labels?.nodes?.map((l) => l.name) || [];

  // Extract sprint info
  const sprint: SprintIteration | null = raw.sprint
    ? {
        id: "", // Not provided in this query
        title: raw.sprint.title,
        startDate: raw.sprint.startDate,
        duration: raw.sprint.duration,
      }
    : null;

  // Get status
  const status = raw.status?.name as ProjectItemStatus | null;

  // Extract comments
  const comments: IssueComment[] = content.comments?.nodes?.map((c) => ({
    body: c.body,
    author: c.author?.login,
  })) || [];

  // Extract linked PRs
  const linkedPRs: LinkedPullRequest[] = content.closedByPullRequestsReferences?.nodes?.map((pr) => ({
    title: pr.title,
    url: pr.url,
    body: pr.body,
    merged: pr.merged,
  })) || [];

  return {
    id: raw.id,
    title,
    status,
    epic: raw.epic?.name || null,
    sprint,
    labels,
    issueNumber: content.number,
    issueUrl: content.url,
    body: content.body,
    isDraft,
    comments,
    linkedPRs,
  };
}

// -----------------------------------------------------------------------------
// Main Function
// -----------------------------------------------------------------------------

/**
 * Fetch project items from GitHub Project.
 */
export async function fetchItems(): Promise<ItemsOutput> {
  logSection("Fetching Project Items");

  // Auth already verified in fetch-sprints step

  // Read sprints data to determine target Sprints
  let targetSprintTitle: string;
  let nextSprintTitle: string | null = null;

  // Check environment variables first
  if (process.env.TARGET_SPRINT) {
    targetSprintTitle = process.env.TARGET_SPRINT;
    nextSprintTitle = process.env.NEXT_SPRINT || null;
  } else {
    // Read from sprints.json
    try {
      const sprintsData = readOutputJson<SprintsInput>("sprints.json");
      if (!sprintsData.currentSprint) {
        throw new Error("No current Sprint found in sprints.json");
      }
      targetSprintTitle = sprintsData.currentSprint.title;
      nextSprintTitle = sprintsData.nextSprint?.title || null;
    } catch (error) {
      throw new Error(
        `Failed to read sprints.json. Run fetch-sprints first.\n${error}`
      );
    }
  }

  logInfo(`Target Sprint: ${targetSprintTitle}`);
  if (nextSprintTitle) {
    logInfo(`Next Sprint: ${nextSprintTitle}`);
  }

  // Fetch all items with pagination
  const allItems: ProjectItem[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  let pageCount = 0;

  console.log("\nFetching project items (paginated)...");

  while (hasNextPage) {
    pageCount++;
    process.stdout.write(`  Page ${pageCount}...`);

    const response: ProjectItemsResponse = executeGraphQL<ProjectItemsResponse>(ITEMS_QUERY, {
      cursor: cursor || "",
    });

    const pageInfo: { hasNextPage: boolean; endCursor: string | null } = response.data.organization.projectV2.items.pageInfo;
    const nodes: RawProjectItem[] = response.data.organization.projectV2.items.nodes;

    // Transform items
    for (const rawItem of nodes) {
      const item = transformItem(rawItem);
      if (item) {
        allItems.push(item);
      }
    }

    console.log(` ${nodes.length} items`);

    // Update pagination state
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  console.log(`\nTotal items fetched: ${allItems.length}`);

  // Filter items by Sprint
  const targetSprintItems = allItems.filter(
    (item) => item.sprint?.title === targetSprintTitle && item.status !== null
  );

  const nextSprintItems = nextSprintTitle
    ? allItems.filter(
        (item) => item.sprint?.title === nextSprintTitle && item.status !== null
      )
    : [];

  logInfo(`Items in ${targetSprintTitle}: ${targetSprintItems.length}`);
  if (nextSprintTitle) {
    logInfo(`Items in ${nextSprintTitle}: ${nextSprintItems.length}`);
  }

  // Log status distribution for target Sprint
  const statusCounts = new Map<string, number>();
  for (const item of targetSprintItems) {
    const status = item.status || "Unknown";
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  }

  console.log("\nStatus distribution:");
  for (const [status, count] of statusCounts) {
    console.log(`  ${status}: ${count}`);
  }

  // Warn if no items found
  if (targetSprintItems.length === 0) {
    logWarning(`No items found for ${targetSprintTitle}`);
    logWarning("Check that items have the Sprint field set and a valid Status");
  }

  // Prepare output
  const output: ItemsOutput = {
    fetchedAt: new Date().toISOString(),
    targetSprint: targetSprintTitle,
    nextSprint: nextSprintTitle,
    totalItemsFetched: allItems.length,
    targetSprintItems,
    nextSprintItems,
  };

  // Save to file
  writeOutputJson("items.json", output);
  logSuccess("Project items fetched successfully");

  return output;
}

// -----------------------------------------------------------------------------
// CLI Entry Point
// -----------------------------------------------------------------------------

// Run if executed directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  fetchItems().catch((error) => {
    console.error("Error fetching items:", error);
    process.exit(1);
  });
}
