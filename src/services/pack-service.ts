/**
 * Pack service: manages sprite packs, including discovery, validation, and selection.
 */

import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { SettingsService } from "./settings-service";

export interface PackInfo {
  id: string;
  name: string;
  author: string;
  version: string;
  path: string;
}

export interface BeamEffect {
  /** Absolute path of the beam PNG (validated to be inside the pack). */
  imagePath: string;
  /** Beam attach point (hand end, on its axis) in beam-image px. */
  originX: number;
  originY: number;
}

export class PackService {
  private settingsService: SettingsService;
  private packsFolder: string = "";
  private availablePacks: PackInfo[] = [];
  private activePackId: string = "default";
  // Packs found in the project's own packs/ folder (e.g. built by
  // scripts/build-hd-pack.py). Git-ignored; synced into the data folder.
  private localPackIds: string[] = [];
  private localPacksRoot: string = "";

  constructor(settingsService: SettingsService) {
    this.settingsService = settingsService;
  }

  /**
   * Initialize the pack service.
   */
  async initialize(): Promise<void> {
    const dataDir = this.settingsService.getDataDirectory();
    this.packsFolder = path.join(dataDir, "packs");

    // Ensure packs folder exists
    if (!fs.existsSync(this.packsFolder)) {
      fs.mkdirSync(this.packsFolder, { recursive: true });
    }

    // Create default pack
    await this.createDefaultPack();

    // Copy packs from the project's packs/ folder into the data folder
    this.syncLocalPacks();

    // Discover packs
    this.discoverPacks();

    // Active pack: an explicit choice in settings wins. While the setting is
    // still "default", the most recently built local pack from packs/ is used.
    const chosen = this.settingsService.getSettings().spritePack || "default";
    const available = (id: string) => this.availablePacks.some((p) => p.id === id);
    if (chosen !== "default" && available(chosen)) {
      this.activePackId = chosen;
    } else {
      const newest = this.localPackIds
        .filter(available)
        .map((id) => ({ id, t: this.packBuiltAt(id) }))
        .sort((a, b) => b.t - a.t)[0];
      this.activePackId = newest?.id ?? "default";
    }
    console.log(`Active sprite pack: ${this.activePackId}`);
  }

  /**
   * Create the built-in default pack.
   */
  private async createDefaultPack(): Promise<void> {
    const defaultPackPath = path.join(this.packsFolder, "default");

    if (!fs.existsSync(defaultPackPath)) {
      fs.mkdirSync(defaultPackPath, { recursive: true });
    }

    const packJsonPath = path.join(defaultPackPath, "pack.json");
    if (!fs.existsSync(packJsonPath)) {
      // Write pack.json
      const packJson = {
        name: "Default (Placeholder)",
        author: "saiyan-desk-pet contributors",
        version: "1.0.0",
        license: "MIT",
        facing: "right",
      };
      fs.writeFileSync(packJsonPath, JSON.stringify(packJson, null, 2));
    }

    const actionsJsonPath = path.join(defaultPackPath, "actions.json");
    if (!fs.existsSync(actionsJsonPath)) {
      // Write actions.json with placeholder actions
      const actionsJson = this.generatePlaceholderActions();
      fs.writeFileSync(actionsJsonPath, JSON.stringify(actionsJson, null, 2));
    }

    // Sync bundled art into the managed default pack: actions.json plus every
    // sheet it references. Repairs old installs that only have placeholder.json.
    try {
      const assetRoots = [
        path.join(app.getAppPath(), "assets", "goku"),
        path.join(__dirname, "..", "..", "assets", "goku"),
      ];
      const assetRoot = assetRoots.find((r) => fs.existsSync(path.join(r, "actions.json")));
      if (assetRoot) {
        const manifest = JSON.parse(
          fs.readFileSync(path.join(assetRoot, "actions.json"), "utf-8")
        ) as { actions: Record<string, { sheet?: string }> };
        const sheets = new Set(
          Object.values(manifest.actions)
            .map((a) => a.sheet)
            .filter((s): s is string => typeof s === "string")
        );
        fs.copyFileSync(
          path.join(assetRoot, "actions.json"),
          path.join(defaultPackPath, "actions.json")
        );
        // pack.json carries rendering mode and effects (Kamehameha beam).
        const bundledPackJson = path.join(assetRoot, "pack.json");
        if (fs.existsSync(bundledPackJson)) {
          fs.copyFileSync(bundledPackJson, packJsonPath);
          const beam = JSON.parse(fs.readFileSync(bundledPackJson, "utf-8"))?.effects?.kamehameha?.image;
          if (typeof beam === "string" && !beam.includes("..")) sheets.add(beam);
        }
        for (const sheet of sheets) {
          const src = path.join(assetRoot, sheet);
          const dest = path.join(defaultPackPath, sheet);
          if (fs.existsSync(src)) {
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(src, dest);
          } else {
            console.warn(`Default pack references missing sheet: ${sheet}`);
          }
        }
        console.log(`Synced default pack (${sheets.size} sheets)`);
      }
    } catch (error) {
      console.warn("Failed to sync default pack art:", error);
    }
  }

