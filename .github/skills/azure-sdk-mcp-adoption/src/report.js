/**
 * Generate a markdown report from correlation data
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import QuickChart from "quickchart-js";
import { getOutputDir, writeOutput, findOutputDirWithFiles } from "./utils.js";

const CHART_WIDTH = 600;
const CHART_HEIGHT = 400;

/**
 * Generate a chart URL
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
 * Format a number with commas
 */
function formatNumber(n) {
  return n?.toLocaleString() || "0";
}

/**
 * Generate the adoption by language chart
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
 * Generate the adoption by version type chart
 */
function generateVersionTypeChart(byVersionType) {
  const config = {
    type: "bar",
    data: {
      labels: byVersionType.map(v => v.versionType),
      datasets: [{
        label: "Adoption Rate (%)",
        data: byVersionType.map(v => v.adoptionRate),
        backgroundColor: ["rgba(75, 192, 92, 0.8)", "rgba(255, 205, 86, 0.8)"]
      }]
    },
    options: {
      plugins: {
        title: { display: true, text: "MCP Adoption Rate by Release Type" },
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, max: 100 }
      }
    }
  };
  return `![MCP Adoption by Version Type](${getChartUrl(config)})`;
}

/**
 * Generate the adoption by plane chart
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

/**
 * Generate the main report
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

/**
 * Main function
 */
async function main() {
  const outputDir = getOutputDir();
  console.log(`Output directory: ${outputDir}`);
  console.log("Loading correlation data...");

  // Load correlation data
  let correlationData = null;
  const correlationPath = join(outputDir, "correlation.json");

  if (existsSync(correlationPath)) {
    correlationData = JSON.parse(readFileSync(correlationPath, "utf-8"));
  } else {
    const found = findOutputDirWithFiles(["correlation.json"]);
    if (found?.files) {
      correlationData = JSON.parse(readFileSync(found.files["correlation.json"], "utf-8"));
    } else if (found?.dir) {
      correlationData = JSON.parse(readFileSync(join(found.dir, "correlation.json"), "utf-8"));
    }
  }

  if (!correlationData) {
    console.error("correlation.json not found. Run correlate step first.");
    process.exit(1);
  }

  console.log("Generating markdown report...");
  const report = generateReport(correlationData);

  // Write report as plain text (not JSON)
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
