/**
 * Correlate MCP tool usage with Azure SDK releases
 * 
 * This script reads the telemetry and release data, then correlates them
 * to identify which MCP tools are being used for which SDK packages,
 * and how tool usage relates to release activity.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { getOutputDir, getLatestOutputDir, writeOutput, findOutputDirWithFiles } from "./utils.js";

// Will be set in main()
let OUTPUT_DIR = null;

/**
 * Load JSON data from a file
 * @param {string} filename 
 * @returns {object|null}
 */
function loadJsonFromDir(filename, dir) {
  const path = join(dir, filename);
  if (!existsSync(path)) {
    console.error(`File not found: ${path}`);
    console.error(`Run fetch-telemetry.js and fetch-releases.js first.`);
    return null;
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

/**
 * Normalize a package name for comparison
 * @param {string} name 
 * @returns {string}
 */
function normalizePackageName(name) {
  if (!name) return "";
  // Remove common prefixes and normalize to lowercase
  return name
    .toLowerCase()
    .replace(/^@azure\//, "")
    .replace(/^azure-/, "")
    .replace(/^azure\./, "")
    .replace(/^com\.azure:/, "")
    .replace(/^com\.azure\./, "")
    .trim();
}

/**
 * Extract the service name from a package name
 * @param {string} packageName 
 * @returns {string}
 */
function extractServiceName(packageName) {
  if (!packageName) return "";
  
  const normalized = normalizePackageName(packageName);
  
  // Remove common suffixes
  return normalized
    .replace(/-async$/, "")
    .replace(/-management$/, "")
    .replace(/^arm-/, "")
    .replace(/^mgmt-/, "")
    .replace(/^resourcemanager-/, "");
}

/**
 * Build a lookup map from releases data
 * @param {object} releasesData 
 * @returns {Map<string, object[]>}
 */
function buildReleaseLookup(releasesData) {
  const lookup = new Map();

  // Index monthly releases by normalized package name
  for (const release of releasesData.monthlyReleases) {
    const name = release.Name || release.Package;
    const normalized = normalizePackageName(name);
    
    if (!lookup.has(normalized)) {
      lookup.set(normalized, []);
    }
    lookup.get(normalized).push(release);
  }

  // Also index by service name for fuzzy matching
  for (const release of releasesData.monthlyReleases) {
    const serviceName = extractServiceName(release.Name || release.Package);
    if (serviceName && !lookup.has(serviceName)) {
      lookup.set(serviceName, []);
    }
    if (serviceName) {
      lookup.get(serviceName).push(release);
    }
  }

  return lookup;
}

/**
 * Build a package catalog lookup from latest packages
 * @param {object} latestPackages 
 * @returns {Map<string, object>}
 */
function buildPackageCatalog(latestPackages) {
  const catalog = new Map();

  for (const [language, packages] of Object.entries(latestPackages)) {
    for (const pkg of packages) {
      const name = pkg.Package || pkg.Name;
      const normalized = normalizePackageName(name);
      
      catalog.set(normalized, {
        ...pkg,
        language,
        originalName: name
      });
    }
  }

  return catalog;
}

/**
 * Correlate a package from telemetry with releases
 * @param {string} packageName 
 * @param {Map<string, object[]>} releaseLookup 
 * @param {Map<string, object>} packageCatalog 
 * @returns {object}
 */
function correlatePackage(packageName, releaseLookup, packageCatalog) {
  const normalized = normalizePackageName(packageName);
  const serviceName = extractServiceName(packageName);

  // Find matching releases
  let releases = releaseLookup.get(normalized) || [];
  if (releases.length === 0 && serviceName) {
    releases = releaseLookup.get(serviceName) || [];
  }

  // Find in package catalog
  const catalogEntry = packageCatalog.get(normalized);

  return {
    packageName,
    normalizedName: normalized,
    serviceName,
    matchedReleases: releases.map(r => ({
      name: r.Name || r.Package,
      version: r.Version,
      versionType: r.VersionType,
      releaseMonth: r.releaseMonth,
      language: r.language
    })),
    catalogInfo: catalogEntry ? {
      displayName: catalogEntry.DisplayName,
      serviceName: catalogEntry.ServiceName,
      type: catalogEntry.Type,
      versionGA: catalogEntry.VersionGA,
      versionPreview: catalogEntry.VersionPreview
    } : null,
    hasRecentRelease: releases.length > 0
  };
}

/**
 * Analyze tool usage patterns
 * @param {object} telemetryData 
 * @returns {object}
 */
function analyzeToolUsage(telemetryData) {
  const tools = {};

  for (const tool of telemetryData.toolSummary) {
    const name = tool.toolName;
    if (!name) continue;

    // Categorize tools by purpose
    let category = "other";
    if (name.includes("generate") || name.includes("create")) {
      category = "generation";
    } else if (name.includes("verify") || name.includes("check") || name.includes("validate")) {
      category = "validation";
    } else if (name.includes("update") || name.includes("version")) {
      category = "versioning";
    } else if (name.includes("pipeline") || name.includes("ci")) {
      category = "ci-cd";
    } else if (name.includes("package") || name.includes("release")) {
      category = "packaging";
    } else if (name.includes("setup") || name.includes("config")) {
      category = "setup";
    }

    tools[name] = {
      name,
      category,
      totalCalls: tool.totalCalls,
      successRate: tool.successRate,
      avgDuration: tool.avgDuration,
      distinctUsers: tool.distinctUsers,
      distinctPackages: tool.distinctPackages || 0
    };
  }

  return tools;
}

/**
 * Analyze client adoption
 * @param {object} telemetryData 
 * @returns {object}
 */
function analyzeClientAdoption(telemetryData) {
  const clients = {};

  for (const client of telemetryData.clientSummary) {
    const name = client.clientName || "unknown";
    
    if (!clients[name]) {
      clients[name] = {
        name,
        versions: [],
        totalCalls: 0,
        totalUsers: 0,
        firstSeen: client.firstSeen,
        lastSeen: client.lastSeen
      };
    }

    clients[name].versions.push({
      version: client.clientVersion,
      calls: client.totalCalls,
      users: client.distinctUsers
    });
    clients[name].totalCalls += client.totalCalls;
    clients[name].totalUsers += client.distinctUsers;
  }

  return clients;
}

/**
 * Calculate release-based adoption: For each released package,
 * check if it had MCP tool usage in the telemetry period (prior 2 months)
 * 
 * Note: Patch releases are excluded from adoption metrics as they typically
 * don't involve significant development work that would use MCP tools.
 * 
 * @param {object[]} releases - Monthly releases
 * @param {object[]} packageUsage - Package usage from telemetry
 * @param {object[]} dailyUsage - Daily usage data for tool breakdown
 * @returns {object}
 */
function calculateReleaseBasedAdoption(releases, packageUsage, dailyUsage) {
  // Filter out Patch releases - only track GA and Beta
  const filteredReleases = releases.filter(r => {
    const versionType = r.VersionType || "";
    return versionType !== "Patch";
  });

  // Build a lookup of packages with MCP usage
  const packagesWithUsage = new Map();
  for (const pkg of packageUsage) {
    if (pkg.packageName) {
      const normalized = normalizePackageName(pkg.packageName);
      packagesWithUsage.set(normalized, {
        usageCount: pkg.usageCount,
        distinctUsers: pkg.distinctUsers,
        language: pkg.language
      });
    }
  }

  // Build tool usage lookup by package
  const toolsByPackage = new Map();
  for (const usage of dailyUsage) {
    if (usage.packageName) {
      const normalized = normalizePackageName(usage.packageName);
      if (!toolsByPackage.has(normalized)) {
        toolsByPackage.set(normalized, new Set());
      }
      if (usage.toolName) {
        toolsByPackage.get(normalized).add(usage.toolName);
      }
    }
  }

  // Analyze each release (excluding Patch releases)
  const releaseDetails = [];
  const byLanguage = {};
  const byVersionType = {};

  for (const release of filteredReleases) {
    const packageName = release.Name || release.Package;
    const normalized = normalizePackageName(packageName);
    const serviceName = extractServiceName(packageName);
    
    // Check for MCP usage (try normalized name and service name)
    let usage = packagesWithUsage.get(normalized);
    if (!usage && serviceName) {
      usage = packagesWithUsage.get(serviceName);
    }
    
    const hadMcpUsage = !!usage;
    const tools = toolsByPackage.get(normalized) || toolsByPackage.get(serviceName) || new Set();

    const detail = {
      packageName,
      version: release.Version,
      versionType: release.VersionType,
      releaseMonth: release.releaseMonth,
      language: release.language,
      hadMcpUsage,
      mcpUsageCount: usage?.usageCount || 0,
      mcpDistinctUsers: usage?.distinctUsers || 0,
      toolsUsed: Array.from(tools)
    };
    releaseDetails.push(detail);

    // Aggregate by language
    const lang = release.language || "unknown";
    if (!byLanguage[lang]) {
      byLanguage[lang] = { total: 0, withMcp: 0, packages: [] };
    }
    byLanguage[lang].total++;
    if (hadMcpUsage) {
      byLanguage[lang].withMcp++;
      byLanguage[lang].packages.push(packageName);
    }

    // Aggregate by version type
    const vtype = release.VersionType || "Unknown";
    if (!byVersionType[vtype]) {
      byVersionType[vtype] = { total: 0, withMcp: 0 };
    }
    byVersionType[vtype].total++;
    if (hadMcpUsage) {
      byVersionType[vtype].withMcp++;
    }
  }

  // Calculate overall stats (using filtered releases - excludes Patch)
  const releasesWithUsage = releaseDetails.filter(r => r.hadMcpUsage).length;
  const totalReleases = filteredReleases.length;
  const adoptionRate = totalReleases > 0 
    ? Math.round((releasesWithUsage / totalReleases) * 10000) / 100 
    : 0;

  // Calculate language adoption rates
  const languageAdoption = Object.entries(byLanguage).map(([lang, data]) => ({
    language: lang,
    totalReleases: data.total,
    releasesWithMcp: data.withMcp,
    adoptionRate: data.total > 0 ? Math.round((data.withMcp / data.total) * 10000) / 100 : 0,
    packages: data.packages
  })).sort((a, b) => b.totalReleases - a.totalReleases);

  // Calculate version type adoption rates
  const versionTypeAdoption = Object.entries(byVersionType).map(([type, data]) => ({
    versionType: type,
    totalReleases: data.total,
    releasesWithMcp: data.withMcp,
    adoptionRate: data.total > 0 ? Math.round((data.withMcp / data.total) * 10000) / 100 : 0
  })).sort((a, b) => b.totalReleases - a.totalReleases);

  return {
    totalReleases,
    releasesWithUsage,
    adoptionRate,
    languageAdoption,
    versionTypeAdoption,
    releaseDetails: releaseDetails.sort((a, b) => {
      // Sort by MCP usage first, then by usage count
      if (a.hadMcpUsage !== b.hadMcpUsage) return b.hadMcpUsage ? 1 : -1;
      return b.mcpUsageCount - a.mcpUsageCount;
    })
  };
}

/**
 * Main correlation function
 */
async function main() {
  // Get the output directory (shared with other scripts in pipeline)
  OUTPUT_DIR = getOutputDir();
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log("Loading data files...");

  // Try to find required input files (may be in current dir or from previous runs)
  const requiredFiles = ["telemetry.json", "releases.json"];
  let telemetryData = null;
  let releasesData = null;

  // First try current output directory
  const telemetryPath = join(OUTPUT_DIR, "telemetry.json");
  const releasesPath = join(OUTPUT_DIR, "releases.json");
  
  if (existsSync(telemetryPath) && existsSync(releasesPath)) {
    telemetryData = JSON.parse(readFileSync(telemetryPath, "utf-8"));
    releasesData = JSON.parse(readFileSync(releasesPath, "utf-8"));
  } else {
    // Fall back to searching recent run directories
    console.log("Files not found in current run, searching recent runs...");
    const found = findOutputDirWithFiles(requiredFiles);
    
    if (found) {
      if (found.dir) {
        // All files in one directory
        console.log(`Found data in: ${found.dir}`);
        telemetryData = JSON.parse(readFileSync(join(found.dir, "telemetry.json"), "utf-8"));
        releasesData = JSON.parse(readFileSync(join(found.dir, "releases.json"), "utf-8"));
      } else if (found.files) {
        // Files in different directories
        console.log("Found data across multiple runs:");
        for (const [file, path] of Object.entries(found.files)) {
          console.log(`  ${file}: ${path}`);
        }
        telemetryData = JSON.parse(readFileSync(found.files["telemetry.json"], "utf-8"));
        releasesData = JSON.parse(readFileSync(found.files["releases.json"], "utf-8"));
      }
    }
  }

  if (!telemetryData || !releasesData) {
    console.error("Required data files not found.");
    console.error("Run fetch-telemetry.js and fetch-releases.js first.");
    process.exit(1);
  }

  console.log(`Telemetry period: ${telemetryData.metadata.startDate} to ${telemetryData.metadata.endDate}`);
  console.log(`Release months: ${releasesData.metadata.months.join(", ")}`);

  // Build lookup structures
  console.log("\nBuilding lookup indexes...");
  const releaseLookup = buildReleaseLookup(releasesData);
  const packageCatalog = buildPackageCatalog(releasesData.latestPackages);
  console.log(`  Release index entries: ${releaseLookup.size}`);
  console.log(`  Package catalog entries: ${packageCatalog.size}`);

  // Correlate package usage with releases
  console.log("\nCorrelating package usage with releases...");
  const packageCorrelations = [];
  
  for (const pkg of telemetryData.packageUsage) {
    if (pkg.packageName) {
      const correlation = correlatePackage(pkg.packageName, releaseLookup, packageCatalog);
      correlation.usageCount = pkg.usageCount;
      correlation.distinctUsers = pkg.distinctUsers;
      correlation.language = pkg.language;
      packageCorrelations.push(correlation);
    }
  }

  // Analyze tool usage
  console.log("Analyzing tool usage patterns...");
  const toolAnalysis = analyzeToolUsage(telemetryData);

  // Analyze client adoption
  console.log("Analyzing client adoption...");
  const clientAnalysis = analyzeClientAdoption(telemetryData);

  // Calculate correlation statistics
  const packagesWithReleases = packageCorrelations.filter(p => p.hasRecentRelease);
  const packagesWithoutReleases = packageCorrelations.filter(p => !p.hasRecentRelease);

  // NEW: Calculate release-based adoption - for each released package, 
  // check if it had MCP tool usage in the telemetry period
  console.log("Calculating release-based MCP adoption...");
  const releaseAdoption = calculateReleaseBasedAdoption(
    releasesData.monthlyReleases,
    telemetryData.packageUsage,
    telemetryData.dailyUsage
  );

  // Build correlation report
  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      telemetryPeriod: {
        start: telemetryData.metadata.startDate,
        end: telemetryData.metadata.endDate
      },
      releaseMonths: releasesData.metadata.months
    },
    summary: {
      totalToolCalls: telemetryData.toolSummary.reduce((sum, t) => sum + t.totalCalls, 0),
      uniqueTools: Object.keys(toolAnalysis).length,
      uniqueClients: Object.keys(clientAnalysis).length,
      packagesWithUsage: packageCorrelations.length,
      packagesWithRecentRelease: packagesWithReleases.length,
      totalReleases: releasesData.monthlyReleases.length,
      // NEW: Release-based adoption metrics
      releasesWithMcpUsage: releaseAdoption.releasesWithUsage,
      releaseAdoptionRate: releaseAdoption.adoptionRate
    },
    toolAnalysis,
    clientAnalysis,
    packageCorrelations,
    releaseAdoption, // NEW: Full release adoption data
    insights: {
      packagesWithRecentReleasesAndUsage: packagesWithReleases.map(p => ({
        package: p.packageName,
        usage: p.usageCount,
        releases: p.matchedReleases
      })),
      topToolsByCategory: Object.values(toolAnalysis)
        .reduce((acc, tool) => {
          if (!acc[tool.category]) acc[tool.category] = [];
          acc[tool.category].push(tool);
          return acc;
        }, {}),
      clientAdoptionTrend: Object.values(clientAnalysis)
        .sort((a, b) => b.totalCalls - a.totalCalls)
    }
  };

  // Write correlation report
  const outputPath = writeOutput("correlation.json", report, OUTPUT_DIR);
  console.log(`\nCorrelation report written to ${outputPath}`);

  // Print summary
  console.log("\n=== Correlation Summary ===");
  console.log(`Total tool calls: ${report.summary.totalToolCalls}`);
  console.log(`Unique tools: ${report.summary.uniqueTools}`);
  console.log(`Unique clients: ${report.summary.uniqueClients}`);
  console.log(`Packages with MCP usage: ${report.summary.packagesWithUsage}`);
  console.log(`Packages with recent releases: ${report.summary.packagesWithRecentRelease}`);
  console.log(`Total SDK releases in period: ${report.summary.totalReleases}`);

  console.log("\n=== Tool Categories ===");
  const categories = {};
  for (const tool of Object.values(toolAnalysis)) {
    categories[tool.category] = (categories[tool.category] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count} tools`);
  }

  console.log("\n=== Client Adoption ===");
  for (const client of Object.values(clientAnalysis).sort((a, b) => b.totalCalls - a.totalCalls).slice(0, 5)) {
    console.log(`  ${client.name}: ${client.totalCalls} calls, ${client.versions.length} versions`);
  }

  // NEW: Release-based adoption summary
  console.log("\n=== Release-Based MCP Adoption ===");
  console.log(`Releases with MCP usage: ${releaseAdoption.releasesWithUsage} of ${releaseAdoption.totalReleases} (${releaseAdoption.adoptionRate}%)`);
  
  console.log("\nBy Language:");
  for (const lang of releaseAdoption.languageAdoption.slice(0, 5)) {
    console.log(`  ${lang.language}: ${lang.releasesWithMcp}/${lang.totalReleases} (${lang.adoptionRate}%)`);
  }

  console.log("\nBy Version Type:");
  for (const vt of releaseAdoption.versionTypeAdoption) {
    console.log(`  ${vt.versionType}: ${vt.releasesWithMcp}/${vt.totalReleases} (${vt.adoptionRate}%)`);
  }

  if (packagesWithReleases.length > 0) {
    console.log("\n=== Packages with Recent Releases & MCP Usage ===");
    packagesWithReleases.slice(0, 5).forEach(p => {
      const releases = p.matchedReleases.map(r => `${r.version} (${r.versionType})`).join(", ");
      console.log(`  ${p.packageName}: ${p.usageCount} uses, releases: ${releases}`);
    });
  }
}

main().catch(console.error);
