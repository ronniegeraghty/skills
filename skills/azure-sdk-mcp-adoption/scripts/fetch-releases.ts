/**
 * Fetch Azure SDK Release Data from GitHub
 *
 * Downloads monthly release YAML files from the Azure/azure-sdk repository
 * and enriches them with TypeSpec location data for correlation.
 *
 * Key responsibilities:
 * - Fetch monthly release data for all supported languages
 * - Classify releases as GA (stable) or Beta
 * - Classify releases as Management plane or Data plane
 * - Fetch tsp-location.yaml to build TypeSpec path mappings
 *
 * @module fetch-releases
 */

import yaml from "js-yaml";
import { GITHUB_RAW_BASE, SUPPORTED_LANGUAGES } from "./constants.ts";
import type { SupportedLanguage } from "./constants.ts";
import { getOutputDir, writeOutput } from "./utils.ts";
import type {
  Release,
  VersionType,
  PlaneType,
  TypespecPackageMapping,
  ReleasesOutput,
} from "./types.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ReleaseEntry {
  Name?: string;
  Package?: string;
  Version: string;
  DisplayName?: string;
  ServiceName?: string;
  VersionType?: string;
  ChangelogUrl?: string;
}

interface ReleaseYaml {
  entries?: ReleaseEntry[];
}

interface TspLocationYaml {
  directory?: string;
}

// -----------------------------------------------------------------------------
// Version Classification
// -----------------------------------------------------------------------------

/**
 * Determine if a version is Beta or GA (stable)
 *
 * Beta patterns (case-insensitive):
 * - Contains "-beta", "-preview", "-alpha", "-rc"
 * - Python: ends with "b" or "a" followed by digits (e.g., 1.0.0b3)
 *
 * Everything else is GA, including patch releases like 6.0.2
 */
function classifyVersion(version: string): VersionType {
  if (!version) return "GA";

  const v = version.toLowerCase();

  // Check for common beta/preview patterns
  if (
    v.includes("-beta") ||
    v.includes("-preview") ||
    v.includes("-alpha") ||
    v.includes("-rc")
  ) {
    return "Beta";
  }

  // Python-style beta versions: 1.0.0b3, 2.0.0b1 (but not "blob" etc.)
  // Pattern: digit followed by 'b' or 'a' followed by digit(s) at end
  if (/\d[ab]\d+$/.test(v)) {
    return "Beta";
  }

  // Everything else is GA (stable), including patch releases
  return "GA";
}

// -----------------------------------------------------------------------------
// Plane Classification
// -----------------------------------------------------------------------------

/**
 * Determine if package is management plane or data plane
 *
 * Management plane patterns:
 * - Contains "mgmt", "management", "arm-", or "resourcemanager"
 */
function classifyPlane(packageName: string): PlaneType {
  if (!packageName) return "Data";

  const name = packageName.toLowerCase();

  if (
    name.includes("mgmt") ||
    name.includes("management") ||
    name.includes("arm-") ||
    name.includes("resourcemanager")
  ) {
    return "Management";
  }

  return "Data";
}

// -----------------------------------------------------------------------------
// Argument Parsing
// -----------------------------------------------------------------------------

interface ParsedArgs {
  months: string[];
  languages: SupportedLanguage[];
}

/**
 * Parse command line arguments for release fetching
 *
 * Supported arguments:
 *   --month YYYY-MM      Month to fetch releases for (can be specified multiple times)
 *   --language js,python Comma-separated list of languages to fetch
 *
 * Defaults:
 *   months = [current month]
 *   languages = all supported languages
 */
function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const months: string[] = [];
  let languages: SupportedLanguage[] = [...SUPPORTED_LANGUAGES];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--month" && args[i + 1]) {
      months.push(args[++i]);
    } else if (args[i] === "--language" && args[i + 1]) {
      languages = args[++i].split(",") as SupportedLanguage[];
    }
  }

  // Default to current month only
  if (months.length === 0) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    months.push(currentMonth);
  }

  return { months, languages };
}

// -----------------------------------------------------------------------------
// HTTP Fetching
// -----------------------------------------------------------------------------

/**
 * Fetch a URL and return the response text
 *
 * Handles 404 responses gracefully (returns null) since not all
 * language/month combinations have release data.
 */
