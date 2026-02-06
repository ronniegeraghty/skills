/**
 * GitHub CLI wrapper for the MGMT Namespace Review skill
 *
 * Provides functions for:
 * - Fetching issues with specific labels
 * - Adding/removing assignees
 * - Adding comments
 * - Updating GitHub Project status via GraphQL
 */

import { execSync, type ExecSyncOptions } from "child_process";
import {
  REPOS,
  NAMESPACE_REVIEW_LABEL,
  PROJECT_ORG,
  PROJECT_NUMBER,
  ARTHUR_GITHUB,
} from "./constants.ts";
import type {
  GitHubIssue,
  GitHubComment,
  ProjectInfo,
  ProjectStatus,
} from "./types.ts";
import { createLogger, getDryRun } from "./utils.ts";

const log = createLogger("github");

// -----------------------------------------------------------------------------
// CLI Execution
// -----------------------------------------------------------------------------

interface ExecOptions extends ExecSyncOptions {
  json?: boolean;
}

/**
 * Execute a GitHub CLI command
 * @param args - Arguments to pass to gh
 * @param options - Execution options
 * @returns Command output
 */
function gh(args: string[], options: ExecOptions = {}): string {
  const cmd = `gh ${args.join(" ")}`;
  try {
    const output = execSync(cmd, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB
      ...options,
    }) as string;
    return output.trim();
  } catch (error) {
    const execError = error as { stderr?: string; message?: string };
    throw new Error(
      `GitHub CLI error: ${execError.stderr || execError.message}`
    );
  }
}

// -----------------------------------------------------------------------------
// Issue Operations
// -----------------------------------------------------------------------------

/**
 * Fetch all open issues with the namespace review label from all repos
 * @returns Array of GitHub issues
 */
export async function fetchNamespaceReviewIssues(): Promise<GitHubIssue[]> {
  const allIssues: GitHubIssue[] = [];

  for (const repo of REPOS) {
    log.info(`Fetching issues from ${repo}...`);

    try {
      const output = gh([
        "issue",
        "list",
        "--repo",
        repo,
        "--label",
        NAMESPACE_REVIEW_LABEL,
        "--state",
        "open",
        "--json",
        "number,title,body,url,state,author,assignees,labels,createdAt,updatedAt",
      ]);

      const issues = JSON.parse(output) as Omit<GitHubIssue, "repository">[];

      // Add repository info to each issue
      const enrichedIssues: GitHubIssue[] = issues.map((issue) => ({
        ...issue,
        repository: { nameWithOwner: repo },
      }));

      log.info(`Found ${enrichedIssues.length} issues in ${repo}`);
      allIssues.push(...enrichedIssues);
    } catch (error) {
      log.error(`Failed to fetch issues from ${repo}: ${error}`);
    }
  }

  return allIssues;
}

/**
 * Fetch comments for an issue
 * @param repo - Repository name (owner/repo)
 * @param issueNumber - Issue number
 * @returns Array of comments
 */
export async function fetchIssueComments(
  repo: string,
  issueNumber: number
): Promise<GitHubComment[]> {
  const output = gh([
    "issue",
    "view",
    String(issueNumber),
    "--repo",
    repo,
    "--json",
    "comments",
  ]);

  const data = JSON.parse(output) as { comments: GitHubComment[] };
  return data.comments;
}

/**
 * Add an assignee to an issue
 * @param repo - Repository name (owner/repo)
 * @param issueNumber - Issue number
 * @param assignee - GitHub username to assign
 */
export async function addAssignee(
  repo: string,
  issueNumber: number,
  assignee: string
): Promise<void> {
  if (getDryRun()) {
    log.dryRun(`Add assignee @${assignee} to ${repo}#${issueNumber}`);
    return;
  }

  gh([
    "issue",
    "edit",
    String(issueNumber),
    "--repo",
    repo,
    "--add-assignee",
    assignee,
  ]);

  log.action(`Added assignee @${assignee} to ${repo}#${issueNumber}`);
}

/**
 * Add Arthur as assignee
 * @param repo - Repository name (owner/repo)
 * @param issueNumber - Issue number
 */
