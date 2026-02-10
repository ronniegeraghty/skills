/**
 * Microsoft Graph API client for the MGMT Namespace Review skill
 *
 * Provides functions for:
 * - Sending emails via Outlook
 * - Searching/reading emails
 * - Sending Teams chat messages
 *
 * Uses device code flow for authentication with token caching.
 */

import { DeviceCodeCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";
import {
  GRAPH_SCOPES,
  ARCHITECT_EMAIL,
  ARTHUR_EMAIL,
} from "./constants.ts";
import type { EmailMessage, EmailSearchResult, TeamsChatMessage } from "./types.ts";
import {
  createLogger,
  getDryRun,
} from "./utils.ts";

const log = createLogger("graph");

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
}

interface GraphMessage {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  bodyPreview: string;
  conversationId: string;
}

interface GraphChat {
  id: string;
  chatType: string;
}

// -----------------------------------------------------------------------------
// Client Initialization
// -----------------------------------------------------------------------------

/** Cached Graph client */
let graphClient: Client | null = null;

/**
 * Get environment variables for Graph API
 * @returns Client ID and Tenant ID
 */
function getGraphConfig(): { clientId: string; tenantId: string } {
  const clientId = process.env.GRAPH_CLIENT_ID;
  const tenantId = process.env.GRAPH_TENANT_ID;

  if (!clientId || !tenantId) {
    throw new Error(
      "GRAPH_CLIENT_ID and GRAPH_TENANT_ID environment variables are required.\n" +
        "See README.md for Azure AD app setup instructions."
    );
  }

  return { clientId, tenantId };
}

/**
 * Initialize the Microsoft Graph client
 * Uses device code flow for interactive authentication
 * @returns Initialized Graph client
 */
export async function initializeGraphClient(): Promise<Client> {
  if (graphClient) {
    return graphClient;
  }

  // Check for pre-authenticated token (CI/CD scenario)
  const accessToken = process.env.GRAPH_ACCESS_TOKEN;
  if (accessToken) {
    log.info("Using pre-authenticated access token from environment");
    graphClient = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });
    return graphClient;
  }

  const { clientId, tenantId } = getGraphConfig();

  log.info("Initializing Graph client with device code flow...");
  log.info("You may be prompted to authenticate in your browser.");

  // Create credential with device code flow
  const credential = new DeviceCodeCredential({
    clientId,
    tenantId,
    userPromptCallback: (info) => {
      console.log("\n" + "=".repeat(60));
      console.log("📱 AUTHENTICATION REQUIRED");
      console.log("=".repeat(60));
      console.log(info.message);
      console.log("=".repeat(60) + "\n");
    },
  });

  // Create auth provider
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: GRAPH_SCOPES.map((s) => `https://graph.microsoft.com/${s}`),
  });

  // Create client
  graphClient = Client.initWithMiddleware({
    authProvider,
  });

  // Test the connection by getting current user
  try {
    const me = (await graphClient.api("/me").get()) as GraphUser;
    log.info(`Authenticated as: ${me.displayName} (${me.mail})`);
  } catch (error) {
    log.error(`Failed to authenticate: ${error}`);
    throw error;
  }

  return graphClient;
}

/**
 * Get the current authenticated user's email
 * @returns User email address
 */
export async function getCurrentUserEmail(): Promise<string> {
  const client = await initializeGraphClient();
  const me = (await client.api("/me").get()) as GraphUser;
  return me.mail;
}

// -----------------------------------------------------------------------------
// Email Operations
// -----------------------------------------------------------------------------

/**
 * Send an email
 * @param message - Email message to send
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (getDryRun()) {
    log.dryRun(`Send email: "${message.subject}" to ${message.toRecipients.join(", ")}`);
    return;
  }

  const client = await initializeGraphClient();

  const mailBody = {
    message: {
      subject: message.subject,
      body: {
        contentType: message.isHtml ? "HTML" : "Text",
        content: message.body,
      },
      toRecipients: message.toRecipients.map((email) => ({
        emailAddress: { address: email },
      })),
      ccRecipients: (message.ccRecipients || []).map((email) => ({
        emailAddress: { address: email },
      })),
    },
    saveToSentItems: true,
  };

  await client.api("/me/sendMail").post(mailBody);
  log.action(`Sent email: "${message.subject}"`);
}

/**
 * Send the architect review email
 * @param params - Email parameters
 */
export async function sendArchitectReviewEmail(params: {
  issueUrl: string;
  resourceProviderName: string;
  deadline: string;
  namespaces: {
    dotnet: string;
    java: string;
    javascript: string;
    python: string;
    go: string;
  };
}): Promise<void> {
  const { EMAIL_TEMPLATES } = await import("./constants.ts");
  const template = EMAIL_TEMPLATES.architectReview(params);

  await sendEmail({
    subject: template.subject,
    body: template.body,
    toRecipients: [ARCHITECT_EMAIL.to],
    ccRecipients: [...ARCHITECT_EMAIL.cc],
    isHtml: false,
  });
}

/**
 * Send the architect approval email (reply to thread)
 * @param originalSubject - Original email subject to reply to
 */
