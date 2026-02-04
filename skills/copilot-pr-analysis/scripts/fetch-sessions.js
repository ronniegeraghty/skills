/**
 * Fetch Session Logs for Copilot PRs
 * 
 * Uses the GitHub CLI `gh agent-task view --log` command to fetch
 * session logs for each Copilot PR. The logs contain information about
 * tools used, files read, and Copilot's internal reasoning.
 * 
 * @module fetch-sessions
 */

import { spawnSync } from "child_process";
import { 
  OUTPUT_FILES,
  RESOURCE_PATTERNS,
  MCP_TOOL_PATTERNS,
  KNOWN_MCP_TOOLS,
  PR_STATUS
} from "./constants.js";
import { 
  readOutput, 
  writeOutput,
  extractMatches
} from "./utils.js";

// -----------------------------------------------------------------------------
// Session Log Fetching
// -----------------------------------------------------------------------------

/**
 * Fetch session log for a PR using GitHub CLI
 * 
 * @param {string} repo - Repository in "owner/repo" format
 * @param {number} prNumber - PR number
 * @returns {string|null} Session log content or null if not available
 */
function fetchSessionLog(repo, prNumber) {
  try {
    const result = spawnSync("gh", [
      "agent-task", "view",
      "--repo", repo,
      String(prNumber),
      "--log"
    ], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000 // 60 second timeout
    });
    
    if (result.status !== 0) {
      // Agent task might not exist for this PR
      return null;
    }
    
    return result.stdout;
  } catch (error) {
    console.warn(`Warning: Failed to fetch session for ${repo}#${prNumber}: ${error.message}`);
    return null;
  }
}

// -----------------------------------------------------------------------------
// Log Parsing
// -----------------------------------------------------------------------------

/**
 * Extract resources mentioned in a session log
 * 
 * @param {string} log - Session log content
 * @returns {string[]} Array of resource paths
 */
function extractResources(log) {
  const resources = new Set();
  
  for (const pattern of RESOURCE_PATTERNS) {
    const matches = log.match(pattern);
    if (matches) {
      matches.forEach(m => resources.add(m.toLowerCase()));
    }
  }
  
  // Also look for any .md files in .github or .copilot directories
  const mdMatches = log.match(/\.github\/[^\s"'\]]+\.md/gi) || [];
  mdMatches.forEach(m => resources.add(m.toLowerCase()));
  
  const copilotMatches = log.match(/\.copilot\/[^\s"'\]]+/gi) || [];
  copilotMatches.forEach(m => resources.add(m.toLowerCase()));
  
  return Array.from(resources);
}

/**
 * Extract MCP tools used in a session log
 * 
 * @param {string} log - Session log content
 * @returns {string[]} Array of tool names
 */
function extractMcpTools(log) {
  const tools = new Set();
  
  // Look for known MCP tools explicitly mentioned
  for (const tool of KNOWN_MCP_TOOLS) {
    const regex = new RegExp(`\\b${tool}\\b`, "gi");
    if (regex.test(log)) {
      tools.add(tool.toLowerCase());
    }
  }
  
  // Look for tool call patterns
  for (const pattern of MCP_TOOL_PATTERNS) {
    const matches = extractMatches(log, pattern);
    matches.forEach(m => {
      // Filter out common non-tool words
      if (m.length > 3 && !["the", "and", "for", "with"].includes(m)) {
        tools.add(m);
      }
    });
  }
  
  return Array.from(tools);
}

/**
 * Extract basic metrics from a session log
 * 
 * @param {string} log - Session log content
 * @returns {object} Session metrics
 */
function extractMetrics(log) {
  const lines = log.split("\n").length;
  const toolCalls = (log.match(/\[TOOL_CALL\]|Calling tool:/gi) || []).length;
  const errors = (log.match(/\[ERROR\]|Error:|Failed:/gi) || []).length;
  const fileReads = (log.match(/Reading file:|Opening file:/gi) || []).length;
  const fileWrites = (log.match(/Writing file:|Creating file:|Updating file:/gi) || []).length;
  
  return {
    logLines: lines,
    toolCalls,
    errors,
    fileReads,
    fileWrites
  };
}

/**
 * Parse a session log and extract all relevant data
 * 
 * @param {string} log - Session log content
 * @returns {object} Parsed session data
 */
function parseSessionLog(log) {
  if (!log) {
    return {
      hasLog: false,
      resources: [],
      mcpTools: [],
      metrics: {
        logLines: 0,
        toolCalls: 0,
        errors: 0,
        fileReads: 0,
        fileWrites: 0
      }
    };
  }
  
  return {
    hasLog: true,
    resources: extractResources(log),
    mcpTools: extractMcpTools(log),
    metrics: extractMetrics(log),
    // Store truncated log for debugging (first 5000 chars)
    logPreview: log.substring(0, 5000)
  };
}

// -----------------------------------------------------------------------------
// Main Function
// -----------------------------------------------------------------------------

/**
 * Main entry point for session fetching
 */
async function main() {
  // Read PRs from previous step
  let prsData;
  try {
    prsData = readOutput(OUTPUT_FILES.PRS);
  } catch (error) {
    console.error("Error: PRs file not found. Run fetch-prs step first.");
    process.exit(1);
  }
  
  const { prs } = prsData;
  
  // Filter to only merged and abandoned PRs (skip active)
  const prsToAnalyze = prs.filter(pr => 
    pr.status === PR_STATUS.MERGED || pr.status === PR_STATUS.ABANDONED
  );
  
  console.log(`Fetching session logs for ${prsToAnalyze.length} PRs...`);
  console.log("(Skipping active PRs)\n");
  
  const sessions = [];
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < prsToAnalyze.length; i++) {
    const pr = prsToAnalyze[i];
    console.log(`[${i + 1}/${prsToAnalyze.length}] Fetching ${pr.repo}#${pr.number}...`);
    
    const log = fetchSessionLog(pr.repo, pr.number);
    const sessionData = parseSessionLog(log);
    
    if (sessionData.hasLog) {
      successCount++;
      console.log(`  Found ${sessionData.resources.length} resources, ${sessionData.mcpTools.length} MCP tools`);
    } else {
      failCount++;
      console.log("  No session log available");
    }
    
    sessions.push({
      repo: pr.repo,
      prNumber: pr.number,
      prStatus: pr.status,
      prTitle: pr.title,
      prUrl: pr.url,
      ...sessionData
    });
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log("\n=== Summary ===");
  console.log(`Sessions with logs: ${successCount}`);
  console.log(`Sessions without logs: ${failCount}`);
  
  // Write output
  writeOutput(OUTPUT_FILES.SESSIONS, {
    summary: {
      total: sessions.length,
      withLogs: successCount,
      withoutLogs: failCount
    },
    sessions
  });
  
  console.log("\nSession fetch complete.");
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
