#!/usr/bin/env node
/**
 * Unified runner script for Azure SDK MCP Adoption reporting
 * 
 * This script orchestrates all the individual scripts in the correct order:
 * 1. fetch-telemetry.js - Fetch MCP telemetry from Kusto
 * 2. fetch-releases.js - Fetch release data from GitHub
 * 3. correlate.js - Correlate telemetry with releases
 * 4. report.js - Generate the markdown report
 * 
 * All scripts share the same output directory via the AZSDK_MCP_RUN_ID env var.
 */

import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getOutputDir, generateTimestamp } from "./utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Define the pipeline steps
const STEPS = [
  { name: "fetch-telemetry", script: "fetch-telemetry.js", description: "Fetching MCP telemetry from Kusto" },
  { name: "fetch-releases", script: "fetch-releases.js", description: "Fetching release data from GitHub" },
  { name: "correlate", script: "correlate.js", description: "Correlating telemetry with releases" },
  { name: "report", script: "report.js", description: "Generating markdown report" }
];

/**
 * Run a single step as a child process
 * @param {object} step - Step configuration
 * @param {string[]} args - Command line arguments to pass through
 * @returns {Promise<void>}
 */
function runStep(step, args = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = join(__dirname, step.script);
    
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Step: ${step.name}`);
    console.log(`Description: ${step.description}`);
    console.log("=".repeat(60));
    
    const child = spawn("node", [scriptPath, ...args], {
      stdio: "inherit",
      env: process.env,
      cwd: join(__dirname, "..")
    });
    
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${step.name} failed with exit code ${code}`));
      }
    });
    
    child.on("error", (err) => {
      reject(new Error(`Failed to start ${step.name}: ${err.message}`));
    });
  });
}

/**
 * Parse arguments to determine which steps to run and which args to pass
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
      // Pass through other arguments to child scripts
      passthrough.push(arg);
      // Include the value if this looks like a flag
      if (arg.startsWith("--") && args[i + 1] && !args[i + 1].startsWith("--")) {
        passthrough.push(args[++i]);
      }
    }
  }
  
  return { steps, passthrough };
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Azure SDK MCP Adoption Report Generator

Usage: node src/run.js [options]

Options:
  --help, -h              Show this help message
  --step <name>           Run only specific step(s). Can be specified multiple times.
                          Valid steps: ${STEPS.map(s => s.name).join(", ")}
  
  All other arguments are passed through to the individual scripts:
  
  --start YYYY-MM-DD      Start date for telemetry (default: 2 months before release cycle end)
  --end YYYY-MM-DD        End date for telemetry (default: end of 16th of current month)
  --month YYYY-MM         Month(s) for release data (can specify multiple)
  --language js,python    Languages to include (default: all)

Examples:
  # Run the full pipeline with defaults
  node src/run.js
  
  # Run with specific date range
  node src/run.js --start 2025-12-01 --end 2026-01-17
  
  # Run only specific steps
  node src/run.js --step correlate --step report
  
  # Run with specific months
  node src/run.js --month 2025-12 --month 2026-01
`);
}

/**
 * Main entry point
 */
async function main() {
  const { steps: requestedSteps, passthrough } = parseArgs();
  
  // Set the run ID so all scripts share the same output directory
  if (!process.env.AZSDK_MCP_RUN_ID) {
    process.env.AZSDK_MCP_RUN_ID = generateTimestamp();
  }
  
  const outputDir = getOutputDir();
  
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║      Azure SDK MCP Adoption Report Generator               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\nRun ID: ${process.env.AZSDK_MCP_RUN_ID}`);
  console.log(`Output directory: ${outputDir}`);
  
  // Determine which steps to run
  let stepsToRun = STEPS;
  if (requestedSteps.length > 0) {
    stepsToRun = requestedSteps.map(name => {
      const step = STEPS.find(s => s.name === name);
      if (!step) {
        console.error(`Unknown step: ${name}`);
        console.error(`Valid steps: ${STEPS.map(s => s.name).join(", ")}`);
        process.exit(1);
      }
      return step;
    });
  }
  
  console.log(`\nSteps to run: ${stepsToRun.map(s => s.name).join(" → ")}`);
  if (passthrough.length > 0) {
    console.log(`Arguments: ${passthrough.join(" ")}`);
  }
  
  const startTime = Date.now();
  
  // Run each step in sequence
  for (const step of stepsToRun) {
    try {
      await runStep(step, passthrough);
    } catch (error) {
      console.error(`\n❌ Pipeline failed at step: ${step.name}`);
      console.error(error.message);
      process.exit(1);
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ Pipeline completed successfully!");
  console.log(`Total time: ${elapsed}s`);
  console.log(`Output directory: ${outputDir}`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