export async function sendArchitectApprovalEmail(
  originalSubject: string
): Promise<void> {
  const { EMAIL_TEMPLATES } = await import("./constants.ts");
  const template = EMAIL_TEMPLATES.architectApproval();

  // Find the original email to reply to
  const emails = await searchEmails(originalSubject);
  if (emails.length === 0) {
    throw new Error(`Could not find original email with subject: ${originalSubject}`);
  }

  if (getDryRun()) {
    log.dryRun(`Reply to email thread: "${originalSubject}"`);
    return;
  }

  const client = await initializeGraphClient();

  // Create reply
  const reply = {
    message: {
      body: {
        contentType: "Text",
        content: template.body,
      },
    },
  };

  await client.api(`/me/messages/${emails[0].id}/reply`).post(reply);
  log.action(`Replied to architect email thread: "${originalSubject}"`);
}

/**
 * Search for emails by subject
 * @param subject - Subject to search for
 * @returns Array of matching emails
 */
export async function searchEmails(subject: string): Promise<EmailSearchResult[]> {
  const client = await initializeGraphClient();

  // Escape special characters in subject for filter
  const escapedSubject = subject.replace(/'/g, "''");

  const response = await client
    .api("/me/messages")
    .filter(`contains(subject, '${escapedSubject}')`)
    .orderby("receivedDateTime desc")
    .top(10)
    .get();

  const messages = (response.value || []) as GraphMessage[];

  return messages.map((msg) => ({
    id: msg.id,
    subject: msg.subject,
    from: msg.from.emailAddress.address,
    receivedDateTime: msg.receivedDateTime,
    bodyPreview: msg.bodyPreview,
    conversationId: msg.conversationId,
  }));
}

/**
 * Check for objections in an email thread
 * @param subject - Email subject to search for
 * @param sentAfter - Only check emails sent after this date
 * @returns Array of emails that might contain objections
 */
export async function checkForObjections(
  subject: string,
  sentAfter: Date
): Promise<EmailSearchResult[]> {
  const currentUserEmail = await getCurrentUserEmail();

  // Search for emails in the thread
  const emails = await searchEmails(subject);

  // Filter to emails after the sent date and not from current user
  const objections = emails.filter((email) => {
    const emailDate = new Date(email.receivedDateTime);
    return (
      emailDate > sentAfter &&
      email.from.toLowerCase() !== currentUserEmail.toLowerCase()
    );
  });

  return objections;
}

// -----------------------------------------------------------------------------
// Teams Chat Operations
// -----------------------------------------------------------------------------

/**
 * Get or create a 1:1 chat with a user
 * @param recipientEmail - Email of the user to chat with
 * @returns Chat ID
 */
async function getOrCreateChat(recipientEmail: string): Promise<string> {
  const client = await initializeGraphClient();

  // Try to find existing chat
  const chats = await client
    .api("/me/chats")
    .filter("chatType eq 'oneOnOne'")
    .expand("members")
    .get();

  for (const chat of chats.value as GraphChat[]) {
    const members = (chat as any).members || [];
    const hasRecipient = members.some(
      (m: any) =>
        m.email?.toLowerCase() === recipientEmail.toLowerCase() ||
        m.displayName?.toLowerCase().includes(recipientEmail.split("@")[0].toLowerCase())
    );
    if (hasRecipient) {
      return chat.id;
    }
  }

  // Create new chat
  const newChat = {
    chatType: "oneOnOne",
    members: [
      {
        "@odata.type": "#microsoft.graph.aadUserConversationMember",
        roles: ["owner"],
        "user@odata.bind": `https://graph.microsoft.com/v1.0/users/${recipientEmail}`,
      },
    ],
  };

  const created = await client.api("/chats").post(newChat);
  return created.id;
}

/**
 * Send a Teams chat message
 * @param message - Message to send
 */
export async function sendTeamsMessage(message: TeamsChatMessage): Promise<void> {
  if (getDryRun()) {
    log.dryRun(`Send Teams message to ${message.recipientEmail}: ${message.content.slice(0, 100)}...`);
    return;
  }

  const client = await initializeGraphClient();

  const chatId = await getOrCreateChat(message.recipientEmail);

  await client.api(`/chats/${chatId}/messages`).post({
    body: {
      content: message.content,
    },
  });

  log.action(`Sent Teams message to ${message.recipientEmail}`);
}

/**
 * Send a Teams message to Arthur about a new namespace review
 * @param issueTitle - Issue title
 * @param issueUrl - Issue URL
 */
export async function notifyArthur(
  issueTitle: string,
  issueUrl: string
): Promise<void> {
  const { TEAMS_MESSAGE_TEMPLATE } = await import("./constants.ts");

  await sendTeamsMessage({
    recipientEmail: ARTHUR_EMAIL,
    content: TEAMS_MESSAGE_TEMPLATE({ issueTitle, issueUrl }),
  });
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * Check if Graph API is configured
 * @returns true if Graph API environment variables are set
 */
export function isGraphConfigured(): boolean {
  return !!(process.env.GRAPH_CLIENT_ID && process.env.GRAPH_TENANT_ID);
}

/**
 * Check if we can skip Graph API (for testing without email/Teams)
 * @returns true if SKIP_GRAPH_API is set
 */
export function shouldSkipGraphApi(): boolean {
  return process.env.SKIP_GRAPH_API === "true";
}
