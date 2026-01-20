/**
 * Correlate MCP Tool Usage with Azure SDK Releases
 * 
 * Matches telemetry data with release data to determine which SDK packages
 * had MCP tool usage during their development cycle.
 * 
 * Correlation approaches:
 * 1. Direct match: Package name in telemetry matches release package name
 * 2. TypeSpec match: TypeSpec path in telemetry matches release's tsp-location
 * 
 * @module correlate
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { getOutputDir, writeOutput, findOutputDirWithFiles } from "./utils.js";

// -----------------------------------------------------------------------------
// Package Name Normalization
// -----------------------------------------------------------------------------

/**
 * Normalize a package name for cross-language comparison
 * 
 * Removes language-specific prefixes and converts to lowercase for matching:
 * - JavaScript: @azure/, @azure-rest/
 * - Python: azure-, azure-mgmt-
 * - .NET: Azure.
 * - Java: com.azure:, com.azure.
 * 
 * @param {string} name - Package name
 * @returns {string} Normalized name for comparison
 */
function normalizePackageName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/^@azure\//, "")
    .replace(/^@azure-rest\//, "")
    .replace(/^azure-/, "")
    .replace(/^azure\./, "")
    .replace(/^com\.azure:/, "")
    .replace(/^com\.azure\./, "")
    .replace(/^azure-mgmt-/, "mgmt-")
    .replace(/^azure-resourcemanager-/, "resourcemanager-")
    .trim();
}

// -----------------------------------------------------------------------------
// TypeSpec Path Normalization
// -----------------------------------------------------------------------------

/**
 * Normalize a TypeSpec path for matching
 * 
 * Converts backslashes to forward slashes and removes the "specification/" prefix
 * for consistent comparison.
 * 
 * @param {string} path - TypeSpec path
 * @returns {string} Normalized path for comparison
 */
function normalizeTypespecPath(path) {
  if (!path) return "";
  return path
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/^specification\//, "")
    .trim();
}

/**
 * Check if two TypeSpec paths match
 * 
 * Handles partial matches where one path might be a subset of the other
 * (e.g., nested TypeSpec projects within a service).
 * 
 * @param {string} path1 - First TypeSpec path
 * @param {string} path2 - Second TypeSpec path
 * @returns {boolean} True if paths match
 */
function typespecPathsMatch(path1, path2) {
  const norm1 = normalizeTypespecPath(path1);
  const norm2 = normalizeTypespecPath(path2);
  
  if (!norm1 || !norm2) return false;
  
  // Exact match
  if (norm1 === norm2) return true;
  
  // One contains the other (for nested paths)
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  
  return false;
}

// -----------------------------------------------------------------------------
// Data Loading
// -----------------------------------------------------------------------------

/**
 * Load telemetry and releases data files
 * 
 * First checks the current run directory, then searches previous runs
 * for any missing files. This allows running correlation with data from
 * different pipeline runs.
 * 
 * @param {string} outputDir - Current run's output directory
 * @returns {{ telemetryData: Object, releasesData: Object }} Loaded data files
 * @throws {Error} If required files cannot be found
 */
function loadDataFiles(outputDir) {
  let telemetryData = null;
  let releasesData = null;

  const telemetryPath = join(outputDir, "telemetry.json");
  const releasesPath = join(outputDir, "releases.json");

  // Load from current directory if available
  if (existsSync(telemetryPath)) {
    telemetryData = JSON.parse(readFileSync(telemetryPath, "utf-8"));
    console.log(`  Loaded telemetry from current run`);
  }
  if (existsSync(releasesPath)) {
    releasesData = JSON.parse(readFileSync(releasesPath, "utf-8"));
    console.log(`  Loaded releases from current run`);
  }

  // Search previous runs for any missing files
  if (!telemetryData || !releasesData) {
    const missingFiles = [];
    if (!telemetryData) missingFiles.push("telemetry.json");
    if (!releasesData) missingFiles.push("releases.json");
    
    console.log(`  Searching previous runs for: ${missingFiles.join(", ")}`);
    
    const found = findOutputDirWithFiles(missingFiles);
    if (found?.files) {
      if (!telemetryData && found.files["telemetry.json"]) {
        telemetryData = JSON.parse(readFileSync(found.files["telemetry.json"], "utf-8"));
        console.log(`  Loaded telemetry from: ${found.files["telemetry.json"]}`);
      }
      if (!releasesData && found.files["releases.json"]) {
        releasesData = JSON.parse(readFileSync(found.files["releases.json"], "utf-8"));
        console.log(`  Loaded releases from: ${found.files["releases.json"]}`);
      }
    } else if (found?.dir) {
      if (!telemetryData) {
        telemetryData = JSON.parse(readFileSync(join(found.dir, "telemetry.json"), "utf-8"));
        console.log(`  Loaded telemetry from: ${found.dir}`);
      }
      if (!releasesData) {
        releasesData = JSON.parse(readFileSync(join(found.dir, "releases.json"), "utf-8"));
        console.log(`  Loaded releases from: ${found.dir}`);
      }
    }
  }

  if (!telemetryData || !releasesData) {
    throw new Error("Required data files not found. Run fetch-telemetry and fetch-releases first.");
  }

  return { telemetryData, releasesData };
}

