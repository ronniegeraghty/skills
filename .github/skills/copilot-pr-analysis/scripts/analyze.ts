/**
 * Analyze Copilot Sessions to Correlate Resources/Tools with PR Outcomes
 *
 * Processes session data to find patterns in:
 * - Which resources correlate with merged (successful) PRs
 * - Which resources correlate with abandoned (unsuccessful) PRs
 * - Which MCP tools are associated with success/failure
 *
 * @module analyze
 */

import { OUTPUT_FILES, PR_STATUS, RESOURCE_CATEGORIES } from "./constants.ts";
import { readOutput, writeOutput, percentage, groupBy } from "./utils.ts";
import type {
  SessionsOutput,
  Session,
  ResourceStat,
  ToolStat,
  ResourceAnalysis,
  ToolAnalysis,
  RepoStat,
  Insight,
  ResourceFrequency,
  ToolFrequency,
  SessionMetrics,
  AnalysisOutput,
} from "./types.ts";

// -----------------------------------------------------------------------------
// Analysis Functions
// -----------------------------------------------------------------------------

/**
 * Categorize a resource path
 */
function categorizeResource(resource: string): string {
  for (const [category, pattern] of Object.entries(RESOURCE_CATEGORIES)) {
    if (pattern.test(resource)) {
      return category;
    }
  }
  return "other";
}

/**
 * Calculate resource usage statistics
 */
function analyzeResourceUsage(sessions: Session[]): ResourceAnalysis {
  const merged = sessions.filter(
    (s) => s.prStatus === PR_STATUS.MERGED && s.hasLog
  );
  const abandoned = sessions.filter(
    (s) => s.prStatus === PR_STATUS.ABANDONED && s.hasLog
  );

  // Count resource occurrences by status
  const resourceStats: Record<
    string,
    {
      resource: string;
      category: string;
      mergedCount: number;
      abandonedCount: number;
      totalCount: number;
    }
  > = {};

  for (const session of sessions) {
    if (!session.hasLog) continue;

    for (const resource of session.resources) {
      if (!resourceStats[resource]) {
        resourceStats[resource] = {
          resource,
          category: categorizeResource(resource),
          mergedCount: 0,
          abandonedCount: 0,
          totalCount: 0,
        };
      }

      resourceStats[resource].totalCount++;
      if (session.prStatus === PR_STATUS.MERGED) {
        resourceStats[resource].mergedCount++;
      } else if (session.prStatus === PR_STATUS.ABANDONED) {
        resourceStats[resource].abandonedCount++;
      }
    }
  }

  // Calculate rates and scores
  const resourceList: ResourceStat[] = Object.values(resourceStats).map(
    (stat) => {
      const mergedRate = percentage(stat.mergedCount, stat.totalCount);
      const abandonedRate = percentage(stat.abandonedCount, stat.totalCount);

      // Success score: positive means more successful, negative means more abandoned
      // Formula: (merged% - abandoned%) weighted by usage frequency
      const successScore = mergedRate - abandonedRate;

      return {
        ...stat,
        mergedRate,
        abandonedRate,
        successScore,
      };
    }
  );

  // Sort by success score
  resourceList.sort((a, b) => b.successScore - a.successScore);

  return {
    totalMerged: merged.length,
    totalAbandoned: abandoned.length,
    resources: resourceList,
  };
}

/**
 * Calculate MCP tool usage statistics
 */
function analyzeToolUsage(sessions: Session[]): ToolAnalysis {
  const merged = sessions.filter(
    (s) => s.prStatus === PR_STATUS.MERGED && s.hasLog
  );
  const abandoned = sessions.filter(
    (s) => s.prStatus === PR_STATUS.ABANDONED && s.hasLog
  );

  const toolStats: Record<
    string,
    {
      tool: string;
      mergedCount: number;
      abandonedCount: number;
      totalCount: number;
    }
  > = {};

  for (const session of sessions) {
    if (!session.hasLog) continue;

    for (const tool of session.mcpTools) {
      if (!toolStats[tool]) {
        toolStats[tool] = {
          tool,
          mergedCount: 0,
          abandonedCount: 0,
          totalCount: 0,
        };
      }

      toolStats[tool].totalCount++;
      if (session.prStatus === PR_STATUS.MERGED) {
        toolStats[tool].mergedCount++;
      } else if (session.prStatus === PR_STATUS.ABANDONED) {
        toolStats[tool].abandonedCount++;
      }
    }
  }

  const toolList: ToolStat[] = Object.values(toolStats).map((stat) => {
    const mergedRate = percentage(stat.mergedCount, stat.totalCount);
    const abandonedRate = percentage(stat.abandonedCount, stat.totalCount);
    const successScore = mergedRate - abandonedRate;

    return {
      ...stat,
      mergedRate,
      abandonedRate,
      successScore,
    };
  });

  toolList.sort((a, b) => b.successScore - a.successScore);

  return {
    totalMerged: merged.length,
    totalAbandoned: abandoned.length,
    tools: toolList,
  };
}

