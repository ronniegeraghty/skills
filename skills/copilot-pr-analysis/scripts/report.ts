/**
 * Generate Markdown Report from Analysis Results
 *
 * Creates a human-readable report with:
 * - Overview statistics
 * - Success/failure patterns
 * - Per-repository breakdown
 * - Actionable recommendations
 *
 * @module report
 */

import QuickChartModule from "quickchart-js";
// Workaround for QuickChart typing issue
const QuickChart = QuickChartModule as unknown as new () => {
  setConfig(config: object): void;
  setWidth(width: number): void;
  setHeight(height: number): void;
  setBackgroundColor(color: string): void;
  getUrl(): string;
};
import { OUTPUT_FILES } from "./constants.ts";
import {
  readOutput,
  writeOutput,
  writeOutputText,
  formatDate,
  percentage,
} from "./utils.ts";
import type {
  AnalysisOutput,
  ResourceAnalysis,
  ToolAnalysis,
  RepoStat,
  Insight,
} from "./types.ts";

// -----------------------------------------------------------------------------
// Chart Generation
// -----------------------------------------------------------------------------

/**
 * Generate a bar chart URL
 */
async function generateBarChart(
  labels: string[],
  data: number[],
  label: string,
  color: string = "rgb(54, 162, 235)"
): Promise<string> {
  const chart = new QuickChart();
  chart.setConfig({
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label,
          data,
          backgroundColor: color,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: { beginAtZero: true },
      },
    },
  });
  chart.setWidth(600);
  chart.setHeight(300);

  return chart.getUrl();
}

/**
 * Generate a pie chart URL
 */
async function generatePieChart(
  labels: string[],
  data: number[]
): Promise<string> {
  const chart = new QuickChart();
  chart.setConfig({
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            "rgb(75, 192, 192)",
            "rgb(255, 99, 132)",
            "rgb(255, 205, 86)",
            "rgb(54, 162, 235)",
          ],
        },
      ],
    },
    options: {
      plugins: {
        legend: { position: "right" },
      },
    },
  });
  chart.setWidth(500);
  chart.setHeight(300);

  return chart.getUrl();
}

/**
 * Generate a comparison bar chart
 */
async function generateComparisonChart(
  labels: string[],
  mergedData: number[],
  abandonedData: number[]
): Promise<string> {
  const chart = new QuickChart();
  chart.setConfig({
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Merged PRs",
          data: mergedData,
          backgroundColor: "rgb(75, 192, 192)",
        },
        {
          label: "Abandoned PRs",
          data: abandonedData,
          backgroundColor: "rgb(255, 99, 132)",
        },
      ],
    },
    options: {
      plugins: {
        legend: { position: "top" },
      },
      scales: {
        y: { beginAtZero: true },
      },
    },
  });
  chart.setWidth(700);
  chart.setHeight(350);

  return chart.getUrl();
}

// -----------------------------------------------------------------------------
// Report Generation
// -----------------------------------------------------------------------------

/**
 * Generate the overview section
 */
async function generateOverview(analysis: AnalysisOutput): Promise<string> {
  const { summary } = analysis;

  const overallSuccessRate = percentage(
    summary.mergedPrs,
    summary.mergedPrs + summary.abandonedPrs
  );

  // Generate pie chart
  const pieChartUrl = await generatePieChart(
    ["Merged", "Abandoned"],
    [summary.mergedPrs, summary.abandonedPrs]
  );

  return `
## Overview

This report analyzes Copilot coding agent sessions to understand which resources (instruction files, skills, MCP configurations) and tools correlate with successful (merged) vs. unsuccessful (abandoned) pull requests.

### Key Metrics

| Metric | Value |
|--------|-------|
| Total Sessions Analyzed | ${summary.totalSessions} |
| Sessions with Logs | ${summary.sessionsWithLogs} |
| Merged PRs | ${summary.mergedPrs} |
| Abandoned PRs | ${summary.abandonedPrs} |
| Overall Success Rate | **${overallSuccessRate}%** |
| Unique Resources Found | ${summary.uniqueResources} |
| Unique MCP Tools Found | ${summary.uniqueTools} |
| Analysis Date | ${formatDate(summary.analyzedAt)} |

### PR Outcomes Distribution

![PR Outcomes](${pieChartUrl})
`;
}

