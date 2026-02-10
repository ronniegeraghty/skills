/**
 * Phase processing for the MGMT Namespace Review skill
 *
 * Handles the state transitions for each phase:
 * 1. Initial Review → Validate, assign Arthur, Teams DM, project "In Progress"
 * 2. Awaiting MGMT Approval → Skip (waiting for Arthur)
 * 3. Ready for Architect Review → Email architects, project "Watch"
 * 4. Watching → Check for objections
 * 5. Ready to Close → Send approval email, close issue
 */

import { Phase, ProjectStatus } from "./types.ts";
import type { EnrichedIssue, IssueAction, ProcessingError } from "./types.ts";
import {
  assignArthur,
  addComment,
  updateProjectStatus,
  closeIssue,
} from "./github.ts";
import {
  sendArchitectReviewEmail,
  sendArchitectApprovalEmail,
  notifyArthur,
  checkForObjections,
  searchEmails,
  isGraphConfigured,
  shouldSkipGraphApi,
} from "./graph.ts";
import { validateIssue, getNamespacesRecord, getResourceProviderName } from "./validate.ts";
import {
  formatDeadline,
  hasArchitectReviewPeriodPassed,
} from "./business-days.ts";
import { COMMENT_TEMPLATES, ARCHITECT_REVIEW_DAYS } from "./constants.ts";
import {
  createLogger,
  getDryRun,
  now,
  extractResourceProviderFromTitle,
} from "./utils.ts";

const log = createLogger("process");

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ProcessResult {
  issue: EnrichedIssue;
  actions: IssueAction[];
  error?: ProcessingError;
}

// -----------------------------------------------------------------------------
// Phase Handlers
// -----------------------------------------------------------------------------

/**
 * Handle Phase 1: Initial Review
 * - Validate namespaces
 * - If valid: assign Arthur, Teams DM, update project status
 * - If invalid: comment with errors
 */
async function handleInitialReview(issue: EnrichedIssue): Promise<IssueAction[]> {
  const actions: IssueAction[] = [];
  const repo = issue.repository.nameWithOwner;

  log.info(`Processing initial review for #${issue.number}`);

  // Validate namespaces
  const validation = validateIssue(issue);

  if (!validation.isValid) {
    // Post comment about validation errors
    const comment = COMMENT_TEMPLATES.validationFailed({
      author: issue.author.login,
      missingLanguages: validation.missingLanguages.map((l) => l.toString()),
      patternErrors: validation.errors.filter(
        (e) => !e.includes("Missing") && !e.includes("azure-rest-api-specs")
      ),
      missingApiSpec: !validation.hasApiSpecLink,
      azureInName: validation.errors.some((e) => e.includes('"azure"')),
    });

    await addComment(repo, issue.number, comment);

    actions.push({
      issueNumber: issue.number,
      issueUrl: issue.url,
      repo,
      phase: Phase.InitialReview,
      action: "Commented with validation errors",
      success: true,
      timestamp: now(),
      dryRun: getDryRun(),
    });

    return actions;
  }

  // Validation passed - assign Arthur
  await assignArthur(repo, issue.number);
  actions.push({
    issueNumber: issue.number,
    issueUrl: issue.url,
    repo,
    phase: Phase.InitialReview,
    action: "Assigned Arthur as reviewer",
    success: true,
    timestamp: now(),
    dryRun: getDryRun(),
  });

  // Update project status to "In Progress"
  await updateProjectStatus(issue.url, ProjectStatus.InProgress);
  actions.push({
    issueNumber: issue.number,
    issueUrl: issue.url,
    repo,
    phase: Phase.InitialReview,
    action: 'Updated project status to "In Progress"',
    success: true,
    timestamp: now(),
    dryRun: getDryRun(),
  });

  // Send Teams message to Arthur
  if (isGraphConfigured() && !shouldSkipGraphApi()) {
    await notifyArthur(issue.title, issue.url);
    actions.push({
      issueNumber: issue.number,
      issueUrl: issue.url,
      repo,
      phase: Phase.InitialReview,
      action: "Sent Teams message to Arthur",
      success: true,
      timestamp: now(),
      dryRun: getDryRun(),
    });
  } else {
    log.warn("Graph API not configured - skipping Teams notification");
  }

  return actions;
}

/**
 * Handle Phase 2: Awaiting MGMT Approval
 * - Nothing to do, just waiting for Arthur
 */
async function handleAwaitingMgmtApproval(issue: EnrichedIssue): Promise<IssueAction[]> {
  log.info(`Issue #${issue.number} is waiting for Arthur's approval - skipping`);
  return [];
}

