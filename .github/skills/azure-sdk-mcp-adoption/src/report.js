/**
 * Generate a markdown report from correlation data with charts
 * 
 * This script reads the correlation.json and produces a formatted
 * markdown report with embedded charts.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import QuickChart from "quickchart-js";
import { getOutputDir, writeOutput, formatDate, formatNumber, findOutputDirWithFiles } from "./utils.js";

// Chart configuration
const CHART_WIDTH = 600;
const CHART_HEIGHT = 400;

let OUTPUT_DIR = null;

/**
 * Generate a chart URL using QuickChart
 * @param {object} config - Chart.js configuration
 * @returns {string} - Chart URL
 */
function getChartUrl(config) {
  const chart = new QuickChart();
  chart.setConfig(config);
  chart.setWidth(CHART_WIDTH);
  chart.setHeight(CHART_HEIGHT);
  chart.setBackgroundColor("white");
  return chart.getUrl();
}

/**
 * Get markdown for a chart
 * @param {string} altText 
 * @param {object} config 
 * @returns {string} - Markdown image reference
 */
function getChartMarkdown(altText, config) {
  const url = getChartUrl(config);
  return `![${altText}](${url})`;
}

/**
 * Generate release adoption chart
 * @param {object} releaseAdoption 
 * @returns {string}
 */
function generateReleaseAdoptionChart(releaseAdoption) {
  const languages = releaseAdoption.languageAdoption.slice(0, 8);
  
  const config = {
    type: "bar",
    data: {
      labels: languages.map(l => l.language),
      datasets: [
        {
          label: "With MCP Usage",
          data: languages.map(l => l.releasesWithMcp),
          backgroundColor: "rgba(54, 162, 235, 0.8)"
        },
        {
          label: "Without MCP Usage",
          data: languages.map(l => l.totalReleases - l.releasesWithMcp),
          backgroundColor: "rgba(201, 203, 207, 0.8)"
        }
      ]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "Release MCP Adoption by Language"
        }
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      }
    }
  };

  return getChartMarkdown("Release Adoption by Language", config);
}

/**
 * Generate tool usage chart
 * @param {object} toolAnalysis 
 * @returns {string}
 */
function generateToolUsageChart(toolAnalysis) {
  const tools = Object.values(toolAnalysis)
    .sort((a, b) => b.totalCalls - a.totalCalls)
    .slice(0, 10);
  
  const config = {
    type: "horizontalBar",
    data: {
      labels: tools.map(t => t.name.replace("azsdk_", "")),
      datasets: [{
        label: "Total Calls",
        data: tools.map(t => t.totalCalls),
        backgroundColor: tools.map(t => {
          if (t.successRate >= 90) return "rgba(75, 192, 92, 0.8)";
          if (t.successRate >= 70) return "rgba(255, 205, 86, 0.8)";
          return "rgba(255, 99, 132, 0.8)";
        })
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "Top 10 MCP Tools (green=90%+, yellow=70%+, red=<70% success)"
        },
        legend: { display: false }
      },
      scales: {
        xAxes: [{ ticks: { beginAtZero: true } }]
      }
    }
  };

  return getChartMarkdown("Tool Usage Chart", config);
}

/**
 * Generate client distribution chart
 * @param {object} clientAnalysis 
 * @returns {string}
 */
function generateClientChart(clientAnalysis) {
  const clients = Object.values(clientAnalysis)
    .sort((a, b) => b.totalCalls - a.totalCalls);
  
  const config = {
    type: "pie",
    data: {
      labels: clients.map(c => c.name),
      datasets: [{
        data: clients.map(c => c.totalCalls),
        backgroundColor: [
          "rgba(54, 162, 235, 0.8)",
          "rgba(255, 99, 132, 0.8)",
          "rgba(255, 205, 86, 0.8)",
          "rgba(75, 192, 192, 0.8)",
          "rgba(153, 102, 255, 0.8)",
          "rgba(255, 159, 64, 0.8)"
        ]
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "MCP Client Distribution"
        }
      }
    }
  };

  return getChartMarkdown("Client Distribution", config);
}

/**
 * Generate version type adoption chart
 * @param {object[]} versionTypeAdoption 
 * @returns {string}
 */
function generateVersionTypeChart(versionTypeAdoption) {
  const config = {
    type: "bar",
    data: {
      labels: versionTypeAdoption.map(v => v.versionType),
      datasets: [{
        label: "Adoption Rate (%)",
        data: versionTypeAdoption.map(v => v.adoptionRate),
        backgroundColor: "rgba(153, 102, 255, 0.8)"
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "MCP Adoption Rate by Release Type"
        },
        legend: { display: false }
      },
      scales: {
        yAxes: [{ ticks: { beginAtZero: true, max: 100 } }]
      }
    }
  };

  return getChartMarkdown("Version Type Adoption", config);
}

/**
 * Generate the executive summary section
 */
