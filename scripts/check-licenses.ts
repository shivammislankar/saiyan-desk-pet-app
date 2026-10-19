/**
 * License check script.
 * Verifies that all dependencies use allowed licenses.
 */

import * as fs from "fs";
import * as path from "path";

const ALLOWED_LICENSES = [
  "MIT",
  "ISC",
  "BSD",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "Apache 2.0",
  "Unlicense",
  "CC0",
  "CC-BY",
  "Python-2.0",
];

interface LicenseCheck {
  name: string;
  version: string;
  license: string;
  allowed: boolean;
}

/**
 * Check licenses of all dependencies.
 */
export function checkLicenses(packageJsonPath: string): LicenseCheck[] {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const results: LicenseCheck[] = [];

  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  for (const [name, version] of Object.entries(dependencies)) {
    const license = findLicense(name, String(version));
    results.push({
      name,
      version: String(version),
      license,
      allowed: isLicenseAllowed(license),
    });
  }

  return results;
}

/**
 * Find the license for a package.
 */
function findLicense(name: string, _version: string): string {
  try {
    const packagePath = path.join(
      path.dirname(require.resolve(path.join(name, "package.json"))),
      "package.json"
    );
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
      return pkg.license || pkg.licenses?.[0]?.type || "UNKNOWN";
    }
  } catch {
    // Package not found
  }
  return "UNKNOWN";
}

/**
 * Check if a license is in the allowlist.
 */
function isLicenseAllowed(license: string): boolean {
  return ALLOWED_LICENSES.some((allowed) =>
    license.toUpperCase().includes(allowed.toUpperCase())
  );
}

// Run if called directly
if (require.main === module) {
  const packageJsonPath = process.argv[2] || path.join(__dirname, "../package.json");
  const results = checkLicenses(packageJsonPath);

  console.log("License Check Report:");
  console.log("=====================");

  let allAllowed = true;
  for (const result of results) {
    const status = result.allowed ? "PASS" : "FAIL";
    console.log(`  [${status}] ${result.name}@${result.version}: ${result.license}`);
    if (!result.allowed) allAllowed = false;
  }

  console.log("=====================");
  console.log(allAllowed ? "All licenses allowed" : "Some licenses not allowed");

  process.exit(allAllowed ? 0 : 1);
}
