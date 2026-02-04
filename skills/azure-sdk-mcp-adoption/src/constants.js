/**
 * Shared constants for the Azure SDK MCP Adoption skill
 * 
 * Centralizes configuration values used across multiple modules.
 */

// -----------------------------------------------------------------------------
// Kusto Configuration
// -----------------------------------------------------------------------------

/** Kusto cluster endpoint for Azure SDK MCP telemetry */
export const KUSTO_CLUSTER_URI = "https://ddazureclients.kusto.windows.net";

/** Kusto database containing MCP tool usage events */
export const KUSTO_DATABASE = "AzSdkToolsMcp";

// -----------------------------------------------------------------------------
// GitHub Configuration
// -----------------------------------------------------------------------------

/** Base URL for raw GitHub content from the azure-sdk repository */
export const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/Azure/azure-sdk/main/_data/releases";

// -----------------------------------------------------------------------------
// Supported Languages
// -----------------------------------------------------------------------------

/**
 * Languages supported for release data fetching
 * These correspond to the subdirectories in the azure-sdk releases folder
 */
export const SUPPORTED_LANGUAGES = [
  "js",       // JavaScript/TypeScript
  "python",   // Python
  "dotnet",   // .NET (C#)
  "java",     // Java
  "go",       // Go
  "cpp",      // C++
  "c",        // C
  "ios",      // iOS (Swift/Objective-C)
  "android"   // Android (Kotlin/Java)
];

// -----------------------------------------------------------------------------
// Chart Configuration
// -----------------------------------------------------------------------------

/** Default chart dimensions for QuickChart generation */
export const CHART_CONFIG = {
  width: 600,
  height: 400,
  backgroundColor: "white"
};
