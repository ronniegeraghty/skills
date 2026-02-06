/**
 * Shared utilities for the MGMT Namespace Review skill
 *
 * Provides common functionality for:
 * - Output directory management (timestamped run folders)
 * - File I/O operations (JSON read/write)
 * - Logging with dry-run awareness
 * - Cross-run file discovery
 */

import {
  mkdirSync,
  existsSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
} from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { TOKEN_CACHE_DIR, TOKEN_CACHE_FILE } from "./constants.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface FoundFiles {
  dir: string | null;
  files?: Record<string, string>;
  found: string[];
}

export interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  action: (message: string) => void;
  dryRun: (message: string) => void;
}

// -----------------------------------------------------------------------------
// Module State
// -----------------------------------------------------------------------------

/** Cached output directory path for the current run */
let cachedOutputDir: string | null = null;

/** Whether we're in dry-run mode */
let isDryRun = false;

// -----------------------------------------------------------------------------
// Dry Run Mode
// -----------------------------------------------------------------------------

/**
 * Set dry-run mode
 * @param value - Whether to enable dry-run mode
 */
export function setDryRun(value: boolean): void {
  isDryRun = value;
}

/**
 * Check if we're in dry-run mode
 * @returns true if in dry-run mode
 */
export function getDryRun(): boolean {
  return isDryRun;
}

// -----------------------------------------------------------------------------
// Logging
// -----------------------------------------------------------------------------

/** ANSI color codes */
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

/**
 * Create a logger with consistent formatting
 * @param prefix - Optional prefix for log messages
 * @returns Logger object with info, warn, error, action, and dryRun methods
 */
export function createLogger(prefix?: string): Logger {
  const pfx = prefix ? `[${prefix}] ` : "";

  return {
    info: (message: string) => {
      console.log(`${colors.blue}ℹ${colors.reset} ${pfx}${message}`);
    },
    warn: (message: string) => {
      console.log(`${colors.yellow}⚠${colors.reset} ${pfx}${message}`);
    },
    error: (message: string) => {
      console.log(`${colors.red}✖${colors.reset} ${pfx}${message}`);
    },
    action: (message: string) => {
      const prefix = isDryRun ? `${colors.magenta}[DRY-RUN]${colors.reset} ` : "";
      console.log(`${colors.green}✓${colors.reset} ${prefix}${pfx}${message}`);
    },
    dryRun: (message: string) => {
      console.log(`${colors.magenta}⊘ [DRY-RUN]${colors.reset} ${pfx}Would: ${message}`);
    },
  };
}

// Default logger
export const log = createLogger();

// -----------------------------------------------------------------------------
// Directory Management
// -----------------------------------------------------------------------------

/**
 * Get the base output directory path
 * @returns Absolute path to the output folder
 */
export function getBaseOutputDir(): string {
  return join(__dirname, "..", "output");
}

/**
 * Generate a timestamp string for folder naming
 * Format: YYYY-MM-DDTHH-MM-SS (ISO 8601 with colons replaced by dashes)
 * @returns Timestamp string
 */
export function generateTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "");
}

/**
 * Get or create the current run's output directory
 *
 * Uses the MGMT_NS_RUN_ID environment variable to share the run ID
 * across scripts in a pipeline. If not set, generates a new timestamp.
 *
 * @returns Absolute path to the run's output folder
 */
export function getOutputDir(): string {
  if (cachedOutputDir) {
    return cachedOutputDir;
  }

  const baseDir = getBaseOutputDir();

  // Use existing run ID or generate new one
  let runId = process.env.MGMT_NS_RUN_ID;
  if (!runId) {
    runId = generateTimestamp();
    process.env.MGMT_NS_RUN_ID = runId;
  }

  const outputDir = join(baseDir, runId);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  cachedOutputDir = outputDir;
  return outputDir;
}

/**
 * Reset the cached output directory (useful for testing)
 */
export function resetOutputDir(): void {
  cachedOutputDir = null;
}

/**
 * Find output directories containing specific files
 *
 * Searches recent run directories for required files.
 *
 * @param requiredFiles - Array of filenames to search for
 * @returns Object containing found file paths, or null if not found
 */