async function fetchUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        return null; // Not found is expected for some months/languages
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.warn(`  Warning: Failed to fetch ${url}: ${(error as Error).message}`);
    return null;
  }
}

// -----------------------------------------------------------------------------
// TypeSpec Location Functions
// -----------------------------------------------------------------------------

/**
 * Build the tsp-location.yaml URL from a ChangelogUrl
 *
 * Release entries include a ChangelogUrl pointing to the package's CHANGELOG.md.
 * The tsp-location.yaml file (if it exists) is in the same directory.
 */
function getTspLocationUrl(changelogUrl: string): string | null {
  if (!changelogUrl) return null;

  // Parse the URL to extract branch/tag and path
  // Format: https://github.com/{owner}/{repo}/tree/{ref}/{path}/CHANGELOG.md
  const match = changelogUrl.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)\/CHANGELOG\.md$/i
  );

  if (!match) return null;

  const [, owner, repo, ref, path] = match;

  // Build the raw GitHub URL for tsp-location.yaml
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}/tsp-location.yaml`;
}

/**
 * Fetch tsp-location.yaml for a release and extract the directory property
 *
 * The directory property contains the TypeSpec specification path, which can
 * be used to correlate with telemetry that only has TypeSpec paths.
 */
async function fetchTspLocation(changelogUrl: string): Promise<string | null> {
  const tspLocationUrl = getTspLocationUrl(changelogUrl);
  if (!tspLocationUrl) return null;

  const yamlContent = await fetchUrl(tspLocationUrl);
  if (!yamlContent) return null;

  try {
    const data = yaml.load(yamlContent) as TspLocationYaml;
    if (data && data.directory) {
      // Normalize the directory path to match typespec paths in telemetry
      return data.directory;
    }
  } catch {
    // YAML parsing failed - silently skip
  }

  return null;
}

// -----------------------------------------------------------------------------
// Release Fetching
// -----------------------------------------------------------------------------

/**
 * Fetch monthly release YAML for a language
 *
 * Downloads and parses the release YAML file from GitHub, then transforms
 * each entry with proper classification.
 */
async function fetchMonthlyReleases(
  month: string,
  language: SupportedLanguage
): Promise<Release[]> {
  const url = `${GITHUB_RAW_BASE}/${month}/${language}.yml`;
  console.log(`  Fetching ${month} releases for ${language}...`);

  const yamlContent = await fetchUrl(url);
  if (!yamlContent) {
    return [];
  }

  try {
    const data = yaml.load(yamlContent) as ReleaseYaml;
    if (!data || !data.entries) {
      return [];
    }

    // Process each entry with proper classification
    return data.entries.map((entry) => {
      const packageName = entry.Name || entry.Package || "";
      const version = entry.Version;

      return {
        packageName,
        version,
        displayName: entry.DisplayName || packageName,
        serviceName: entry.ServiceName || "",
        versionType: classifyVersion(version), // GA or Beta
        plane: classifyPlane(packageName), // Management or Data
        language,
        releaseMonth: month,
        // Keep original VersionType for reference
        originalVersionType: entry.VersionType || "",
        // Include ChangelogUrl for tsp-location lookup
        changelogUrl: entry.ChangelogUrl || "",
      };
    });
  } catch (error) {
    console.warn(
      `  Warning: Failed to parse YAML for ${language} ${month}: ${(error as Error).message}`
    );
    return [];
  }
}

// -----------------------------------------------------------------------------
// TypeSpec Mapping
// -----------------------------------------------------------------------------

/**
 * Fetch TypeSpec locations for all releases and build a mapping
 *
 * For each release with a ChangelogUrl, attempts to fetch tsp-location.yaml
 * and extract the TypeSpec directory. This builds a mapping from TypeSpec
 * paths to package names for correlation with telemetry.
 */
async function buildTypespecMapping(
  releases: Release[]
): Promise<Map<string, TypespecPackageMapping[]>> {
  const typespecToPackages = new Map<string, TypespecPackageMapping[]>();
  const releasesWithChangelog = releases.filter((r) => r.changelogUrl);

  console.log(`  Found ${releasesWithChangelog.length} releases with ChangelogUrl`);

  let fetched = 0;
  let found = 0;

  for (const release of releasesWithChangelog) {
    const typespecDir = await fetchTspLocation(release.changelogUrl);
    fetched++;

    if (typespecDir) {
      found++;
      const normalizedPath = typespecDir.replace(/\\/g, "/").toLowerCase();

      if (!typespecToPackages.has(normalizedPath)) {
        typespecToPackages.set(normalizedPath, []);
      }
      typespecToPackages.get(normalizedPath)!.push({
        packageName: release.packageName,
        language: release.language,
        version: release.version,
        releaseMonth: release.releaseMonth,
      });

      // Add typespec directory to the release object
      release.typespecDirectory = typespecDir;
    }

    // Progress indicator every 50 releases
    if (fetched % 50 === 0) {
      console.log(
        `    Processed ${fetched}/${releasesWithChangelog.length} releases...`
      );
    }
  }

  console.log(`  Fetched ${fetched} tsp-location.yaml files`);
  console.log(`  Found ${found} with typespec directories`);
  console.log(`  Unique typespec paths: ${typespecToPackages.size}`);

  return typespecToPackages;
}

// -----------------------------------------------------------------------------
// Console Output
// -----------------------------------------------------------------------------

/**
 * Print release summary to console
 */
function printSummary(releases: Release[]): void {
  console.log(`Total releases: ${releases.length}`);

  // By language
  const byLang: Record<string, number> = {};
  for (const release of releases) {
    byLang[release.language] = (byLang[release.language] || 0) + 1;
  }
  console.log("\nReleases by language:");
  for (const [lang, count] of Object.entries(byLang).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${lang}: ${count}`);
  }

  // By version type
  const byType = { GA: 0, Beta: 0 };
  for (const release of releases) {
    byType[release.versionType]++;
  }
  console.log("\nReleases by type:");
  console.log(`  GA (stable): ${byType.GA}`);
  console.log(`  Beta (preview): ${byType.Beta}`);

  // By plane
  const byPlane = { Management: 0, Data: 0 };
  for (const release of releases) {
    byPlane[release.plane]++;
  }
  console.log("\nReleases by plane:");
  console.log(`  Management: ${byPlane.Management}`);
  console.log(`  Data: ${byPlane.Data}`);

  // Sample releases
  if (releases.length > 0) {
    console.log("\nSample releases:");
    releases.slice(0, 5).forEach((r, i) => {
      console.log(
        `  ${i + 1}. ${r.packageName} v${r.version} (${r.language}, ${r.versionType}, ${r.plane})`
      );
    });
  }
}

