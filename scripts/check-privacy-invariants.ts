/**
 * Privacy invariants check.
 * Verifies that no code logs raw key codes or stores input event streams.
 */

import * as fs from "fs";
import * as path from "path";

interface Violation {
  file: string;
  line: number;
  message: string;
}

/**
 * Check for privacy violations in source files.
 */
export function checkPrivacyInvariants(srcDir: string): Violation[] {
  const violations: Violation[] = [];

  // Patterns that indicate privacy violations
  const forbiddenPatterns = [
    { pattern: /console\.log.*keycode/i, message: "Logging raw keycode" },
    { pattern: /console\.log.*key.*code/i, message: "Logging key code" },
    { pattern: /console\.log.*event\.key/i, message: "Logging event key" },
    { pattern: /writeFileSync.*key/i, message: "Writing key data to disk" },
    { pattern: /JSON\.stringify.*keycode/i, message: "Serializing keycode" },
    { pattern: /localStorage.*key/i, message: "Storing key data in localStorage" },
  ];

  function checkFile(filePath: string): void {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      for (const { pattern, message } of forbiddenPatterns) {
        if (pattern.test(lines[i])) {
          violations.push({
            file: path.relative(srcDir, filePath),
            line: i + 1,
            message,
          });
        }
      }
    }
  }

  function walkDir(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) {
        checkFile(fullPath);
      }
    }
  }

  walkDir(srcDir);
  return violations;
}

// Run if called directly
if (require.main === module) {
  const srcDir = process.argv[2] || path.join(__dirname, "../src");
  const violations = checkPrivacyInvariants(srcDir);

  if (violations.length === 0) {
    console.log("PASS: No privacy violations found");
    process.exit(0);
  } else {
    console.log("FAIL: Privacy violations found:");
    for (const v of violations) {
      console.log(`  ${v.file}:${v.line} - ${v.message}`);
    }
    process.exit(1);
  }
}
