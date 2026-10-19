/**
 * Asset verification script.
 * Validates that all required actions exist and their sheets are present.
 */

import * as fs from "fs";
import * as path from "path";

interface AssetCheck {
  file: string;
  exists: boolean;
  valid: boolean;
  message: string;
}

const REQUIRED_ACTIONS = [
  "idle", "fly", "hover", "nimbus_ride",
  "punch_1", "punch_2", "punch_3", "kick_1", "kick_2", "uppercut", "block",
  "kamehameha_charge", "kamehameha_fire", "kaioken",
  "laugh", "scroll_unroll", "peek", "stretch", "drink", "thinking", "done", "drag", "sleep",
  "working", "confused", "eat", "train", "scratch_head", "yawn", "stomach_growl", "look_around", "spar",
];

export function verifyAssets(assetsDir: string): AssetCheck[] {
  const checks: AssetCheck[] = [];

  const actionsPath = path.join(assetsDir, "actions.json");
  const actionsExists = fs.existsSync(actionsPath);
  checks.push({
    file: "actions.json",
    exists: actionsExists,
    valid: false,
    message: actionsExists ? "File exists" : "File missing",
  });

  if (actionsExists) {
    try {
      const actions = JSON.parse(fs.readFileSync(actionsPath, "utf-8"));
      const missingActions = REQUIRED_ACTIONS.filter(
        (a) => !actions.actions || !actions.actions[a]
      );
      checks[0].valid = missingActions.length === 0;
      checks[0].message =
        missingActions.length === 0
          ? `All ${REQUIRED_ACTIONS.length} required actions present`
          : `Missing actions: ${missingActions.join(", ")}`;

      // Check every referenced sheet exists
      const sheets = new Set<string>();
      for (const def of Object.values(actions.actions || {}) as Array<{ sheet?: string }>) {
        if (def.sheet) sheets.add(def.sheet);
      }
      const missingSheets = [...sheets].filter(
        (s) => !fs.existsSync(path.join(assetsDir, s))
      );
      checks.push({
        file: `${sheets.size} referenced sheets`,
        exists: missingSheets.length === 0,
        valid: missingSheets.length === 0,
        message:
          missingSheets.length === 0
            ? "All referenced sheets present"
            : `Missing sheets: ${missingSheets.join(", ")}`,
      });
    } catch (error) {
      checks[0].message = `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return checks;
}

if (require.main === module) {
  const assetsDir = process.argv[2] || path.join(__dirname, "../assets/goku");
  const checks = verifyAssets(assetsDir);

  console.log("Asset Verification Report:");
  console.log("==========================");

  let allValid = true;
  for (const check of checks) {
    const status = check.valid ? "PASS" : "FAIL";
    console.log(`  [${status}] ${check.file}: ${check.message}`);
    if (!check.valid) allValid = false;
  }

  console.log("==========================");
  console.log(allValid ? "All assets valid" : "Some assets invalid");

  process.exit(allValid ? 0 : 1);
}
