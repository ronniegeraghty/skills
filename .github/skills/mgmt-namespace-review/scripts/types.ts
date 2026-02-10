/**
 * Type definitions for the MGMT Namespace Review skill
 */

/** Phase of a namespace review issue */
export enum Phase {
  /** Issue needs initial validation and Arthur assignment */
  InitialReview = "initial-review",
  /** Arthur is assigned but hasn't approved yet */
  AwaitingMgmtApproval = "awaiting-mgmt-approval",
  /** Ready to send architect email */
  ReadyForArchitectReview = "ready-for-architect-review",
  /** Watching for architect objections (within 3 business days) */
  Watching = "watching",
  /** 3+ business days passed, ready to close */
  ReadyToClose = "ready-to-close",
}

/** Project status values in GitHub Project #424 */
export enum ProjectStatus {
  ToDo = "To Do",
  InProgress = "In Progress",
  Watch = "Watch",
  Done = "Done",
}

/** Tier-1 language identifiers */
export type Language = "dotnet" | "java" | "go" | "javascript" | "python";

/** Parsed namespace for a single language */
export interface ParsedNamespace {
  language: Language;
  raw: string;
  resourceProviderName: string;
  isValid: boolean;
  errors: string[];
}

/** Result of validating all namespaces in an issue */
export interface ValidationResult {
  isValid: boolean;
  namespaces: ParsedNamespace[];
  hasApiSpecLink: boolean;
  missingLanguages: Language[];
  errors: string[];
}

/** GitHub issue author */
export interface GitHubAuthor {
  login: string;
}

/** GitHub issue assignee */
export interface GitHubAssignee {
  login: string;
}

/** GitHub issue label */
export interface GitHubLabel {
  name: string;
}

/** GitHub issue comment */
export interface GitHubComment {
  id: number;
  author: GitHubAuthor;
  body: string;
  createdAt: string;
}

/** GitHub issue from CLI */
export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  url: string;
  state: string;
  author: GitHubAuthor;
  assignees: GitHubAssignee[];
  labels: GitHubLabel[];
  createdAt: string;
  updatedAt: string;
  repository: {
    nameWithOwner: string;
  };
}

/** Issue enriched with validation and phase info */
export interface EnrichedIssue extends GitHubIssue {
  validation: ValidationResult;
  phase: Phase;
  projectStatus?: ProjectStatus;
  projectItemId?: string;
  architectEmailSubject?: string;
  architectEmailSentAt?: string;
}

/** Action taken on an issue */
export interface IssueAction {
  issueNumber: number;
  issueUrl: string;
  repo: string;
  phase: Phase;
  action: string;
  success: boolean;
  error?: string;
  timestamp: string;
  dryRun: boolean;
}

/** Error encountered during processing */
export interface ProcessingError {
  issueNumber: number;
  issueUrl: string;
  repo: string;
  phase: Phase;
  error: string;
  timestamp: string;
}

/** Summary report of a run */
export interface RunReport {
  runId: string;
  startTime: string;
  endTime: string;
  dryRun: boolean;
  totalIssues: number;
  issuesByPhase: Record<Phase, number>;
  actionsPerformed: IssueAction[];
  errors: ProcessingError[];
  issuesProcessed: number;
  issuesSkipped: number;
}

/** GitHub Project field info */
export interface ProjectField {
  id: string;
  name: string;
  options?: Array<{ id: string; name: string }>;
}

/** GitHub Project info */
export interface ProjectInfo {
  id: string;
  fields: ProjectField[];
  statusFieldId?: string;
  statusOptions?: Record<string, string>; // status name -> option ID
}

/** Email message for Graph API */
export interface EmailMessage {
  subject: string;
  body: string;
  toRecipients: string[];
  ccRecipients?: string[];
  isHtml?: boolean;
}

/** Email from inbox search */
export interface EmailSearchResult {
  id: string;
  subject: string;
  from: string;
  receivedDateTime: string;
  bodyPreview: string;
  conversationId: string;
}

/** Teams chat message */
export interface TeamsChatMessage {
  recipientEmail: string;
  content: string;
}

/** Options for the run command */
export interface RunOptions {
  dryRun: boolean;
  outputDir: string;
}
