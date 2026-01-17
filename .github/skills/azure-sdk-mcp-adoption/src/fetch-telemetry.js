/**
 * Fetch MCP tool usage telemetry from Kusto
 * 
 * Queries the AzSdkToolsMcp database to get tool usage data.
 * Resolves package names from TypeSpec project paths when needed.
 */

import { Client, KustoConnectionStringBuilder } from "azure-kusto-data";
import yaml from "js-yaml";
import { getOutputDir, writeOutput } from "./utils.js";

const CLUSTER_URI = "https://ddazureclients.kusto.windows.net";
const DATABASE = "AzSdkToolsMcp";

// Cache for tspconfig lookups to avoid repeated fetches
const tspConfigCache = new Map();

/**
 * Parse command line arguments
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

/**
 * Extract the relative specification path from an absolute TypeSpec project path
 * Examples:
 *   "/home/runner/work/azure-rest-api-specs/azure-rest-api-specs/specification/mongocluster/..." 
 *   -> "specification/mongocluster/..."
 *   "c:\Users\...\azure-rest-api-specs\specification\dell\Dell.Storage.Management"
 *   -> "specification/dell/Dell.Storage.Management"
 * 
 * @param {string} absolutePath 
 * @returns {string|null}
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

/**
 * Fetch tspconfig.yaml from azure-rest-api-specs and extract package names
 * @param {string} typespecPath - Absolute path containing "specification/..."
 * @returns {Promise<Map<string, string>>} Map of language -> package name
 */
async function fetchTspConfig(typespecPath) {
  // Extract relative path starting from "specification/"
  const relativePath = extractSpecificationPath(typespecPath);
  
  if (!relativePath) {
    // Can't extract path, skip
    return new Map();
  }
  
  if (tspConfigCache.has(relativePath)) {
    return tspConfigCache.get(relativePath);
  }

  const packageMap = new Map();
  
  // Build the URL to tspconfig.yaml
  const url = `https://raw.githubusercontent.com/Azure/azure-rest-api-specs/main/${relativePath}/tspconfig.yaml`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status !== 404) {
        console.log(`    Could not fetch tspconfig for ${relativePath}: ${response.status}`);
      }
      tspConfigCache.set(relativePath, packageMap);
      return packageMap;
    }
    
    const yamlContent = await response.text();
    const config = yaml.load(yamlContent);
    
    // Extract package names from emitter options
    // Structure varies but common patterns:
    // options:
    //   "@azure-tools/typespec-python":
    //     package-name: "azure-mgmt-mongocluster"
    //   "@azure-tools/typespec-ts":
    //     package-name: "@azure/arm-mongocluster"
    //   "@azure-tools/typespec-java":
    //     package-name: "com.azure.resourcemanager.mongocluster"
    //   "@azure-tools/typespec-csharp":
    //     package-name: "Azure.ResourceManager.MongoCluster"
    //   "@azure-tools/typespec-go":
    //     module: "github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/mongocluster/armmongocluster"
    
    if (config?.options) {
      for (const [emitter, opts] of Object.entries(config.options)) {
        if (!opts) continue;
        
        let lang = null;
        let pkgName = null;
        
        // Determine language from emitter name
        if (emitter.includes("python")) {
          lang = "python";
          pkgName = opts["package-name"] || opts.packageName;
        } else if (emitter.includes("-ts") || emitter.includes("typescript")) {
          lang = "js";
          pkgName = opts["package-name"] || opts.packageName;
        } else if (emitter.includes("java")) {
          lang = "java";
          pkgName = opts["package-name"] || opts.packageName;
        } else if (emitter.includes("csharp") || emitter.includes("dotnet")) {
          lang = "dotnet";
          pkgName = opts["package-name"] || opts.packageName || opts.namespace;
        } else if (emitter.includes("-go")) {
          lang = "go";
          // Go uses module path, extract package name from it
          const modulePath = opts.module || opts["module-name"];
          if (modulePath) {
            // Extract last segment: github.com/.../armmongocluster -> armmongocluster
            pkgName = modulePath.split("/").pop();
          }
        }
        
        // Validate package name - skip placeholders and invalid names
        if (lang && pkgName) {
          // Skip template placeholders
          if (pkgName.includes("{") || pkgName.includes("}")) continue;
          // Skip version-only names like "v2", "v8"
          if (/^v\d+$/.test(pkgName)) continue;
          // Skip empty or very short names
          if (pkgName.length < 3) continue;
          
          packageMap.set(lang, pkgName);
        }
      }
    }
    
  } catch (error) {
    console.log(`    Error fetching tspconfig for ${relativePath}: ${error.message}`);
  }
  
  tspConfigCache.set(relativePath, packageMap);
  return packageMap;
}

