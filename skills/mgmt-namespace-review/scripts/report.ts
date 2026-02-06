/**
 * Report generation for the MGMT Namespace Review skill
 *
 * Generates a summary report of actions taken during a run.
 */

import { Phase } from "./types.ts";
import type { EnrichedIssue, IssueAction, ProcessingError, RunReport } from "./types.ts";
import { createLogger, writeOutput, readOutput, getOutputDir, getDryRun, now } from "./utils.ts";
import { LANGUAGE_DISPLAY_NAMES } from "./constants.ts";

const log = createLogger("report");

// -----------------------------------------------------------------------------
// Report Generation
// -----------------------------------------------------------------------------

/**
 * Generate a run report from processing results
 * @param issues - Processed issues
 * @param actions - Actions taken
 * @param errors - Errors encountered
 * @param startTime - Run start time
 * @returns Run report
 */
export function generateReport(
  issues: EnrichedIssue[],
  actions: IssueAction[],
  errors: ProcessingError[],
  startTime: string
): RunReport {
  const runId = process.env.MGMT_NS_RUN_ID || "unknown";

  // Count issues by phase
  const issuesByPhase = issues.reduce(
    (acc, issue) => {
      acc[issue.phase] = (acc[issue.phase] || 0) + 1;
      return acc;
    },
    {} as Record<Phase, number>
  );

  const issuesWithActions = new Set(actions.map((a) => a.issueNumber));
  const issuesWithErrors = new Set(errors.map((e) => e.issueNumber));

  return {
    runId,
    startTime,
    endTime: now(),
    dryRun: getDryRun(),
    totalIssues: issues.length,
    issuesByPhase,
    actionsPerformed: actions,
    errors,
    issuesProcessed: issuesWithActions.size,
    issuesSkipped: issues.length - issuesWithActions.size - issuesWithErrors.size,
  };
}

/**
 * Generate markdown report content
 * @param report - Run report
 * @param issues - Processed issues
 * @returns Markdown string
 */
