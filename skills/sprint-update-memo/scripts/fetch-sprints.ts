#!/usr/bin/env npx tsx
/**
 * Fetch Sprint iterations from GitHub Project.
 *
 * This script queries the GitHub Project to get all Sprint iterations
 * (both active and completed) and saves them to output/sprints.json.
 *
 * Usage:
 *   pnpm exec tsx scripts/fetch-sprints.ts
 */

import { executeGraphQL, SPRINTS_QUERY, verifyAuth } from "./github.ts";
import type { SprintIteration, SprintIterationsResponse } from "./types.ts";
import {
  addDays,
  logSection,
  logSuccess,
  parseDate,
  writeOutputJson,
} from "./utils.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Output data structure for sprints.json.
 */
interface SprintsOutput {
  /** Timestamp when data was fetched */
  fetchedAt: string;
  /** Currently active Sprint (based on today's date) */
  currentSprint: SprintIteration | null;
  /** Next upcoming Sprint */
  nextSprint: SprintIteration | null;
  /** All active (future/current) iterations */
  activeIterations: SprintIteration[];
  /** All completed (past) iterations */
  completedIterations: SprintIteration[];
}

// -----------------------------------------------------------------------------
// Main Function
// -----------------------------------------------------------------------------

/**
 * Fetch Sprint iterations from GitHub Project.
 */
export async function fetchSprints(): Promise<SprintsOutput> {
  logSection("Fetching Sprint Iterations");

  // Verify authentication
  verifyAuth();

  // Execute GraphQL query
  console.log("Querying GitHub Project for Sprint iterations...");
  const response = executeGraphQL<SprintIterationsResponse>(SPRINTS_QUERY);

  // Extract iterations
  const config = response.data.organization.projectV2.field.configuration;
  const activeIterations = config.iterations || [];
  const completedIterations = config.completedIterations || [];

  console.log(`Found ${activeIterations.length} active iterations`);
  console.log(`Found ${completedIterations.length} completed iterations`);

  // Determine current Sprint based on today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentSprint: SprintIteration | null = null;
  let nextSprint: SprintIteration | null = null;

  // Check active iterations for current Sprint
  for (const iteration of activeIterations) {
    const startDate = parseDate(iteration.startDate);
    const endDate = addDays(startDate, iteration.duration);

    if (today >= startDate && today < endDate) {
      currentSprint = iteration;
    } else if (today < startDate) {
      // This is a future Sprint - could be next Sprint
      if (!nextSprint || parseDate(iteration.startDate) < parseDate(nextSprint.startDate)) {
        nextSprint = iteration;
      }
    }
  }

  // If no current Sprint found in active, check if we're between Sprints
  // In that case, the most recent completed Sprint might still be relevant
  if (!currentSprint && completedIterations.length > 0) {
    // Sort completed iterations by start date descending
    const sortedCompleted = [...completedIterations].sort(
      (a, b) => parseDate(b.startDate).getTime() - parseDate(a.startDate).getTime()
    );
    
    // The most recent completed Sprint
    const mostRecent = sortedCompleted[0];
    const endDate = addDays(parseDate(mostRecent.startDate), mostRecent.duration);
    
    // If it ended within the last 7 days, consider it current for reporting
    const daysSinceEnd = Math.floor((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceEnd <= 7) {
      console.log(`Note: Sprint "${mostRecent.title}" ended ${daysSinceEnd} days ago`);
      currentSprint = mostRecent;
    }
  }

  // If still no next Sprint, use the first active iteration
  if (!nextSprint && activeIterations.length > 0) {
    nextSprint = activeIterations[0];
  }

  // Log findings
  if (currentSprint) {
    const startDate = parseDate(currentSprint.startDate);
    const endDate = addDays(startDate, currentSprint.duration);
    console.log(`\nCurrent Sprint: ${currentSprint.title}`);
    console.log(`  Start: ${startDate.toLocaleDateString()}`);
    console.log(`  End: ${endDate.toLocaleDateString()}`);
  } else {
    console.log("\nNo current Sprint found (may be between Sprints)");
  }

  if (nextSprint && nextSprint !== currentSprint) {
    console.log(`\nNext Sprint: ${nextSprint.title}`);
    console.log(`  Start: ${parseDate(nextSprint.startDate).toLocaleDateString()}`);
  }

  // Prepare output
  const output: SprintsOutput = {
    fetchedAt: new Date().toISOString(),
    currentSprint,
    nextSprint: nextSprint !== currentSprint ? nextSprint : null,
    activeIterations,
    completedIterations,
  };

  // Save to file
  writeOutputJson("sprints.json", output);
  logSuccess("Sprint iterations fetched successfully");

  return output;
}

// -----------------------------------------------------------------------------
// CLI Entry Point
// -----------------------------------------------------------------------------

// Run if executed directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  fetchSprints().catch((error) => {
    console.error("Error fetching sprints:", error);
    process.exit(1);
  });
}