  /**
   * Copy each pack in <app>/packs/<id>/ (pack.json + actions.json + PNGs only)
   * into the data folder's packs/. Data only: no other file types are copied,
   * and nothing outside the pack folder is followed.
   */
  private syncLocalPacks(): void {
    const roots = [
      // Installed app: packs shipped as extra resources next to app.asar.
      ...(app.isPackaged ? [path.join(process.resourcesPath, "packs")] : []),
      // Running from source.
      path.join(app.getAppPath(), "packs"),
      path.join(__dirname, "..", "..", "packs"),
    ];
    const root = roots.find((r) => fs.existsSync(r));
    if (!root) return;
    this.localPacksRoot = root;

    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "default") continue;
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(entry.name)) continue;
      const src = path.join(root, entry.name);
      if (!fs.existsSync(path.join(src, "pack.json")) || !fs.existsSync(path.join(src, "actions.json"))) continue;
      const dest = path.join(this.packsFolder, entry.name);
      try {
        this.copyPackFiles(src, dest, src);
        this.localPackIds.push(entry.name);
        console.log(`Synced local pack "${entry.name}"`);
      } catch (error) {
        console.warn(`Failed to sync local pack "${entry.name}":`, error);
      }
    }
  }

  private packBuiltAt(id: string): number {
    try {
      // Source copy in packs/: data-folder copies all get "now" as mtime.
      return fs.statSync(path.join(this.localPacksRoot, id, "actions.json")).mtimeMs;
    } catch {
      return 0;
    }
  }

  private copyPackFiles(src: string, dest: string, packRoot: string): void {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const from = path.join(src, entry.name);
      if (!path.resolve(from).startsWith(path.resolve(packRoot) + path.sep)) continue;
      const to = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyPackFiles(from, to, packRoot);
      } else if (entry.isFile() && /\.(png|json)$/i.test(entry.name)) {
        fs.copyFileSync(from, to);
      }
    }
  }

  /**
   * Generate placeholder action manifests.
   */
  private generatePlaceholderActions(): { actions: Record<string, unknown> } {
    const actions: Record<string, unknown> = {};
    const actionNames = [
      "idle", "fly", "hover", "nimbus_ride",
      "punch_1", "punch_2", "punch_3", "kick_1", "kick_2", "uppercut", "block",
      "kamehameha_charge", "kamehameha_fire", "kaioken",
      "laugh", "scroll_unroll", "peek", "stretch", "drink", "thinking", "done", "drag", "sleep",
      "working", "confused", "eat", "train", "scratch_head", "yawn", "stomach_growl", "look_around", "spar",
    ];

    for (const name of actionNames) {
      actions[name] = {
        sheet: "sprites/placeholder.png",
        frameWidth: 32,
        frameHeight: 32,
        frameCount: 4,
        framesPerRow: 4,
        fps: 8,
        anchorX: 16,
        anchorY: 28,
        loop: ["idle", "hover", "fly", "working", "thinking"].includes(name),
        frameEvents: {},
        flip: false,
      };
    }

    return { actions };
  }

  /**
   * Discover available packs.
   */
  private discoverPacks(): void {
    this.availablePacks = [];

    // Always include default pack
    this.availablePacks.push({
      id: "default",
      name: "Default (Placeholder)",
      author: "saiyan-desk-pet contributors",
      version: "1.0.0",
      path: path.join(this.packsFolder, "default"),
    });

    // Discover user packs
    try {
      const entries = fs.readdirSync(this.packsFolder, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === "default") continue;

        const packPath = path.join(this.packsFolder, entry.name);
        const packJsonPath = path.join(packPath, "pack.json");

        if (!fs.existsSync(packJsonPath)) continue;

        try {
          const packJson = JSON.parse(fs.readFileSync(packJsonPath, "utf-8"));
          this.availablePacks.push({
            id: entry.name,
            name: packJson.name || entry.name,
            author: packJson.author || "",
            version: packJson.version || "1.0.0",
            path: packPath,
          });
        } catch (error) {
          console.warn(`Failed to parse pack.json for ${entry.name}:`, error);
        }
      }
    } catch (error) {
      console.error("Failed to discover packs:", error);
    }
  }

  /**
   * Get all available packs.
   */
  getAvailablePacks(): { packs: PackInfo[]; active: string } {
    return {
      packs: [...this.availablePacks],
      active: this.activePackId,
    };
  }

  /**
   * Select a pack.
   */
  async selectPack(packId: string): Promise<{ success: boolean; error?: string }> {
    const pack = this.availablePacks.find((p) => p.id === packId);
    if (!pack) {
      return { success: false, error: `Pack not found: ${packId}` };
    }

    try {
      await this.settingsService.updateSetting("spritePack", packId);
      this.activePackId = packId;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get the packs folder path.
   */
  getPacksFolderPath(): string {
    return this.packsFolder;
  }

  /**
   * The active pack's Kamehameha beam, if it has one. pack.json is untrusted:
   * the image must be a .png path inside the pack folder, numbers must be sane.
   */
  getKamehamehaEffect(): BeamEffect | null {
    try {
      const packPath = this.getActivePackPath();
      const manifest = JSON.parse(fs.readFileSync(path.join(packPath, "pack.json"), "utf-8"));
      const e = manifest?.effects?.kamehameha;
      if (!e || typeof e.image !== "string") return null;
      if (!/^[A-Za-z0-9_\-/]{1,200}\.png$/.test(e.image) || e.image.includes("..")) return null;
      const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 4096;
      if (!num(e.originX) || !num(e.originY)) return null;
      const imagePath = path.resolve(packPath, e.image);
      if (!imagePath.startsWith(path.resolve(packPath) + path.sep)) return null;
      if (!fs.existsSync(imagePath) || fs.lstatSync(imagePath).isSymbolicLink()) return null;
      return { imagePath, originX: e.originX, originY: e.originY };
    } catch {
      return null;
    }
  }

  /**
   * Get the active pack path.
   */
  getActivePackPath(): string {
    const pack = this.availablePacks.find((p) => p.id === this.activePackId);
    return pack?.path || path.join(this.packsFolder, "default");
  }
}