export async function assignArthur(
  repo: string,
  issueNumber: number
): Promise<void> {
  return addAssignee(repo, issueNumber, ARTHUR_GITHUB);
}

/**
 * Add a comment to an issue
 * @param repo - Repository name (owner/repo)
 * @param issueNumber - Issue number
 * @param body - Comment body (markdown)
 */
export async function addComment(
  repo: string,
  issueNumber: number,
  body: string
): Promise<void> {
  if (getDryRun()) {
    log.dryRun(`Add comment to ${repo}#${issueNumber}: ${body.slice(0, 100)}...`);
    return;
  }

  gh(["issue", "comment", String(issueNumber), "--repo", repo, "--body", body]);

  log.action(`Added comment to ${repo}#${issueNumber}`);
}

/**
 * Close an issue
 * @param repo - Repository name (owner/repo)
 * @param issueNumber - Issue number
 */
export async function closeIssue(
  repo: string,
  issueNumber: number
): Promise<void> {
  if (getDryRun()) {
    log.dryRun(`Close issue ${repo}#${issueNumber}`);
    return;
  }

  gh(["issue", "close", String(issueNumber), "--repo", repo]);

  log.action(`Closed issue ${repo}#${issueNumber}`);
}

// -----------------------------------------------------------------------------
// Project Operations (via GraphQL)
// -----------------------------------------------------------------------------

/** Cached project info */
let cachedProjectInfo: ProjectInfo | null = null;

/**
 * Get project information (ID, fields, status options)
 * @returns Project info
 */
