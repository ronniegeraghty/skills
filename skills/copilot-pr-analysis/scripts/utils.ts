/**
 * Utility functions for Copilot PR Analysis Skill
 *
 * @module utils
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { OUTPUT_DIR } from "./constants.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

// -----------------------------------------------------------------------------
// Output Directory Management
// -----------------------------------------------------------------------------

let currentOutputDir: string | null = null;

/**
 * Generate a timestamp string for output directory naming
 */
export function generateTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("Z", "");
}

/**
 * Get or create the output directory for the current run
 *
 * Subsequent calls return the same directory within a single run.
 * The directory is created under OUTPUT_DIR with a timestamp.
 */
export function getOutputDir(): string {
  if (currentOutputDir) return currentOutputDir;

  // Check if we have an env var set (for pipeline coordination)
  if (process.env.OUTPUT_DIR) {
    currentOutputDir = process.env.OUTPUT_DIR;
  } else {
    const baseDir = join(__dirname, "..", "..", OUTPUT_DIR);
    currentOutputDir = join(baseDir, generateTimestamp());
  }

  if (!existsSync(currentOutputDir)) {
    mkdirSync(currentOutputDir, { recursive: true });
  }

  return currentOutputDir;
}

/**
 * Set the output directory explicitly (used by pipeline orchestrator)
 */
export function setOutputDir(dir: string): void {
  currentOutputDir = dir;
  if (!existsSync(currentOutputDir)) {
    mkdirSync(currentOutputDir, { recursive: true });
  }
}

// -----------------------------------------------------------------------------
// File I/O
// -----------------------------------------------------------------------------

/**
 * Write JSON data to the output directory
 */
export function writeOutput(filename: string, data: unknown): void {
  const outputPath = join(getOutputDir(), filename);
  writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`Wrote ${outputPath}`);
}

/**
 * Read JSON data from the output directory
 */
export function readOutput<T>(filename: string): T {
  const outputPath = join(getOutputDir(), filename);
  if (!existsSync(outputPath)) {
    throw new Error(`Output file not found: ${outputPath}`);
  }
  return JSON.parse(readFileSync(outputPath, "utf8")) as T;
}

/**
 * Check if an output file exists
 */
export function outputExists(filename: string): boolean {
  const outputPath = join(getOutputDir(), filename);
  return existsSync(outputPath);
}

/**
 * Write raw text to the output directory
 */
export function writeOutputText(filename: string, content: string): void {
  const outputPath = join(getOutputDir(), filename);
  writeFileSync(outputPath, content, "utf8");
  console.log(`Wrote ${outputPath}`);
}

// -----------------------------------------------------------------------------
// Date Utilities
// -----------------------------------------------------------------------------

/**
 * Calculate a date N days ago from today
 */
export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Check if a date is older than N days ago
 */
export function isOlderThanDays(date: string | Date, days: number): boolean {
  const checkDate = new Date(date);
  const threshold = daysAgo(days);
  return checkDate < threshold;
}

/**
 * Format a date for display
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toISOString().split("T")[0];
}

// -----------------------------------------------------------------------------
// String Utilities
// -----------------------------------------------------------------------------

/**
 * Extract matches from text using a pattern
 */
export function extractMatches(text: string, pattern: RegExp): string[] {
  const matches = new Set<string>();

  // Create a new RegExp to reset lastIndex
  const regex = new RegExp(pattern.source, pattern.flags);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      matches.add(match[1].toLowerCase());
    } else if (match[0]) {
      matches.add(match[0].toLowerCase());
    }
  }

  return Array.from(matches);
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number = 100): string {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

// -----------------------------------------------------------------------------
// Command Execution
// -----------------------------------------------------------------------------

/**
 * Parse a shell command safely
 */
export function parseCommand(command: string): { cmd: string; args: string[] } {
  const parts = command.split(/\s+/);
  return {
    cmd: parts[0],
    args: parts.slice(1),
  };
}

// -----------------------------------------------------------------------------
// Statistical Utilities
// -----------------------------------------------------------------------------

/**
 * Calculate percentage
 */
export function percentage(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100 * 10) / 10;
}

/**
 * Calculate correlation coefficient between two arrays
 */
export function correlation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Group an array of items by a key function
 */
export function groupBy<T>(
  items: T[],
  keyFn: (item: T) => string
): Record<string, T[]> {
  return items.reduce(
    (acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
}

/**
 * Count occurrences in an array
 */
export function countBy<T>(
  items: T[],
  keyFn: (item: T) => string = (x) => String(x)
): Record<string, number> {
  return items.reduce(
    (acc, item) => {
      const key = keyFn(item);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}
