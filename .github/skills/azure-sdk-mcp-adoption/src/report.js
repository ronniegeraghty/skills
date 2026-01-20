/**
 * Generate Markdown Report from Correlation Data
 * 
 * Creates a human-readable markdown report with embedded charts (via QuickChart)
 * showing MCP adoption metrics for Azure SDK releases.
 * 
 * @module report
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import QuickChart from "quickchart-js";
import { CHART_CONFIG } from "./constants.js";
import { getOutputDir, writeOutput, findOutputDirWithFiles } from "./utils.js";

// -----------------------------------------------------------------------------
// Chart Generation
// -----------------------------------------------------------------------------

/**
 * Generate a QuickChart URL for embedding in markdown
 * 
 * @param {Object} config - Chart.js configuration object
 * @returns {string} URL to the generated chart image
 */
function getChartUrl(config) {
  const chart = new QuickChart();
  chart.setConfig(config);
  chart.setWidth(CHART_CONFIG.width);
  chart.setHeight(CHART_CONFIG.height);
  chart.setBackgroundColor(CHART_CONFIG.backgroundColor);
  return chart.getUrl();
}

/**
 * Format a number with locale-aware separators
 * @param {number} n - Number to format
 * @returns {string} Formatted number string
 */
function formatNumber(n) {
  return n?.toLocaleString() || "0";
}

/**
 * Generate bar chart showing MCP adoption by programming language
 * 
 * @param {Object[]} byLanguage - Language statistics array
 * @returns {string} Markdown image syntax with chart URL
 */
