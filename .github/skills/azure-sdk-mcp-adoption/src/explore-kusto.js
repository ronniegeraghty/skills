/**
 * Explore the Kusto schema for the RawEventsDependencies table
 * This script helps discover the table structure and customDimensions fields
 */

import { Client, KustoConnectionStringBuilder } from "azure-kusto-data";

const CLUSTER_URI = "https://ddazureclients.kusto.windows.net";
const DATABASE = "AzSdkToolsMcp";

async function main() {
  console.log("Connecting to Kusto cluster...");
  
  // Use the Kusto SDK's built-in Az CLI auth method
  const kcsb = KustoConnectionStringBuilder.withAzLoginIdentity(CLUSTER_URI);
  
  const client = new Client(kcsb);
  
  try {
    // Query 1: Get table schema
    console.log("\n=== Table Schema ===");
    const schemaQuery = `RawEventsDependencies | getschema`;
    const schemaResult = await client.execute(DATABASE, schemaQuery);
    
    const schemaTable = schemaResult.primaryResults[0];
    console.log("Columns:");
    for (const row of schemaTable.rows()) {
      console.log(`  ${row.ColumnName}: ${row.ColumnType}`);
    }
    
    // Query 2: Sample a few rows to see data shape
    console.log("\n=== Sample Data (5 rows) ===");
    const sampleQuery = `RawEventsDependencies | take 5`;
    const sampleResult = await client.execute(DATABASE, sampleQuery);
    
    const sampleTable = sampleResult.primaryResults[0];
    for (const row of sampleTable.rows()) {
      console.log(JSON.stringify(row, null, 2));
    }
    
    // Query 3: Explore customDimensions keys
    console.log("\n=== CustomDimensions Keys ===");
    const keysQuery = `
      RawEventsDependencies
      | take 1000
      | mv-expand bagexpansion=array customDimensions
      | extend key = tostring(customDimensions[0])
      | distinct key
      | order by key asc
    `;
    const keysResult = await client.execute(DATABASE, keysQuery);
    
    const keysTable = keysResult.primaryResults[0];
    console.log("Keys found in customDimensions:");
    for (const row of keysTable.rows()) {
      console.log(`  - ${row.key}`);
    }
    
    // Query 4: Look for MCP client identifier
    console.log("\n=== Looking for MCP Client Field ===");
    const clientQuery = `
      RawEventsDependencies
      | take 100
      | extend mcpClient = tostring(customDimensions["mcpClient"]),
               client = tostring(customDimensions["client"]),
               clientName = tostring(customDimensions["clientName"]),
               toolName = tostring(customDimensions["toolName"]),
               packageName = tostring(customDimensions["packageName"])
      | project mcpClient, client, clientName, toolName, packageName
      | where isnotempty(mcpClient) or isnotempty(client) or isnotempty(clientName)
      | take 10
    `;
    const clientResult = await client.execute(DATABASE, clientQuery);
    
    const clientTable = clientResult.primaryResults[0];
    console.log("Sample client fields:");
    for (const row of clientTable.rows()) {
      console.log(JSON.stringify(row, null, 2));
    }
    
  } catch (error) {
    console.error("Error querying Kusto:", error.message);
    throw error;
  } finally {
    client.close();
  }
}

main().catch(console.error);
