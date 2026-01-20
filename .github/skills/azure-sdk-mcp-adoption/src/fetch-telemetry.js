/**
 * Fetch MCP Tool Usage Telemetry from Kusto
 * 
 * Queries the Azure SDK MCP telemetry database to collect:
 * - Tool usage by package name (direct correlation with releases)
 * - Tool usage by TypeSpec path (for packages without explicit names)
 * - Tool and client usage statistics
 * 
 * @module fetch-telemetry
 */

import { Client, KustoConnectionStringBuilder } from "azure-kusto-data";
import { KUSTO_CLUSTER_URI, KUSTO_DATABASE } from "./constants.js";
import { getOutputDir, writeOutput } from "./utils.js";

// -----------------------------------------------------------------------------
// Argument Parsing
// -----------------------------------------------------------------------------

/**
 * Parse command line arguments for telemetry date range
 * 
 * Supported arguments:
 *   --start YYYY-MM-DD  Start date for telemetry query
 *   --end YYYY-MM-DD    End date for telemetry query
 * 
 * Defaults:
 *   end = 17th of current month (end of release cycle)
 *   start = 3 months before end date
 * 
 * @returns {{ startDate: string, endDate: string }}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let startDate = null;
  let endDate = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--start" && args[i + 1]) {
      startDate = args[++i];
    } else if (args[i] === "--end" && args[i + 1]) {
      endDate = args[++i];
    }
  }

  // Default: end = today, start = 3 months back
  if (!endDate) {
    const now = new Date();
    // Default to 17th of current month (end of 16th release cycle)
    endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-17`;
  }
  if (!startDate) {
    const end = new Date(endDate);
    const threeMonthsAgo = new Date(end.getFullYear(), end.getMonth() - 3, end.getDate());
    startDate = threeMonthsAgo.toISOString().split("T")[0];
  }

  return { startDate, endDate };
}

// -----------------------------------------------------------------------------
// Path Extraction
// -----------------------------------------------------------------------------

/**
 * Extract the relative specification path from an absolute TypeSpec project path
 * 
 * TypeSpec project paths in telemetry include full filesystem paths. This function
 * extracts just the specification-relative portion for matching with releases.
 * 
 * @example
 * // Linux CI path
 * extractSpecificationPath("/home/runner/work/azure-rest-api-specs/azure-rest-api-specs/specification/mongocluster/...")
 * // Returns: "specification/mongocluster/..."
 * 
 * @example
 * // Windows local path
 * extractSpecificationPath("c:\\Users\\dev\\azure-rest-api-specs\\specification\\dell\\Dell.Storage.Management")
 * // Returns: "specification/dell/Dell.Storage.Management"
 * 
 * @param {string} absolutePath - Full filesystem path to TypeSpec project
 * @returns {string|null} Relative path starting with "specification/", or null if not found
 */
function extractSpecificationPath(absolutePath) {
  if (!absolutePath) return null;
  
  // Normalize path separators
  const normalized = absolutePath.replace(/\\/g, "/");
  
  // Find "specification/" in the path
  const specIndex = normalized.indexOf("specification/");
  if (specIndex === -1) return null;
  
  return normalized.substring(specIndex);
}

// -----------------------------------------------------------------------------
// Kusto Result Processing
// -----------------------------------------------------------------------------

/**
 * Extract row objects from a Kusto query result
 * 
 * Converts Kusto's tabular result format into an array of plain objects
 * with column names as keys.
 * 
 * @param {Object} result - Kusto query result from client.execute()
 * @returns {Object[]} Array of row objects
 */
function extractResults(result) {
  const table = result.primaryResults[0];
  const rows = [];
  
  for (const row of table.rows()) {
    const obj = {};
    for (const col of table.columns) {
      obj[col.name] = row[col.name];
    }
    rows.push(obj);
  }
  
  return rows;
}

// -----------------------------------------------------------------------------
// Data Processing Functions
// -----------------------------------------------------------------------------

/**
 * Process raw telemetry rows into package-level summaries
 * @param {Object[]} rawData - Raw Kusto query results
 * @returns {{ callsWithPackage: Object[], packagesWithUsage: Map }}
 */
function processPackageData(rawData) {
  const callsWithPackage = [];
  const packagesWithUsage = new Map();
  
  for (const row of rawData) {
    const hasPackage = row.PackageName && row.PackageName.trim() !== "";
    if (!hasPackage) continue;
    
    callsWithPackage.push(row);
    
    const packageName = row.PackageName;
    if (!packagesWithUsage.has(packageName)) {
      packagesWithUsage.set(packageName, { 
        calls: 0, 
        users: new Set(), 
        tools: new Set(),
        clients: new Map(),
        language: row.Language || ""
      });
    }
    const pkgData = packagesWithUsage.get(packageName);
    pkgData.calls++;
    if (row.DeviceId) pkgData.users.add(row.DeviceId);
    if (row.ToolName) pkgData.tools.add(row.ToolName);
    if (row.ClientName) {
      const clientKey = row.ClientName;
      pkgData.clients.set(clientKey, (pkgData.clients.get(clientKey) || 0) + 1);
    }
  }
  
  return { callsWithPackage, packagesWithUsage };
}