export function findOutputDirWithFiles(
  requiredFiles: string[]
): FoundFiles | null {
  const baseDir = getBaseOutputDir();

  if (!existsSync(baseDir)) {
    return null;
  }

  // Get all run directories sorted by timestamp (newest first)
  const runDirs = readdirSync(baseDir)
    .map((name) => ({
      name,
      path: join(baseDir, name),
      stat: statSync(join(baseDir, name)),
    }))
    .filter((e) => e.stat.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(e.name))
    .sort((a, b) => b.name.localeCompare(a.name));

  // Try to find a single directory with all required files
  for (const runDir of runDirs) {
    const found = requiredFiles.filter((f) => existsSync(join(runDir.path, f)));
    if (found.length === requiredFiles.length) {
      return { dir: runDir.path, found };
    }
  }

  // If no single directory has all files, search across multiple runs
  const fileLocations: Record<string, string> = {};
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
      found: foundFiles,
    };
  }

  return null;
}

// -----------------------------------------------------------------------------
// File I/O
// -----------------------------------------------------------------------------

/**
 * Write JSON data to the output directory
 * @param filename - Name of the file (e.g., "issues.json")
 * @param data - Data to serialize
 * @param outputDir - Specific output directory (defaults to current run)
 * @returns Full path to the written file
 */
export function writeOutput(
  filename: string,
  data: unknown,
  outputDir: string | null = null
): string {
  const dir = outputDir || getOutputDir();
  const path = join(dir, filename);
  writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
}

/**
 * Read JSON data from the output directory
 * @param filename - Name of the file to read
 * @param outputDir - Specific output directory (defaults to current run)
 * @returns Parsed JSON data
 */
export function readOutput<T>(
  filename: string,
  outputDir: string | null = null
): T {
  const dir = outputDir || getOutputDir();
  const path = join(dir, filename);
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

/**
 * Check if a file exists in the output directory
 * @param filename - Name of the file to check
 * @param outputDir - Specific output directory (defaults to current run)
 * @returns true if file exists
 */
export function outputExists(
  filename: string,
  outputDir: string | null = null
): boolean {
  const dir = outputDir || getOutputDir();
  return existsSync(join(dir, filename));
}

// -----------------------------------------------------------------------------
// Token Cache
// -----------------------------------------------------------------------------

/**
 * Get the path to the token cache directory
 * @returns Absolute path to token cache directory
 */
export function getTokenCacheDir(): string {
  return join(homedir(), TOKEN_CACHE_DIR);
}

/**
 * Get the path to the token cache file
 * @returns Absolute path to token cache file
 */
export function getTokenCachePath(): string {
  return join(getTokenCacheDir(), TOKEN_CACHE_FILE);
}

/**
 * Ensure the token cache directory exists
 */
export function ensureTokenCacheDir(): void {
  const dir = getTokenCacheDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Read cached token data
 * @returns Cached token data or null if not found
 */
export function readTokenCache<T>(): T | null {
  const path = getTokenCachePath();
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

/**
 * Write token data to cache
 * @param data - Token data to cache
 */
export function writeTokenCache(data: unknown): void {
  ensureTokenCacheDir();
  writeFileSync(getTokenCachePath(), JSON.stringify(data, null, 2));
}

// -----------------------------------------------------------------------------
// Date Helpers
// -----------------------------------------------------------------------------

/**
 * Format a date as YYYY-MM-DD
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Format a date for display (e.g., "February 5, 2026")
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDateForDisplay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Get current timestamp in ISO format
 * @returns ISO timestamp string
 */
export function now(): string {
  return new Date().toISOString();
}

// -----------------------------------------------------------------------------
// String Helpers
// -----------------------------------------------------------------------------

/**
 * Extract resource provider name from issue title
 * Expected format: "MGMT Plane Namespace Review for {ResourceProviderName}"
 * @param title - Issue title
 * @returns Resource provider name or null if not found
 */
export function extractResourceProviderFromTitle(title: string): string | null {
  const match = title.match(/MGMT\s+Plane\s+Namespace\s+Review\s+for\s+(.+)/i);
  return match ? match[1].trim() : null;
}

/**
 * Truncate a string to a maximum length
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string with ellipsis if needed
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}