/**
 * Get an icon for an insight type
 */
function getInsightIcon(type: string): string {
  const icons: Record<string, string> = {
    "success-factor": "✅",
    "failure-pattern": "❌",
    "success-tools": "🔧",
    "repo-comparison": "📊",
  };
  return icons[type] || "💡";
}

/**
 * Generate the insights section
 */
function generateInsightsSection(insights: Insight[]): string {
  if (insights.length === 0) {
    return `
## Key Insights

*No significant patterns were detected. This may be due to:*
- Insufficient data (need more PRs for analysis)
- Consistent resource usage across all PRs
- No session logs available for the analyzed PRs
`;
  }

  let md = "\n## Key Insights\n\n";

  for (const insight of insights) {
    md += `### ${getInsightIcon(insight.type)} ${insight.title}\n\n`;
    md += `${insight.description}\n\n`;

    if (insight.type === "success-factor" || insight.type === "failure-pattern") {
      md += "| Resource | Category | Success Score | Rate |\n";
      md += "|----------|----------|---------------|------|\n";

      for (const item of insight.items) {
        const rate =
          insight.type === "success-factor"
            ? `${item.mergedRate}% merged`
            : `${item.abandonedRate}% abandoned`;
        const scoreEmoji = item.successScore > 0 ? "🟢" : "🔴";
        md += `| \`${item.name}\` | ${item.category} | ${scoreEmoji} ${item.successScore.toFixed(1)} | ${rate} |\n`;
      }
      md += "\n";
    } else if (insight.type === "success-tools") {
      md += "| Tool | Success Score | Merged Rate |\n";
      md += "|------|---------------|-------------|\n";

      for (const item of insight.items) {
        md += `| \`${item.name}\` | 🟢 ${item.successScore.toFixed(1)} | ${item.mergedRate}% |\n`;
      }
      md += "\n";
    } else if (insight.type === "repo-comparison") {
      md += "| Repository | Success Rate | Status |\n";
      md += "|------------|--------------|--------|\n";

      for (const item of insight.items) {
        const emoji = item.label === "Best Performing" ? "🏆" : "⚠️";
        md += `| ${item.repo} | ${item.successScore}% | ${emoji} ${item.label} |\n`;
      }
      md += "\n";
    }
  }

  return md;
}

/**
 * Generate the resource analysis section
 */
async function generateResourceSection(
  resourceAnalysis: ResourceAnalysis
): Promise<string> {
  const { resources } = resourceAnalysis;

  if (resources.length === 0) {
    return "\n## Resource Analysis\n\n*No resources were extracted from session logs.*\n";
  }

  // Take top and bottom resources for chart
  const topResources = resources.filter((r) => r.totalCount >= 2).slice(0, 8);

  let chartMd = "";
  if (topResources.length > 0) {
    const labels = topResources.map((r) => {
      // Truncate long resource names
      const name = r.resource.replace(/^\.github\//, "");
      return name.length > 20 ? name.substring(0, 17) + "..." : name;
    });

    const chartUrl = await generateComparisonChart(
      labels,
      topResources.map((r) => r.mergedCount),
      topResources.map((r) => r.abandonedCount)
    );

    chartMd = `\n![Resource Usage by PR Outcome](${chartUrl})\n`;
  }

  let md = `
## Resource Analysis

This section shows how different resources (instruction files, skills, etc.) correlate with PR outcomes.

### Resource Usage by Category

${chartMd}

### Top Resources by Usage

| Resource | Category | Total | Merged | Abandoned | Success Score |
|----------|----------|-------|--------|-----------|---------------|
`;

  // Show top 15 resources by usage
  const topByUsage = [...resources]
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 15);

  for (const r of topByUsage) {
    const scoreEmoji =
      r.successScore > 0 ? "🟢" : r.successScore < 0 ? "🔴" : "⚪";
    md += `| \`${r.resource}\` | ${r.category} | ${r.totalCount} | ${r.mergedCount} | ${r.abandonedCount} | ${scoreEmoji} ${r.successScore.toFixed(1)} |\n`;
  }

  return md;
}

