#!/usr/bin/env npx tsx
/**
 * GitHub CLI wrapper for GraphQL queries.
 */

import { spawnSync } from "child_process";
import { GITHUB_ORG, PROJECT_NUMBER } from "./constants.ts";
import { logError, logInfo } from "./utils.ts";

// -----------------------------------------------------------------------------
// Authentication
// -----------------------------------------------------------------------------

/**
 * Check if GitHub CLI is authenticated.
 */
export function checkGhAuth(): boolean {
  try {
    const result = spawnSync("gh", ["auth", "status"], { 
      encoding: "utf8", 
      stdio: "pipe" 
    });
    
    // Check stdout and stderr for success indicators
    const output = (result.stdout || "") + (result.stderr || "");
    
    // If output contains "Logged in" or "Active account: true", we're authenticated
    if (output.includes("Logged in") || output.includes("Active account: true")) {
      return true;
    }
    
    // If exit code is 0, we're authenticated
    if (result.status === 0) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if GitHub CLI has the required project scope.
 * Handles rate limiting by checking stderr for throttling messages.
 */
export function checkProjectScope(): boolean {
  try {
    // First check token scopes directly instead of making API call
    const statusResult = spawnSync("gh", ["auth", "status"], {
      encoding: "utf8",
      stdio: "pipe",
    });
    
    const output = statusResult.stdout + statusResult.stderr;
    
    // Check if read:project scope is present
    if (output.includes("read:project")) {
      return true;
    }
    
    // If we can't determine from token scopes, try a simple query
    // but only if not rate limited
    const result = spawnSync(
      "gh",
      [
        "api",
        "graphql",
        "-f",
        `query=query { organization(login: "${GITHUB_ORG}") { projectV2(number: ${PROJECT_NUMBER}) { id } } }`,
      ],
      { encoding: "utf8", stdio: "pipe" }
    );
    
    // Check for rate limiting
    const stderr = result.stderr || "";
    if (stderr.includes("throttled") || stderr.includes("429")) {
      // Rate limited - assume scope is OK if auth succeeded
      logInfo("Rate limited, assuming project scope is OK");
      return true;
    }
    
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Verify GitHub CLI authentication and project access.
 * Throws an error with instructions if not authenticated.
 */
export function verifyAuth(): void {
  if (!checkGhAuth()) {
    logError("GitHub CLI is not authenticated.");
    console.log("\nTo authenticate, run:");
    console.log("  gh auth login\n");
    throw new Error("GitHub CLI authentication required");
  }

  if (!checkProjectScope()) {
    logError("GitHub CLI does not have the required 'read:project' scope.");
    console.log("\nTo add the scope, run:");
    console.log("  gh auth refresh -s read:project\n");
    throw new Error("GitHub CLI project scope required");
  }

  logInfo("GitHub CLI authenticated with project access ✓");
}

// -----------------------------------------------------------------------------
// GraphQL Execution
// -----------------------------------------------------------------------------

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Busy wait - not ideal but works synchronously
  }
}

/**
 * Execute a GraphQL query using GitHub CLI with retry logic for rate limiting.
 * @param query GraphQL query string
 * @param variables Optional query variables
 * @returns Parsed JSON response
 */
export function executeGraphQL<T>(
  query: string,
  variables?: Record<string, string | number | null>
): T {
  const args = ["api", "graphql", "-f", `query=${query}`];

  // Add variables if provided
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      if (value !== null && value !== undefined) {
        args.push("-f", `${key}=${value}`);
      }
    }
  }

  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = spawnSync("gh", args, {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large responses
    });

    if (result.status === 0) {
      try {
        return JSON.parse(result.stdout) as T;
      } catch {
        throw new Error(`Failed to parse GraphQL response: ${result.stdout}`);
      }
    }

    const errorMessage = result.stderr || result.stdout || "Unknown error";
    
    // Check if rate limited
    if (errorMessage.includes("throttled") || errorMessage.includes("429")) {
      const waitTime = Math.pow(2, attempt + 1) * 5000; // 10s, 20s, 40s
      console.log(`  Rate limited, waiting ${waitTime / 1000}s before retry...`);
      sleep(waitTime);
      lastError = new Error(`GraphQL query failed: ${errorMessage}`);
      continue;
    }

    // Not a rate limit error, fail immediately
    throw new Error(`GraphQL query failed: ${errorMessage}`);
  }

  throw lastError || new Error("GraphQL query failed after retries");
}

// -----------------------------------------------------------------------------
// GraphQL Queries
// -----------------------------------------------------------------------------

/**
 * GraphQL query to fetch Sprint iterations.
 */
export const SPRINTS_QUERY = `
query {
  organization(login: "${GITHUB_ORG}") {
    projectV2(number: ${PROJECT_NUMBER}) {
      field(name: "Sprint") {
        ... on ProjectV2IterationField {
          id
          name
          configuration {
            iterations {
              id
              title
              startDate
              duration
            }
            completedIterations {
              id
              title
              startDate
              duration
            }
          }
        }
      }
    }
  }
}
`;

/**
 * GraphQL query to fetch project items with pagination.
 * Uses a cursor variable for pagination.
 */
export const ITEMS_QUERY = `
query($cursor: String) {
  organization(login: "${GITHUB_ORG}") {
    projectV2(number: ${PROJECT_NUMBER}) {
      items(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          sprint: fieldValueByName(name: "Sprint") {
            ... on ProjectV2ItemFieldIterationValue {
              title
              startDate
              duration
            }
          }
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
            }
          }
          epic: fieldValueByName(name: "Epic") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
            }
          }
          content {
            ... on Issue {
              title
              number
              url
              body
              labels(first: 10) {
                nodes {
                  name
                }
              }
              comments(first: 10) {
                nodes {
                  body
                  author {
                    login
                  }
                }
              }
              closedByPullRequestsReferences(first: 5) {
                nodes {
                  title
                  url
                  body
                  merged
                }
              }
            }
            ... on DraftIssue {
              title
              body
            }
          }
        }
      }
    }
  }
}
`;

/**
 * Fetch detailed issue data including comments and linked PRs.
 * Used for enriching Sprint items with more context.
 */
export const ISSUE_DETAILS_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      title
      body
      state
      comments(first: 20) {
        nodes {
          body
          author {
            login
          }
          createdAt
        }
      }
      closedByPullRequestsReferences(first: 5) {
        nodes {
          title
          url
          body
          merged
          additions
          deletions
        }
      }
      timelineItems(first: 50, itemTypes: [CONNECTED_EVENT, CROSS_REFERENCED_EVENT]) {
        nodes {
          ... on ConnectedEvent {
            subject {
              ... on PullRequest {
                title
                url
                body
                merged
              }
            }
          }
          ... on CrossReferencedEvent {
            source {
              ... on PullRequest {
                title
                url
                body
                merged
              }
            }
          }
        }
      }
    }
  }
}
`;
