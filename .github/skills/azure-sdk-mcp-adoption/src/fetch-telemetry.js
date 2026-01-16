/**
 * Fetch MCP tool usage telemetry from Kusto
 * 
 * Queries the RawEventsDependencies table to get aggregated tool usage data
 * grouped by client, tool, and time period.
 */

import { Client, KustoConnectionStringBuilder } from "azure-kusto-data";
import { getOutputDir, writeOutput } from "./utils.js";

const CLUSTER_URI = "https://ddazureclients.kusto.windows.net";
const DATABASE = "AzSdkToolsMcp";

/**
 * Calculate the release cycle end date for a given month.
 * Azure SDK releases on the 16th of each month, so the telemetry end date
 * should be the end of the 16th (i.e., 17th exclusive).
 * 
 * @param {Date} date - A date within the target release month
 * @returns {string} - The release cycle end date (YYYY-MM-DD)
 */
function getReleaseCycleEndDate(date) {
  // Release cycle ends at the end of the 16th (so we use the 17th as exclusive end)
  const year = date.getFullYear();
  const month = date.getMonth();
  // Create date for the 17th of the month (end of day on the 16th)
  const endDate = new Date(year, month, 17);
  return endDate.toISOString().split("T")[0];
}

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

  // Default: Use release cycle dates if not specified
  // End date: End of release cycle (end of the 16th) for the current month
  // Start date: 2 months back from the release cycle end date
  if (!endDate) {
    const now = new Date();
    endDate = getReleaseCycleEndDate(now);
  }
  if (!startDate) {
    // Parse the end date and go back 2 months
    const end = new Date(endDate);
    const twoMonthsAgo = new Date(end.getFullYear(), end.getMonth() - 2, end.getDate());
    startDate = twoMonthsAgo.toISOString().split("T")[0];
  }

  return { startDate, endDate };
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
    // Query 1: Daily usage by client and tool
    console.log("\nFetching daily usage aggregates...");
    const dailyQuery = `
      RawEventsDependencies
      | where timestamp >= datetime('${startDate}') and timestamp < datetime('${endDate}')
      | extend 
          clientName = tostring(customDimensions["clientname"]),
          clientVersion = tostring(customDimensions["clientversion"]),
          toolName = tostring(customDimensions["toolname"]),
          packageName = tostring(customDimensions["package_name"]),
          language = tostring(customDimensions["language"]),
          operationStatus = tostring(customDimensions["operation_status"]),
          serverVersion = tostring(customDimensions["version"]),
          deviceId = tostring(customDimensions["devdeviceid"])
      | summarize 
          totalCalls = count(),
          successCount = countif(operationStatus == "Succeeded"),
          failureCount = countif(operationStatus == "Failed"),
          avgDuration = avg(duration),
          distinctUsers = dcount(deviceId)
        by 
          day = bin(timestamp, 1d),
          clientName,
          toolName,
          packageName,
          language
      | order by day desc, totalCalls desc
    `;
    const dailyResult = await client.execute(DATABASE, dailyQuery);
    const dailyData = extractResults(dailyResult);
    console.log(`  Found ${dailyData.length} daily aggregates`);

    // Query 2: Overall summary by client
    console.log("Fetching client summary...");
    const clientSummaryQuery = `
      RawEventsDependencies
      | where timestamp >= datetime('${startDate}') and timestamp < datetime('${endDate}')
      | extend 
          clientName = tostring(customDimensions["clientname"]),
          clientVersion = tostring(customDimensions["clientversion"]),
          deviceId = tostring(customDimensions["devdeviceid"])
      | summarize 
          totalCalls = count(),
          distinctUsers = dcount(deviceId),
          firstSeen = min(timestamp),
          lastSeen = max(timestamp)
        by clientName, clientVersion
      | order by totalCalls desc
    `;
    const clientResult = await client.execute(DATABASE, clientSummaryQuery);
    const clientData = extractResults(clientResult);
    console.log(`  Found ${clientData.length} client versions`);

    // Query 3: Tool usage summary
    console.log("Fetching tool usage summary...");
    const toolSummaryQuery = `
      RawEventsDependencies
      | where timestamp >= datetime('${startDate}') and timestamp < datetime('${endDate}')
      | extend 
          toolName = tostring(customDimensions["toolname"]),
          operationStatus = tostring(customDimensions["operation_status"]),
          deviceId = tostring(customDimensions["devdeviceid"]),
          packageName = tostring(customDimensions["package_name"])
      | summarize 
          totalCalls = count(),
          successRate = round(countif(operationStatus == "Succeeded") * 100.0 / count(), 2),
          avgDuration = round(avg(duration), 2),
          distinctUsers = dcount(deviceId),
          distinctPackages = dcount(packageName)
        by toolName
      | order by totalCalls desc
    `;
    const toolResult = await client.execute(DATABASE, toolSummaryQuery);
    const toolData = extractResults(toolResult);
    console.log(`  Found ${toolData.length} tools`);

    // Query 4: Package usage (for correlation with releases)
    console.log("Fetching package usage...");
    const packageQuery = `
      RawEventsDependencies
      | where timestamp >= datetime('${startDate}') and timestamp < datetime('${endDate}')
      | extend 
          packageName = tostring(customDimensions["package_name"]),
          language = tostring(customDimensions["language"]),
          deviceId = tostring(customDimensions["devdeviceid"])
      | where isnotempty(packageName)
      | summarize 
          usageCount = count(),
          distinctUsers = dcount(deviceId)
        by packageName, language
      | order by usageCount desc
    `;
    const packageResult = await client.execute(DATABASE, packageQuery);
    const packageData = extractResults(packageResult);
    console.log(`  Found ${packageData.length} packages`);

    // Get timestamped output directory
    const outputDir = getOutputDir();

    // Write results to JSON files
    const output = {
      metadata: {
        startDate,
        endDate,
        generatedAt: new Date().toISOString(),
        cluster: CLUSTER_URI,
        database: DATABASE
      },
      dailyUsage: dailyData,
      clientSummary: clientData,
      toolSummary: toolData,
      packageUsage: packageData
    };

    const outputPath = writeOutput("telemetry.json", output, outputDir);
    console.log(`\nTelemetry data written to ${outputPath}`);

    // Print summary
    console.log("\n=== Telemetry Summary ===");
    console.log(`Period: ${startDate} to ${endDate}`);
    console.log(`Total daily aggregates: ${dailyData.length}`);
    console.log(`Unique clients: ${clientData.length}`);
    console.log(`Unique tools: ${toolData.length}`);
    console.log(`Packages with usage: ${packageData.length}`);

    if (clientData.length > 0) {
      console.log("\nTop 5 clients by usage:");
      clientData.slice(0, 5).forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.clientName} v${c.clientVersion}: ${c.totalCalls} calls, ${c.distinctUsers} users`);
      });
    }

    if (toolData.length > 0) {
      console.log("\nTop 5 tools by usage:");
      toolData.slice(0, 5).forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.toolName}: ${t.totalCalls} calls, ${t.successRate}% success rate`);
      });
    }

  } catch (error) {
    console.error("Error fetching telemetry:", error.message);
    if (error.response?.data) {
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
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

main().catch(console.error);
