/**
 * Pack validator.
 * Validates sprite pack structure, schemas, and safety constraints.
 */

import * as fs from "fs";
import * as path from "path";
import { z } from "zod";

const packManifestSchema = z.object({
  name: z.string().min(1).max(100),
  author: z.string().max(100).default(""),
  version: z.string().min(1).max(20),
  license: z.string().max(500).default(""),
  facing: z.enum(["left", "right"]).default("right"),
});

const actionManifestSchema = z.object({
  sheet: z.string().min(1),
  frameWidth: z.number().int().positive().max(256),
  frameHeight: z.number().int().positive().max(256),
  frameCount: z.number().int().positive().max(256),
  framesPerRow: z.number().int().positive().max(64).optional(),
  fps: z.number().positive().min(1).max(60),
  anchorX: z.number(),
  anchorY: z.number(),
  loop: z.boolean().default(true),
  frameEvents: z.record(z.string(), z.number()).optional(),
  flip: z.boolean().default(false),
});

export interface PackValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  actions: string[];
}

/**
 * Validate a sprite pack folder.
 */
export function validatePack(packPath: string): PackValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const actions: string[] = [];

  // Check pack.json
  const packJsonPath = path.join(packPath, "pack.json");
  if (!fs.existsSync(packJsonPath)) {
    errors.push("Missing pack.json");
    return { valid: false, errors, warnings, actions };
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(packJsonPath, "utf-8"));
    const result = packManifestSchema.safeParse(manifest);
    if (!result.success) {
      errors.push(`Invalid pack.json: ${result.error.message}`);
    }
  } catch (error) {
    errors.push(`Invalid pack.json: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Check actions.json
  const actionsPath = path.join(packPath, "actions.json");
  if (!fs.existsSync(actionsPath)) {
    errors.push("Missing actions.json");
    return { valid: false, errors, warnings, actions };
  }

  try {
    const actionsData = JSON.parse(fs.readFileSync(actionsPath, "utf-8"));
    if (!actionsData.actions || typeof actionsData.actions !== "object") {
      errors.push("actions.json must contain an 'actions' object");
      return { valid: false, errors, warnings, actions };
    }

    const requiredActions = [
      "idle", "fly", "hover", "punch_1", "kick_1", "drag",
    ];

    for (const [actionName, actionData] of Object.entries(actionsData.actions)) {
      actions.push(actionName);
      const result = actionManifestSchema.safeParse(actionData);
      if (!result.success) {
        errors.push(`Invalid action "${actionName}": ${result.error.message}`);
      }

      // Check sheet path safety
      const action = actionData as { sheet?: string };
      if (action.sheet) {
        if (path.isAbsolute(action.sheet)) {
          errors.push(`Action "${actionName}": sheet path must be relative`);
        }
        if (action.sheet.includes("..")) {
          errors.push(`Action "${actionName}": sheet path must not contain '..'`);
        }

        // Check file exists
        const sheetPath = path.join(packPath, action.sheet);
        if (!fs.existsSync(sheetPath)) {
          errors.push(`Action "${actionName}": sheet file not found: ${action.sheet}`);
        } else {
          // Check file size
          const stats = fs.statSync(sheetPath);
          const maxSize = 4 * 1024 * 1024; // 4 MB
          if (stats.size > maxSize) {
            errors.push(`Action "${actionName}": sheet file too large (${stats.size} bytes)`);
          }
        }
      }
    }

    // Check for missing required actions
    for (const required of requiredActions) {
      if (!actionsData.actions[required]) {
        warnings.push(`Missing recommended action: ${required}`);
      }
    }
  } catch (error) {
    errors.push(`Invalid actions.json: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Check for path traversal in any JSON files
  const jsonFiles = ["pack.json", "actions.json"];
  for (const jsonFile of jsonFiles) {
    const jsonPath = path.join(packPath, jsonFile);
    if (fs.existsSync(jsonPath)) {
      try {
        const content = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        checkPathSafety(content, jsonFile, errors);
      } catch {
        // Already handled above
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    actions,
  };
}

/**
 * Recursively check for path traversal in JSON values.
 */
function checkPathSafety(obj: unknown, fileName: string, errors: string[]): void {
  if (typeof obj === "string") {
    if (obj.includes("..") || path.isAbsolute(obj)) {
      errors.push(`${fileName}: path traversal detected in "${obj}"`);
    }
  } else if (typeof obj === "object" && obj !== null) {
    for (const value of Object.values(obj)) {
      checkPathSafety(value, fileName, errors);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const packPath = process.argv[2];
  if (!packPath) {
    console.error("Usage: ts-node scripts/validate-pack.ts <pack-folder>");
    process.exit(1);
  }

  const result = validatePack(packPath);

  console.log("Pack Validation Report:");
  console.log("=======================");
  console.log(`Path: ${packPath}`);
  console.log(`Valid: ${result.valid ? "YES" : "NO"}`);
  console.log(`Actions found: ${result.actions.length}`);

  if (result.errors.length > 0) {
    console.log("\nErrors:");
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }

  console.log("=======================");
  process.exit(result.valid ? 0 : 1);
}