// -----------------------------------------------------------------------------
// Correlation Logic
// -----------------------------------------------------------------------------

/**
 * Build lookup maps for MCP usage by package name and TypeSpec path
 * 
 * @param {Object} telemetryData - Telemetry data with packageSummary and typespecSummary
 * @returns {{ packagesWithMcp: Map, typespecPathsWithMcp: Map }}
 */
function buildLookupMaps(telemetryData) {
  // Build package lookup
  const packagesWithMcp = new Map();
  for (const pkg of telemetryData.packageSummary) {
    const normalized = normalizePackageName(pkg.packageName);
    packagesWithMcp.set(normalized, pkg);
    // Also store original name for exact matching
    packagesWithMcp.set(pkg.packageName.toLowerCase(), pkg);
  }

  // Build TypeSpec path lookup
  const typespecPathsWithMcp = new Map();
  if (telemetryData.typespecSummary) {
    for (const tsp of telemetryData.typespecSummary) {
      const normalized = normalizeTypespecPath(tsp.typespecPath);
      typespecPathsWithMcp.set(normalized, tsp);
    }
  }

  return { packagesWithMcp, typespecPathsWithMcp };
}

/**
 * Correlate a single release with MCP telemetry
 * 
 * @param {Object} release - Release object
 * @param {Map} packagesWithMcp - Package name to MCP usage lookup
 * @param {Map} typespecPathsWithMcp - TypeSpec path to MCP usage lookup
 * @returns {Object} Correlated release with MCP usage fields
 */
function correlateRelease(release, packagesWithMcp, typespecPathsWithMcp) {
  const normalized = normalizePackageName(release.packageName);
  
  // First try direct package name match
  let mcpUsage = packagesWithMcp.get(normalized) || 
                 packagesWithMcp.get(release.packageName.toLowerCase());
  let matchType = mcpUsage ? "package" : null;
  
  // If no direct match and release has typespec directory, try typespec path matching
  if (!mcpUsage && release.typespecDirectory) {
    const releaseTypespecNorm = normalizeTypespecPath(release.typespecDirectory);
    
    for (const [telemetryPath, tspData] of typespecPathsWithMcp) {
      if (typespecPathsMatch(releaseTypespecNorm, telemetryPath)) {
        mcpUsage = {
          packageName: release.packageName,
          language: release.language,
          callCount: tspData.callCount,
          userCount: tspData.userCount,
          toolsUsed: tspData.toolsUsed,
          clientsUsed: tspData.clientsUsed,
          resolvedFromTypespec: true,
          matchedTypespecPath: tspData.typespecPath
        };
        matchType = "typespec";
        break;
      }
    }
  }
  
  return {
    ...release,
    hadMcpUsage: !!mcpUsage,
    mcpMatchType: matchType,
    mcpCallCount: mcpUsage?.callCount || 0,
    mcpUserCount: mcpUsage?.userCount || 0,
    mcpToolsUsed: mcpUsage?.toolsUsed || [],
    mcpClientsUsed: mcpUsage?.clientsUsed || [],
    mcpResolvedFromTypespec: mcpUsage?.resolvedFromTypespec || false,
    mcpMatchedTypespecPath: mcpUsage?.matchedTypespecPath || null
  };
}

// -----------------------------------------------------------------------------
// Statistics Calculation
// -----------------------------------------------------------------------------

/**
 * Calculate statistics grouped by a specific field
 * 
 * @param {Object[]} releases - Correlated releases
 * @param {string} field - Field to group by (e.g., "language", "versionType", "plane")
 * @returns {Object[]} Array of statistics objects sorted by total count
 */
function calculateGroupedStats(releases, field) {
  const byGroup = {};
  
  for (const r of releases) {
    const key = r[field];
    if (!byGroup[key]) {
      byGroup[key] = { total: 0, withMcp: 0 };
    }
    byGroup[key].total++;
    if (r.hadMcpUsage) byGroup[key].withMcp++;
  }

  return Object.entries(byGroup)
    .map(([key, stats]) => ({
      [field]: key,
      total: stats.total,
      withMcp: stats.withMcp,
      adoptionRate: stats.total > 0 ? Math.round((stats.withMcp / stats.total) * 10000) / 100 : 0
    }))
    .sort((a, b) => b.total - a.total);
}

// -----------------------------------------------------------------------------
// Console Output
// -----------------------------------------------------------------------------

/**
 * Print correlation summary to console
 */
