/**
 * Constants for the MGMT Namespace Review skill
 */

import type { Language } from "./types.ts";

/** GitHub repositories to search for namespace review issues */
export const REPOS = ["Azure/azure-sdk", "Azure/azure-sdk-pr"] as const;

/** Label indicating a namespace review request */
export const NAMESPACE_REVIEW_LABEL = "mgmt-namespace-review";

/** Label indicating Arthur has approved the namespaces */
export const NAMESPACE_READY_LABEL = "mgmt-namespace-ready";

/** Arthur Ma's GitHub username */
export const ARTHUR_GITHUB = "ArthurMa1978";

/** Arthur Ma's email for Teams and CC */
export const ARTHUR_EMAIL = "arthurma@microsoft.com";

/** GitHub Project organization */
export const PROJECT_ORG = "Azure";

/** GitHub Project number */
export const PROJECT_NUMBER = 424;

/** Email recipients for architect review */
export const ARCHITECT_EMAIL = {
  to: "azsdkarch@microsoft.com",
  cc: ["azsdkarch-help@microsoft.com", "arthurma@microsoft.com", "micnash@microsoft.com"],
} as const;

/** Number of business days for architect review */
export const ARCHITECT_REVIEW_DAYS = 3;

/** Namespace patterns for each tier-1 language */
export const NAMESPACE_PATTERNS: Record<Language, RegExp> = {
  /** .NET: Azure.ResourceManager.{Name} (PascalCase) */
  dotnet: /Azure\.ResourceManager\.([A-Z][a-zA-Z0-9]*)/,

  /** Java: azure-resourcemanager-{name} (com.azure.resourcemanager.{name}) */
  java: /azure-resourcemanager-([a-z][a-z0-9]*)\s*\(com\.azure\.resourcemanager\.([a-z][a-z0-9]*)\)/i,

  /** Go: sdk/resourcemanager/{name}/arm{name} */
  go: /sdk\/resourcemanager\/([a-z][a-z0-9]*)\/arm([a-z][a-z0-9]*)/i,

  /** JavaScript: @azure/arm-{name} */
  javascript: /@azure\/arm-([a-z][a-z0-9-]*)/i,

  /** Python: azure-mgmt-{name} */
  python: /azure-mgmt-([a-z][a-z0-9-]*)/i,
};

/** Display names for languages */
export const LANGUAGE_DISPLAY_NAMES: Record<Language, string> = {
  dotnet: ".NET",
  java: "Java",
  go: "Go/Golang",
  javascript: "JavaScript",
  python: "Python",
};

/** All tier-1 languages */
export const ALL_LANGUAGES: Language[] = ["dotnet", "java", "go", "javascript", "python"];

/** Pattern to detect API spec link */
export const API_SPEC_LINK_PATTERN = /github\.com\/Azure\/azure-rest-api-specs/i;

/** Patterns that indicate Arthur approval in a comment */
export const APPROVAL_PATTERNS = [
  /\bLGTM\b/i,
  /\blooks?\s*good\s*(to\s*me)?\b/i,
  /\bapproved?\b/i,
  /\bship\s*it\b/i,
  /\b(all\s*)?(good|great)\s*to\s*(go|proceed)\b/i,
];

/** US Federal Holidays (month-day or special calculation) */
export const US_FEDERAL_HOLIDAYS = {
  fixed: [
    { month: 1, day: 1, name: "New Year's Day" },
    { month: 6, day: 19, name: "Juneteenth" },
    { month: 7, day: 4, name: "Independence Day" },
    { month: 11, day: 11, name: "Veterans Day" },
    { month: 12, day: 25, name: "Christmas Day" },
  ],
  floating: [
    { month: 1, weekday: 1, occurrence: 3, name: "MLK Day" }, // 3rd Monday of January
    { month: 2, weekday: 1, occurrence: 3, name: "Presidents Day" }, // 3rd Monday of February
    { month: 5, weekday: 1, occurrence: -1, name: "Memorial Day" }, // Last Monday of May
    { month: 9, weekday: 1, occurrence: 1, name: "Labor Day" }, // 1st Monday of September
    { month: 10, weekday: 1, occurrence: 2, name: "Columbus Day" }, // 2nd Monday of October
    { month: 11, weekday: 4, occurrence: 4, name: "Thanksgiving" }, // 4th Thursday of November
  ],
};

/** Microsoft-specific holidays */
export const MICROSOFT_HOLIDAYS = {
  /** Day after Thanksgiving */
  thanksgivingFriday: true,
  /** Christmas Eve when observed */
  christmasEve: true,
  /** Week between Christmas and New Year's (Dec 26-31) */
  yearEndWeek: true,
};