function generateLanguageChart(byLanguage) {
  const config = {
    type: "bar",
    data: {
      labels: byLanguage.map(l => l.language.toUpperCase()),
      datasets: [
        {
          label: "With MCP Usage",
          data: byLanguage.map(l => l.withMcp),
          backgroundColor: "rgba(54, 162, 235, 0.9)"
        },
        {
          label: "Total Releases",
          data: byLanguage.map(l => l.total),
          backgroundColor: "rgba(201, 203, 207, 0.9)"
        }
      ]
    },
    options: {
      plugins: {
        title: { display: true, text: "MCP Adoption by Language" },
        datalabels: {
          display: true,
          anchor: "end",
          align: "top",
          color: "#333",
          font: { weight: "bold" }
        }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  };
  return `![MCP Adoption by Language](${getChartUrl(config)})`;
}

/**
 * Generate bar chart showing MCP adoption by version type (GA/Beta)
 * 
 * @param {Object[]} byVersionType - Version type statistics array
 * @returns {string} Markdown image syntax with chart URL
 */
function generateVersionTypeChart(byVersionType) {
  const config = {
    type: "bar",
    data: {
      labels: byVersionType.map(v => v.versionType),
      datasets: [
        {
          label: "With MCP Usage",
          data: byVersionType.map(v => v.withMcp),
          backgroundColor: "rgba(54, 162, 235, 0.9)"
        },
        {
          label: "Total Releases",
          data: byVersionType.map(v => v.total),
          backgroundColor: "rgba(201, 203, 207, 0.9)"
        }
      ]
    },
    options: {
      plugins: {
        title: { display: true, text: "MCP Adoption by Release Type" },
        datalabels: {
          display: true,
          anchor: "end",
          align: "top",
          color: "#333",
          font: { weight: "bold" }
        }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  };
  return `![MCP Adoption by Version Type](${getChartUrl(config)})`;
}

/**
 * Generate doughnut chart showing releases by plane (Management/Data)
 * 
 * @param {Object[]} byPlane - Plane statistics array
 * @returns {string} Markdown image syntax with chart URL
 */
function generatePlaneChart(byPlane) {
  const config = {
    type: "doughnut",
    data: {
      labels: byPlane.map(p => `${p.plane} (${p.withMcp}/${p.total})`),
      datasets: [{
        data: byPlane.map(p => p.total),
        backgroundColor: ["rgba(54, 162, 235, 0.8)", "rgba(255, 99, 132, 0.8)"]
      }]
    },
    options: {
      plugins: {
        title: { display: true, text: "Releases by Plane" }
      }
    }
  };
  return `![Releases by Plane](${getChartUrl(config)})`;
}

// -----------------------------------------------------------------------------
// Report Generation
// -----------------------------------------------------------------------------

/**
 * Generate the complete markdown report
 * 
 * @param {Object} data - Correlation data including metadata, summary, and releases
 * @returns {string} Complete markdown report
 */
function generateReport(data) {
  const { metadata, summary, byLanguage, byVersionType, byPlane, releases, toolSummary, clientSummary } = data;

  let md = `# Azure SDK MCP Adoption Report

> Generated: ${new Date(metadata.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}

This report shows MCP (Model Context Protocol) tool usage for Azure SDK releases.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Telemetry Period** | ${metadata.telemetryPeriod.start} to ${metadata.telemetryPeriod.end} |
| **Release Month(s)** | ${metadata.releaseMonths.join(", ")} |
| **Total Releases** | ${summary.totalReleases} |
| **Releases with MCP Usage** | ${summary.releasesWithMcp} (${summary.adoptionRate}%) |

---

## MCP Adoption Overview

**${summary.releasesWithMcp}** of **${summary.totalReleases}** releases (**${summary.adoptionRate}%**) had MCP tool usage during development.

### By Language

${generateLanguageChart(byLanguage)}

| Language | Total Releases | With MCP | Adoption Rate |
|----------|----------------|----------|---------------|
`;

  for (const lang of byLanguage) {
    md += `| ${lang.language} | ${lang.total} | ${lang.withMcp} | ${lang.adoptionRate}% |\n`;
  }

  md += `
### By Release Type

${generateVersionTypeChart(byVersionType)}

| Type | Total Releases | With MCP | Adoption Rate |
|------|----------------|----------|---------------|
`;

  for (const vt of byVersionType) {
    md += `| ${vt.versionType} | ${vt.total} | ${vt.withMcp} | ${vt.adoptionRate}% |\n`;
  }

  md += `
### By Plane (Management vs Data)

${generatePlaneChart(byPlane)}

| Plane | Total Releases | With MCP | Adoption Rate |
|-------|----------------|----------|---------------|
`;

  for (const p of byPlane) {
    md += `| ${p.plane} | ${p.total} | ${p.withMcp} | ${p.adoptionRate}% |\n`;
  }

  // Releases with MCP usage - detailed list
  const withMcp = releases.filter(r => r.hadMcpUsage);
  if (withMcp.length > 0) {
    md += `
---

## Released Packages with MCP Usage

The following **${withMcp.length}** packages released in ${metadata.releaseMonths.join(", ")} used AzSDK MCP tools during development:

`;

    // Group by language for better organization
    const byLang = {};
    for (const r of withMcp) {
      if (!byLang[r.language]) byLang[r.language] = [];
      byLang[r.language].push(r);
    }

    // Track client usage across all released packages with MCP
    const clientPackageCount = new Map();

    for (const [lang, pkgs] of Object.entries(byLang).sort((a, b) => b[1].length - a[1].length)) {
      md += `### ${lang.toUpperCase()} (${pkgs.length} packages)\n\n`;
      
      for (const r of pkgs.sort((a, b) => b.mcpCallCount - a.mcpCallCount)) {
        const allTools = r.mcpToolsUsed.map(t => `\`${t.replace("azsdk_", "")}\``).join(", ");
        const allClients = r.mcpClientsUsed?.map(c => c.name).filter(Boolean) || [];
        const uniqueClients = [...new Set(allClients)];
        
        // Track which clients were used for which packages
        for (const client of uniqueClients) {
          if (!clientPackageCount.has(client)) {
            clientPackageCount.set(client, new Set());
          }
          clientPackageCount.get(client).add(r.packageName);
        }
        
        md += `**${r.packageName}** v${r.version}\n`;
        md += `- Type: ${r.versionType} | Plane: ${r.plane}\n`;
        md += `- MCP Calls: **${r.mcpCallCount}**\n`;
        md += `- Tools Used: ${allTools || "N/A"}\n`;
        md += `- Clients Used: ${uniqueClients.length > 0 ? uniqueClients.join(", ") : "N/A"}\n\n`;
      }
    }

    // Add client comparison section
    if (clientPackageCount.size > 0) {
      md += `### MCP Client Usage Comparison\n\n`;
      md += `Packages that used MCP tools by client (a package may use multiple clients):\n\n`;
      md += `| Client | Packages |\n`;
      md += `|--------|----------|\n`;
      
      const sortedClients = [...clientPackageCount.entries()]
        .sort((a, b) => b[1].size - a[1].size);
      
      for (const [client, packages] of sortedClients) {
        md += `| ${client} | ${packages.size} |\n`;
      }
      md += `\n`;
    }
  }

  // Tool usage
  if (toolSummary && toolSummary.length > 0) {
    md += `
---

## MCP Tool Usage

| Tool | Calls | Success Rate | Users | Packages |
|------|-------|--------------|-------|----------|
`;

    for (const t of toolSummary.slice(0, 15)) {
      const icon = t.successRate >= 90 ? "✅" : t.successRate >= 70 ? "⚠️" : "❌";
      md += `| ${icon} \`${t.name}\` | ${formatNumber(t.calls)} | ${t.successRate}% | ${t.userCount} | ${t.packageCount} |\n`;
    }
  }

  md += `
---

*Report generated by Azure SDK MCP Adoption Skill*
`;

  return md;
}

// -----------------------------------------------------------------------------
// Data Loading
// -----------------------------------------------------------------------------

/**
 * Load correlation data from current or previous run
 * 
 * @param {string} outputDir - Current run's output directory
 * @returns {Object} Correlation data
 * @throws {Error} If correlation.json not found
 */
function loadCorrelationData(outputDir) {
  const correlationPath = join(outputDir, "correlation.json");

  if (existsSync(correlationPath)) {
    return JSON.parse(readFileSync(correlationPath, "utf-8"));
  }
  
  const found = findOutputDirWithFiles(["correlation.json"]);
  if (found?.files) {
    return JSON.parse(readFileSync(found.files["correlation.json"], "utf-8"));
  }
  if (found?.dir) {
    return JSON.parse(readFileSync(join(found.dir, "correlation.json"), "utf-8"));
  }
  
  throw new Error("correlation.json not found. Run correlate step first.");
}

// -----------------------------------------------------------------------------
// Main Entry Point
// -----------------------------------------------------------------------------

/**
 * Main function - generates markdown report from correlation data
 */
async function main() {
  const outputDir = getOutputDir();
  console.log(`Output directory: ${outputDir}`);
  console.log("Loading correlation data...");

  const correlationData = loadCorrelationData(outputDir);

  console.log("Generating markdown report...");
  const report = generateReport(correlationData);

  // Write report
  const reportPath = join(outputDir, "report.md");
  writeFileSync(reportPath, report);
  console.log(`Report written to ${reportPath}`);

  // Write summary JSON
  const summaryPath = writeOutput("summary.json", {
    ...correlationData.summary,
    byLanguage: correlationData.byLanguage,
    byVersionType: correlationData.byVersionType,
    byPlane: correlationData.byPlane
  }, outputDir);
  console.log(`Summary written to ${summaryPath}`);

  console.log("\nDone!");
}

main().catch(console.error);