export function generateMarkdownReport(
  report: RunReport,
  issues: EnrichedIssue[]
): string {
  const lines: string[] = [];

  // Header
  lines.push("# MGMT Namespace Review Run Report");
  lines.push("");

  if (report.dryRun) {
    lines.push("> ⚠️ **DRY RUN** - No actual changes were made");
    lines.push("");
  }

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Run ID | \`${report.runId}\` |`);
  lines.push(`| Start Time | ${report.startTime} |`);
  lines.push(`| End Time | ${report.endTime} |`);
  lines.push(`| Total Issues | ${report.totalIssues} |`);
  lines.push(`| Issues Processed | ${report.issuesProcessed} |`);
  lines.push(`| Issues Skipped | ${report.issuesSkipped} |`);
  lines.push(`| Errors | ${report.errors.length} |`);
  lines.push("");

  // Issues by Phase
  lines.push("## Issues by Phase");
  lines.push("");
  lines.push("| Phase | Count |");
  lines.push("|-------|-------|");

  for (const phase of Object.values(Phase)) {
    const count = report.issuesByPhase[phase] || 0;
    lines.push(`| ${phase} | ${count} |`);
  }
  lines.push("");

  // Actions Taken
  if (report.actionsPerformed.length > 0) {
    lines.push("## Actions Taken");
    lines.push("");

    // Group actions by issue
    const actionsByIssue = report.actionsPerformed.reduce(
      (acc, action) => {
        const key = `${action.repo}#${action.issueNumber}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(action);
        return acc;
      },
      {} as Record<string, IssueAction[]>
    );

    for (const [issueKey, issueActions] of Object.entries(actionsByIssue)) {
      const firstAction = issueActions[0];
      lines.push(`### ${issueKey}`);
      lines.push("");
      lines.push(`- **URL:** ${firstAction.issueUrl}`);
      lines.push(`- **Phase:** ${firstAction.phase}`);
      lines.push("");
      lines.push("| Action | Timestamp |");
      lines.push("|--------|-----------|");

      for (const action of issueActions) {
        const prefix = action.dryRun ? "🔸 " : "✅ ";
        lines.push(`| ${prefix}${action.action} | ${action.timestamp} |`);
      }
      lines.push("");
    }
  }

  // Errors
  if (report.errors.length > 0) {
    lines.push("## Errors");
    lines.push("");

    for (const error of report.errors) {
      lines.push(`### ${error.repo}#${error.issueNumber}`);
      lines.push("");
      lines.push(`- **URL:** ${error.issueUrl}`);
      lines.push(`- **Phase:** ${error.phase}`);
      lines.push(`- **Error:** ${error.error}`);
      lines.push(`- **Timestamp:** ${error.timestamp}`);
      lines.push("");
    }
  }

  // Issue Details
  lines.push("## Issue Details");
  lines.push("");

  for (const issue of issues) {
    const validIcon = issue.validation.isValid ? "✅" : "❌";
    lines.push(`### ${validIcon} #${issue.number}: ${issue.title}`);
    lines.push("");
    lines.push(`- **Repository:** ${issue.repository.nameWithOwner}`);
    lines.push(`- **URL:** ${issue.url}`);
    lines.push(`- **Phase:** ${issue.phase}`);
    lines.push(`- **Project Status:** ${issue.projectStatus || "Not in project"}`);
    lines.push(`- **Validation:** ${issue.validation.isValid ? "Passed" : "Failed"}`);
    lines.push("");

    if (issue.validation.namespaces.length > 0) {
      lines.push("**Namespaces:**");
      lines.push("");
      for (const ns of issue.validation.namespaces) {
        const langName = LANGUAGE_DISPLAY_NAMES[ns.language];
        const icon = ns.isValid ? "✓" : "✗";
        lines.push(`- ${icon} **${langName}:** \`${ns.raw}\``);
      }
      lines.push("");
    }

    if (!issue.validation.isValid) {
      lines.push("**Validation Errors:**");
      lines.push("");
      for (const error of issue.validation.errors) {
        lines.push(`- ⚠️ ${error}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Write the report to the output directory
 * @param report - Run report
 * @param issues - Processed issues
 */
export function writeReport(report: RunReport, issues: EnrichedIssue[]): void {
  // Write JSON report
  const jsonPath = writeOutput("report.json", report);
  log.info(`Wrote JSON report to ${jsonPath}`);

  // Write markdown report
  const markdown = generateMarkdownReport(report, issues);
  const mdPath = writeOutput("report.md", markdown);
  log.info(`Wrote markdown report to ${mdPath}`);
}

// -----------------------------------------------------------------------------
// Standalone Execution
// -----------------------------------------------------------------------------

async function main(): Promise<void> {
  // Read data from previous steps
  const issues = readOutput<EnrichedIssue[]>("issues.json");
  const actions = readOutput<IssueAction[]>("actions.json");
  const errors = readOutput<ProcessingError[]>("errors.json");

  // Generate report
  const startTime = process.env.MGMT_NS_START_TIME || now();
  const report = generateReport(issues, actions, errors, startTime);

  // Write report
  writeReport(report, issues);

  // Print summary to console
  console.log("\n" + "=".repeat(60));
  console.log("RUN SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total Issues: ${report.totalIssues}`);
  console.log(`Issues Processed: ${report.issuesProcessed}`);
  console.log(`Issues Skipped: ${report.issuesSkipped}`);
  console.log(`Errors: ${report.errors.length}`);
  console.log(`Actions Taken: ${report.actionsPerformed.length}`);

  if (report.dryRun) {
    console.log("\n⚠️  This was a DRY RUN - no actual changes were made");
  }

  console.log(`\nFull report: ${getOutputDir()}/report.md`);
}

// Run if executed directly
const isMain = process.argv[1]?.includes("report");
if (isMain) {
  main().catch(console.error);
}
