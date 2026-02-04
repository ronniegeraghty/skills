#!/usr/bin/env npx tsx
/**
 * Copilot PR Analysis Report Generator
 *
 * Pipeline orchestrator that runs all steps in sequence:
 * 1. fetch-prs     - Query GitHub for Copilot-generated PRs
 * 2. fetch-sessions - Fetch session logs for each PR
 * 3. analyze       - Extract resources/tools and correlate with outcomes
 * 4. report        - Generate markdown report with charts
 *
 * Each step produces JSON output that the next step consumes.
 * All outputs go to a timestamped directory (e.g., output/2026-01-21T10-30-00/).
 *
 * @module run
 */

import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { setOutputDir, generateTimestamp, getOutputDir } from "./utils.ts";
import { OUTPUT_DIR } from "./constants.ts";
import type { PipelineStep, ParsedRunArgs } from "./types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

// -----------------------------------------------------------------------------
// Pipeline Configuration
// -----------------------------------------------------------------------------

/**
 * Pipeline steps in execution order
 */
const STEPS: PipelineStep[] = [
  {
    name: "fetch-prs",
    script: "fetch-prs.ts",
    desc: "Fetching Copilot PRs from GitHub",
  },
  {
    name: "fetch-sessions",
    script: "fetch-sessions.ts",
    desc: "Fetching session logs for PRs",
  },
  {
    name: "analyze",
    script: "analyze.ts",
    desc: "Analyzing resource/tool correlations",
  },
  { name: "report", script: "report.ts", desc: "Generating markdown report" },
];

// -----------------------------------------------------------------------------
// Step Execution
// -----------------------------------------------------------------------------

/**
 * Run a single pipeline step
 */
function runStep(step: PipelineStep, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptPath = join(__dirname, step.script);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`Step: ${step.name}`);
    console.log(`Description: ${step.desc}`);
    console.log("=".repeat(60));

    const child = spawn("npx", ["tsx", scriptPath, ...args], {
      stdio: "inherit",
      env: {
        ...process.env,
        OUTPUT_DIR: getOutputDir(),
      },
      cwd: join(__dirname, ".."),
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${step.name} failed with exit code ${code}`));
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to start ${step.name}: ${err.message}`));
    });
  });
}

// -----------------------------------------------------------------------------
// Argument Parsing
// -----------------------------------------------------------------------------

/**
 * Parse command line arguments
 */
function parseArgs(): ParsedRunArgs {
  const args = process.argv.slice(2);
  const steps: string[] = [];
  const passthrough: string[] = [];
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--step" && args[i + 1]) {
      steps.push(args[++i]);
    } else if (arg === "--help" || arg === "-h") {
      showHelp = true;
    } else {
      passthrough.push(arg);
    }
  }

  return { steps, passthrough, showHelp };
}

/**
 * Display help message
 */
function showHelpMessage(): void {
  console.log(`
Copilot PR Analysis Report Generator

Usage:
  npx tsx scripts/run.ts --repos owner/repo1,owner/repo2 [options]

Required:
  --repos, -r <repos>    Comma-separated list of repositories to analyze

Options:
  --since <date>         Start date for PR query (YYYY-MM-DD)
  --stale-days <n>       Days of inactivity before PR is considered abandoned (default: 14)
  --step <name>          Run specific step(s) only (can be repeated)
  --help, -h             Show this help message

Available steps:
  fetch-prs              Query GitHub for Copilot-generated PRs
  fetch-sessions         Fetch session logs for each PR
  analyze                Extract resources/tools and correlate with outcomes
  report                 Generate markdown report with charts

Examples:
  # Full pipeline
  npx tsx scripts/run.ts --repos Azure/azure-sdk-for-js

  # Multiple repos
  npx tsx scripts/run.ts --repos Azure/azure-sdk-for-js,Azure/azure-sdk-for-python

  # Custom date range
  npx tsx scripts/run.ts --repos owner/repo --since 2025-11-01 --stale-days 7

  # Run only analysis and report (using existing data)
  npx tsx scripts/run.ts --step analyze --step report

Output:
  Results are saved to output/<timestamp>/ containing:
    - prs.json           Raw PR data
    - sessions.json      Session logs with extracted data
    - analysis.json      Correlation analysis
    - report.md          Human-readable report
`);
}

// -----------------------------------------------------------------------------
// Main Entry Point
// -----------------------------------------------------------------------------

/**
 * Main function - orchestrates the pipeline
 */
async function main(): Promise<void> {
  const { steps: requestedSteps, passthrough, showHelp } = parseArgs();

  if (showHelp) {
    showHelpMessage();
    process.exit(0);
  }

  // Generate a new run ID for this pipeline run
  const runId = generateTimestamp();
  const baseDir = join(__dirname, "..", "..", OUTPUT_DIR);
  const outputDir = join(baseDir, runId);
  setOutputDir(outputDir);

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║        Copilot PR Analysis Report Generator                ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\nRun ID: ${runId}`);
  console.log(`Output: ${outputDir}`);

  // Determine steps to run
  let stepsToRun = STEPS;
  if (requestedSteps.length > 0) {
    stepsToRun = requestedSteps.map((name) => {
      const step = STEPS.find((s) => s.name === name);
      if (!step) {
        console.error(`Unknown step: ${name}`);
        process.exit(1);
      }
      return step;
    });
  }

  console.log(`Steps: ${stepsToRun.map((s) => s.name).join(" → ")}`);
  if (passthrough.length > 0) {
    console.log(`Args: ${passthrough.join(" ")}`);
  }

  const startTime = Date.now();

  for (const step of stepsToRun) {
    try {
      await runStep(step, passthrough);
    } catch (error) {
      console.error(`\n❌ Failed at: ${step.name}`);
      console.error((error as Error).message);
      process.exit(1);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ Pipeline completed!");
  console.log(`Time: ${elapsed}s`);
  console.log(`Output: ${outputDir}`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