// -----------------------------------------------------------------------------
// Main Entry Point
// -----------------------------------------------------------------------------

/**
 * Main function - fetches release data and writes to output
 */
async function main(): Promise<void> {
  const { months, languages } = parseArgs();
  console.log(`Fetching releases for months: ${months.join(", ")}`);
  console.log(`Languages: ${languages.join(", ")}`);

  // Fetch monthly releases for each language and month
  const allReleases: Release[] = [];
  console.log("\n=== Fetching Monthly Releases ===");

  for (const month of months) {
    console.log(`\nMonth: ${month}`);
    for (const lang of languages) {
      const releases = await fetchMonthlyReleases(month, lang);
      if (releases.length > 0) {
        allReleases.push(...releases);
        console.log(`    Found ${releases.length} releases for ${lang}`);
      }
    }
  }

  // Fetch TypeSpec locations and build mapping
  console.log("\n=== Fetching TypeSpec Locations ===");
  const typespecToPackages = await buildTypespecMapping(allReleases);

  // Convert mapping to serializable format
  const typespecMapping: Record<string, TypespecPackageMapping[]> = {};
  for (const [path, packages] of typespecToPackages) {
    typespecMapping[path] = packages;
  }

  // Build and write output
  const outputDir = getOutputDir();
  const output: ReleasesOutput = {
    metadata: {
      months,
      languages,
      generatedAt: new Date().toISOString(),
      tspLocationsFetched: allReleases.filter((r) => r.changelogUrl).length,
      tspLocationsFound: Object.keys(typespecMapping).length,
      uniqueTypespecPaths: typespecToPackages.size,
    },
    releases: allReleases,
    typespecMapping,
  };

  const outputPath = writeOutput("releases.json", output, outputDir);
  console.log(`\nRelease data written to ${outputPath}`);

  // Print summary
  console.log("\n=== Release Summary ===");
  printSummary(allReleases);
}

main().catch(console.error);
