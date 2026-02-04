#!/usr/bin/env node
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
import { setOutputDir, generateTimestamp, getOutputDir } from "./utils.js";
import { OUTPUT_DIR } from "./constants.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// -----------------------------------------------------------------------------
// Pipeline Configuration
// -----------------------------------------------------------------------------

/**
 * Pipeline steps in execution order
 */
const STEPS = [
  { name: "fetch-prs", script: "fetch-prs.js", desc: "Fetching Copilot PRs from GitHub" },
  { name: "fetch-sessions", script: "fetch-sessions.js", desc: "Fetching session logs for PRs" },
  { name: "analyze", script: "analyze.js", desc: "Analyzing resource/tool correlations" },
  { name: "report", script: "report.js", desc: "Generating markdown report" }
];

// -----------------------------------------------------------------------------
// Step Execution
// -----------------------------------------------------------------------------

/**
 * Run a single pipeline step
 * 
 * @param {Object} step - Step configuration with name, script, and desc
 * @param {string[]} args - Command line arguments to pass to the script
 * @returns {Promise<void>} Resolves when step completes successfully
 * @throws {Error} If step exits with non-zero code
 */
function runStep(step, args = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = join(__dirname, step.script);
    
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Step: ${step.name}`);
    console.log(`Description: ${step.desc}`);
    console.log("=".repeat(60));
    
    const child = spawn("node", [scriptPath, ...args], {
      stdio: "inherit",
      env: {
        ...process.env,
        OUTPUT_DIR: getOutputDir()
      },
      cwd: join(__dirname, "..")
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
 * 
 * @returns {{ steps: string[], passthrough: string[], showHelp: boolean }}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const steps = [];
  const passthrough = [];
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
function showHelp() {
  console.log(`
Copilot PR Analysis Report Generator

Usage:
  node src/run.js --repos owner/repo1,owner/repo2 [options]

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
  node src/run.js --repos Azure/azure-sdk-for-js

  # Multiple repos
  node src/run.js --repos Azure/azure-sdk-for-js,Azure/azure-sdk-for-python

  # Custom date range
  node src/run.js --repos owner/repo --since 2025-11-01 --stale-days 7

  # Run only analysis and report (using existing data)
  node src/run.js --step analyze --step report

Output:
  Results are saved to output/<timestamp>/ containing:
    - prs.json           Raw PR data
    - sessions.json      Session logs and extracted metadata
    - analysis.json      Correlation analysis results
    - report.md          Human-readable report
    - summary.json       Quick summary for automation
`);
}

// -----------------------------------------------------------------------------
// Main Pipeline
// -----------------------------------------------------------------------------

/**
 * Main entry point
 */
async function main() {
  const { steps, passthrough, showHelp: needsHelp } = parseArgs();
  
  if (needsHelp) {
    showHelp();
    process.exit(0);
  }
  
  // Validate repos argument
  if (!passthrough.some(arg => arg === "--repos" || arg === "-r") && steps.length === 0) {
    console.error("Error: --repos is required unless running specific steps.");
    console.error("Run with --help for usage information.");
    process.exit(1);
  }
  
  // Initialize output directory
  const baseDir = join(__dirname, "..", OUTPUT_DIR);
  setOutputDir(join(baseDir, generateTimestamp()));
  
  console.log("Copilot PR Analysis Report Generator");
  console.log("=====================================");
  console.log(`Output directory: ${getOutputDir()}`);
  
  // Determine which steps to run
  let stepsToRun = STEPS;
  if (steps.length > 0) {
    stepsToRun = steps.map(stepName => {
      const step = STEPS.find(s => s.name === stepName);
      if (!step) {
        console.error(`Unknown step: ${stepName}`);
        console.error(`Available steps: ${STEPS.map(s => s.name).join(", ")}`);
        process.exit(1);
      }
      return step;
    });
  }
  
  console.log(`Steps to run: ${stepsToRun.map(s => s.name).join(" → ")}`);
  
  const startTime = Date.now();
  
  // Run pipeline
  for (const step of stepsToRun) {
    try {
      await runStep(step, passthrough);
    } catch (error) {
      console.error(`\nPipeline failed at step '${step.name}'`);
      console.error(error.message);
      process.exit(1);
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(`\n${"=".repeat(60)}`);
  console.log("Pipeline Complete!");
  console.log("=".repeat(60));
  console.log(`Duration: ${duration}s`);
  console.log(`Output: ${getOutputDir()}`);
  console.log("\nGenerated files:");
  console.log("  - prs.json         (PR data)");
  console.log("  - sessions.json    (Session logs)");
  console.log("  - analysis.json    (Correlation analysis)");
  console.log("  - report.md        (Human-readable report)");
  console.log("  - summary.json     (Quick summary)");
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