/**
 * Generate the tool analysis section
 */
async function generateToolSection(toolAnalysis: ToolAnalysis): Promise<string> {
  const { tools } = toolAnalysis;

  if (tools.length === 0) {
    return "\n## MCP Tool Analysis\n\n*No MCP tools were detected in session logs.*\n";
  }

  let md = `
## MCP Tool Analysis

This section shows which MCP tools are used during Copilot sessions and how they correlate with outcomes.

### Tools by Usage

| Tool | Total Uses | Merged PRs | Abandoned PRs | Success Score |
|------|------------|------------|---------------|---------------|
`;

  // Sort by total usage
  const sortedTools = [...tools].sort((a, b) => b.totalCount - a.totalCount);

  for (const t of sortedTools.slice(0, 15)) {
    const scoreEmoji =
      t.successScore > 0 ? "🟢" : t.successScore < 0 ? "🔴" : "⚪";
    md += `| \`${t.tool}\` | ${t.totalCount} | ${t.mergedCount} | ${t.abandonedCount} | ${scoreEmoji} ${t.successScore.toFixed(1)} |\n`;
  }

  return md;
}

/**
 * Generate the per-repository section
 */
async function generateRepoSection(
  repoAnalysis: Record<string, RepoStat>
): Promise<string> {
  const repos = Object.values(repoAnalysis);

  if (repos.length === 0) {
    return "";
  }

  // Generate chart
  const labels = repos.map((r) => r.repo.split("/")[1] || r.repo);
  const chartUrl = await generateBarChart(
    labels,
    repos.map((r) => r.successRate),
    "Success Rate (%)",
    "rgb(75, 192, 192)"
  );

  let md = `
## Repository Breakdown

### Success Rate by Repository

![Success Rate by Repository](${chartUrl})

### Detailed Repository Metrics

`;

  for (const repo of repos.sort((a, b) => b.successRate - a.successRate)) {
    md += `
#### ${repo.repo}

| Metric | Value |
|--------|-------|
| Total PRs | ${repo.totalPrs} |
| PRs with Logs | ${repo.prsWithLogs} |
| Merged | ${repo.merged} |
| Abandoned | ${repo.abandoned} |
| **Success Rate** | **${repo.successRate}%** |
| Unique Resources | ${repo.uniqueResources} |
| Unique Tools | ${repo.uniqueTools} |

<details>
<summary>Top Resources Used</summary>

${repo.topResources.map((r) => `- \`${r.resource}\` (${r.count} uses)`).join("\n") || "*None detected*"}

</details>

<details>
<summary>Top Tools Used</summary>

${repo.topTools.map((t) => `- \`${t.tool}\` (${t.count} uses)`).join("\n") || "*None detected*"}

</details>

