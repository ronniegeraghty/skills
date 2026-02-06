#!/usr/bin/env npx tsx
/**
 * Constants and configuration for the Sprint Update Memo skill.
 */

// -----------------------------------------------------------------------------
// GitHub Project Configuration
// -----------------------------------------------------------------------------

/** GitHub organization */
export const GITHUB_ORG = "Azure";

/** GitHub Project number */
export const PROJECT_NUMBER = 865;

/** Project URL */
export const PROJECT_URL = `https://github.com/orgs/${GITHUB_ORG}/projects/${PROJECT_NUMBER}`;

// -----------------------------------------------------------------------------
// Status Configuration
// -----------------------------------------------------------------------------

/**
 * Status emoji mappings for the progress table.
 */
export const STATUS_EMOJI: Record<string, string> = {
  Done: "✅ Done",
  "In Progress": "🔄 In Progress",
  Todo: "📝 To Do",
  Blocked: "🚫 Blocked",
  "Needs Triage": "❓ Needs Triage",
};

/**
 * RAG status emoji mappings.
 */
export const RAG_EMOJI: Record<string, string> = {
  Green: "🟢",
  Yellow: "🟡",
  Red: "🔴",
};

// -----------------------------------------------------------------------------
// Epic to Category Mappings
// -----------------------------------------------------------------------------

/**
 * Maps Epic field values to display category names for the memo.
 */
export const EPIC_TO_CATEGORY: Record<string, string> = {
  "0.5 TypeSpec": "TypeSpec Authoring",
  "1. Env Setup": "Environment Setup",
  "2. Generating": "SDK Generation",
  "3. Customizing TypeSpec/Library": "SDK Code Customization",
  "4. Testing": "Testing",
  "5. Samples": "Samples & Sample Generation",
  "6. Package Metadata & Docs Updates": "Package Metadata & Docs Updates",
  "7. Validating": "Validation",
  "8. Releasing": "Releasing",
  "99. Operations": "Integration & AI Tooling",
};

/**
 * Order of categories in the progress table (by Epic number prefix).
 */
export const CATEGORY_ORDER = [
  "0.5 TypeSpec",
  "1. Env Setup",
  "2. Generating",
  "3. Customizing TypeSpec/Library",
  "4. Testing",
  "5. Samples",
  "6. Package Metadata & Docs Updates",
  "7. Validating",
  "8. Releasing",
  "99. Operations",
];

// -----------------------------------------------------------------------------
// Labels Configuration
// -----------------------------------------------------------------------------

/**
 * Labels to track and their meanings.
 */
export const TRACKED_LABELS = {
  /** Issue discovered during bug bash */
  BUG_BASH: "bug bash",
  /** Scenario labels (Scenario 1, Scenario 2, etc.) */
  SCENARIO_PREFIX: "Scenario",
  /** Management plane related */
  MGMT: "Mgmt",
  /** CLI mode specific */
  AZSDK_CLI: "azsdk-cli",
  /** Central Engineering Systems */
  CENTRAL_ENGSYS: "Central-EngSys",
  /** Design discussion (not implementation work) */
  DESIGN_DISCUSSION: "design discussion",
};

// -----------------------------------------------------------------------------
// RAG Status Thresholds
// -----------------------------------------------------------------------------

/**
 * Percentage threshold for Green status (≥80% done).
 */
export const RAG_GREEN_THRESHOLD = 80;

/**
 * Percentage threshold for Yellow status (≥60% done).
 */
export const RAG_YELLOW_THRESHOLD = 60;

/**
 * Maximum blocked items for Yellow status (1-2 blocked).
 */
export const RAG_YELLOW_MAX_BLOCKED = 2;

// -----------------------------------------------------------------------------
// Output Configuration
// -----------------------------------------------------------------------------

/**
 * Output directory name.
 */
export const OUTPUT_DIR = "output";

/**
 * Output filename template.
 * Use with: `AzSDK-Tools-Agent-Sprint-${sprintNumber}-Update.md`
 */
export const OUTPUT_FILENAME_TEMPLATE = "AzSDK-Tools-Agent-Sprint-{N}-Update.md";

// -----------------------------------------------------------------------------
// Pipeline Steps
// -----------------------------------------------------------------------------

import type { PipelineStep } from "./types.ts";

/**
 * Pipeline steps in execution order.
 */
export const PIPELINE_STEPS: PipelineStep[] = [
  {
    name: "fetch-sprints",
    script: "fetch-sprints.ts",
    desc: "Fetch Sprint iterations from GitHub Project",
  },
  {
    name: "fetch-items",
    script: "fetch-items.ts",
    desc: "Fetch project items with pagination and filter by Sprint",
  },
  {
    name: "analyze",
    script: "analyze.ts",
    desc: "Analyze Sprint data, calculate RAG status",
  },
  {
    name: "report",
    script: "report.ts",
    desc: "Generate Markdown memo",
  },
];
