/**
 * Fetch Azure SDK release data from GitHub
 * 
 * Downloads monthly release YAML files and the latest packages CSV
 * from the Azure/azure-sdk repository.
 */

import yaml from "js-yaml";
import { getOutputDir, writeOutput } from "./utils.js";

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/Azure/azure-sdk/main/_data/releases";

// Supported languages for release data
const LANGUAGES = ["js", "python", "dotnet", "java", "go", "cpp", "c", "ios", "android", "rust"];

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

  // Default to current and previous month if not specified
  if (months.length === 0) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    months.push(currentMonth);
    
    // Add previous month
    const prev = new Date(now.getFullYear(), now.getMonth() - 1);
    const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    months.push(prevMonth);
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
 * Fetch the latest packages CSV for a language
 * @param {string} language 
 * @returns {Promise<object[]>}
 */
async function fetchLatestPackages(language) {
  const url = `${GITHUB_RAW_BASE}/latest/${language}-packages.csv`;
  console.log(`  Fetching latest packages for ${language}...`);
  
  const csv = await fetchUrl(url);
  if (!csv) {
    return [];
  }

  // Parse CSV
  const lines = csv.split("\n").filter(line => line.trim());
  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(",").map(h => h.trim());
  const packages = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const pkg = {};
    headers.forEach((header, idx) => {
      pkg[header] = values[idx] || "";
    });
    packages.push(pkg);
  }

  return packages;
}

/**
 * Parse a CSV line handling quoted values
 * @param {string} line 
 * @returns {string[]}
 */
function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
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

    // Add metadata to each entry
    return data.entries.map(entry => ({
      ...entry,
      language,
      releaseMonth: month
    }));
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
  const allPackages = {};

  // Fetch latest packages for each language
  console.log("\n=== Fetching Latest Package Catalogs ===");
  for (const lang of languages) {
    const packages = await fetchLatestPackages(lang);
    if (packages.length > 0) {
      allPackages[lang] = packages;
      console.log(`    Found ${packages.length} packages for ${lang}`);
    }
  }

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

  // Get timestamped output directory
  const outputDir = getOutputDir();

  // Write results to JSON file
  const output = {
    metadata: {
      months,
      languages,
      generatedAt: new Date().toISOString()
    },
    latestPackages: allPackages,
    monthlyReleases: allReleases
  };

  const outputPath = writeOutput("releases.json", output, outputDir);
  console.log(`\nRelease data written to ${outputPath}`);

  // Print summary
  console.log("\n=== Release Summary ===");
  console.log(`Total monthly releases: ${allReleases.length}`);
  
  // Group by language
  const byLang = {};
  for (const release of allReleases) {
    byLang[release.language] = (byLang[release.language] || 0) + 1;
  }
  console.log("\nReleases by language:");
  for (const [lang, count] of Object.entries(byLang).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${lang}: ${count}`);
  }

  // Group by version type
  const byType = {};
  for (const release of allReleases) {
    const type = release.VersionType || "Unknown";
    byType[type] = (byType[type] || 0) + 1;
  }
  console.log("\nReleases by version type:");
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  // Sample some releases
  if (allReleases.length > 0) {
    console.log("\nSample releases:");
    allReleases.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.Name || r.Package} v${r.Version} (${r.language}, ${r.VersionType})`);
    });
  }
}

main().catch(console.error);