/**
 * Count resources by frequency in sessions
 */
function countResourcesByFrequency(
  sessions: Session[],
  limit: number = 10
): ResourceFrequency[] {
  const counts: Record<string, number> = {};
  sessions.forEach((s) => {
    s.resources.forEach((r) => {
      counts[r] = (counts[r] || 0) + 1;
    });
  });

  return Object.entries(counts)
    .map(([resource, count]) => ({ resource, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Count tools by frequency in sessions
 */
function countToolsByFrequency(
  sessions: Session[],
  limit: number = 10
): ToolFrequency[] {
  const counts: Record<string, number> = {};
  sessions.forEach((s) => {
    s.mcpTools.forEach((t) => {
      counts[t] = (counts[t] || 0) + 1;
    });
  });

  return Object.entries(counts)
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Analyze sessions by repository
 */
function analyzeByRepo(sessions: Session[]): Record<string, RepoStat> {
  const byRepo = groupBy(sessions, (s) => s.repo);

  const repoStats: Record<string, RepoStat> = {};

  for (const [repo, repoSessions] of Object.entries(byRepo)) {
    const withLogs = repoSessions.filter((s) => s.hasLog);
    const merged = withLogs.filter((s) => s.prStatus === PR_STATUS.MERGED);
    const abandoned = withLogs.filter(
      (s) => s.prStatus === PR_STATUS.ABANDONED
    );

    // Count unique resources
    const allResources = new Set<string>();
    withLogs.forEach((s) => s.resources.forEach((r) => allResources.add(r)));

    // Count unique tools
    const allTools = new Set<string>();
    withLogs.forEach((s) => s.mcpTools.forEach((t) => allTools.add(t)));

    // Average metrics
    const avgMetrics: SessionMetrics = {
      logLines: 0,
      toolCalls: 0,
      errors: 0,
      fileReads: 0,
      fileWrites: 0,
    };

    if (withLogs.length > 0) {
      withLogs.forEach((s) => {
        if (s.metrics) {
          avgMetrics.logLines += s.metrics.logLines;
          avgMetrics.toolCalls += s.metrics.toolCalls;
          avgMetrics.errors += s.metrics.errors;
          avgMetrics.fileReads += s.metrics.fileReads;
          avgMetrics.fileWrites += s.metrics.fileWrites;
        }
      });

      (Object.keys(avgMetrics) as (keyof SessionMetrics)[]).forEach((key) => {
        avgMetrics[key] = Math.round(avgMetrics[key] / withLogs.length);
      });
    }

    repoStats[repo] = {
      repo,
      totalPrs: repoSessions.length,
      prsWithLogs: withLogs.length,
      merged: merged.length,
      abandoned: abandoned.length,
      successRate: percentage(merged.length, merged.length + abandoned.length),
      uniqueResources: allResources.size,
      uniqueTools: allTools.size,
      topResources: countResourcesByFrequency(withLogs, 5),
      topTools: countToolsByFrequency(withLogs, 5),
      avgMetrics,
    };
  }

  return repoStats;
}

/**
 * Generate insights based on analysis
 */
function generateInsights(
  resourceAnalysis: ResourceAnalysis,
  toolAnalysis: ToolAnalysis,
  repoAnalysis: Record<string, RepoStat>
): Insight[] {
  const insights: Insight[] = [];

  // Success factor insights (resources with high success scores)
  const topSuccessResources = resourceAnalysis.resources
    .filter((r) => r.successScore > 20 && r.totalCount >= 2)
    .slice(0, 5);

  if (topSuccessResources.length > 0) {
    insights.push({
      type: "success-factor",
      title: "Resources Associated with Successful PRs",
      description:
        "These resources appear more often in merged PRs than abandoned ones.",
      items: topSuccessResources.map((r) => ({
        name: r.resource,
        category: r.category,
        successScore: r.successScore,
        mergedRate: r.mergedRate,
      })),
    });
  }

  // Failure pattern insights (resources with low success scores)
  const failureResources = resourceAnalysis.resources
    .filter((r) => r.successScore < -20 && r.totalCount >= 2)
    .slice(-5)
    .reverse();

  if (failureResources.length > 0) {
    insights.push({
      type: "failure-pattern",
      title: "Resources Associated with Abandoned PRs",
      description:
        "These resources appear more often in abandoned PRs. Consider reviewing their content.",
      items: failureResources.map((r) => ({
        name: r.resource,
        category: r.category,
        successScore: r.successScore,
        abandonedRate: r.abandonedRate,
      })),
    });
  }

  // Tool insights
  const topSuccessTools = toolAnalysis.tools
    .filter((t) => t.successScore > 20 && t.totalCount >= 2)
    .slice(0, 5);

  if (topSuccessTools.length > 0) {
    insights.push({
      type: "success-tools",
      title: "MCP Tools Associated with Successful PRs",
      description: "These tools are more commonly used in merged PRs.",
      items: topSuccessTools.map((t) => ({
        name: t.tool,
        successScore: t.successScore,
        mergedRate: t.mergedRate,
      })),
    });
  }

  // Repo performance insights
  const repos = Object.values(repoAnalysis);
  if (repos.length > 0) {
    const bestRepo = repos.reduce((a, b) =>
      a.successRate > b.successRate ? a : b
    );
    const worstRepo = repos.reduce((a, b) =>
      a.successRate < b.successRate ? a : b
    );

    if (bestRepo !== worstRepo) {
      insights.push({
        type: "repo-comparison",
        title: "Repository Performance Comparison",
        description: "Success rates vary across repositories.",
        items: [
          {
            name: bestRepo.repo,
            repo: bestRepo.repo,
            successScore: bestRepo.successRate,
            label: "Best Performing",
          },
          {
            name: worstRepo.repo,
            repo: worstRepo.repo,
            successScore: worstRepo.successRate,
            label: "Needs Improvement",
          },
        ],
      });
    }
  }

  return insights;
}

// -----------------------------------------------------------------------------
// Main Function
// -----------------------------------------------------------------------------

/**
 * Main entry point for analysis
 */
async function main(): Promise<void> {
  // Read sessions from previous step
  let sessionsData: SessionsOutput;
  try {
    sessionsData = readOutput<SessionsOutput>(OUTPUT_FILES.SESSIONS);
  } catch {
    console.error(
      "Error: Sessions file not found. Run fetch-sessions step first."
    );
    process.exit(1);
  }

  const { sessions } = sessionsData;

  console.log(`Analyzing ${sessions.length} sessions...\n`);

  // Perform analyses
  console.log("Analyzing resource usage...");
  const resourceAnalysis = analyzeResourceUsage(sessions);

  console.log("Analyzing tool usage...");
  const toolAnalysis = analyzeToolUsage(sessions);

  console.log("Analyzing by repository...");
  const repoAnalysis = analyzeByRepo(sessions);

  console.log("Generating insights...\n");
  const insights = generateInsights(resourceAnalysis, toolAnalysis, repoAnalysis);

  // Summary
  console.log("=== Analysis Summary ===");
  console.log(`Unique resources found: ${resourceAnalysis.resources.length}`);
  console.log(`Unique MCP tools found: ${toolAnalysis.tools.length}`);
  console.log(`Insights generated: ${insights.length}`);
  console.log(`Repositories analyzed: ${Object.keys(repoAnalysis).length}`);

  // Write output
  const analysis: AnalysisOutput = {
    summary: {
      totalSessions: sessions.length,
      sessionsWithLogs: sessions.filter((s) => s.hasLog).length,
      mergedPrs: resourceAnalysis.totalMerged,
      abandonedPrs: resourceAnalysis.totalAbandoned,
      uniqueResources: resourceAnalysis.resources.length,
      uniqueTools: toolAnalysis.tools.length,
      analyzedAt: new Date().toISOString(),
    },
    resourceAnalysis,
    toolAnalysis,
    repoAnalysis,
    insights,
  };

  writeOutput(OUTPUT_FILES.ANALYSIS, analysis);

  console.log("\nAnalysis complete.");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
