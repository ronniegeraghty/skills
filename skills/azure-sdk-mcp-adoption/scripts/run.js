#!/usr/bin/env node
/**
 * Azure SDK MCP Adoption Report Generator
 * 
 * Pipeline orchestrator that runs all steps in sequence:
 * 1. fetch-telemetry - Query Kusto for MCP tool usage data
 * 2. fetch-releases  - Fetch monthly release data from GitHub
 * 3. correlate       - Match releases with MCP usage
 * 4. report          - Generate markdown report with charts
 * 
 * Each step produces JSON output that the next step consumes.
 * All outputs go to a timestamped directory (e.g., output/2026-01-20T10-30-00/).
 * 
 * @module run
 */

import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getOutputDir, generateTimestamp } from "./utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// -----------------------------------------------------------------------------
// Pipeline Configuration
// -----------------------------------------------------------------------------

/**
 * Pipeline steps in execution order
 */
const STEPS = [
  { name: "fetch-telemetry", script: "fetch-telemetry.js", desc: "Fetching MCP telemetry from Kusto" },
  { name: "fetch-releases", script: "fetch-releases.js", desc: "Fetching releases from GitHub" },
  { name: "correlate", script: "correlate.js", desc: "Correlating releases with MCP usage" },
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
      env: process.env,
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
 * Supported arguments:
 *   --step <name>     Run specific step(s) only (can be repeated)
 *   --help, -h        Show help message
 *   All other args    Passed through to individual scripts
 * 
 * @returns {{ steps: string[], passthrough: string[] }}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const steps = [];
  const passthrough = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === "--step" && args[i + 1]) {
      steps.push(args[++i]);
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      passthrough.push(arg);
      if (arg.startsWith("--") && args[i + 1] && !args[i + 1].startsWith("--")) {
        passthrough.push(args[++i]);
      }
    }
  }
  
  return { steps, passthrough };
}

// -----------------------------------------------------------------------------
// Help Output
// -----------------------------------------------------------------------------

/**
 * Print help message to console
 */
function printHelp() {
  console.log(`
Azure SDK MCP Adoption Report Generator

Usage: node scripts/run.js [options]

Options:
  --help, -h              Show this help
  --step <name>           Run specific step(s) only
                          Steps: fetch-telemetry, fetch-releases, correlate, report
  
Arguments passed to scripts:
  --month YYYY-MM         Release month (default: current month)
  --start YYYY-MM-DD      Telemetry start date (default: 3 months before end)
  --end YYYY-MM-DD        Telemetry end date (default: 17th of current month)

Examples:
  # Run full pipeline for January 2026 releases
  node scripts/run.js --month 2026-01 --end 2026-01-17
  
  # Run only correlation and report steps
  node scripts/run.js --step correlate --step report
`);
}

// -----------------------------------------------------------------------------
// Main Entry Point
// -----------------------------------------------------------------------------

/**
 * Main function - orchestrates the pipeline
 */
async function main() {
  const { steps: requestedSteps, passthrough } = parseArgs();
  
  // Always generate a new run ID for each pipeline run
  // This ensures outputs always go to a fresh directory with the current timestamp
  process.env.AZSDK_MCP_RUN_ID = generateTimestamp();
  
  const outputDir = getOutputDir();
  
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║      Azure SDK MCP Adoption Report Generator               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\nRun ID: ${process.env.AZSDK_MCP_RUN_ID}`);
  console.log(`Output: ${outputDir}`);
  
  // Determine steps to run
  let stepsToRun = STEPS;
  if (requestedSteps.length > 0) {
    stepsToRun = requestedSteps.map(name => {
      const step = STEPS.find(s => s.name === name);
      if (!step) {
        console.error(`Unknown step: ${name}`);
        process.exit(1);
      }
      return step;
    });
  }
  
  console.log(`Steps: ${stepsToRun.map(s => s.name).join(" → ")}`);
  if (passthrough.length > 0) {
    console.log(`Args: ${passthrough.join(" ")}`);
  }
  
  const startTime = Date.now();
  
  for (const step of stepsToRun) {
    try {
      await runStep(step, passthrough);
    } catch (error) {
      console.error(`\n❌ Failed at: ${step.name}`);
      console.error(error.message);
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
