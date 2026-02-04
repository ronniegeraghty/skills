/**
 * Shared utilities for the Azure SDK MCP Adoption skill
 * 
 * Provides common functionality for:
 * - Output directory management (timestamped run folders)
 * - File I/O operations (JSON read/write)
 * - Cross-run file discovery (finding data from previous runs)
 */

import { mkdirSync, existsSync, writeFileSync, readFileSync, readdirSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// -----------------------------------------------------------------------------
// Module State
// -----------------------------------------------------------------------------

/** Cached output directory path for the current run */
let cachedOutputDir = null;

// -----------------------------------------------------------------------------
// Directory Management
// -----------------------------------------------------------------------------

/**
 * Get the base output directory path
 * @returns {string} Absolute path to the output folder
 */
export function getBaseOutputDir() {
  return join(__dirname, "..", "output");
}

/**
 * Generate a timestamp string for folder naming
 * Format: YYYY-MM-DDTHH-MM-SS (ISO 8601 with colons replaced by dashes)
 * @returns {string}
 */
export function generateTimestamp() {
  const now = new Date();
  return now.toISOString()
    .replace(/:/g, "-")
    .replace(/\.\d{3}Z$/, "");
}

/**
 * Get or create the current run's output directory
 * 
 * Uses the AZSDK_MCP_RUN_ID environment variable to share the run ID
 * across scripts in a pipeline. If not set, generates a new timestamp.
 * 
 * @returns {string} Absolute path to the run's output folder
 */
export function getOutputDir() {
  if (cachedOutputDir) {
    return cachedOutputDir;
  }

  const baseDir = getBaseOutputDir();
  
  // Use existing run ID or generate new one
  let runId = process.env.AZSDK_MCP_RUN_ID;
  if (!runId) {
    runId = generateTimestamp();
    process.env.AZSDK_MCP_RUN_ID = runId;
  }
  
  const outputDir = join(baseDir, runId);
  
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  cachedOutputDir = outputDir;
  return outputDir;
}

/**
 * Find output directories containing specific files
 * 
 * Searches recent run directories for required files. Handles cases where
 * files may be split across multiple runs (e.g., telemetry from one run,
 * releases from another).
 * 
 * @param {string[]} requiredFiles - Array of filenames to search for
 * @returns {Object|null} Object containing found file paths, or null if not found
 * @returns {string} [return.dir] - Directory containing all files (if all in one dir)
 * @returns {Object.<string, string>} [return.files] - Map of filename to full path
 * @returns {string[]} return.found - List of found filenames
 */
export function findOutputDirWithFiles(requiredFiles) {
  const baseDir = getBaseOutputDir();
  
  if (!existsSync(baseDir)) {
    return null;
  }
  
  // Get all run directories sorted by timestamp (newest first)
  const runDirs = readdirSync(baseDir)
    .map(name => ({
      name,
      path: join(baseDir, name),
      stat: statSync(join(baseDir, name))
    }))
    .filter(e => e.stat.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(e.name))
    .sort((a, b) => b.name.localeCompare(a.name));
  
  // Try to find a single directory with all required files
  for (const runDir of runDirs) {
    const found = requiredFiles.filter(f => existsSync(join(runDir.path, f)));
    if (found.length === requiredFiles.length) {
      return { dir: runDir.path, found };
    }
  }
  
  // If no single directory has all files, search across multiple runs
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

// -----------------------------------------------------------------------------
// File I/O
// -----------------------------------------------------------------------------

/**
 * Write JSON data to the output directory
 * @param {string} filename - Name of the file (e.g., "telemetry.json")
 * @param {Object} data - Data to serialize
 * @param {string} [outputDir] - Specific output directory (defaults to current run)
 * @returns {string} Full path to the written file
 */
export function writeOutput(filename, data, outputDir = null) {
  const dir = outputDir || getOutputDir();
  const path = join(dir, filename);
  writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
}
