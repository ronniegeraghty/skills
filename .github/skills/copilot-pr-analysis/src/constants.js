/**
 * Constants for Copilot PR Analysis Skill
 * 
 * @module constants
 */

// -----------------------------------------------------------------------------
// Time Constants
// -----------------------------------------------------------------------------

/**
 * Days of inactivity before a PR is considered "abandoned"
 */
export const DEFAULT_STALE_DAYS = parseInt(process.env.STALE_DAYS || "14", 10);

/**
 * Default lookback period for fetching PRs
 */
export const DEFAULT_SINCE_DAYS = 90;

// -----------------------------------------------------------------------------
// PR Classification
// -----------------------------------------------------------------------------

/**
 * PR status classifications
 */
export const PR_STATUS = {
  MERGED: "merged",
  ABANDONED: "abandoned",
  ACTIVE: "active"
};

// -----------------------------------------------------------------------------
// Resource Patterns
// -----------------------------------------------------------------------------

/**
 * Patterns to identify instruction/resource files in session logs
 */
export const RESOURCE_PATTERNS = [
  // Copilot instructions
  /\.github\/copilot-instructions\.md/gi,
  /\.copilot\/.*\.md/gi,
  /COPILOT\.md/gi,
  
  // Skills
  /\.github\/skills\/[^/]+\/SKILL\.md/gi,
  /\.github\/skills\/[^/]+/gi,
  
  // MCP configurations
  /\.github\/copilot\/mcp\.json/gi,
  /copilot-mcp\.json/gi,
  /\.mcp\/.*\.json/gi,
  
  // Custom agent definitions
  /\.github\/agents\/.*\.md/gi,
  /\.github\/copilot\/agents\.json/gi,
  
  // General instruction files
  /CONTRIBUTING\.md/gi,
  /README\.md/gi,
  /ARCHITECTURE\.md/gi,
  /\.github\/CODEOWNERS/gi,
  
  // Azure-specific patterns (common in Azure SDK repos)
  /azure\.instructions\.md/gi,
  /sdk\/[^/]+\/[^/]+\/README\.md/gi
];

/**
 * Categories for grouping resources
 */
export const RESOURCE_CATEGORIES = {
  "copilot-instructions": /copilot-instructions|COPILOT\.md|\.copilot\//i,
  "skills": /\.github\/skills\//i,
  "mcp-config": /mcp\.json|\.mcp\//i,
  "custom-agents": /agents\.json|\.github\/agents\//i,
  "documentation": /README\.md|CONTRIBUTING\.md|ARCHITECTURE\.md/i,
  "other": /.*/
};

// -----------------------------------------------------------------------------
// Tool Patterns
// -----------------------------------------------------------------------------

/**
 * Patterns to identify MCP tool calls in session logs
 */
export const MCP_TOOL_PATTERNS = [
  // Direct tool call patterns
  /calling\s+tool[:\s]+([a-z_]+)/gi,
  /tool\s*:\s*([a-z_]+)/gi,
  /mcp_([a-z_]+)/gi,
  
  // Tool invocation patterns
  /invok(?:e|ing)\s+(?:tool\s+)?([a-z_]+)/gi,
  /using\s+tool\s+([a-z_]+)/gi
];

/**
 * Known MCP tool names to look for
 */
export const KNOWN_MCP_TOOLS = [
  // GitHub MCP tools
  "github_search_code",
  "github_search_issues",
  "github_get_file_contents",
  "github_create_or_update_file",
  "github_list_commits",
  "github_get_issue",
  "github_create_pull_request",
  
  // Azure SDK MCP tools
  "azure_sdk_get_package_info",
  "azure_sdk_list_packages",
  "azure_sdk_search_apis",
  "azure_sdk_get_samples",
  
  // File system tools
  "read_file",
  "write_file",
  "list_directory",
  "search_files",
  
  // Code analysis tools
  "semantic_search",
  "grep_search",
  "list_code_usages"
];

// -----------------------------------------------------------------------------
// Session Log Patterns
// -----------------------------------------------------------------------------

/**
 * Patterns to extract key sections from session logs
 */
export const LOG_SECTION_PATTERNS = {
  toolCalls: /\[TOOL_CALL\]|\[Tool\]|Calling tool:/gi,
  fileReads: /Reading file:|Opening file:|Loaded file:/gi,
  fileWrites: /Writing file:|Creating file:|Updating file:/gi,
  errors: /\[ERROR\]|\[Error\]|Error:|Failed:/gi,
  thinking: /\[THINKING\]|Thinking:|Planning:/gi
};

// -----------------------------------------------------------------------------
// Output Configuration
// -----------------------------------------------------------------------------

/**
 * Default output directory
 */
export const OUTPUT_DIR = "output";

/**
 * Output file names
 */
export const OUTPUT_FILES = {
  PRS: "prs.json",
  SESSIONS: "sessions.json",
  ANALYSIS: "analysis.json",
  REPORT: "report.md",
  SUMMARY: "summary.json"
};
