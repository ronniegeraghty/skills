/**
 * Shared types for the Copilot PR Analysis skill
 */

import type { PrStatusType } from "./constants.ts";

// -----------------------------------------------------------------------------
// PR Types
// -----------------------------------------------------------------------------

export interface PrAuthor {
  login: string;
}

export interface RawPr {
  number: number;
  title: string;
  state: string;
  author: PrAuthor;
  headRefName: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  url: string;
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface ClassifiedPr extends RawPr {
  repo: string;
  status: PrStatusType;
  analyzedAt: string;
}

export interface PrSummary {
  total: number;
  merged: number;
  abandoned: number;
  active: number;
  repos: number;
  sinceDate: string;
  staleDays: number;
}

export interface PrsOutput {
  summary: PrSummary;
  prs: ClassifiedPr[];
}

// -----------------------------------------------------------------------------
// Session Types
// -----------------------------------------------------------------------------

export interface SessionMetrics {
  logLines: number;
  toolCalls: number;
  errors: number;
  fileReads: number;
  fileWrites: number;
}

export interface SessionData {
  hasLog: boolean;
  resources: string[];
  mcpTools: string[];
  metrics: SessionMetrics;
  logPreview?: string;
}

export interface Session extends SessionData {
  repo: string;
  prNumber: number;
  prStatus: PrStatusType;
  prTitle: string;
  prUrl: string;
}

export interface SessionsSummary {
  total: number;
  withLogs: number;
  withoutLogs: number;
}

export interface SessionsOutput {
  summary: SessionsSummary;
  sessions: Session[];
}

// -----------------------------------------------------------------------------
// Analysis Types
// -----------------------------------------------------------------------------

export interface ResourceStat {
  resource: string;
  category: string;
  mergedCount: number;
  abandonedCount: number;
  totalCount: number;
  mergedRate: number;
  abandonedRate: number;
  successScore: number;
}

export interface ToolStat {
  tool: string;
  mergedCount: number;
  abandonedCount: number;
  totalCount: number;
  mergedRate: number;
  abandonedRate: number;
  successScore: number;
}

export interface ResourceAnalysis {
  totalMerged: number;
  totalAbandoned: number;
  resources: ResourceStat[];
}

export interface ToolAnalysis {
  totalMerged: number;
  totalAbandoned: number;
  tools: ToolStat[];
}

export interface ResourceFrequency {
  resource: string;
  count: number;
}

export interface ToolFrequency {
  tool: string;
  count: number;
}

export interface RepoStat {
  repo: string;
  totalPrs: number;
  prsWithLogs: number;
  merged: number;
  abandoned: number;
  successRate: number;
  uniqueResources: number;
  uniqueTools: number;
  topResources: ResourceFrequency[];
  topTools: ToolFrequency[];
  avgMetrics: SessionMetrics;
}

export interface InsightItem {
  name: string;
  category?: string;
  successScore: number;
  mergedRate?: number;
  abandonedRate?: number;
  repo?: string;
  label?: string;
}

export interface Insight {
  type: string;
  title: string;
  description: string;
  items: InsightItem[];
}

export interface AnalysisSummary {
  totalSessions: number;
  sessionsWithLogs: number;
  mergedPrs: number;
  abandonedPrs: number;
  uniqueResources: number;
  uniqueTools: number;
  analyzedAt: string;
}

export interface AnalysisOutput {
  summary: AnalysisSummary;
  resourceAnalysis: ResourceAnalysis;
  toolAnalysis: ToolAnalysis;
  repoAnalysis: Record<string, RepoStat>;
  insights: Insight[];
}

// -----------------------------------------------------------------------------
// Pipeline Types
// -----------------------------------------------------------------------------

export interface PipelineStep {
  name: string;
  script: string;
  desc: string;
}

export interface ParsedRunArgs {
  steps: string[];
  passthrough: string[];
  showHelp: boolean;
}

export interface ParsedPrArgs {
  repos: string[];
  sinceDate: string;
  staleDays: number;
}