/**
 * Handle Phase 3: Ready for Architect Review
 * - Add comment about architect review
 * - Send email to architects
 * - Update project status to "Watch"
 */
async function handleReadyForArchitectReview(issue: EnrichedIssue): Promise<IssueAction[]> {
  const actions: IssueAction[] = [];
  const repo = issue.repository.nameWithOwner;

  log.info(`Processing architect review for #${issue.number}`);

  // Get resource provider name and namespaces
  const resourceProviderName =
    getResourceProviderName(issue.validation) ||
    extractResourceProviderFromTitle(issue.title) ||
    "Unknown";

  const namespaces = getNamespacesRecord(issue.validation);
  const deadline = formatDeadline(new Date(), ARCHITECT_REVIEW_DAYS);

  // Add comment about architect review
  const comment = COMMENT_TEMPLATES.movingToArchitectReview({
    resourceProviderName,
    deadline,
  });

  await addComment(repo, issue.number, comment);
  actions.push({
    issueNumber: issue.number,
    issueUrl: issue.url,
    repo,
    phase: Phase.ReadyForArchitectReview,
    action: "Added architect review comment",
    success: true,
    timestamp: now(),
    dryRun: getDryRun(),
  });

  // Send email to architects
  if (isGraphConfigured() && !shouldSkipGraphApi()) {
    await sendArchitectReviewEmail({
      issueUrl: issue.url,
      resourceProviderName,
      deadline,
      namespaces: {
        dotnet: namespaces.dotnet,
        java: namespaces.java,
        javascript: namespaces.javascript,
        python: namespaces.python,
        go: namespaces.go,
      },
    });

    actions.push({
      issueNumber: issue.number,
      issueUrl: issue.url,
      repo,
      phase: Phase.ReadyForArchitectReview,
      action: `Sent architect review email (deadline: ${deadline})`,
      success: true,
      timestamp: now(),
      dryRun: getDryRun(),
    });
  } else {
    log.warn("Graph API not configured - skipping architect email");
  }

  // Update project status to "Watch"
  await updateProjectStatus(issue.url, ProjectStatus.Watch);
  actions.push({
    issueNumber: issue.number,
    issueUrl: issue.url,
    repo,
    phase: Phase.ReadyForArchitectReview,
    action: 'Updated project status to "Watch"',
    success: true,
    timestamp: now(),
    dryRun: getDryRun(),
  });

  return actions;
}

/**
 * Handle Phase 4: Watching for Objections
 * - Check email thread for objections
 * - If objections found, relay to issue
 * - If 3 business days passed, move to ready to close
 */
async function handleWatching(issue: EnrichedIssue): Promise<IssueAction[]> {
  const actions: IssueAction[] = [];
  const repo = issue.repository.nameWithOwner;

  log.info(`Checking for objections on #${issue.number}`);

  // Get the email subject to search for
  const resourceProviderName =
    getResourceProviderName(issue.validation) ||
    extractResourceProviderFromTitle(issue.title) ||
    "Unknown";

  const emailSubject = `MGMT Plane Namespace Review for ${resourceProviderName}`;

  // Find when the architect email was sent
  if (isGraphConfigured() && !shouldSkipGraphApi()) {
    const emails = await searchEmails(emailSubject);

    if (emails.length === 0) {
      log.warn(`Could not find architect email for issue #${issue.number}`);
      return actions;
    }

    const sentDate = new Date(emails[0].receivedDateTime);

    // Check if review period has passed
    if (hasArchitectReviewPeriodPassed(sentDate, ARCHITECT_REVIEW_DAYS)) {
      log.info(`Review period has passed for issue #${issue.number}`);
      // Will be handled as ReadyToClose on next phase detection
      // For now, check for any final objections
    }

    // Check for objections (replies from architects)
    const objections = await checkForObjections(emailSubject, sentDate);

    if (objections.length > 0) {
      // Relay objections to the issue
      for (const objection of objections) {
        const comment = COMMENT_TEMPLATES.objectionReceived({
          author: issue.author.login,
          objectionText: objection.bodyPreview,
          architectName: objection.from,
        });

        await addComment(repo, issue.number, comment);
        actions.push({
          issueNumber: issue.number,
          issueUrl: issue.url,
          repo,
          phase: Phase.Watching,
          action: `Relayed objection from ${objection.from}`,
          success: true,
          timestamp: now(),
          dryRun: getDryRun(),
        });
      }
    } else {
      log.info(`No objections found for issue #${issue.number}`);
    }
  } else {
    log.warn("Graph API not configured - cannot check for objections");
  }

  return actions;
}