/**
 * Extract results from Kusto query response
 * @param {any} result - Kusto query result
 * @returns {any[]} - Array of result objects
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

/**
 * Main function to fetch telemetry data
 */
async function main() {
  const { startDate, endDate } = parseArgs();
  console.log(`Fetching telemetry from ${startDate} to ${endDate}...`);

  // Connect to Kusto
  const kcsb = KustoConnectionStringBuilder.withAzLoginIdentity(CLUSTER_URI);
  const client = new Client(kcsb);

  try {
    // Query: Get all tool calls with package info
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
    
    const result = await client.execute(DATABASE, query);
    const rawData = extractResults(result);
    console.log(`  Found ${rawData.length} tool calls`);

    // Process data: resolve TypeSpec paths to package names where needed
    console.log("\nProcessing package names...");
    const typespecPaths = new Set();
    
    // First pass: collect unique TypeSpec paths that need resolution
    for (const row of rawData) {
      if (!row.PackageName && row.TypeSpecPath) {
        const relativePath = extractSpecificationPath(row.TypeSpecPath);
        if (relativePath) {
          typespecPaths.add(relativePath);
        }
      }
    }
    
    console.log(`  Found ${typespecPaths.size} unique TypeSpec paths to resolve`);
    
    // Fetch tspconfig for each unique path
    if (typespecPaths.size > 0) {
      console.log("  Fetching tspconfig.yaml files...");
      let resolved = 0;
      for (const path of typespecPaths) {
        const pkgMap = await fetchTspConfig(path);
        if (pkgMap.size > 0) resolved++;
      }
      console.log(`  Successfully resolved ${resolved} of ${typespecPaths.size} paths`);
    }

    // Second pass: enrich data with resolved package names
    const toolCalls = [];
    const packagesWithUsage = new Map(); // package -> { calls, users, tools }
    
    for (const row of rawData) {
      let packageName = row.PackageName;
      let resolvedFromTypeSpec = false;
      
      // If no package name but has TypeSpec path, try to resolve
      if (!packageName && row.TypeSpecPath) {
        const relativePath = extractSpecificationPath(row.TypeSpecPath);
        const pkgMap = relativePath ? tspConfigCache.get(relativePath) : null;
        if (pkgMap && row.Language) {
          packageName = pkgMap.get(row.Language.toLowerCase());
          resolvedFromTypeSpec = true;
        }
        // If still no package name but we have a map, use any available
        if (!packageName && pkgMap && pkgMap.size > 0) {
          // Use all package names from this TypeSpec project
          for (const [lang, pkg] of pkgMap) {
            const callData = {
              ...row,
              PackageName: pkg,
              Language: lang,
              ResolvedFromTypeSpec: true,
              TypeSpecPath: row.TypeSpecPath
            };
            toolCalls.push(callData);
            
            // Track package usage
            if (!packagesWithUsage.has(pkg)) {
              packagesWithUsage.set(pkg, { 
                calls: 0, 
                users: new Set(), 
                tools: new Set(),
                clients: new Map(),
                language: lang
              });
            }
            const pkgData = packagesWithUsage.get(pkg);
            pkgData.calls++;
            if (row.DeviceId) pkgData.users.add(row.DeviceId);
            if (row.ToolName) pkgData.tools.add(row.ToolName);
            if (row.ClientName) {
              const clientKey = row.ClientName;
              pkgData.clients.set(clientKey, (pkgData.clients.get(clientKey) || 0) + 1);
            }
          }
          continue; // Skip adding this row again
        }
      }
      
      // Skip if still no package name
      if (!packageName) {
        continue;
      }
      
      const callData = {
        ...row,
        PackageName: packageName,
        ResolvedFromTypeSpec: resolvedFromTypeSpec
      };
      toolCalls.push(callData);
      
      // Track package usage
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
    
    console.log(`  Processed ${toolCalls.length} calls with package names`);
    console.log(`  Found ${packagesWithUsage.size} unique packages with MCP usage`);

    // Build package summary
    const packageSummary = [];
    for (const [pkg, data] of packagesWithUsage) {
      // Convert clients Map to array of {name, calls}
      const clientsUsed = Array.from(data.clients.entries())
        .map(([name, calls]) => ({ name, calls }))
        .sort((a, b) => b.calls - a.calls);
      
      packageSummary.push({
        packageName: pkg,
        language: data.language,
        callCount: data.calls,
        userCount: data.users.size,
        toolsUsed: Array.from(data.tools),
        clientsUsed: clientsUsed
      });
    }
    packageSummary.sort((a, b) => b.callCount - a.callCount);

    // Build tool summary
    const toolStats = new Map();
    for (const call of toolCalls) {
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
    
    const toolSummary = Array.from(toolStats.values()).map(t => ({
      name: t.name,
      calls: t.calls,
      successRate: t.calls > 0 ? Math.round((t.successes / t.calls) * 100) : 0,
      userCount: t.users.size,
      packageCount: t.packages.size
    })).sort((a, b) => b.calls - a.calls);

    // Build client summary
    const clientStats = new Map();
    for (const call of rawData) { // Use rawData to get all calls including those without package
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
    
    const clientSummary = Array.from(clientStats.values()).map(c => ({
      name: c.name,
      version: c.version,
      calls: c.calls,
      userCount: c.users.size
    })).sort((a, b) => b.calls - a.calls);

    // Get output directory
    const outputDir = getOutputDir();

    // Write results
    const output = {
      metadata: {
        startDate,
        endDate,
        generatedAt: new Date().toISOString(),
        cluster: CLUSTER_URI,
        database: DATABASE,
        totalRawCalls: rawData.length,
        callsWithPackage: toolCalls.length,
        typespecPathsResolved: typespecPaths.size
      },
      packageSummary,
      toolSummary,
      clientSummary
    };

    const outputPath = writeOutput("telemetry.json", output, outputDir);
    console.log(`\nTelemetry data written to ${outputPath}`);

    // Print summary
    console.log("\n=== Telemetry Summary ===");
    console.log(`Period: ${startDate} to ${endDate}`);
    console.log(`Total raw calls: ${rawData.length}`);
    console.log(`Calls with package name: ${toolCalls.length}`);
    console.log(`Unique packages: ${packagesWithUsage.size}`);
    console.log(`Unique tools: ${toolSummary.length}`);
    console.log(`Unique clients: ${clientSummary.length}`);

    if (packageSummary.length > 0) {
      console.log("\nTop 10 packages by MCP usage:");
      packageSummary.slice(0, 10).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.packageName} (${p.language}): ${p.callCount} calls, ${p.userCount} users`);
      });
    }

    if (toolSummary.length > 0) {
      console.log("\nTop 5 tools:");
      toolSummary.slice(0, 5).forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.name}: ${t.calls} calls, ${t.successRate}% success`);
      });
    }

  } catch (error) {
    console.error("Error fetching telemetry:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