function generateExecutiveSummary(report) {
  const { summary, metadata, releaseAdoption } = report;
  
  return `## Executive Summary

| Metric | Value |
|--------|-------|
| **Report Period** | ${metadata.telemetryPeriod.start} to ${metadata.telemetryPeriod.end} |
| **Release Months** | ${metadata.releaseMonths.join(", ")} |
| **Total MCP Tool Calls** | ${formatNumber(summary.totalToolCalls)} |
| **Unique Tools Used** | ${summary.uniqueTools} |
| **Unique MCP Clients** | ${summary.uniqueClients} |
| **Total SDK Releases** | ${summary.totalReleases} |
| **Releases with MCP Usage** | ${releaseAdoption?.releasesWithUsage || 0} (${releaseAdoption?.adoptionRate || 0}%) |

`;
}

/**
 * Generate the release adoption section with chart
 */
function generateReleaseAdoptionSection(report) {
  const { releaseAdoption } = report;
  if (!releaseAdoption) return "";

  const chartMd = generateReleaseAdoptionChart(releaseAdoption);

  let md = `## Release-Based MCP Adoption

This section shows what percentage of SDK packages released in the tracked months had MCP tool usage during their development (in the prior 3 months of telemetry data).

### Overall Adoption

**${releaseAdoption.releasesWithUsage}** of **${releaseAdoption.totalReleases}** releases (**${releaseAdoption.adoptionRate}%**) had MCP tool activity.

${chartMd}

### Adoption by Language

| Language | Releases | With MCP | Adoption Rate |
|----------|----------|----------|---------------|
`;

  for (const lang of releaseAdoption.languageAdoption) {
    md += `| ${lang.language} | ${lang.totalReleases} | ${lang.releasesWithMcp} | ${lang.adoptionRate}% |\n`;
  }

  md += `
### Adoption by Version Type

| Type | Releases | With MCP | Adoption Rate |
|------|----------|----------|---------------|
`;

  for (const vt of releaseAdoption.versionTypeAdoption) {
    md += `| ${vt.versionType} | ${vt.totalReleases} | ${vt.releasesWithMcp} | ${vt.adoptionRate}% |\n`;
  }

  // Add version type chart
  const vtChartMd = generateVersionTypeChart(releaseAdoption.versionTypeAdoption);
  md += `\n${vtChartMd}\n`;

  // List packages with MCP usage
  const withUsage = releaseAdoption.releaseDetails.filter(r => r.hadMcpUsage);
  if (withUsage.length > 0) {
    md += `
### Released Packages with MCP Usage

| Package | Version | Type | Language | MCP Calls | Tools Used |
|---------|---------|------|----------|-----------|------------|
`;
    for (const pkg of withUsage.slice(0, 20)) {
      const tools = pkg.toolsUsed.slice(0, 3).map(t => `\`${t.replace("azsdk_", "")}\``).join(", ");
      md += `| ${pkg.packageName} | ${pkg.version} | ${pkg.versionType} | ${pkg.language} | ${pkg.mcpUsageCount} | ${tools} |\n`;
    }
  }

  return md + "\n";
}

/**
 * Generate the client adoption section with chart
 */
function generateClientSection(report) {
  const clients = Object.values(report.clientAnalysis)
    .sort((a, b) => b.totalCalls - a.totalCalls);

  const chartMd = generateClientChart(report.clientAnalysis);

  let md = `## MCP Client Adoption

${chartMd}

### Client Usage Summary

| Client | Total Calls | Versions Tracked | Users |
|--------|-------------|------------------|-------|
`;

  for (const client of clients) {
    md += `| ${client.name} | ${formatNumber(client.totalCalls)} | ${client.versions.length} | ${client.totalUsers} |\n`;
  }

  return md + "\n";
}

/**
 * Generate the tool usage section with chart
 */
function generateToolSection(report) {
  const tools = Object.values(report.toolAnalysis)
    .sort((a, b) => b.totalCalls - a.totalCalls);

  const chartMd = generateToolUsageChart(report.toolAnalysis);

  let md = `## MCP Tool Usage

${chartMd}

### Top Tools by Usage

| Tool | Category | Calls | Success Rate | Avg Duration | Packages |
|------|----------|-------|--------------|--------------|----------|
`;

  for (const tool of tools.slice(0, 15)) {
    const statusIcon = tool.successRate >= 90 ? "✅" : tool.successRate >= 70 ? "⚠️" : "❌";
    md += `| ${statusIcon} \`${tool.name}\` | ${tool.category} | ${formatNumber(tool.totalCalls)} | ${tool.successRate}% | ${Math.round(tool.avgDuration)}ms | ${tool.distinctPackages || 0} |\n`;
  }

  // Group by category
  const byCategory = {};
  for (const tool of tools) {
    if (!byCategory[tool.category]) byCategory[tool.category] = [];
    byCategory[tool.category].push(tool);
  }

  md += `
### Tools by Category

`;

  for (const [category, categoryTools] of Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length)) {
    const totalCalls = categoryTools.reduce((sum, t) => sum + t.totalCalls, 0);
    md += `- **${category}**: ${categoryTools.length} tools, ${formatNumber(totalCalls)} total calls\n`;
  }

  return md + "\n";
}