function printSummary(correlatedReleases, languageStats, versionTypeStats, planeStats, directMatches, typespecMatches) {
  console.log("\n=== Correlation Summary ===");
  console.log(`Total releases: ${correlatedReleases.length}`);
  
  const releasesWithMcp = correlatedReleases.filter(r => r.hadMcpUsage).length;
  const adoptionRate = correlatedReleases.length > 0 
    ? Math.round((releasesWithMcp / correlatedReleases.length) * 10000) / 100 
    : 0;
  console.log(`Releases with MCP usage: ${releasesWithMcp} (${adoptionRate}%)`);

  console.log("\nBy Language:");
  for (const lang of languageStats) {
    console.log(`  ${lang.language}: ${lang.withMcp}/${lang.total} (${lang.adoptionRate}%)`);
  }

  console.log("\nBy Version Type:");
  for (const vt of versionTypeStats) {
    console.log(`  ${vt.versionType}: ${vt.withMcp}/${vt.total} (${vt.adoptionRate}%)`);
  }

  console.log("\nBy Plane:");
  for (const p of planeStats) {
    console.log(`  ${p.plane}: ${p.withMcp}/${p.total} (${p.adoptionRate}%)`);
  }

  // Show releases with MCP usage
  const withMcp = correlatedReleases.filter(r => r.hadMcpUsage);
  if (withMcp.length > 0) {
    console.log("\nReleases with MCP Usage:");
    withMcp.slice(0, 10).forEach((r, i) => {
      const matchInfo = r.mcpMatchType === "typespec" ? " [via typespec]" : "";
      console.log(`  ${i + 1}. ${r.packageName} v${r.version} (${r.language}, ${r.versionType}) - ${r.mcpCallCount} calls${matchInfo}`);
    });
    
    const typespecMatched = withMcp.filter(r => r.mcpMatchType === "typespec");
    if (typespecMatched.length > 0) {
      console.log(`\nReleases matched via TypeSpec path (${typespecMatched.length}):`);
      typespecMatched.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.packageName} <- ${r.mcpMatchedTypespecPath}`);
      });
    }
  }
}

// -----------------------------------------------------------------------------
// Main Entry Point
// -----------------------------------------------------------------------------

/**
 * Main correlation function
 */
async function main() {
  const outputDir = getOutputDir();
  console.log(`Output directory: ${outputDir}`);
  console.log("Loading data files...");

  // Load telemetry and releases data
  const { telemetryData, releasesData } = loadDataFiles(outputDir);

  console.log(`Telemetry period: ${telemetryData.metadata.startDate} to ${telemetryData.metadata.endDate}`);
  console.log(`Release months: ${releasesData.metadata.months.join(", ")}`);

  // Build lookup maps
  const { packagesWithMcp, typespecPathsWithMcp } = buildLookupMaps(telemetryData);
  console.log(`\nPackages with direct MCP usage: ${telemetryData.packageSummary.length}`);
  console.log(`TypeSpec paths with MCP usage (pending correlation): ${typespecPathsWithMcp.size}`);
  console.log(`TypeSpec to package mappings from releases: ${Object.keys(releasesData.typespecMapping || {}).length}`);

  // Correlate each release with telemetry
  let directMatches = 0;
  let typespecMatches = 0;
  
  const correlatedReleases = releasesData.releases.map(release => {
    const correlated = correlateRelease(release, packagesWithMcp, typespecPathsWithMcp);
    if (correlated.mcpMatchType === "package") directMatches++;
    if (correlated.mcpMatchType === "typespec") typespecMatches++;
    return correlated;
  });

  console.log(`\nCorrelation results:`);
  console.log(`  Direct package matches: ${directMatches}`);
  console.log(`  TypeSpec path matches: ${typespecMatches}`);
  console.log(`  Total matches: ${directMatches + typespecMatches}`);

  // Calculate statistics
  const totalReleases = correlatedReleases.length;
  const releasesWithMcp = correlatedReleases.filter(r => r.hadMcpUsage).length;
  const adoptionRate = totalReleases > 0 ? Math.round((releasesWithMcp / totalReleases) * 10000) / 100 : 0;

  const languageStats = calculateGroupedStats(correlatedReleases, "language");
  const versionTypeStats = calculateGroupedStats(correlatedReleases, "versionType");
  const planeStats = calculateGroupedStats(correlatedReleases, "plane");

  // Build output
  const output = {
    metadata: {
      generatedAt: new Date().toISOString(),
      telemetryPeriod: {
        start: telemetryData.metadata.startDate,
        end: telemetryData.metadata.endDate
      },
      releaseMonths: releasesData.metadata.months
    },
    summary: {
      totalReleases,
      releasesWithMcp,
      adoptionRate,
      matchBreakdown: {
        directPackageMatches: directMatches,
        typespecPathMatches: typespecMatches
      }
    },
    byLanguage: languageStats,
    byVersionType: versionTypeStats,
    byPlane: planeStats,
    releases: correlatedReleases.sort((a, b) => {
      if (a.hadMcpUsage !== b.hadMcpUsage) return b.hadMcpUsage ? 1 : -1;
      return b.mcpCallCount - a.mcpCallCount;
    }),
    toolSummary: telemetryData.toolSummary,
    clientSummary: telemetryData.clientSummary
  };

  // Write output
  const outputPath = writeOutput("correlation.json", output, outputDir);
  console.log(`\nCorrelation report written to ${outputPath}`);

  // Print summary
  printSummary(correlatedReleases, languageStats, versionTypeStats, planeStats, directMatches, typespecMatches);
}

main().catch(console.error);
