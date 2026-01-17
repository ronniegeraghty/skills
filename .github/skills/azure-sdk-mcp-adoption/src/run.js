#!/usr/bin/env node
/**
 * Azure SDK MCP Adoption Report Generator
 * 
 * Orchestrates the pipeline:
 * 1. fetch-telemetry - Get MCP tool usage from Kusto (3 months back)
 * 2. fetch-releases - Get releases from GitHub (target month)
 * 3. correlate - Match releases with MCP usage
 * 4. report - Generate markdown report
 */

import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getOutputDir, generateTimestamp } from "./utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const STEPS = [
  { name: "fetch-telemetry", script: "fetch-telemetry.js", desc: "Fetching MCP telemetry from Kusto" },
  { name: "fetch-releases", script: "fetch-releases.js", desc: "Fetching releases from GitHub" },
  { name: "correlate", script: "correlate.js", desc: "Correlating releases with MCP usage" },
  { name: "report", script: "report.js", desc: "Generating markdown report" }
];

/**
 * Run a single step
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

/**
 * Parse command line arguments
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

/**
 * Print help
 */
function printHelp() {
  console.log(`
Azure SDK MCP Adoption Report Generator

Usage: node src/run.js [options]

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
  node src/run.js --month 2026-01 --end 2026-01-17
  
  # Run only correlation and report steps
  node src/run.js --step correlate --step report
`);
}

/**
 * Main
 */
async function main() {
  const { steps: requestedSteps, passthrough } = parseArgs();
  
  // Set shared run ID
  if (!process.env.AZSDK_MCP_RUN_ID) {
    process.env.AZSDK_MCP_RUN_ID = generateTimestamp();
  }
  
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