`;
  }

  return md;
}

/**
 * Generate recommendations section
 */
function generateRecommendations(analysis: AnalysisOutput): string {
  const { insights, summary, repoAnalysis } = analysis;
  const recommendations: {
    priority: string;
    recommendation: string;
    rationale: string;
  }[] = [];

  // Based on success factors
  const successFactors = insights.find((i) => i.type === "success-factor");
  if (successFactors && successFactors.items.length > 0) {
    recommendations.push({
      priority: "High",
      recommendation: `Ensure all repositories have the following resources: ${successFactors.items
        .slice(0, 3)
        .map((i) => `\`${i.name}\``)
        .join(", ")}`,
      rationale:
        "These resources are associated with higher PR success rates.",
    });
  }

  // Based on failure patterns
  const failurePatterns = insights.find((i) => i.type === "failure-pattern");
  if (failurePatterns && failurePatterns.items.length > 0) {
    recommendations.push({
      priority: "High",
      recommendation: `Review and improve the content of: ${failurePatterns.items
        .slice(0, 3)
        .map((i) => `\`${i.name}\``)
        .join(", ")}`,
      rationale:
        "These resources appear more often in abandoned PRs, suggesting their content may be misleading or insufficient.",
    });
  }

  // Based on repo comparison
  const repos = Object.values(repoAnalysis);
  if (repos.length > 1) {
    const bestRepo = repos.reduce((a, b) =>
      a.successRate > b.successRate ? a : b
    );
    const worstRepo = repos.reduce((a, b) =>
      a.successRate < b.successRate ? a : b
    );

    if (bestRepo.successRate - worstRepo.successRate > 20) {
      recommendations.push({
        priority: "Medium",
        recommendation: `Study the Copilot configuration in \`${bestRepo.repo}\` and apply similar patterns to \`${worstRepo.repo}\``,
        rationale: `Success rate gap of ${(bestRepo.successRate - worstRepo.successRate).toFixed(1)}% suggests configuration differences.`,
      });
    }
  }

  // General recommendations
  if (summary.sessionsWithLogs < summary.totalSessions * 0.5) {
    recommendations.push({
      priority: "Medium",
      recommendation: "Enable session logging for more Copilot sessions",
      rationale: `Only ${percentage(summary.sessionsWithLogs, summary.totalSessions)}% of sessions had accessible logs.`,
    });
  }

  if (recommendations.length === 0) {
    return `
## Recommendations

Based on the analysis, no specific recommendations can be made at this time. Consider:
- Collecting more PR data for better pattern detection
- Ensuring Copilot session logs are accessible
- Adding more detailed instruction files to repositories
`;
  }

  let md = "\n## Recommendations\n\n";

  for (let i = 0; i < recommendations.length; i++) {
    const rec = recommendations[i];
    const priorityEmoji =
      rec.priority === "High"
        ? "🔴"
        : rec.priority === "Medium"
          ? "🟡"
          : "🟢";

    md += `### ${i + 1}. ${priorityEmoji} ${rec.recommendation}\n\n`;
    md += `*Rationale: ${rec.rationale}*\n\n`;
  }

  return md;
}

// -----------------------------------------------------------------------------
// Main Function
// -----------------------------------------------------------------------------

/**
 * Main entry point for report generation
 */
async function main(): Promise<void> {
  // Read analysis from previous step
  let analysis: AnalysisOutput;
  try {
    analysis = readOutput<AnalysisOutput>(OUTPUT_FILES.ANALYSIS);
  } catch {
    console.error("Error: Analysis file not found. Run analyze step first.");
    process.exit(1);
  }

  console.log("Generating report...\n");

  // Build report sections
  const sections: string[] = [];

  // Title
  sections.push("# Copilot PR Analysis Report\n");
  sections.push(`*Generated on ${formatDate(new Date())}*\n`);

  // Table of contents
  sections.push(`
## Table of Contents

1. [Overview](#overview)
2. [Key Insights](#key-insights)
3. [Resource Analysis](#resource-analysis)
4. [MCP Tool Analysis](#mcp-tool-analysis)
5. [Repository Breakdown](#repository-breakdown)
6. [Recommendations](#recommendations)
`);

  console.log("Generating overview section...");
  sections.push(await generateOverview(analysis));

  console.log("Generating insights section...");
  sections.push(generateInsightsSection(analysis.insights));

  console.log("Generating resource analysis section...");
  sections.push(await generateResourceSection(analysis.resourceAnalysis));

  console.log("Generating tool analysis section...");
  sections.push(await generateToolSection(analysis.toolAnalysis));

  console.log("Generating repository breakdown...");
  sections.push(await generateRepoSection(analysis.repoAnalysis));

  console.log("Generating recommendations...");
  sections.push(generateRecommendations(analysis));

  // Footer
  sections.push(`
---

*This report was generated by the Copilot PR Analysis skill.*
*For questions or improvements, see the [skill documentation](SKILL.md).*
`);

  // Write report
  const report = sections.join("\n");
  writeOutputText(OUTPUT_FILES.REPORT, report);

  // Write summary JSON for programmatic access
  writeOutput(OUTPUT_FILES.SUMMARY, {
    generatedAt: new Date().toISOString(),
    summary: analysis.summary,
    topInsights: analysis.insights.slice(0, 3),
    overallSuccessRate: percentage(
      analysis.summary.mergedPrs,
      analysis.summary.mergedPrs + analysis.summary.abandonedPrs
    ),
  });

  console.log("\n=== Report Generated ===");
  console.log(`Report: ${OUTPUT_FILES.REPORT}`);
  console.log(`Summary: ${OUTPUT_FILES.SUMMARY}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