/** Email template for architect review */
export const EMAIL_TEMPLATES = {
  architectReview: (params: {
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
  }) => ({
    subject: `MGMT Plane Namespace Review for ${params.resourceProviderName}`,
    body: `Hi Architects,

This is an FYI email for our MGMT Plane namespace review process.

GitHub Issue: ${params.issueUrl}

The namespaces below have been approved by the MGMT Plane team and the service partner teams. You have until EOB on ${params.deadline} to object to any of the proposed names. If there are no objections, the names will be considered approved.

Note: Some of the libraries listed below have already been released in varying states, as indicated.

Proposed Namespaces:
.NET: ${params.namespaces.dotnet}
Java: ${params.namespaces.java}
JavaScript: ${params.namespaces.javascript}
Python: ${params.namespaces.python}
Go/Golang: ${params.namespaces.go}

Let me know if there are any questions or objections.

Thanks,
Ronnie`,
  }),

  architectApproval: () => ({
    subject: "", // Reply to existing thread
    body: `Hi All,

Since there have been no objections to the proposed package names below, they are now considered approved.

Thanks,
Ronnie`,
  }),
};

/** Issue comment templates */
export const COMMENT_TEMPLATES = {
  movingToArchitectReview: (params: { resourceProviderName: string; deadline: string }) =>
    `We'll now move to the Architect Review. The architects will have 3 business days to make any objections to the package names. If there are no objections or all objections are handled, I'll update this issue stating that the names have been approved.

📧 Architect review email sent with subject: **"MGMT Plane Namespace Review for ${params.resourceProviderName}"**
⏰ Review deadline: EOB ${params.deadline}`,

  validationFailed: (params: {
    author: string;
    missingLanguages: string[];
    patternErrors: string[];
    missingApiSpec: boolean;
    azureInName: boolean;
  }) => {
    let comment = `@${params.author} - I found some issues during the initial review of this namespace request:\n\n`;

    if (params.missingLanguages.length > 0) {
      comment += `**Missing Namespaces:**\n${params.missingLanguages.map((l) => `- ${l}`).join("\n")}\n\n`;
    }

    if (params.patternErrors.length > 0) {
      comment += `**Pattern Mismatches:**\n${params.patternErrors.map((e) => `- ${e}`).join("\n")}\n\n`;
    }

    if (params.missingApiSpec) {
      comment += `**Missing API Spec Link:**\nPlease include a link to the service's API specification in the Azure/azure-rest-api-specs repository.\n\n`;
    }

    if (params.azureInName) {
      comment += `**"Azure" in Resource Provider Name:**\nThe word "azure" should not appear in the resource provider name portion of the namespaces (it's already in the prefix).\n\n`;
    }

    comment += `Please update the issue with the missing information.`;
    return comment;
  },

  objectionReceived: (params: { author: string; objectionText: string; architectName: string }) =>
    `@${params.author} - An objection was raised during the architect review:

> ${params.objectionText}
> — ${params.architectName}

Please address this objection. The review deadline has been extended to allow for resolution.`,

  namesApproved: (params: {
    dotnet: string;
    java: string;
    javascript: string;
    python: string;
    go: string;
  }) =>
    `🎉 The proposed namespace names have been approved by the Architecture Board with no objections.

You may proceed with package development using these names:
- **.NET:** ${params.dotnet}
- **Java:** ${params.java}
- **JavaScript:** ${params.javascript}
- **Python:** ${params.python}
- **Go:** ${params.go}

Closing this issue.`,
};

/** Teams message template for notifying Arthur */
export const TEAMS_MESSAGE_TEMPLATE = (params: { issueTitle: string; issueUrl: string }) =>
  `Hi Arthur! 👋

A new MGMT Plane Namespace Review has been submitted and needs your review:

📋 **Issue:** ${params.issueTitle}
🔗 **Link:** ${params.issueUrl}

Please review the proposed namespaces and either:
- Add the \`mgmt-namespace-ready\` label if approved
- Comment with any concerns

Thanks!`;

/** Token cache path */
export const TOKEN_CACHE_DIR = ".mgmt-namespace-review";
export const TOKEN_CACHE_FILE = "token-cache.json";

/** Graph API scopes */
export const GRAPH_SCOPES = [
  "Mail.Send",
  "Mail.Read",
  "Chat.ReadWrite",
  "ChatMessage.Send",
  "User.Read",
];
