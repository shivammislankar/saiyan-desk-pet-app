/**
 * Pack import tool.
 * Imports sprite packs from various formats into the saiyan-desk-pet format.
 *
 * Usage: npm run import-pack <source-folder> [--map map.json] [--name <pack-name>]
 */

import * as fs from "fs";
import * as path from "path";

interface ImportMap {
  facing: "left" | "right";
  actions: Record<string, {
    frames: string[];
    fps?: number;
    loop?: boolean;
  }>;
}

interface ImportReport {
  action: string;
  status: "provided" | "fallback" | "missing";
  frames: number;
}

/**
 * Import a sprite pack from a source folder.
 */
export async function importPack(
  sourceFolder: string,
  mapPath?: string,
  packName?: string,
  outputDir?: string
): Promise<{ success: boolean; report: ImportReport[]; packPath?: string }> {
  const report: ImportReport[] = [];

  // Validate source folder
  if (!fs.existsSync(sourceFolder)) {
    throw new Error(`Source folder not found: ${sourceFolder}`);
  }

  // Load map file
  let map: ImportMap;
  if (mapPath) {
    if (!fs.existsSync(mapPath)) {
      throw new Error(`Map file not found: ${mapPath}`);
    }
    map = JSON.parse(fs.readFileSync(mapPath, "utf-8"));
  } else {
    // Auto-generate map from folder contents
    map = await generateMapFromFolder(sourceFolder);
  }

  // Determine pack name
  const finalPackName = packName || path.basename(sourceFolder);

  // Determine output directory (user's packs folder)
  const packsDir = outputDir || path.join(process.env.GOKUPET_DATA_DIR || process.cwd(), "packs");
  const packPath = path.join(packsDir, finalPackName);

  // Ensure output directory exists
  if (!fs.existsSync(packsDir)) {
    fs.mkdirSync(packsDir, { recursive: true });
  }

  // Create pack folder
  if (!fs.existsSync(packPath)) {
    fs.mkdirSync(packPath, { recursive: true });
  }

  // Write pack.json
  const packJson = {
    name: finalPackName,
    author: "",
    version: "1.0.0",
    license: "",
    facing: map.facing,
  };
  fs.writeFileSync(path.join(packPath, "pack.json"), JSON.stringify(packJson, null, 2));

  // Process each action
  const actionsJson: Record<string, unknown> = {};

  for (const [actionName, actionConfig] of Object.entries(map.actions)) {
    const frameFiles = actionConfig.frames
      .flatMap((pattern) => resolveWildcard(sourceFolder, pattern))
      .sort(naturalSort);

    if (frameFiles.length === 0) {
      report.push({ action: actionName, status: "missing", frames: 0 });
      continue;
    }

    // Copy frames to pack folder
    const spritesDir = path.join(packPath, "sprites");
    if (!fs.existsSync(spritesDir)) {
      fs.mkdirSync(spritesDir, { recursive: true });
    }

    // For simplicity, copy the first frame as a placeholder
    // In a full implementation, this would trim and pack into sheets
    const destFile = path.join(spritesDir, `${actionName}.png`);
    fs.copyFileSync(frameFiles[0], destFile);

    actionsJson[actionName] = {
      sheet: `sprites/${actionName}.png`,
      frameWidth: 32,
      frameHeight: 32,
      frameCount: frameFiles.length,
      framesPerRow: 1,
      fps: actionConfig.fps || 8,
      anchorX: 16,
      anchorY: 28,
      loop: actionConfig.loop ?? ["idle", "hover", "fly", "working", "thinking"].includes(actionName),
      frameEvents: {},
      flip: false,
    };

    report.push({ action: actionName, status: "provided", frames: frameFiles.length });
  }

  // Add fallback actions for missing ones
  const allActions = [
    "idle", "fly", "hover", "nimbus_ride",
    "punch_1", "punch_2", "punch_3", "kick_1", "kick_2", "uppercut", "block",
    "kamehameha_charge", "kamehameha_fire", "kaioken",
    "laugh", "scroll_unroll", "peek", "stretch", "drink", "thinking", "done", "drag", "sleep",
    "working", "confused", "eat", "train", "scratch_head", "yawn", "stomach_growl", "look_around", "spar",
  ];

  for (const action of allActions) {
    if (!actionsJson[action]) {
      report.push({ action, status: "fallback", frames: 0 });
    }
  }

  // Write actions.json
  fs.writeFileSync(
    path.join(packPath, "actions.json"),
    JSON.stringify({ actions: actionsJson }, null, 2)
  );

  // Run validation
  const { validatePack } = await import("./validate-pack");
  const validation = validatePack(packPath);

  if (!validation.valid) {
    console.warn("Pack validation warnings:");
    for (const error of validation.errors) {
      console.warn(`  - ${error}`);
    }
  }

  return { success: true, report, packPath };
}

/**
 * Generate a map from folder contents.
 */
async function generateMapFromFolder(folder: string): Promise<ImportMap> {
  const files = fs.readdirSync(folder)
    .filter((f) => f.endsWith(".png") || f.endsWith(".gif") || f.endsWith(".jpg"))
    .sort(naturalSort);

  // Simple heuristic: group by prefix
  const groups: Record<string, string[]> = {};
  for (const file of files) {
    const prefix = file.split("_")[0];
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(file);
  }

  const actions: ImportMap["actions"] = {};
  for (const prefix of Object.keys(groups)) {
    actions[prefix] = { frames: [prefix + "_*.png"] };
  }

  return { facing: "right", actions };
}

/**
 * Resolve a wildcard pattern to matching files.
 */
function resolveWildcard(folder: string, pattern: string): string[] {
  const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
  return fs.readdirSync(folder)
    .filter((f) => regex.test(f))
    .map((f) => path.join(folder, f));
}

/**
 * Natural sort comparison (frame2 before frame10).
 */
function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const sourceFolder = args[0];

  if (!sourceFolder) {
    console.error("Usage: npm run import-pack <source-folder> [--map map.json] [--name <pack-name>]");
    process.exit(1);
  }

  let mapPath: string | undefined;
  let packName: string | undefined;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--map" && args[i + 1]) {
      mapPath = args[i + 1];
      i++;
    } else if (args[i] === "--name" && args[i + 1]) {
      packName = args[i + 1];
      i++;
    }
  }

  importPack(sourceFolder, mapPath, packName)
    .then((result) => {
      console.log("Pack Import Report:");
      console.log("====================");
      for (const item of result.report) {
        console.log(`  [${item.status.toUpperCase()}] ${item.action}: ${item.frames} frames`);
      }
      console.log("====================");
      if (result.packPath) {
        console.log(`Pack imported to: ${result.packPath}`);
      }
    })
    .catch((error) => {
      console.error("Import failed:", error);
      process.exit(1);
    });
}
