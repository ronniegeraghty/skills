/**
 * Utility functions for Copilot PR Analysis Skill
 * 
 * @module utils
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { OUTPUT_DIR } from "./constants.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// -----------------------------------------------------------------------------
// Output Directory Management
// -----------------------------------------------------------------------------

/** @type {string|null} */
let currentOutputDir = null;

/**
 * Generate a timestamp string for output directory naming
 * 
 * @returns {string} ISO timestamp with colons replaced by dashes
 */
export function generateTimestamp() {
  return new Date().toISOString()
    .replace(/[:.]/g, "-")
    .replace("Z", "");
}

/**
 * Get or create the output directory for the current run
 * 
 * Subsequent calls return the same directory within a single run.
 * The directory is created under OUTPUT_DIR with a timestamp.
 * 
 * @returns {string} Absolute path to the output directory
 */
export function getOutputDir() {
  if (currentOutputDir) return currentOutputDir;
  
  // Check if we have an env var set (for pipeline coordination)
  if (process.env.OUTPUT_DIR) {
    currentOutputDir = process.env.OUTPUT_DIR;
  } else {
    const baseDir = join(__dirname, "..", OUTPUT_DIR);
    currentOutputDir = join(baseDir, generateTimestamp());
  }
  
  if (!existsSync(currentOutputDir)) {
    mkdirSync(currentOutputDir, { recursive: true });
  }
  
  return currentOutputDir;
}

/**
 * Set the output directory explicitly (used by pipeline orchestrator)
 * 
 * @param {string} dir - Absolute path to output directory
 */
export function setOutputDir(dir) {
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
 * 
 * @param {string} filename - Name of the file to write
 * @param {any} data - Data to serialize as JSON
 */
export function writeOutput(filename, data) {
  const outputPath = join(getOutputDir(), filename);
  writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`Wrote ${outputPath}`);
}

/**
 * Read JSON data from the output directory
 * 
 * @param {string} filename - Name of the file to read
 * @returns {any} Parsed JSON data
 * @throws {Error} If file doesn't exist or is invalid JSON
 */
export function readOutput(filename) {
  const outputPath = join(getOutputDir(), filename);
  if (!existsSync(outputPath)) {
    throw new Error(`Output file not found: ${outputPath}`);
  }
  return JSON.parse(readFileSync(outputPath, "utf8"));
}

/**
 * Check if an output file exists
 * 
 * @param {string} filename - Name of the file to check
 * @returns {boolean} True if file exists
 */
export function outputExists(filename) {
  const outputPath = join(getOutputDir(), filename);
  return existsSync(outputPath);
}

/**
 * Write raw text to the output directory
 * 
 * @param {string} filename - Name of the file to write
 * @param {string} content - Text content to write
 */
export function writeOutputText(filename, content) {
  const outputPath = join(getOutputDir(), filename);
  writeFileSync(outputPath, content, "utf8");
  console.log(`Wrote ${outputPath}`);
}

// -----------------------------------------------------------------------------
// Date Utilities
// -----------------------------------------------------------------------------

/**
 * Calculate a date N days ago from today
 * 
 * @param {number} days - Number of days to subtract
 * @returns {Date} Date object representing N days ago
 */
export function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Check if a date is older than N days ago
 * 
 * @param {string|Date} date - Date to check
 * @param {number} days - Number of days threshold
 * @returns {boolean} True if date is older than N days ago
 */
export function isOlderThanDays(date, days) {
  const checkDate = new Date(date);
  const threshold = daysAgo(days);
  return checkDate < threshold;
}

/**
 * Format a date for display
 * 
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
  return new Date(date).toISOString().split("T")[0];
}

// -----------------------------------------------------------------------------
// String Utilities
// -----------------------------------------------------------------------------

/**
 * Extract matches from text using a pattern
 * 
 * @param {string} text - Text to search
 * @param {RegExp} pattern - Pattern with capture groups
 * @returns {string[]} Array of unique matches (first capture group)
 */
export function extractMatches(text, pattern) {
  const matches = new Set();
  let match;
  
  // Create a new RegExp to reset lastIndex
  const regex = new RegExp(pattern.source, pattern.flags);
  
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
 * 
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string with ellipsis if needed
 */
export function truncate(str, maxLength = 100) {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

// -----------------------------------------------------------------------------
// Command Execution
// -----------------------------------------------------------------------------

/**
 * Parse a shell command safely
 * 
 * @param {string} command - Command string
 * @returns {{ cmd: string, args: string[] }} Parsed command and arguments
 */
export function parseCommand(command) {
  const parts = command.split(/\s+/);
  return {
    cmd: parts[0],
    args: parts.slice(1)
  };
}

// -----------------------------------------------------------------------------
// Statistical Utilities
// -----------------------------------------------------------------------------

/**
 * Calculate percentage
 * 
 * @param {number} part - Part value
 * @param {number} total - Total value
 * @returns {number} Percentage (0-100), or 0 if total is 0
 */
export function percentage(part, total) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100 * 10) / 10;
}

/**
 * Calculate correlation coefficient between two arrays
 * 
 * @param {number[]} x - First array
 * @param {number[]} y - Second array
 * @returns {number} Pearson correlation coefficient (-1 to 1)
 */
export function correlation(x, y) {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Group an array of items by a key function
 * 
 * @template T
 * @param {T[]} items - Items to group
 * @param {(item: T) => string} keyFn - Function to extract grouping key
 * @returns {Record<string, T[]>} Grouped items
 */
export function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

/**
 * Count occurrences in an array
 * 
 * @template T
 * @param {T[]} items - Items to count
 * @param {(item: T) => string} [keyFn] - Optional key function
 * @returns {Record<string, number>} Count by key
 */
export function countBy(items, keyFn = (x) => String(x)) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