export async function getProjectInfo(): Promise<ProjectInfo> {
  if (cachedProjectInfo) {
    return cachedProjectInfo;
  }

  const query = `
    query {
      organization(login: "${PROJECT_ORG}") {
        projectV2(number: ${PROJECT_NUMBER}) {
          id
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  const output = gh(["api", "graphql", "-f", `query=${query}`]);
  const data = JSON.parse(output) as {
    data: {
      organization: {
        projectV2: {
          id: string;
          fields: {
            nodes: Array<{
              id?: string;
              name?: string;
              options?: Array<{ id: string; name: string }>;
            }>;
          };
        };
      };
    };
  };

  const project = data.data.organization.projectV2;
  const fields = project.fields.nodes
    .filter((node) => node.id && node.name)
    .map((node) => ({
      id: node.id!,
      name: node.name!,
      options: node.options,
    }));

  // Find Status field
  const statusField = fields.find(
    (f) => f.name.toLowerCase() === "status" && f.options
  );

  const statusOptions: Record<string, string> = {};
  if (statusField?.options) {
    for (const opt of statusField.options) {
      statusOptions[opt.name] = opt.id;
    }
  }

  cachedProjectInfo = {
    id: project.id,
    fields,
    statusFieldId: statusField?.id,
    statusOptions,
  };

  return cachedProjectInfo;
}

/**
 * Find an issue's item ID in the project
 * @param issueUrl - GitHub issue URL
 * @returns Item ID or null if not found
 */
export async function findProjectItemId(
  issueUrl: string
): Promise<string | null> {
  // Search for the issue in project items
  const query = `
    query {
      organization(login: "${PROJECT_ORG}") {
        projectV2(number: ${PROJECT_NUMBER}) {
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue {
                  url
                }
              }
            }
          }
        }
      }
    }
  `;

  const output = gh(["api", "graphql", "-f", `query=${query}`]);
  const data = JSON.parse(output) as {
    data: {
      organization: {
        projectV2: {
          items: {
            nodes: Array<{
              id: string;
              content?: { url?: string };
            }>;
          };
        };
      };
    };
  };

  const item = data.data.organization.projectV2.items.nodes.find(
    (node) => node.content?.url === issueUrl
  );

  return item?.id || null;
}

/**
 * Add an issue to the project
 * @param issueUrl - GitHub issue URL
 * @returns Item ID
 */
export async function addIssueToProject(issueUrl: string): Promise<string> {
  const project = await getProjectInfo();

  // First, get the issue node ID
  const issueQuery = `
    query {
      resource(url: "${issueUrl}") {
        ... on Issue {
          id
        }
      }
    }
  `;

  const issueOutput = gh(["api", "graphql", "-f", `query=${issueQuery}`]);
  const issueData = JSON.parse(issueOutput) as {
    data: { resource: { id: string } };
  };

  const issueId = issueData.data.resource.id;

  if (getDryRun()) {
    log.dryRun(`Add issue ${issueUrl} to project`);
    return "dry-run-item-id";
  }

  // Add to project
  const mutation = `
    mutation {
      addProjectV2ItemById(input: {
        projectId: "${project.id}"
        contentId: "${issueId}"
      }) {
        item {
          id
        }
      }
    }
  `;

  const output = gh(["api", "graphql", "-f", `query=${mutation}`]);
  const data = JSON.parse(output) as {
    data: { addProjectV2ItemById: { item: { id: string } } };
  };

  log.action(`Added issue to project: ${issueUrl}`);
  return data.data.addProjectV2ItemById.item.id;
}

/**
 * Update the status of an issue in the project
 * @param issueUrl - GitHub issue URL
 * @param status - New status
 */
export async function updateProjectStatus(
  issueUrl: string,
  status: ProjectStatus
): Promise<void> {
  const project = await getProjectInfo();

  if (!project.statusFieldId || !project.statusOptions) {
    throw new Error("Project does not have a Status field");
  }

  const statusOptionId = project.statusOptions[status];
  if (!statusOptionId) {
    throw new Error(`Status "${status}" not found in project options`);
  }

  // Find or add the item to the project
  let itemId = await findProjectItemId(issueUrl);
  if (!itemId) {
    log.info(`Issue not in project, adding it: ${issueUrl}`);
    itemId = await addIssueToProject(issueUrl);
  }

  if (getDryRun()) {
    log.dryRun(`Update project status to "${status}" for ${issueUrl}`);
    return;
  }

  const mutation = `
    mutation {
      updateProjectV2ItemFieldValue(input: {
        projectId: "${project.id}"
        itemId: "${itemId}"
        fieldId: "${project.statusFieldId}"
        value: {
          singleSelectOptionId: "${statusOptionId}"
        }
      }) {
        projectV2Item {
          id
        }
      }
    }
  `;

  gh(["api", "graphql", "-f", `query=${mutation}`]);
  log.action(`Updated project status to "${status}" for ${issueUrl}`);
}

/**
 * Get the current project status of an issue
 * @param issueUrl - GitHub issue URL
 * @returns Current status or null if not in project
 */
export async function getProjectStatus(
  issueUrl: string
): Promise<ProjectStatus | null> {
  const project = await getProjectInfo();

  if (!project.statusFieldId) {
    return null;
  }

  const query = `
    query {
      organization(login: "${PROJECT_ORG}") {
        projectV2(number: ${PROJECT_NUMBER}) {
          items(first: 100) {
            nodes {
              id
              fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                }
              }
              content {
                ... on Issue {
                  url
                }
              }
            }
          }
        }
      }
    }
  `;

  const output = gh(["api", "graphql", "-f", `query=${query}`]);
  const data = JSON.parse(output) as {
    data: {
      organization: {
        projectV2: {
          items: {
            nodes: Array<{
              id: string;
              fieldValueByName?: { name?: string };
              content?: { url?: string };
            }>;
          };
        };
      };
    };
  };

  const item = data.data.organization.projectV2.items.nodes.find(
    (node) => node.content?.url === issueUrl
  );

  if (!item?.fieldValueByName?.name) {
    return null;
  }

  return item.fieldValueByName.name as ProjectStatus;
}

/**
 * Check if Arthur has approved the namespaces in comments
 * @param repo - Repository name (owner/repo)
 * @param issueNumber - Issue number
 * @returns true if Arthur has approved
 */
export async function hasArthurApproved(
  repo: string,
  issueNumber: number
): Promise<boolean> {
  const comments = await fetchIssueComments(repo, issueNumber);

  // Import approval patterns
  const { APPROVAL_PATTERNS } = await import("./constants.ts");

  for (const comment of comments) {
    if (comment.author.login === ARTHUR_GITHUB) {
      for (const pattern of APPROVAL_PATTERNS) {
        if (pattern.test(comment.body)) {
          return true;
        }
      }
    }
  }

  return false;
}