/**
 * Generate insights section
 */
function generateInsightsSection(report) {
  const tools = Object.values(report.toolAnalysis);
  const lowSuccessTools = tools.filter(t => t.successRate < 70 && t.totalCalls > 10)
    .sort((a, b) => a.successRate - b.successRate);

  let md = `## Insights & Recommendations

### 🎯 Key Findings

1. **MCP Adoption Rate:** ${report.releaseAdoption?.adoptionRate || 0}% of SDK releases in the tracked period had MCP tool usage during development.

2. **Client Diversity:** ${Object.keys(report.clientAnalysis).length} different MCP clients are being used, with VS Code being the most popular.

3. **Tool Coverage:** ${tools.length} unique MCP tools are being actively used.

`;

  if (lowSuccessTools.length > 0) {
    md += `### ⚠️ Tools Needing Attention

These tools have low success rates (<70%) and significant usage:

| Tool | Success Rate | Calls |
|------|--------------|-------|
`;
    for (const tool of lowSuccessTools.slice(0, 5)) {
      md += `| \`${tool.name}\` | ${tool.successRate}% | ${tool.totalCalls} |\n`;
    }
  }

  md += `
### 📈 Recommendations

1. **Investigate low-success-rate tools** for common error patterns
2. **Track adoption trends** over time to measure improvement
3. **Target languages with low adoption** for outreach and training
`;

  return md;
}

/**
 * Generate the full markdown report
 */
function generateReport(report) {
  const now = new Date().toISOString();

  let md = `# Azure SDK MCP Adoption Report

> Generated: ${formatDate(now)}

This report correlates Azure SDK MCP (Model Context Protocol) tool usage with monthly SDK releases to provide insights into AI-assisted development patterns.

---

`;

  md += generateExecutiveSummary(report);
  md += generateReleaseAdoptionSection(report);
  md += generateClientSection(report);
  md += generateToolSection(report);
  md += generateInsightsSection(report);

  md += `
---

## Appendix

### Data Sources

- **Telemetry:** Azure Data Explorer (Kusto) - \`ddazureclients.kusto.windows.net/AzSdkToolsMcp\`
- **Releases:** GitHub - \`Azure/azure-sdk\` repository

### Report Configuration

\`\`\`json
${JSON.stringify(report.metadata, null, 2)}
\`\`\`
`;

  return md;
}

/**
 * Main function
 */
async function main() {
  // Get output directory (shared with pipeline)
  OUTPUT_DIR = getOutputDir();
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log("Loading correlation data...");
  
  let report = null;
  const correlationPath = join(OUTPUT_DIR, "correlation.json");
  
  if (existsSync(correlationPath)) {
    report = JSON.parse(readFileSync(correlationPath, "utf-8"));
  } else {
    // Try to find correlation.json in recent runs
    console.log("File not found in current run, searching recent runs...");
    const found = findOutputDirWithFiles(["correlation.json"]);
    
    if (found) {
      const foundPath = found.dir 
        ? join(found.dir, "correlation.json")
        : found.files["correlation.json"];
      console.log(`Found data in: ${foundPath}`);
      report = JSON.parse(readFileSync(foundPath, "utf-8"));
    }
  }

  if (!report) {
    console.error("correlation.json not found.");
    console.error("Run correlate.js first to generate correlation.json");
    process.exit(1);
  }

  console.log("Generating markdown report with charts...");
  const markdown = generateReport(report);

  // Write report
  const reportPath = join(OUTPUT_DIR, "report.md");
  writeFileSync(reportPath, markdown);
  console.log(`Report written to ${reportPath}`);

  // Write summary JSON
  const summaryPath = writeOutput("summary.json", {
    generatedAt: new Date().toISOString(),
    period: report.metadata.telemetryPeriod,
    releaseMonths: report.metadata.releaseMonths,
    summary: report.summary,
    releaseAdoption: {
      total: report.releaseAdoption?.totalReleases || 0,
      withMcp: report.releaseAdoption?.releasesWithUsage || 0,
      rate: report.releaseAdoption?.adoptionRate || 0
    },
    topClients: Object.values(report.clientAnalysis)
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, 5)
      .map(c => ({ name: c.name, calls: c.totalCalls })),
    topTools: Object.values(report.toolAnalysis)
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, 10)
      .map(t => ({ name: t.name, calls: t.totalCalls, successRate: t.successRate }))
  }, OUTPUT_DIR);
  console.log(`Summary written to ${summaryPath}`);

  console.log("\nDone! Report files generated:");
  console.log(`  📄 ${reportPath}`);
  console.log(`  📊 ${summaryPath}`);
  console.log(`  📈 Charts embedded via QuickChart.io URLs`);
}

main().catch(console.error);
