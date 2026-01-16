/**
 * Shared utilities for the Azure SDK MCP Adoption skill
 */

import { mkdirSync, existsSync, writeFileSync, readFileSync, readdirSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cache the current run's output directory for consistent access
let cachedOutputDir = null;

/**
 * Get the base output directory
 * @returns {string}
 */
export function getBaseOutputDir() {
  return join(__dirname, "..", "output");
}

/**
 * Generate a timestamp string for folder naming
 * @returns {string} - Format: YYYY-MM-DDTHH-MM-SS
 */
export function generateTimestamp() {
  const now = new Date();
  return now.toISOString()
    .replace(/:/g, "-")
    .replace(/\.\d{3}Z$/, "");
}

/**
 * Get or create the current run's output directory
 * Uses environment variable to share timestamp across scripts in a pipeline
 * @returns {string}
 */
export function getOutputDir() {
  // Return cached value if already computed in this process
  if (cachedOutputDir) {
    return cachedOutputDir;
  }

  const baseDir = getBaseOutputDir();
  
  // Check if we have a run ID from environment (set by the first script in a pipeline)
  let runId = process.env.AZSDK_MCP_RUN_ID;
  
  if (!runId) {
    // Generate new run ID
    runId = generateTimestamp();
    process.env.AZSDK_MCP_RUN_ID = runId;
  }
  
  const outputDir = join(baseDir, runId);
  
  // Ensure directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  cachedOutputDir = outputDir;
  return outputDir;
}

/**
 * Get the latest output directory (most recent run)
 * @returns {string|null}
 */
export function getLatestOutputDir() {
  const baseDir = getBaseOutputDir();
  
  if (!existsSync(baseDir)) {
    return null;
  }
  
  const entries = readdirSync(baseDir)
    .map(name => ({
      name,
      path: join(baseDir, name),
      stat: statSync(join(baseDir, name))
    }))
    .filter(e => e.stat.isDirectory())
    .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());
  
  return entries.length > 0 ? entries[0].path : null;
}

/**
 * Find the best output directory for reading pipeline data.
 * Searches recent run directories for required files.
 * @param {string[]} requiredFiles - Array of filenames that must exist
 * @returns {{ dir: string, found: string[] } | null}
 */
export function findOutputDirWithFiles(requiredFiles) {
  const baseDir = getBaseOutputDir();
  
  if (!existsSync(baseDir)) {
    return null;
  }
  
  // Get all run directories sorted by most recent
  const runDirs = readdirSync(baseDir)
    .map(name => ({
      name,
      path: join(baseDir, name),
      stat: statSync(join(baseDir, name))
    }))
    .filter(e => e.stat.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(e.name))
    .sort((a, b) => b.name.localeCompare(a.name)); // Sort by name (timestamp) descending
  
  // For each directory, check if all required files exist
  for (const runDir of runDirs) {
    const found = requiredFiles.filter(f => existsSync(join(runDir.path, f)));
    if (found.length === requiredFiles.length) {
      return { dir: runDir.path, found };
    }
  }
  
  // If no single directory has all files, try to find files across recent runs
  // This handles the case where telemetry.json and releases.json are in different dirs
  const fileLocations = {};
  for (const file of requiredFiles) {
    for (const runDir of runDirs) {
      const filepath = join(runDir.path, file);
      if (existsSync(filepath)) {
        fileLocations[file] = filepath;
        break;
      }
    }
  }
  
  // Check if we found all files
  const foundFiles = Object.keys(fileLocations);
  if (foundFiles.length === requiredFiles.length) {
    return { 
      dir: null, 
      files: fileLocations,
      found: foundFiles 
    };
  }
  
  return null;
}

/**
 * Write JSON data to the output directory
 * @param {string} filename 
 * @param {object} data 
 * @param {string} [outputDir] - Optional specific output directory
 */
export function writeOutput(filename, data, outputDir = null) {
  const dir = outputDir || getOutputDir();
  const path = join(dir, filename);
  writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
}

/**
 * Load JSON from a file
 * @param {string} filepath 
 * @returns {object|null}
 */
export function loadJson(filepath) {
  if (!existsSync(filepath)) {
    return null;
  }
  return JSON.parse(readFileSync(filepath, "utf-8"));
}

/**
 * Parse command line arguments
 * @param {string[]} argDefs - Array of argument names to look for
 * @returns {object}
 */
export function parseArgs(argDefs) {
  const args = process.argv.slice(2);
  const result = {};
  
  for (const def of argDefs) {
    result[def] = [];
  }
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i].replace(/^--/, "");
    if (argDefs.includes(arg) && args[i + 1]) {
      result[arg].push(args[++i]);
    }
  }
  
  return result;
}

/**
 * Format a date for display
 * @param {string|Date} date 
 * @returns {string}
 */
export function formatDate(date) {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

/**
 * Format a number with commas
 * @param {number} num 
 * @returns {string}
 */
export function formatNumber(num) {
  return num.toLocaleString();
}
