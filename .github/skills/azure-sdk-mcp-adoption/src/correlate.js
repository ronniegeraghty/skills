/**
 * Correlate MCP tool usage with Azure SDK releases
 * 
 * Simple correlation: For each release, check if the package had MCP tool usage.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { getOutputDir, writeOutput, findOutputDirWithFiles } from "./utils.js";

/**
 * Normalize a package name for comparison
 * Removes common prefixes and converts to lowercase
 * @param {string} name 
 * @returns {string}
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

/**
 * Main correlation function
 */
async function main() {
  const outputDir = getOutputDir();
  console.log(`Output directory: ${outputDir}`);
  console.log("Loading data files...");

  // Load telemetry and releases data
  let telemetryData = null;
  let releasesData = null;

  const telemetryPath = join(outputDir, "telemetry.json");
  const releasesPath = join(outputDir, "releases.json");

  if (existsSync(telemetryPath) && existsSync(releasesPath)) {
    telemetryData = JSON.parse(readFileSync(telemetryPath, "utf-8"));
    releasesData = JSON.parse(readFileSync(releasesPath, "utf-8"));
  } else {
    // Try to find files from recent runs
    const found = findOutputDirWithFiles(["telemetry.json", "releases.json"]);
    if (found?.files) {
      telemetryData = JSON.parse(readFileSync(found.files["telemetry.json"], "utf-8"));
      releasesData = JSON.parse(readFileSync(found.files["releases.json"], "utf-8"));
    } else if (found?.dir) {
      telemetryData = JSON.parse(readFileSync(join(found.dir, "telemetry.json"), "utf-8"));
      releasesData = JSON.parse(readFileSync(join(found.dir, "releases.json"), "utf-8"));
    }
  }

  if (!telemetryData || !releasesData) {
    console.error("Required data files not found. Run fetch-telemetry and fetch-releases first.");
    process.exit(1);
  }

  console.log(`Telemetry period: ${telemetryData.metadata.startDate} to ${telemetryData.metadata.endDate}`);
  console.log(`Release months: ${releasesData.metadata.months.join(", ")}`);

  // Build lookup of packages with MCP usage
  const packagesWithMcp = new Map();
  for (const pkg of telemetryData.packageSummary) {
    const normalized = normalizePackageName(pkg.packageName);
    packagesWithMcp.set(normalized, pkg);
    // Also store original name for exact matching
    packagesWithMcp.set(pkg.packageName.toLowerCase(), pkg);
  }

  console.log(`\nPackages with MCP usage: ${packagesWithMcp.size / 2}`); // Divide by 2 since we store both

  // Correlate each release with telemetry
  const releases = releasesData.releases;
  const correlatedReleases = [];

  for (const release of releases) {
    const normalized = normalizePackageName(release.packageName);
    const mcpUsage = packagesWithMcp.get(normalized) || 
                     packagesWithMcp.get(release.packageName.toLowerCase());
    
    correlatedReleases.push({
      ...release,
      hadMcpUsage: !!mcpUsage,
      mcpCallCount: mcpUsage?.callCount || 0,
      mcpUserCount: mcpUsage?.userCount || 0,
      mcpToolsUsed: mcpUsage?.toolsUsed || [],
      mcpClientsUsed: mcpUsage?.clientsUsed || []
    });
  }

  // Calculate summary statistics
  const totalReleases = correlatedReleases.length;
  const releasesWithMcp = correlatedReleases.filter(r => r.hadMcpUsage).length;
  const adoptionRate = totalReleases > 0 ? Math.round((releasesWithMcp / totalReleases) * 10000) / 100 : 0;

  // By language
  const byLanguage = {};
  for (const r of correlatedReleases) {
    if (!byLanguage[r.language]) {
      byLanguage[r.language] = { total: 0, withMcp: 0 };
    }
    byLanguage[r.language].total++;
    if (r.hadMcpUsage) byLanguage[r.language].withMcp++;
  }

  const languageStats = Object.entries(byLanguage)
    .map(([lang, stats]) => ({
      language: lang,
      total: stats.total,
      withMcp: stats.withMcp,
      adoptionRate: stats.total > 0 ? Math.round((stats.withMcp / stats.total) * 10000) / 100 : 0
    }))
    .sort((a, b) => b.total - a.total);

  // By version type (GA vs Beta)
  const byVersionType = {};
  for (const r of correlatedReleases) {
    if (!byVersionType[r.versionType]) {
      byVersionType[r.versionType] = { total: 0, withMcp: 0 };
    }
    byVersionType[r.versionType].total++;
    if (r.hadMcpUsage) byVersionType[r.versionType].withMcp++;
  }

  const versionTypeStats = Object.entries(byVersionType)
    .map(([type, stats]) => ({
      versionType: type,
      total: stats.total,
      withMcp: stats.withMcp,
      adoptionRate: stats.total > 0 ? Math.round((stats.withMcp / stats.total) * 10000) / 100 : 0
    }))
    .sort((a, b) => b.total - a.total);

  // By plane (Management vs Data)
  const byPlane = {};
  for (const r of correlatedReleases) {
    if (!byPlane[r.plane]) {
      byPlane[r.plane] = { total: 0, withMcp: 0 };
    }
    byPlane[r.plane].total++;
    if (r.hadMcpUsage) byPlane[r.plane].withMcp++;
  }

  const planeStats = Object.entries(byPlane)
    .map(([plane, stats]) => ({
      plane: plane,
      total: stats.total,
      withMcp: stats.withMcp,
      adoptionRate: stats.total > 0 ? Math.round((stats.withMcp / stats.total) * 10000) / 100 : 0
    }))
    .sort((a, b) => b.total - a.total);

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
      adoptionRate
    },
    byLanguage: languageStats,
    byVersionType: versionTypeStats,
    byPlane: planeStats,
    releases: correlatedReleases.sort((a, b) => {
      // Sort by MCP usage first, then by call count
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
  console.log("\n=== Correlation Summary ===");
  console.log(`Total releases: ${totalReleases}`);
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
      console.log(`  ${i + 1}. ${r.packageName} v${r.version} (${r.language}, ${r.versionType}) - ${r.mcpCallCount} calls`);
    });
  }
}

main().catch(console.error);
