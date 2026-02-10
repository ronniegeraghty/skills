/**
 * Namespace validation for the MGMT Namespace Review skill
 *
 * Validates that:
 * - All 5 tier-1 languages have namespaces
 * - Each namespace matches the expected pattern
 * - Resource provider names are consistent
 * - "azure" does not appear in the resource provider name
 * - Issue contains a link to azure-rest-api-specs
 */

import {
  NAMESPACE_PATTERNS,
  ALL_LANGUAGES,
  LANGUAGE_DISPLAY_NAMES,
  API_SPEC_LINK_PATTERN,
} from "./constants.ts";
import type {
  Language,
  ParsedNamespace,
  ValidationResult,
  GitHubIssue,
} from "./types.ts";
import { createLogger } from "./utils.ts";

const log = createLogger("validate");

// -----------------------------------------------------------------------------
// Namespace Parsing
// -----------------------------------------------------------------------------

/**
 * Extract namespace for a specific language from issue body
 * @param body - Issue body text
 * @param language - Language to extract namespace for
 * @returns Parsed namespace or null if not found
 */
function extractNamespace(body: string, language: Language): ParsedNamespace | null {
  const pattern = NAMESPACE_PATTERNS[language];
  const match = body.match(pattern);

  if (!match) {
    return null;
  }

  const errors: string[] = [];
  let resourceProviderName = "";

  // Extract resource provider name based on language
  switch (language) {
    case "dotnet":
      // Azure.ResourceManager.{Name} - PascalCase
      resourceProviderName = match[1];
      break;

    case "java":
      // azure-resourcemanager-{name} (com.azure.resourcemanager.{name})
      // Both captures should match
      resourceProviderName = match[1].toLowerCase();
      if (match[2] && match[1].toLowerCase() !== match[2].toLowerCase()) {
        errors.push(
          `Java namespace mismatch: ${match[1]} vs ${match[2]} in Maven coordinates`
        );
      }
      break;

    case "go":
      // sdk/resourcemanager/{name}/arm{name}
      // Both captures should match
      resourceProviderName = match[1].toLowerCase();
      if (match[2] && match[1].toLowerCase() !== match[2].toLowerCase()) {
        errors.push(
          `Go namespace mismatch: ${match[1]} vs arm${match[2]} in path`
        );
      }
      break;

    case "javascript":
      // @azure/arm-{name}
      resourceProviderName = match[1].toLowerCase().replace(/-/g, "");
      break;

    case "python":
      // azure-mgmt-{name}
      resourceProviderName = match[1].toLowerCase().replace(/-/g, "");
      break;
  }

  // Check if "azure" appears in the resource provider name
  if (/azure/i.test(resourceProviderName)) {
    errors.push(
      `"azure" should not appear in the resource provider name (already in prefix)`
    );
  }

  return {
    language,
    raw: match[0],
    resourceProviderName,
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Normalize resource provider name for comparison
 * Removes hyphens and converts to lowercase
 */
function normalizeProviderName(name: string): string {
  return name.toLowerCase().replace(/[-_]/g, "");
}

/**
 * Check if resource provider names are consistent across languages
 * @param namespaces - Parsed namespaces
 * @returns Error message if inconsistent, null if consistent
 */
function checkConsistency(namespaces: ParsedNamespace[]): string | null {
  if (namespaces.length < 2) {
    return null;
  }

  const normalized = namespaces.map((ns) => ({
    language: ns.language,
    name: normalizeProviderName(ns.resourceProviderName),
  }));

  const firstName = normalized[0].name;
  const inconsistent = normalized.filter((ns) => ns.name !== firstName);

  if (inconsistent.length > 0) {
    const details = namespaces
      .map((ns) => `${LANGUAGE_DISPLAY_NAMES[ns.language]}: "${ns.resourceProviderName}"`)
      .join(", ");
    return `Resource provider names are inconsistent: ${details}`;
  }

  return null;
}

// -----------------------------------------------------------------------------
// Full Validation
// -----------------------------------------------------------------------------

/**
 * Validate all namespaces in an issue
 * @param issue - GitHub issue to validate
 * @returns Validation result
 */
export function validateIssue(issue: GitHubIssue): ValidationResult {
  const body = issue.body || "";
  const errors: string[] = [];
  const namespaces: ParsedNamespace[] = [];
  const missingLanguages: Language[] = [];

  log.info(`Validating issue #${issue.number}: ${issue.title}`);

  // Extract namespaces for each language
  for (const language of ALL_LANGUAGES) {
    const ns = extractNamespace(body, language);

    if (!ns) {
      missingLanguages.push(language);
      log.warn(`Missing namespace for ${LANGUAGE_DISPLAY_NAMES[language]}`);
    } else {
      namespaces.push(ns);

      if (!ns.isValid) {
        for (const err of ns.errors) {
          errors.push(`${LANGUAGE_DISPLAY_NAMES[language]}: ${err}`);
          log.warn(`${LANGUAGE_DISPLAY_NAMES[language]}: ${err}`);
        }
      }
    }
  }

  // Check for missing languages
  if (missingLanguages.length > 0) {
    const missingNames = missingLanguages
      .map((l) => LANGUAGE_DISPLAY_NAMES[l])
      .join(", ");
    errors.push(`Missing namespaces for: ${missingNames}`);
  }

  // Check consistency across languages
  if (namespaces.length >= 2) {
    const consistencyError = checkConsistency(namespaces);
    if (consistencyError) {
      errors.push(consistencyError);
      log.warn(consistencyError);
    }
  }

  // Check for API spec link
  const hasApiSpecLink = API_SPEC_LINK_PATTERN.test(body);
  if (!hasApiSpecLink) {
    errors.push("Missing link to azure-rest-api-specs repository");
    log.warn("Missing API spec link");
  }

  const isValid = errors.length === 0;

  if (isValid) {
    log.info(`Validation passed for issue #${issue.number}`);
  } else {
    log.warn(`Validation failed for issue #${issue.number}: ${errors.length} error(s)`);
  }

  return {
    isValid,
    namespaces,
    hasApiSpecLink,
    missingLanguages,
    errors,
  };
}

/**
 * Get extracted namespaces as a record for easy access
 * @param validation - Validation result
 * @returns Record of language -> raw namespace string
 */
export function getNamespacesRecord(
  validation: ValidationResult
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const ns of validation.namespaces) {
    result[ns.language] = ns.raw;
  }

  // Fill in missing languages with placeholder
  for (const lang of ALL_LANGUAGES) {
    if (!result[lang]) {
      result[lang] = "(missing)";
    }
  }

  return result;
}

/**
 * Extract the resource provider name from validated namespaces
 * Uses .NET namespace as the source of truth (PascalCase)
 * @param validation - Validation result
 * @returns Resource provider name or null
 */
export function getResourceProviderName(
  validation: ValidationResult
): string | null {
  // Prefer .NET namespace as source of truth
  const dotnetNs = validation.namespaces.find((ns) => ns.language === "dotnet");
  if (dotnetNs) {
    return dotnetNs.resourceProviderName;
  }

  // Fall back to any available namespace
  if (validation.namespaces.length > 0) {
    return validation.namespaces[0].resourceProviderName;
  }

  return null;
}

// -----------------------------------------------------------------------------
// Standalone Execution
// -----------------------------------------------------------------------------

/**
 * Run validation on issues from a previous fetch
 */
async function main(): Promise<void> {
  const { readOutput, writeOutput } = await import("./utils.ts");
  const issues = readOutput<GitHubIssue[]>("issues.json");

  const results = issues.map((issue) => ({
    issue: {
      number: issue.number,
      title: issue.title,
      url: issue.url,
      repo: issue.repository.nameWithOwner,
    },
    validation: validateIssue(issue),
  }));

  const path = writeOutput("validation.json", results);
  log.info(`Wrote validation results to ${path}`);

  // Summary
  const passed = results.filter((r) => r.validation.isValid).length;
  const failed = results.length - passed;
  console.log(`\nValidation Summary: ${passed} passed, ${failed} failed`);
}

// Run if executed directly
const isMain = process.argv[1]?.includes("validate");
if (isMain) {
  main().catch(console.error);
}
