#!/usr/bin/env npx tsx
/**
 * Sprint Update Memo Pipeline Orchestrator
 *
 * This script coordinates the execution of all pipeline steps to generate
 * a Sprint update memo from the GitHub Project data.
 *
 * Usage:
 *   pnpm start                          # Interactive mode
 *   pnpm start -- --sprint 12           # Generate for Sprint 12
 *   pnpm start -- --sprint 12 --no-prompt  # Non-interactive
 *
 * Pipeline Steps:
 *   1. fetch-sprints - Fetch Sprint iterations from GitHub Project
 *   2. fetch-items   - Fetch project items, filter by Sprint
 *   3. analyze       - Analyze data, calculate RAG status
 *   4. report        - Generate Markdown memo
 */

import { PIPELINE_STEPS } from "./constants.ts";
import { fetchSprints } from "./fetch-sprints.ts";
import { fetchItems } from "./fetch-items.ts";
import { analyze } from "./analyze.ts";
import { report } from "./report.ts";
import type { SprintIteration } from "./types.ts";
import {
  extractSprintNumber,
  generateTimestamp,
  getRunDir,
  logError,
  logInfo,
  logSection,
  logSuccess,
  parseArgs,
  printHelp,
  setRunDir,
} from "./utils.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SprintsData {
  currentSprint: SprintIteration | null;
  nextSprint: SprintIteration | null;
  activeIterations: SprintIteration[];
  completedIterations: SprintIteration[];
}

// -----------------------------------------------------------------------------
// Interactive Prompts
// -----------------------------------------------------------------------------

/**
 * Prompt user for input (simple readline wrapper).
 */
async function prompt(question: string): Promise<string> {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Confirm Sprint selection with user.
 */
async function confirmSprint(
  sprintsData: SprintsData,
  requestedSprint?: number
): Promise<{ targetSprint: SprintIteration; nextSprint: SprintIteration | null }> {
  // Find all available Sprints
  const allSprints = [
    ...sprintsData.activeIterations,
    ...sprintsData.completedIterations,
  ];

  // If Sprint was specified, find it
  if (requestedSprint) {
    const found = allSprints.find(
      (s) => extractSprintNumber(s.title) === requestedSprint
    );
    if (found) {
      logInfo(`Using specified Sprint: ${found.title}`);
      
      // Find next Sprint
      const nextSprintNumber = requestedSprint + 1;
      const nextSprint = allSprints.find(
        (s) => extractSprintNumber(s.title) === nextSprintNumber
      ) || null;
      
      return { targetSprint: found, nextSprint };
    } else {
      logError(`Sprint ${requestedSprint} not found`);
      console.log("Available Sprints:");
      for (const s of allSprints.slice(0, 10)) {
        console.log(`  - ${s.title}`);
      }
      throw new Error(`Sprint ${requestedSprint} not found`);
    }
  }

  // Use current Sprint if available
  if (sprintsData.currentSprint) {
    return {
      targetSprint: sprintsData.currentSprint,
      nextSprint: sprintsData.nextSprint,
    };
  }

  // No current Sprint - prompt user
  console.log("\nNo current Sprint detected. Available Sprints:");
  for (const s of allSprints.slice(0, 5)) {
    console.log(`  - ${s.title}`);
  }
  
  const answer = await prompt("\nEnter Sprint number (e.g., 12): ");
  const sprintNumber = parseInt(answer, 10);
  
  if (isNaN(sprintNumber)) {
    throw new Error("Invalid Sprint number");
  }

  const found = allSprints.find(
    (s) => extractSprintNumber(s.title) === sprintNumber
  );
  
  if (!found) {
    throw new Error(`Sprint ${sprintNumber} not found`);
  }

  // Find next Sprint
  const nextSprintNumber = sprintNumber + 1;
  const nextSprint = allSprints.find(
    (s) => extractSprintNumber(s.title) === nextSprintNumber
  ) || null;

  return { targetSprint: found, nextSprint };
}

// -----------------------------------------------------------------------------
// Pipeline Execution
// -----------------------------------------------------------------------------

/**
 * Run the complete pipeline.
 */
async function runPipeline(): Promise<void> {
  const startTime = Date.now();

  // Parse arguments
  const args = parseArgs();

  if (args.help) {
    printHelp();
    return;
  }

  // Initialize timestamped output directory
  const timestamp = generateTimestamp();
  setRunDir(timestamp);
  logInfo(`Output directory: ${getRunDir()}`);

  logSection("Sprint Update Memo Generator");
  console.log("");
  console.log("This skill generates Sprint update memos for the");
  console.log("AzSDK Tools Agent Developer Inner Loop project.");
  console.log("");

  // Step 1: Fetch Sprints
  console.log(`\n[1/${PIPELINE_STEPS.length}] ${PIPELINE_STEPS[0].desc}...`);
  const sprintsData = await fetchSprints();

  // Confirm Sprint selection
  const { targetSprint, nextSprint } = await confirmSprint(
    sprintsData,
    args.sprint
  );

  const sprintNumber = extractSprintNumber(targetSprint.title);
  logInfo(`Target Sprint: ${targetSprint.title}`);
  if (nextSprint) {
    logInfo(`Next Sprint: ${nextSprint.title}`);
  }

  // Set environment variables for downstream scripts
  process.env.TARGET_SPRINT = targetSprint.title;
  if (nextSprint) {
    process.env.NEXT_SPRINT = nextSprint.title;
  }

  // Step 2: Fetch Items
  console.log(`\n[2/${PIPELINE_STEPS.length}] ${PIPELINE_STEPS[1].desc}...`);
  await fetchItems();

  // Step 3: Analyze
  console.log(`\n[3/${PIPELINE_STEPS.length}] ${PIPELINE_STEPS[2].desc}...`);
  await analyze();

  // Step 4: Generate Report
  console.log(`\n[4/${PIPELINE_STEPS.length}] ${PIPELINE_STEPS[3].desc}...`);
  await report();

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  logSection("Pipeline Complete");
  console.log("");
  logSuccess(`Sprint ${sprintNumber} update memo generated!`);
  console.log("");
  console.log(`📄 Output: ${getRunDir()}`);
  console.log(`⏱️  Time: ${elapsed}s`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Review the generated memo");
  console.log("  2. Update the Executive Summary with specific highlights");
  console.log("  3. Add Value Delivered bullet points");
  console.log("  4. Review and adjust Risks & Mitigations");
  console.log("  5. Verify Next Steps align with team priorities");
}

// -----------------------------------------------------------------------------
// Main Entry Point
// -----------------------------------------------------------------------------

runPipeline().catch((error) => {
  logError(`Pipeline failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
