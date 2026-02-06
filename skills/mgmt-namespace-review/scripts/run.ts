#!/usr/bin/env node
/**
 * Main entry point for the MGMT Namespace Review skill
 *
 * Pipeline steps:
 * 1. Fetch open namespace review issues from both repos
 * 2. Validate and detect phase for each issue
 * 3. Process issues through their current phase
 * 4. Generate summary report
 *
 * Usage:
 *   pnpm start              # Run full pipeline
 *   pnpm start:dry          # Dry run (no changes)
 *   tsx scripts/run.ts --dry-run
 *   tsx scripts/run.ts --help
 */

import { fetchAndEnrichIssues } from "./fetch-issues.ts";
import { processAllIssues } from "./process.ts";
import { generateReport, writeReport } from "./report.ts";
import type { EnrichedIssue, IssueAction, ProcessingError } from "./types.ts";
import {
  createLogger,
  setDryRun,
  getDryRun,
  getOutputDir,
  writeOutput,
  now,
} from "./utils.ts";
import { isGraphConfigured, shouldSkipGraphApi } from "./graph.ts";

const log = createLogger("run");

// -----------------------------------------------------------------------------
// CLI Argument Parsing
// -----------------------------------------------------------------------------

interface CliOptions {
  dryRun: boolean;
  help: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);

  return {
    dryRun:
      args.includes("--dry-run") ||
      args.includes("-n") ||
      process.env.DRY_RUN === "true",
    help: args.includes("--help") || args.includes("-h"),
  };
}

function printHelp(): void {
  console.log(`
MGMT Namespace Review Skill
===========================

Automates the Azure SDK Management Plane Namespace Review process.

Usage:
  tsx scripts/run.ts [options]

Options:
  --dry-run, -n    Validate and log actions without making changes
  --help, -h       Show this help message

Environment Variables:
  GRAPH_CLIENT_ID      Azure AD app client ID (required for Teams/email)
  GRAPH_TENANT_ID      Azure AD tenant ID (required for Teams/email)
  GRAPH_ACCESS_TOKEN   Pre-authenticated token (optional, for CI/CD)
  SKIP_GRAPH_API       Set to "true" to skip Teams/email operations
  DRY_RUN              Set to "true" for dry run mode

Examples:
  # Run full pipeline
  tsx scripts/run.ts

  # Dry run
  tsx scripts/run.ts --dry-run

  # Skip Graph API (GitHub-only mode)
  SKIP_GRAPH_API=true tsx scripts/run.ts
`);
}

// -----------------------------------------------------------------------------
// Pipeline Execution
// -----------------------------------------------------------------------------

async function run(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  // Set dry run mode
  setDryRun(options.dryRun);

  const startTime = now();
  process.env.MGMT_NS_START_TIME = startTime;

  console.log("\n" + "=".repeat(60));
  console.log("MGMT NAMESPACE REVIEW WORKFLOW");
  console.log("=".repeat(60));

  if (getDryRun()) {
    console.log("\n⚠️  DRY RUN MODE - No actual changes will be made\n");
  }

  // Check Graph API configuration
  if (shouldSkipGraphApi()) {
    log.info("Graph API operations disabled via SKIP_GRAPH_API=true");
  } else if (!isGraphConfigured()) {
    log.warn("Graph API not configured (GRAPH_CLIENT_ID and GRAPH_TENANT_ID not set)");
    log.warn("Teams notifications and email operations will be skipped");
    log.warn("Set GRAPH_CLIENT_ID and GRAPH_TENANT_ID to enable, or set SKIP_GRAPH_API=true to suppress this warning");
  } else {
    log.info("Graph API configured - Teams and email operations enabled");
  }

  console.log(`\nOutput directory: ${getOutputDir()}\n`);

  // Step 1: Fetch and enrich issues
  console.log("\n" + "-".repeat(40));
  console.log("STEP 1: Fetching Issues");
  console.log("-".repeat(40) + "\n");

  let issues: EnrichedIssue[];
  try {
    issues = await fetchAndEnrichIssues();
    writeOutput("issues.json", issues);
    log.info(`Fetched and enriched ${issues.length} issues`);
  } catch (error) {
    log.error(`Failed to fetch issues: ${error}`);
    process.exit(1);
  }

  if (issues.length === 0) {
    log.info("No open namespace review issues found");
    console.log("\n✓ No issues to process");
    return;
  }

  // Step 2: Process issues
  console.log("\n" + "-".repeat(40));
  console.log("STEP 2: Processing Issues");
  console.log("-".repeat(40) + "\n");

  const results = await processAllIssues(issues);

  // Collect actions and errors
  const allActions: IssueAction[] = results.flatMap((r) => r.actions);
  const allErrors: ProcessingError[] = results
    .filter((r) => r.error)
    .map((r) => r.error!);

  writeOutput("actions.json", allActions);
  writeOutput("errors.json", allErrors);

  log.info(`Processed ${issues.length} issues`);
  log.info(`Actions taken: ${allActions.length}`);
  log.info(`Errors: ${allErrors.length}`);

  // Step 3: Generate report
  console.log("\n" + "-".repeat(40));
  console.log("STEP 3: Generating Report");
  console.log("-".repeat(40) + "\n");

  const report = generateReport(issues, allActions, allErrors, startTime);
  writeReport(report, issues);

  // Final summary
  console.log("\n" + "=".repeat(60));
  console.log("COMPLETED");
  console.log("=".repeat(60));
  console.log(`
Total Issues:      ${report.totalIssues}
Issues Processed:  ${report.issuesProcessed}
Issues Skipped:    ${report.issuesSkipped}
Actions Taken:     ${report.actionsPerformed.length}
Errors:            ${report.errors.length}
`);

  if (getDryRun()) {
    console.log("⚠️  This was a DRY RUN - no actual changes were made");
  }

  console.log(`\nFull report: ${getOutputDir()}/report.md\n`);

  // Exit with error code if there were errors
  if (allErrors.length > 0) {
    console.log("⚠️  Some issues encountered errors. Check the report for details.");
    process.exit(1);
  }
}

// -----------------------------------------------------------------------------
// Entry Point
// -----------------------------------------------------------------------------

run().catch((error) => {
  log.error(`Unhandled error: ${error}`);
  console.error(error);
  process.exit(1);
});
