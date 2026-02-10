/**
 * Shared types for the Azure SDK MCP Adoption skill
 */

import type { SupportedLanguage } from "./constants.ts";

// -----------------------------------------------------------------------------
// Telemetry Types
// -----------------------------------------------------------------------------

export interface TelemetryRow {
  timestamp: string;
  PackageName: string;
  TypeSpecPath: string;
  ToolName: string;
  ClientName: string;
  ClientVersion: string;
  Language: string;
  OperationStatus: string;
  DeviceId: string;
  duration: number;
}

export interface PackageUsageData {
  calls: number;
  users: Set<string>;
  tools: Set<string>;
  clients: Map<string, number>;
  language: string;
}

export interface TypespecPathData {
  calls: number;
  users: Set<string>;
  tools: Set<string>;
  clients: Map<string, number>;
  rawPath: string;
  languages: Set<string>;
}

export interface PackageSummaryItem {
  packageName: string;
  language: string;
  callCount: number;
  userCount: number;
  toolsUsed: string[];
  clientsUsed: { name: string; calls: number }[];
}

export interface TypespecSummaryItem {
  typespecPath: string;
  normalizedPath: string;
  callCount: number;
  userCount: number;
  toolsUsed: string[];
  clientsUsed: { name: string; calls: number }[];
  languages: string[];
}

export interface ToolSummaryItem {
  name: string;
  calls: number;
  successRate: number;
  userCount: number;
  packageCount: number;
}

export interface ClientSummaryItem {
  name: string;
  version: string;
  calls: number;
  userCount: number;
}

export interface TelemetryMetadata {
  startDate: string;
  endDate: string;
  generatedAt: string;
  cluster: string;
  database: string;
  totalRawCalls: number;
  callsWithPackage: number;
  callsWithTypespecOnly: number;
  uniqueTypespecPaths: number;
}

export interface TelemetryOutput {
  metadata: TelemetryMetadata;
  packageSummary: PackageSummaryItem[];
  typespecSummary: TypespecSummaryItem[];
  toolSummary: ToolSummaryItem[];
  clientSummary: ClientSummaryItem[];
}

// -----------------------------------------------------------------------------
// Release Types
// -----------------------------------------------------------------------------

export type VersionType = "GA" | "Beta";
export type PlaneType = "Management" | "Data";

export interface Release {
  packageName: string;
  version: string;
  displayName: string;
  serviceName: string;
  versionType: VersionType;
  plane: PlaneType;
  language: SupportedLanguage | string;
  releaseMonth: string;
  originalVersionType: string;
  changelogUrl: string;
  typespecDirectory?: string;
}

export interface TypespecPackageMapping {
  packageName: string;
  language: string;
  version: string;
  releaseMonth: string;
}

export interface ReleasesMetadata {
  months: string[];
  languages: string[];
  generatedAt: string;
  tspLocationsFetched: number;
  tspLocationsFound: number;
  uniqueTypespecPaths: number;
}

export interface ReleasesOutput {
  metadata: ReleasesMetadata;
  releases: Release[];
  typespecMapping: Record<string, TypespecPackageMapping[]>;
}

// -----------------------------------------------------------------------------
// Correlation Types
// -----------------------------------------------------------------------------

export interface CorrelatedRelease extends Release {
  hadMcpUsage: boolean;
  mcpMatchType: "package" | "typespec" | null;
  mcpCallCount: number;
  mcpUserCount: number;
  mcpToolsUsed: string[];
  mcpClientsUsed: { name: string; calls: number }[];
  mcpResolvedFromTypespec: boolean;
  mcpMatchedTypespecPath: string | null;
}

export interface GroupedStat {
  total: number;
  withMcp: number;
  adoptionRate: number;
}

export interface LanguageStat extends GroupedStat {
  language: string;
}

export interface VersionTypeStat extends GroupedStat {
  versionType: string;
}

export interface PlaneStat extends GroupedStat {
  plane: string;
}

export interface CorrelationSummary {
  totalReleases: number;
  releasesWithMcp: number;
  adoptionRate: number;
  matchBreakdown: {
    directPackageMatches: number;
    typespecPathMatches: number;
  };
}

export interface CorrelationMetadata {
  generatedAt: string;
  telemetryPeriod: {
    start: string;
    end: string;
  };
  releaseMonths: string[];
}

export interface CorrelationOutput {
  metadata: CorrelationMetadata;
  summary: CorrelationSummary;
  byLanguage: LanguageStat[];
  byVersionType: VersionTypeStat[];
  byPlane: PlaneStat[];
  releases: CorrelatedRelease[];
  toolSummary: ToolSummaryItem[];
  clientSummary: ClientSummaryItem[];
}

// -----------------------------------------------------------------------------
// Pipeline Types
// -----------------------------------------------------------------------------

export interface PipelineStep {
  name: string;
  script: string;
  desc: string;
}

export interface ParsedArgs {
  steps: string[];
  passthrough: string[];
}
