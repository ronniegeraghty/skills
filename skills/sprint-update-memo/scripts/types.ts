#!/usr/bin/env npx tsx
/**
 * TypeScript interfaces for the Sprint Update Memo skill.
 */

// -----------------------------------------------------------------------------
// GitHub Project Types
// -----------------------------------------------------------------------------

/**
 * Sprint iteration from GitHub Project.
 */
export interface SprintIteration {
  /** Iteration ID from GitHub */
  id: string;
  /** Sprint title, e.g., "Sprint 12" */
  title: string;
  /** Start date in ISO format, e.g., "2026-01-19" */
  startDate: string;
  /** Duration in days */
  duration: number;
}

/**
 * Status values from the GitHub Project Status field.
 */
export type ProjectItemStatus =
  | "Todo"
  | "In Progress"
  | "Done"
  | "Needs Triage"
  | "Blocked";

/**
 * A comment on a GitHub issue.
 */
export interface IssueComment {
  /** Comment body */
  body: string;
  /** Author login */
  author?: string;
}

/**
 * A linked pull request.
 */
export interface LinkedPullRequest {
  /** PR title */
  title: string;
  /** PR URL */
  url: string;
  /** PR body/description */
  body?: string;
  /** Whether the PR was merged */
  merged: boolean;
}

/**
 * A project item (issue or draft issue) from GitHub Project.
 */
export interface ProjectItem {
  /** Project item ID */
  id: string;
  /** Issue or draft issue title */
  title: string;
  /** Current status */
  status: ProjectItemStatus | null;
  /** Epic/category field value */
  epic: string | null;
  /** Sprint iteration if assigned */
  sprint: SprintIteration | null;
  /** Labels on the issue */
  labels: string[];
  /** Issue number (if linked issue, not draft) */
  issueNumber?: number;
  /** Issue URL (if linked issue, not draft) */
  issueUrl?: string;
  /** Issue body/description */
  body?: string;
  /** Whether this is a draft issue */
  isDraft: boolean;
  /** Comments on the issue */
  comments?: IssueComment[];
  /** Linked pull requests */
  linkedPRs?: LinkedPullRequest[];
}

// -----------------------------------------------------------------------------
// Analysis Types
// -----------------------------------------------------------------------------

/**
 * RAG status for the project.
 */
export type RAGStatus = "Green" | "Yellow" | "Red";

/**
 * Status counts for a Sprint.
 */
export interface StatusCounts {
  todo: number;
  inProgress: number;
  done: number;
  blocked: number;
  needsTriage: number;
  total: number;
}

/**
 * Analysis result for a Sprint.
 */
export interface SprintAnalysis {
  /** Sprint number extracted from title */
  sprintNumber: number;
  /** Full sprint title */
  sprintTitle: string;
  /** Sprint start date */
  startDate: Date;
  /** Sprint end date (startDate + duration) */
  endDate: Date;
  /** All items in this Sprint */
  items: ProjectItem[];
  /** Status distribution */
  statusCounts: StatusCounts;
  /** Calculated RAG status */
  ragStatus: RAGStatus;
  /** Reason for the RAG status */
  ragReason: string;
  /** Items with Blocked status */
  blockedItems: ProjectItem[];
  /** Items with Done status */
  completedItems: ProjectItem[];
  /** Items with In Progress status */
  inProgressItems: ProjectItem[];
  /** Items with Todo status */
  todoItems: ProjectItem[];
  /** Items grouped by Epic/category */
  itemsByEpic: Map<string, ProjectItem[]>;
}

// -----------------------------------------------------------------------------
// Report Types
// -----------------------------------------------------------------------------

/**
 * Milestone row for the progress table.
 */
export interface MilestoneRow {
  /** Category name (mapped from Epic) */
  category: string;
  /** Task title */
  task: string;
  /** Issue URL for linking (if available) */
  issueUrl?: string;
  /** Status emoji and text */
  status: string;
  /** Bug bash indicator (✅ or empty) */
  bugBash: string;
  /** Notes column */
  notes: string;
}

/**
 * Risk row for the risks table.
 */
export interface RiskRow {
  /** Risk description */
  risk: string;
  /** Impact on team/project */
  impact: string;
  /** Mitigation strategy */
  mitigation: string;
}

/**
 * Complete memo data structure.
 */
export interface MemoData {
  /** Sprint number */
  sprintNumber: number;
  /** Formatted date for header */
  dateString: string;
  /** Executive summary paragraphs (placeholders for agent to fill) */
  executiveSummary: string[];
  /** RAG status */
  ragStatus: RAGStatus;
  /** RAG status emoji */
  ragEmoji: string;
  /** RAG justification */
  ragReason: string;
  /** Milestone rows for progress table */
  milestones: MilestoneRow[];
  /** Value delivered bullet points */
  valueDelivered: string[];
  /** Risk rows for risks table */
  risks: RiskRow[];
  /** Next steps bullet points */
  nextSteps: string[];
  /** Next Sprint number */
  nextSprintNumber: number;
}

// -----------------------------------------------------------------------------
// Pipeline Types
// -----------------------------------------------------------------------------

/**
 * Pipeline step definition.
 */
export interface PipelineStep {
  /** Step name */
  name: string;
  /** Script filename */
  script: string;
  /** Human-readable description */
  desc: string;
}

/**
 * CLI arguments for the pipeline.
 */
export interface CLIArgs {
  /** Target Sprint number (optional) */
  sprint?: number;
  /** Skip interactive prompts */
  noPrompt: boolean;
  /** Show help */
  help: boolean;
  /** Run specific steps only */
  steps?: string[];
  /** User-provided highlights for executive summary */
  highlights?: string;
}

// -----------------------------------------------------------------------------
// GitHub GraphQL Response Types
// -----------------------------------------------------------------------------

/**
 * GraphQL response for Sprint iterations.
 */
export interface SprintIterationsResponse {
  data: {
    organization: {
      projectV2: {
        field: {
          id: string;
          name: string;
          configuration: {
            iterations: SprintIteration[];
            completedIterations: SprintIteration[];
          };
        };
      };
    };
  };
}

/**
 * GraphQL response for project items.
 */
export interface ProjectItemsResponse {
  data: {
    organization: {
      projectV2: {
        items: {
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string | null;
          };
          nodes: RawProjectItem[];
        };
      };
    };
  };
}

/**
 * Raw project item from GraphQL response.
 */
export interface RawProjectItem {
  id: string;
  sprint: {
    title: string;
    startDate: string;
    duration: number;
  } | null;
  status: {
    name: string;
  } | null;
  epic: {
    name: string;
  } | null;
  content: {
    title?: string;
    number?: number;
    url?: string;
    body?: string;
    labels?: {
      nodes: Array<{ name: string }>;
    };
    comments?: {
      nodes: Array<{
        body: string;
        author?: { login: string };
      }>;
    };
    closedByPullRequestsReferences?: {
      nodes: Array<{
        title: string;
        url: string;
        body?: string;
        merged: boolean;
      }>;
    };
  } | null;
}