/**
 * Process raw telemetry rows into TypeSpec path summaries
 * (for calls without package names but with TypeSpec paths)
 * @param {Object[]} rawData - Raw Kusto query results
 * @returns {{ callsWithTypespecOnly: Object[], typespecPathSummary: Map }}
 */
function processTypespecData(rawData) {
  const callsWithTypespecOnly = [];
  const typespecPathSummary = new Map();
  
  for (const row of rawData) {
    const hasPackage = row.PackageName && row.PackageName.trim() !== "";
    const hasTypespecPath = row.TypeSpecPath && row.TypeSpecPath.trim() !== "";
    
    if (hasPackage || !hasTypespecPath) continue;
    
    callsWithTypespecOnly.push(row);
    
    const relativePath = extractSpecificationPath(row.TypeSpecPath);
    if (!relativePath) continue;
    
    const normalizedPath = relativePath.toLowerCase();
    
    if (!typespecPathSummary.has(normalizedPath)) {
      typespecPathSummary.set(normalizedPath, {
        calls: 0,
        users: new Set(),
        tools: new Set(),
        clients: new Map(),
        rawPath: relativePath,
        languages: new Set()
      });
    }
    const pathData = typespecPathSummary.get(normalizedPath);
    pathData.calls++;
    if (row.DeviceId) pathData.users.add(row.DeviceId);
    if (row.ToolName) pathData.tools.add(row.ToolName);
    if (row.Language) pathData.languages.add(row.Language);
    if (row.ClientName) {
      const clientKey = row.ClientName;
      pathData.clients.set(clientKey, (pathData.clients.get(clientKey) || 0) + 1);
    }
  }
  
  return { callsWithTypespecOnly, typespecPathSummary };
}

/**
 * Build tool usage statistics from calls with package names
 * @param {Object[]} callsWithPackage - Telemetry rows with package names
 * @returns {Object[]} Tool summary array sorted by call count
 */
function buildToolSummary(callsWithPackage) {
  const toolStats = new Map();
  
  for (const call of callsWithPackage) {
    if (!call.ToolName) continue;
    
    if (!toolStats.has(call.ToolName)) {
      toolStats.set(call.ToolName, {
        name: call.ToolName,
        calls: 0,
        successes: 0,
        failures: 0,
        users: new Set(),
        packages: new Set()
      });
    }
    const stat = toolStats.get(call.ToolName);
    stat.calls++;
    if (call.OperationStatus === "Succeeded") stat.successes++;
    if (call.OperationStatus === "Failed") stat.failures++;
    if (call.DeviceId) stat.users.add(call.DeviceId);
    if (call.PackageName) stat.packages.add(call.PackageName);
  }
  
  return Array.from(toolStats.values())
    .map(t => ({
      name: t.name,
      calls: t.calls,
      successRate: t.calls > 0 ? Math.round((t.successes / t.calls) * 100) : 0,
      userCount: t.users.size,
      packageCount: t.packages.size
    }))
    .sort((a, b) => b.calls - a.calls);
}

/**
 * Build MCP client usage statistics
 * @param {Object[]} rawData - All raw telemetry rows
 * @returns {Object[]} Client summary array sorted by call count
 */
function buildClientSummary(rawData) {
  const clientStats = new Map();
  
  for (const call of rawData) {
    const key = `${call.ClientName}|${call.ClientVersion}`;
    if (!clientStats.has(key)) {
      clientStats.set(key, {
        name: call.ClientName,
        version: call.ClientVersion,
        calls: 0,
        users: new Set()
      });
    }
    const stat = clientStats.get(key);
    stat.calls++;
    if (call.DeviceId) stat.users.add(call.DeviceId);
  }
  
  return Array.from(clientStats.values())
    .map(c => ({
      name: c.name,
      version: c.version,
      calls: c.calls,
      userCount: c.users.size
    }))
    .sort((a, b) => b.calls - a.calls);
}

// -----------------------------------------------------------------------------
// Main Entry Point
// -----------------------------------------------------------------------------

/**
 * Main function - fetches telemetry data from Kusto and writes to output
 */
