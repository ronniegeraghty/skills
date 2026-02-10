/**
 * Fetch Copilot-generated PRs from GitHub repositories
 *
 * Uses the GitHub CLI to query for PRs that were created by Copilot coding agent.
 * Copilot PRs are identified by:
 * - Branch name starting with "copilot/"
 * - Author being the authenticated user (since Copilot PRs are co-authored)
 *
 * @module fetch-prs
 */

import { execSync, spawnSync } from "child_process";
import {
  PR_STATUS,
  DEFAULT_STALE_DAYS,
  DEFAULT_SINCE_DAYS,
  OUTPUT_FILES,
} from "./constants.ts";
import type { PrStatusType } from "./constants.ts";
import { writeOutput, daysAgo, isOlderThanDays, formatDate } from "./utils.ts";
import type { RawPr, ClassifiedPr, PrSummary, PrsOutput, ParsedPrArgs } from "./types.ts";

// -----------------------------------------------------------------------------
// Argument Parsing
// -----------------------------------------------------------------------------

/**
 * Parse command line arguments
 */
function parseArgs(): ParsedPrArgs {
  const args = process.argv.slice(2);
  let repos: string[] = [];
  let sinceDate: string | null = null;
  let staleDays = DEFAULT_STALE_DAYS;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--repos" || args[i] === "-r") && args[i + 1]) {
      repos = args[++i].split(",").map((r) => r.trim());
    } else if (args[i] === "--since" && args[i + 1]) {
      sinceDate = args[++i];
    } else if (args[i] === "--stale-days" && args[i + 1]) {
      staleDays = parseInt(args[++i], 10);
    }
  }

  if (!sinceDate) {
    sinceDate = formatDate(daysAgo(DEFAULT_SINCE_DAYS));
  }

  return { repos, sinceDate, staleDays };
}

// -----------------------------------------------------------------------------
// GitHub CLI Helpers
// -----------------------------------------------------------------------------

/**
 * Check if GitHub CLI is authenticated
 */
function checkGhAuth(): boolean {
  try {
    execSync("gh auth status", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute a GitHub CLI command and return JSON result
 */
function ghCommand<T>(args: string[]): T {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
  });

  if (result.status !== 0) {
    throw new Error(`gh command failed: ${result.stderr || result.stdout}`);
  }

  try {
    return JSON.parse(result.stdout) as T;
  } catch {
    return result.stdout as unknown as T;
  }
}

// -----------------------------------------------------------------------------
// PR Fetching
// -----------------------------------------------------------------------------

/**
 * Fetch PRs from a repository
 */
function fetchRepoPrs(repo: string, sinceDate: string): (RawPr & { repo: string })[] {
  console.log(`Fetching PRs from ${repo}...`);

  // Fetch both open and closed PRs
  const prs: RawPr[] = [];

  for (const state of ["all"]) {
    try {
      const result = ghCommand<RawPr[]>([
        "pr",
        "list",
        "--repo",
        repo,
        "--state",
        state,
        "--limit",
        "500",
        "--json",
        "number,title,state,author,headRefName,createdAt,updatedAt,mergedAt,closedAt,url,additions,deletions,changedFiles",
      ]);

      if (Array.isArray(result)) {
        prs.push(...result);
      }
    } catch (error) {
      console.warn(
        `Warning: Failed to fetch ${state} PRs from ${repo}: ${(error as Error).message}`
      );
    }
  }

  // Filter to only Copilot-generated PRs (branch starts with "copilot/")
  const copilotPrs = prs.filter((pr) => {
    const isCopilotBranch = pr.headRefName && pr.headRefName.startsWith("copilot/");
    const isRecent = new Date(pr.createdAt) >= new Date(sinceDate);
    return isCopilotBranch && isRecent;
  });

  console.log(`Found ${copilotPrs.length} Copilot PRs in ${repo}`);
  return copilotPrs.map((pr) => ({ ...pr, repo }));
}

/**
 * Classify a PR's status based on its state and activity
 */
function classifyPr(pr: RawPr & { repo: string }, staleDays: number): PrStatusType {
  // Merged PRs are successful
  if (pr.mergedAt) {
    return PR_STATUS.MERGED;
  }

  // Closed without merge is abandoned
  if (pr.state === "CLOSED") {
    return PR_STATUS.ABANDONED;
  }

  // Open but stale (no activity for N days) is abandoned
  if (pr.state === "OPEN" && isOlderThanDays(pr.updatedAt, staleDays)) {
    return PR_STATUS.ABANDONED;
  }

  // Open with recent activity is active
  return PR_STATUS.ACTIVE;
}

// -----------------------------------------------------------------------------
// Main Function
// -----------------------------------------------------------------------------

/**
 * Main entry point for PR fetching
 */
async function main(): Promise<void> {
  const { repos, sinceDate, staleDays } = parseArgs();

  if (repos.length === 0) {
    console.error(
      "Error: No repositories specified. Use --repos owner/repo1,owner/repo2"
    );
    process.exit(1);
  }

  if (!checkGhAuth()) {
    console.error(
      "Error: GitHub CLI is not authenticated. Run 'gh auth login' first."
    );
    process.exit(1);
  }

  console.log(
    `Fetching Copilot PRs since ${sinceDate} from ${repos.length} repos...`
  );
  console.log(
    `PRs with no activity for ${staleDays}+ days will be classified as abandoned.\n`
  );

  // Fetch PRs from all repos
  const allPrs: (RawPr & { repo: string })[] = [];
  for (const repo of repos) {
    try {
      const prs = fetchRepoPrs(repo, sinceDate);
      allPrs.push(...prs);
    } catch (error) {
      console.error(`Error fetching PRs from ${repo}: ${(error as Error).message}`);
    }
  }

  // Classify PRs and add metadata
  const classifiedPrs: ClassifiedPr[] = allPrs.map((pr) => ({
    ...pr,
    status: classifyPr(pr, staleDays),
    analyzedAt: new Date().toISOString(),
  }));

  // Summary stats
  const summary: PrSummary = {
    total: classifiedPrs.length,
    merged: classifiedPrs.filter((pr) => pr.status === PR_STATUS.MERGED).length,
    abandoned: classifiedPrs.filter((pr) => pr.status === PR_STATUS.ABANDONED)
      .length,
    active: classifiedPrs.filter((pr) => pr.status === PR_STATUS.ACTIVE).length,
    repos: repos.length,
    sinceDate,
    staleDays,
  };

  console.log("\n=== Summary ===");
  console.log(`Total Copilot PRs: ${summary.total}`);
  console.log(`  Merged: ${summary.merged}`);
  console.log(`  Abandoned: ${summary.abandoned}`);
  console.log(`  Active (excluded from analysis): ${summary.active}`);

  // Write output
  const output: PrsOutput = {
    summary,
    prs: classifiedPrs,
  };
  writeOutput(OUTPUT_FILES.PRS, output);

  console.log("\nPR fetch complete.");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