/**
 * Handle Phase 5: Ready to Close
 * - Send approval email
 * - Add approval comment
 * - Close issue
 */
async function handleReadyToClose(issue: EnrichedIssue): Promise<IssueAction[]> {
  const actions: IssueAction[] = [];
  const repo = issue.repository.nameWithOwner;

  log.info(`Closing approved issue #${issue.number}`);

  const namespaces = getNamespacesRecord(issue.validation);
  const resourceProviderName =
    getResourceProviderName(issue.validation) ||
    extractResourceProviderFromTitle(issue.title) ||
    "Unknown";

  const emailSubject = `MGMT Plane Namespace Review for ${resourceProviderName}`;

  // Send approval email (reply to thread)
  if (isGraphConfigured() && !shouldSkipGraphApi()) {
    await sendArchitectApprovalEmail(emailSubject);
    actions.push({
      issueNumber: issue.number,
      issueUrl: issue.url,
      repo,
      phase: Phase.ReadyToClose,
      action: "Sent architect approval email",
      success: true,
      timestamp: now(),
      dryRun: getDryRun(),
    });
  }

  // Add approval comment
  const comment = COMMENT_TEMPLATES.namesApproved({
    dotnet: namespaces.dotnet,
    java: namespaces.java,
    javascript: namespaces.javascript,
    python: namespaces.python,
    go: namespaces.go,
  });

  await addComment(repo, issue.number, comment);
  actions.push({
    issueNumber: issue.number,
    issueUrl: issue.url,
    repo,
    phase: Phase.ReadyToClose,
    action: "Added approval comment",
    success: true,
    timestamp: now(),
    dryRun: getDryRun(),
  });

  // Close issue
  await closeIssue(repo, issue.number);
  actions.push({
    issueNumber: issue.number,
    issueUrl: issue.url,
    repo,
    phase: Phase.ReadyToClose,
    action: "Closed issue",
    success: true,
    timestamp: now(),
    dryRun: getDryRun(),
  });

  return actions;
}

// -----------------------------------------------------------------------------
// Main Processing
// -----------------------------------------------------------------------------

/**
 * Process a single issue through its current phase
 * @param issue - Enriched issue to process
 * @returns Processing result
 */
export async function processIssue(issue: EnrichedIssue): Promise<ProcessResult> {
  log.info(`Processing issue #${issue.number} (phase: ${issue.phase})`);

  try {
    let actions: IssueAction[] = [];

    switch (issue.phase) {
      case Phase.InitialReview:
        actions = await handleInitialReview(issue);
        break;

      case Phase.AwaitingMgmtApproval:
        actions = await handleAwaitingMgmtApproval(issue);
        break;

      case Phase.ReadyForArchitectReview:
        actions = await handleReadyForArchitectReview(issue);
        break;

      case Phase.Watching:
        actions = await handleWatching(issue);
        break;

      case Phase.ReadyToClose:
        actions = await handleReadyToClose(issue);
        break;

      default:
        log.warn(`Unknown phase: ${issue.phase}`);
    }

    return { issue, actions };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(`Failed to process issue #${issue.number}: ${errorMessage}`);

    return {
      issue,
      actions: [],
      error: {
        issueNumber: issue.number,
        issueUrl: issue.url,
        repo: issue.repository.nameWithOwner,
        phase: issue.phase,
        error: errorMessage,
        timestamp: now(),
      },
    };
  }
}

/**
 * Process all issues
 * @param issues - Array of enriched issues
 * @returns Array of processing results
 */
export async function processAllIssues(
  issues: EnrichedIssue[]
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];

  for (const issue of issues) {
    const result = await processIssue(issue);
    results.push(result);
  }

  return results;
}

// -----------------------------------------------------------------------------
// Standalone Execution
// -----------------------------------------------------------------------------

async function main(): Promise<void> {
  const { readOutput, writeOutput } = await import("./utils.ts");
  const issues = readOutput<EnrichedIssue[]>("issues.json");

  log.info(`Processing ${issues.length} issues...`);

  const results = await processAllIssues(issues);

  // Collect all actions and errors
  const allActions = results.flatMap((r) => r.actions);
  const allErrors = results.filter((r) => r.error).map((r) => r.error!);

  writeOutput("actions.json", allActions);
  writeOutput("errors.json", allErrors);

  log.info(`Completed: ${allActions.length} actions, ${allErrors.length} errors`);
}

// Run if executed directly
const isMain = process.argv[1]?.includes("process");
if (isMain) {
  main().catch(console.error);
}
