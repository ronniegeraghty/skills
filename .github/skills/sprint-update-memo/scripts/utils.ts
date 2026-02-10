#!/usr/bin/env npx tsx
/**
 * Shared utility functions for the Sprint Update Memo skill.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { OUTPUT_DIR } from "./constants.ts";

// -----------------------------------------------------------------------------
// Path Utilities
// -----------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Current run's timestamped output directory (set once per run) */
let currentRunDir: string | null = null;

/**
 * Get the skill root directory.
 */
export function getSkillDir(): string {
  return dirname(__dirname);
}

/**
 * Get the base output directory path.
 */
export function getOutputDir(): string {
  return join(getSkillDir(), OUTPUT_DIR);
}

/**
 * Generate a timestamp string for directory naming.
 * Format: YYYY-MM-DDTHH-MM-SS
 */
export function generateTimestamp(): string {
  const now = new Date();
  return now.toISOString()
    .replace(/:/g, "-")
    .replace(/\.\d{3}Z$/, "")
    .replace("T", "T");
}

/**
 * Get or create the timestamped run directory for this execution.
 */
export function getRunDir(): string {
  if (currentRunDir) {
    return currentRunDir;
  }
  
  // Check if RUN_DIR environment variable is set (for pipeline coordination)
  if (process.env.RUN_DIR) {
    currentRunDir = process.env.RUN_DIR;
  } else {
    // Create new timestamped directory
    const timestamp = generateTimestamp();
    currentRunDir = join(getOutputDir(), timestamp);
  }
  
  // Ensure it exists
  if (!existsSync(currentRunDir)) {
    mkdirSync(currentRunDir, { recursive: true });
  }
  
  return currentRunDir;
}

/**
 * Set the run directory explicitly (used by pipeline orchestrator).
 * @param timestamp - The timestamp string to use for the directory name
 */
export function setRunDir(timestamp: string): void {
  currentRunDir = join(getOutputDir(), timestamp);
  if (!existsSync(currentRunDir)) {
    mkdirSync(currentRunDir, { recursive: true });
  }
}

/**
 * Ensure the output directory exists.
 */
export function ensureOutputDir(): void {
  const outputDir = getRunDir();
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
}

/**
 * Get the output file path for a Sprint.
 */
export function getOutputFilePath(sprintNumber: number): string {
  return join(getRunDir(), `AzSDK-Tools-Agent-Sprint-${sprintNumber}-Update.md`);
}

// -----------------------------------------------------------------------------
// File I/O Utilities
// -----------------------------------------------------------------------------

/**
 * Read JSON data from a file in the run directory.
 */
export function readOutputJson<T>(filename: string): T {
  const filePath = join(getRunDir(), filename);
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Write JSON data to a file in the run directory.
 */
export function writeOutputJson<T>(filename: string, data: T): void {
  ensureOutputDir();
  const filePath = join(getRunDir(), filename);
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`📄 Wrote: ${filePath}`);
}

/**
 * Write Markdown content to a file.
 */
export function writeMarkdown(filePath: string, content: string): void {
  ensureOutputDir();
  writeFileSync(filePath, content, "utf-8");
  console.log(`📄 Wrote: ${filePath}`);
}

// -----------------------------------------------------------------------------
// Date Utilities
// -----------------------------------------------------------------------------

/**
 * Parse a date string in ISO format (YYYY-MM-DD) to a Date object.
 */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}

/**
 * Add days to a date.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Format a date as "Month Day, Year" (e.g., "Jan 20th, 2026").
 */
export function formatDateLong(date: Date): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const day = date.getDate();
  const suffix = getOrdinalSuffix(day);
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${month} ${day}${suffix}, ${year}`;
}

/**
 * Get ordinal suffix for a number (st, nd, rd, th).
 */
function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Check if a date is within a Sprint's date range.
 */
export function isDateInSprint(
  date: Date,
  startDate: Date,
  durationDays: number
): boolean {
  const endDate = addDays(startDate, durationDays);
  return date >= startDate && date < endDate;
}

/**
 * Extract Sprint number from Sprint title (e.g., "Sprint 12" -> 12).
 */
export function extractSprintNumber(title: string): number {
  const match = title.match(/Sprint\s+(\d+)/i);
  if (!match) {
    throw new Error(`Cannot extract Sprint number from: ${title}`);
  }
  return parseInt(match[1], 10);
}

// -----------------------------------------------------------------------------
// CLI Argument Parsing
// -----------------------------------------------------------------------------

import type { CLIArgs } from "./types.ts";

/**
 * Parse command-line arguments.
 */
export function parseArgs(argv: string[] = process.argv.slice(2)): CLIArgs {
  const args: CLIArgs = {
    noPrompt: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    
    if (arg === "--sprint" || arg === "-s") {
      const value = argv[++i];
      if (value && !value.startsWith("-")) {
        args.sprint = parseInt(value, 10);
      }
    } else if (arg === "--no-prompt") {
      args.noPrompt = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--steps") {
      const value = argv[++i];
      if (value && !value.startsWith("-")) {
        args.steps = value.split(",").map((s) => s.trim());
      }
    } else if (arg === "--highlights") {
      const value = argv[++i];
      if (value && !value.startsWith("-")) {
        args.highlights = value;
      }
    }
  }

  return args;
}

/**
 * Print help message.
 */
export function printHelp(): void {
  console.log(`
Sprint Update Memo Generator

Usage:
  pnpm start [options]

Options:
  --sprint, -s <number>   Sprint number to generate report for
  --no-prompt             Skip interactive prompts
  --highlights <text>     Highlights to include in executive summary
  --steps <step1,step2>   Run only specific pipeline steps
  --help, -h              Show this help message

Examples:
  pnpm start                          # Interactive mode
  pnpm start --sprint 12              # Generate report for Sprint 12
  pnpm start --sprint 12 --no-prompt  # Non-interactive for Sprint 12

Pipeline Steps:
  fetch-sprints   Fetch Sprint iterations from GitHub Project
  fetch-items     Fetch project items, filter by Sprint
  analyze         Analyze data, calculate RAG status
  report          Generate Markdown memo
`);
}

// -----------------------------------------------------------------------------
// Console Utilities
// -----------------------------------------------------------------------------

/**
 * Log a section header.
 */
export function logSection(title: string): void {
  console.log("");
  console.log("=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

/**
 * Log an info message.
 */
export function logInfo(message: string): void {
  console.log(`ℹ️  ${message}`);
}

/**
 * Log a success message.
 */
export function logSuccess(message: string): void {
  console.log(`✅ ${message}`);
}

/**
 * Log a warning message.
 */
export function logWarning(message: string): void {
  console.log(`⚠️  ${message}`);
}

/**
 * Log an error message.
 */
export function logError(message: string): void {
  console.error(`❌ ${message}`);
}
