/**
 * Issue fetching for the MGMT Namespace Review skill
 *
 * Fetches open namespace review issues from:
 * - Azure/azure-sdk
 * - Azure/azure-sdk-pr
 *
 * Enriches issues with validation and phase detection.
 */

import { fetchNamespaceReviewIssues, getProjectStatus, hasArthurApproved } from "./github.ts";
import { validateIssue } from "./validate.ts";
import { ARTHUR_GITHUB, NAMESPACE_READY_LABEL } from "./constants.ts";
import { Phase, ProjectStatus } from "./types.ts";
import type { GitHubIssue, EnrichedIssue } from "./types.ts";
import { createLogger, writeOutput, extractResourceProviderFromTitle } from "./utils.ts";

const log = createLogger("fetch");

// -----------------------------------------------------------------------------
// Phase Detection
// -----------------------------------------------------------------------------

/**
 * Determine the phase of an issue based on its current state
 * @param issue - GitHub issue
 * @param projectStatus - Current project status
 * @param arthurApproved - Whether Arthur has approved via comment
 * @returns Detected phase
 */
function detectPhase(
  issue: GitHubIssue,
  projectStatus: ProjectStatus | null,
  arthurApproved: boolean
): Phase {
  const hasArthurAssigned = issue.assignees.some(
    (a) => a.login === ARTHUR_GITHUB
  );
  const hasReadyLabel = issue.labels.some(
    (l) => l.name === NAMESPACE_READY_LABEL
  );

  // Phase 1: Initial Review
  // Arthur is not assigned yet
  if (!hasArthurAssigned) {
    return Phase.InitialReview;
  }

  // Phase 2: Awaiting MGMT Approval
  // Arthur is assigned but hasn't approved yet
  if (!hasReadyLabel && !arthurApproved) {
    return Phase.AwaitingMgmtApproval;
  }

  // Phase 3: Ready for Architect Review
  // Arthur approved but project status is not "Watch"
  if (projectStatus !== ProjectStatus.Watch) {
    return Phase.ReadyForArchitectReview;
  }

  // For phases 4 and 5, we need to check business days
  // This will be refined in process.ts with email date info
  // For now, if status is "Watch", we're in the watching phase
  return Phase.Watching;
}

// -----------------------------------------------------------------------------
// Issue Enrichment
// -----------------------------------------------------------------------------

/**
 * Enrich an issue with validation and phase information
 * @param issue - Raw GitHub issue
 * @returns Enriched issue
 */
async function enrichIssue(issue: GitHubIssue): Promise<EnrichedIssue> {
  log.info(`Enriching issue #${issue.number}: ${issue.title}`);

  // Validate namespaces
  const validation = validateIssue(issue);

  // Get project status
  const projectStatus = await getProjectStatus(issue.url);

  // Check if Arthur has approved via comment
  const arthurApproved = await hasArthurApproved(
    issue.repository.nameWithOwner,
    issue.number
  );

  // Detect phase
  const phase = detectPhase(issue, projectStatus, arthurApproved);

  log.info(`Issue #${issue.number} is in phase: ${phase}`);

  // Extract resource provider name from title for email subject tracking
  const resourceProviderName = extractResourceProviderFromTitle(issue.title);
  const architectEmailSubject = resourceProviderName
    ? `MGMT Plane Namespace Review for ${resourceProviderName}`
    : undefined;

  return {
    ...issue,
    validation,
    phase,
    projectStatus: projectStatus || undefined,
    architectEmailSubject,
  };
}

// -----------------------------------------------------------------------------
// Main Fetch Function
// -----------------------------------------------------------------------------

/**
 * Fetch and enrich all open namespace review issues
 * @returns Array of enriched issues
 */
export async function fetchAndEnrichIssues(): Promise<EnrichedIssue[]> {
  log.info("Fetching namespace review issues...");

  // Fetch raw issues
  const rawIssues = await fetchNamespaceReviewIssues();
  log.info(`Found ${rawIssues.length} open namespace review issues`);

  // Enrich each issue
  const enrichedIssues: EnrichedIssue[] = [];

  for (const issue of rawIssues) {
    try {
      const enriched = await enrichIssue(issue);
      enrichedIssues.push(enriched);
    } catch (error) {
      log.error(`Failed to enrich issue #${issue.number}: ${error}`);
      // Create a minimal enriched issue for error cases
      enrichedIssues.push({
        ...issue,
        validation: {
          isValid: false,
          namespaces: [],
          hasApiSpecLink: false,
          missingLanguages: [],
          errors: [`Failed to enrich: ${error}`],
        },
        phase: Phase.InitialReview,
      });
    }
  }

  // Log summary by phase
  const byPhase = enrichedIssues.reduce(
    (acc, issue) => {
      acc[issue.phase] = (acc[issue.phase] || 0) + 1;
      return acc;
    },
    {} as Record<Phase, number>
  );

  log.info("Issues by phase:");
  for (const [phase, count] of Object.entries(byPhase)) {
    log.info(`  ${phase}: ${count}`);
  }

  return enrichedIssues;
}

// -----------------------------------------------------------------------------
// Standalone Execution
// -----------------------------------------------------------------------------

/**
 * Run fetch as a standalone script
 */
async function main(): Promise<void> {
  const issues = await fetchAndEnrichIssues();

  const path = writeOutput("issues.json", issues);
  log.info(`Wrote ${issues.length} issues to ${path}`);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("NAMESPACE REVIEW ISSUES SUMMARY");
  console.log("=".repeat(60));

  for (const issue of issues) {
    const status = issue.validation.isValid ? "✓" : "✗";
    console.log(
      `\n${status} #${issue.number}: ${issue.title}`
    );
    console.log(`   Repo: ${issue.repository.nameWithOwner}`);
    console.log(`   Phase: ${issue.phase}`);
    console.log(`   Project Status: ${issue.projectStatus || "Not in project"}`);
    console.log(`   Valid: ${issue.validation.isValid}`);

    if (!issue.validation.isValid) {
      for (const error of issue.validation.errors) {
        console.log(`   ⚠ ${error}`);
      }
    }
  }
}

// Run if executed directly
const isMain = process.argv[1]?.includes("fetch-issues");
if (isMain) {
  main().catch(console.error);
}