async function main() {
  const { startDate, endDate } = parseArgs();
  console.log(`Fetching telemetry from ${startDate} to ${endDate}...`);

  // Connect to Kusto using Azure CLI authentication
  const kcsb = KustoConnectionStringBuilder.withAzLoginIdentity(KUSTO_CLUSTER_URI);
  const client = new Client(kcsb);

  try {
    // Query for all tool calls with relevant fields
    console.log("\nFetching tool usage data...");
    const query = `
      RawEventsDependencies
      | where timestamp >= datetime('${startDate}') and timestamp < datetime('${endDate}')
      | extend cd = parse_json(customDimensions)
      | extend
          PackageName = tostring(cd.package_name),
          TypeSpecPath = tostring(parse_json(tostring(cd.toolargs)).typespecProjectRoot),
          ToolName = tostring(cd.toolname),
          ClientName = tostring(cd.clientname),
          ClientVersion = tostring(cd.clientversion),
          Language = tostring(cd.language),
          OperationStatus = tostring(cd.operation_status),
          DeviceId = tostring(cd.devdeviceid)
      | project 
          timestamp,
          PackageName,
          TypeSpecPath,
          ToolName,
          ClientName,
          ClientVersion,
          Language,
          OperationStatus,
          DeviceId,
          duration
    `;
    
    const result = await client.execute(KUSTO_DATABASE, query);
    const rawData = extractResults(result);
    console.log(`  Found ${rawData.length} tool calls`);

    // Process data into summaries
    console.log("\nProcessing telemetry data...");
    
    const { callsWithPackage, packagesWithUsage } = processPackageData(rawData);
    const { callsWithTypespecOnly, typespecPathSummary } = processTypespecData(rawData);
    
    console.log(`  Calls with package name: ${callsWithPackage.length}`);
    console.log(`  Calls with typespec path only: ${callsWithTypespecOnly.length}`);
    console.log(`  Unique packages: ${packagesWithUsage.size}`);
    console.log(`  Unique typespec paths: ${typespecPathSummary.size}`);

    // Build package summary (convert Sets/Maps to arrays)
    const packageSummary = Array.from(packagesWithUsage.entries())
      .map(([pkg, data]) => ({
        packageName: pkg,
        language: data.language,
        callCount: data.calls,
        userCount: data.users.size,
        toolsUsed: Array.from(data.tools),
        clientsUsed: Array.from(data.clients.entries())
          .map(([name, calls]) => ({ name, calls }))
          .sort((a, b) => b.calls - a.calls)
      }))
      .sort((a, b) => b.callCount - a.callCount);

    // Build typespec path summary
    const typespecSummary = Array.from(typespecPathSummary.entries())
      .map(([normalizedPath, data]) => ({
        typespecPath: data.rawPath,
        normalizedPath: normalizedPath,
        callCount: data.calls,
        userCount: data.users.size,
        toolsUsed: Array.from(data.tools),
        clientsUsed: Array.from(data.clients.entries())
          .map(([name, calls]) => ({ name, calls }))
          .sort((a, b) => b.calls - a.calls),
        languages: Array.from(data.languages)
      }))
      .sort((a, b) => b.callCount - a.callCount);

    // Build tool and client summaries
    const toolSummary = buildToolSummary(callsWithPackage);
    const clientSummary = buildClientSummary(rawData);

    // Write output
    const outputDir = getOutputDir();
    const output = {
      metadata: {
        startDate,
        endDate,
        generatedAt: new Date().toISOString(),
        cluster: KUSTO_CLUSTER_URI,
        database: KUSTO_DATABASE,
        totalRawCalls: rawData.length,
        callsWithPackage: callsWithPackage.length,
        callsWithTypespecOnly: callsWithTypespecOnly.length,
        uniqueTypespecPaths: typespecPathSummary.size
      },
      packageSummary,
      typespecSummary,
      toolSummary,
      clientSummary
    };

    const outputPath = writeOutput("telemetry.json", output, outputDir);
    console.log(`\nTelemetry data written to ${outputPath}`);

    // Print summary
    printSummary(startDate, endDate, rawData, callsWithPackage, callsWithTypespecOnly, 
                 packagesWithUsage, typespecPathSummary, packageSummary, typespecSummary, toolSummary);

  } catch (error) {
    console.error("Error fetching telemetry:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Print a summary of the fetched telemetry to the console
 */
function printSummary(startDate, endDate, rawData, callsWithPackage, callsWithTypespecOnly,
                      packagesWithUsage, typespecPathSummary, packageSummary, typespecSummary, toolSummary) {
  console.log("\n=== Telemetry Summary ===");
  console.log(`Period: ${startDate} to ${endDate}`);
  console.log(`Total raw calls: ${rawData.length}`);
  console.log(`Calls with package name: ${callsWithPackage.length}`);
  console.log(`Calls with typespec path only: ${callsWithTypespecOnly.length}`);
  console.log(`Unique packages: ${packagesWithUsage.size}`);
  console.log(`Unique typespec paths: ${typespecPathSummary.size}`);
  console.log(`Unique tools: ${toolSummary.length}`);

  if (packageSummary.length > 0) {
    console.log("\nTop 10 packages by MCP usage:");
    packageSummary.slice(0, 10).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.packageName} (${p.language}): ${p.callCount} calls, ${p.userCount} users`);
    });
  }

  if (typespecSummary.length > 0) {
    console.log("\nTop 5 typespec paths (pending correlation with releases):");
    typespecSummary.slice(0, 5).forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.typespecPath}: ${t.callCount} calls, ${t.userCount} users`);
    });
  }

  if (toolSummary.length > 0) {
    console.log("\nTop 5 tools:");
    toolSummary.slice(0, 5).forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.name}: ${t.calls} calls, ${t.successRate}% success`);
    });
  }
}

main().catch(console.error);
