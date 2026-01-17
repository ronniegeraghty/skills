/**
 * Fetch Azure SDK release data from GitHub
 * 
 * Downloads monthly release YAML files from the Azure/azure-sdk repository.
 * Classifies releases as GA (stable) or Beta based on version patterns.
 */

import yaml from "js-yaml";
import { getOutputDir, writeOutput } from "./utils.js";

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/Azure/azure-sdk/main/_data/releases";

// Supported languages for release data
const LANGUAGES = ["js", "python", "dotnet", "java", "go", "cpp", "c", "ios", "android"];

/**
 * Determine if a version is Beta or GA (stable)
 * 
 * Beta patterns (case-insensitive):
 * - Contains "-beta" (e.g., 2.1.0-beta.2)
 * - Contains "-preview" (e.g., 1.0.0-preview.1)
 * - Contains "-alpha" (e.g., 1.0.0-alpha.1)
 * - Contains "-rc" (e.g., 1.0.0-rc.1)
 * - Python: contains "b" followed by digits (e.g., 1.0.0b3, 2.0.0b1)
 * - Python: contains "a" followed by digits for alpha (e.g., 1.0.0a1)
 * 
 * Everything else is GA (stable), including patch releases like 6.0.2
 * 
 * @param {string} version - The version string
 * @returns {"GA" | "Beta"}
 */
function classifyVersion(version) {
  if (!version) return "GA";
  
  const v = version.toLowerCase();
  
  // Check for common beta/preview patterns
  if (v.includes("-beta") || 
      v.includes("-preview") || 
      v.includes("-alpha") || 
      v.includes("-rc")) {
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

/**
 * Determine if package is management plane or data plane
 * 
 * Management plane patterns:
 * - Contains "mgmt" or "management"
 * - Contains "arm-" prefix
 * - Contains "resourcemanager"
 * 
 * @param {string} packageName - The package name
 * @returns {"Management" | "Data"}
 */
function classifyPlane(packageName) {
  if (!packageName) return "Data";
  
  const name = packageName.toLowerCase();
  
  if (name.includes("mgmt") || 
      name.includes("management") || 
      name.includes("arm-") ||
      name.includes("resourcemanager")) {
    return "Management";
  }
  
  return "Data";
}

/**
 * Parse command line arguments
 * @returns {{ months: string[], languages: string[] }}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let months = [];
  let languages = [...LANGUAGES];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--month" && args[i + 1]) {
      months.push(args[++i]);
    } else if (args[i] === "--language" && args[i + 1]) {
      languages = args[++i].split(",");
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

/**
 * Fetch a URL and return the response text
 * @param {string} url 
 * @returns {Promise<string|null>}
 */
async function fetchUrl(url) {
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
    console.warn(`  Warning: Failed to fetch ${url}: ${error.message}`);
    return null;
  }
}

/**
 * Fetch monthly release YAML for a language
 * @param {string} month - Format: YYYY-MM
 * @param {string} language 
 * @returns {Promise<object[]>}
 */
async function fetchMonthlyReleases(month, language) {
  const url = `${GITHUB_RAW_BASE}/${month}/${language}.yml`;
  console.log(`  Fetching ${month} releases for ${language}...`);

  const yamlContent = await fetchUrl(url);
  if (!yamlContent) {
    return [];
  }

  try {
    const data = yaml.load(yamlContent);
    if (!data || !data.entries) {
      return [];
    }

    // Process each entry with proper classification
    return data.entries.map(entry => {
      const packageName = entry.Name || entry.Package;
      const version = entry.Version;
      
      return {
        packageName,
        version,
        displayName: entry.DisplayName || packageName,
        serviceName: entry.ServiceName || "",
        versionType: classifyVersion(version),  // GA or Beta
        plane: classifyPlane(packageName),       // Management or Data
        language,
        releaseMonth: month,
        // Keep original VersionType for reference
        originalVersionType: entry.VersionType || ""
      };
    });
  } catch (error) {
    console.warn(`  Warning: Failed to parse YAML for ${language} ${month}: ${error.message}`);
    return [];
  }
}

/**
 * Main function to fetch release data
 */
async function main() {
  const { months, languages } = parseArgs();
  console.log(`Fetching releases for months: ${months.join(", ")}`);
  console.log(`Languages: ${languages.join(", ")}`);

  const allReleases = [];

  // Fetch monthly releases for each language and month
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

  // Get output directory
  const outputDir = getOutputDir();

  // Build output
  const output = {
    metadata: {
      months,
      languages,
      generatedAt: new Date().toISOString()
    },
    releases: allReleases
  };

  const outputPath = writeOutput("releases.json", output, outputDir);
  console.log(`\nRelease data written to ${outputPath}`);

  // Print summary
  console.log("\n=== Release Summary ===");
  console.log(`Total releases: ${allReleases.length}`);
  
  // Group by language
  const byLang = {};
  for (const release of allReleases) {
    byLang[release.language] = (byLang[release.language] || 0) + 1;
  }
  console.log("\nReleases by language:");
  for (const [lang, count] of Object.entries(byLang).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${lang}: ${count}`);
  }

  // Group by version type (GA vs Beta)
  const byType = { GA: 0, Beta: 0 };
  for (const release of allReleases) {
    byType[release.versionType]++;
  }
  console.log("\nReleases by type:");
  console.log(`  GA (stable): ${byType.GA}`);
  console.log(`  Beta (preview): ${byType.Beta}`);

  // Group by plane
  const byPlane = { Management: 0, Data: 0 };
  for (const release of allReleases) {
    byPlane[release.plane]++;
  }
  console.log("\nReleases by plane:");
  console.log(`  Management: ${byPlane.Management}`);
  console.log(`  Data: ${byPlane.Data}`);

  // Sample releases
  if (allReleases.length > 0) {
    console.log("\nSample releases:");
    allReleases.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.packageName} v${r.version} (${r.language}, ${r.versionType}, ${r.plane})`);
    });
  }
}

main().catch(console.error);
