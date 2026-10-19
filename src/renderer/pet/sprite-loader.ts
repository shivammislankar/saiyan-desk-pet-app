/**
 * Sprite loader: loads and caches sprite sheets and action manifests.
 * Uses XMLHttpRequest for file:// protocol support in Electron.
 */

import type { SpriteAction, SpritePack } from "../../core/types";

export interface LoadedSpriteSheet {
  image: HTMLImageElement;
  width: number;
  height: number;
}

export class SpriteLoader {
  private cache: Map<string, LoadedSpriteSheet> = new Map();
  private pending: Map<string, Promise<LoadedSpriteSheet>> = new Map();
  private packs: Map<string, SpritePack> = new Map();
  private activePack: SpritePack | null = null;

  /**
   * Convert a filesystem path to a file:// URL (handles Windows backslashes).
   */
  private toFileUrl(filePath: string): string {
    return "file:///" + filePath.replace(/\\/g, "/");
  }

  /**
   * Load a JSON file using XMLHttpRequest (supports file:// protocol).
   */
  private loadJsonFile<T>(filePath: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", this.toFileUrl(filePath), true);
      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 0) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error(`Failed to parse JSON from ${filePath}`));
          }
        } else {
          reject(new Error(`Failed to load ${filePath}: status ${xhr.status}`));
        }
      };
      xhr.onerror = () => {
        reject(new Error(`Network error loading ${filePath}`));
      };
      xhr.send();
    });
  }

  /**
   * Load a sprite pack from a folder path.
   */
  async loadPack(packId: string, packPath: string): Promise<SpritePack> {
    if (this.packs.has(packId)) {
      this.activePack = this.packs.get(packId)!;
      return this.activePack;
    }

    try {
      const manifest = await this.loadJsonFile<Record<string, unknown>>(`${packPath}/pack.json`);
      const actionsData = await this.loadJsonFile<{ actions: Record<string, unknown> }>(`${packPath}/actions.json`);

      const pack: SpritePack = {
        id: packId,
        name: (manifest.name as string) || packId,
        author: (manifest.author as string) || "",
        version: (manifest.version as string) || "1.0.0",
        license: (manifest.license as string) || "",
        facing: (manifest.facing as "left" | "right") || "right",
        rendering: manifest.rendering === "smooth" ? "smooth" : "pixelated",
        displayScale:
          typeof manifest.displayScale === "number" &&
          manifest.displayScale >= 0.25 &&
          manifest.displayScale <= 8
            ? manifest.displayScale
            : undefined,
        kamehameha: this.parseKamehameha(manifest),
        actions: {},
        imageCache: new Map(),
      };

      // Load every action's sheet. One missing/broken sheet must not take the
      // whole pack down: that action is skipped and falls back at draw time.
      const entries = Object.entries(actionsData.actions);
      const results = await Promise.allSettled(
        entries.map(([, actionData]) =>
          this.loadSpriteSheet(`${packPath}/${(actionData as SpriteAction).sheet}`)
        )
      );
      entries.forEach(([actionName, actionData], i) => {
        const result = results[i];
        if (result.status === "fulfilled") {
          pack.actions[actionName] = actionData as SpriteAction;
          pack.imageCache.set(actionName, result.value.image);
        } else {
          console.warn(`Skipping action "${actionName}": ${String(result.reason)}`);
        }
      });

      this.packs.set(packId, pack);
      this.activePack = pack;
      console.log(`Loaded pack "${packId}" with ${Object.keys(pack.actions).length} actions`);
      return pack;
    } catch (error) {
      console.error(`Failed to load pack "${packId}":`, error);
      throw error;
    }
  }

  private parseKamehameha(manifest: Record<string, unknown>): { handX: number; handY: number } | undefined {
    const effects = manifest.effects as Record<string, unknown> | undefined;
    const k = effects?.kamehameha as Record<string, unknown> | undefined;
    const ok = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 4096;
    return k && ok(k.handX) && ok(k.handY) ? { handX: k.handX, handY: k.handY } : undefined;
  }

  /**
   * Load a sprite sheet image.
   */
  async loadSpriteSheet(sheetPath: string): Promise<LoadedSpriteSheet> {
    if (this.cache.has(sheetPath)) {
      return this.cache.get(sheetPath)!;
    }
    // Actions often share a sheet and are loaded in parallel: reuse the load.
    const pending = this.pending.get(sheetPath);
    if (pending) return pending;
    const load = this.loadImage(sheetPath).finally(() => this.pending.delete(sheetPath));
    this.pending.set(sheetPath, load);
    return load;
  }

  private loadImage(sheetPath: string): Promise<LoadedSpriteSheet> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const sheet: LoadedSpriteSheet = {
          image: img,
          width: img.naturalWidth,
          height: img.naturalHeight,
        };
        this.cache.set(sheetPath, sheet);
        console.log(`Loaded sprite sheet: ${sheetPath} (${sheet.width}x${sheet.height})`);
        resolve(sheet);
      };
      img.onerror = () => {
        console.error(`Failed to load sprite sheet: ${sheetPath}`);
        reject(new Error(`Failed to load sprite sheet: ${sheetPath}`));
      };
      img.src = this.toFileUrl(sheetPath);
    });
  }

  getActivePack(): SpritePack | null {
    return this.activePack;
  }

  /**
   * The sheet image for an action (each action can live on its own sheet).
   */
  getSheet(actionName: string): HTMLImageElement | null {
    if (!this.activePack) return null;
    return this.activePack.imageCache.get(actionName) ?? null;
  }

  getAction(actionName: string): SpriteAction | null {
    if (!this.activePack) return null;
    return this.activePack.actions[actionName] || null;
  }

  getFallbackAction(requestedAction: string): SpriteAction | null {
    if (!this.activePack) return null;
    const action = this.activePack.actions[requestedAction];
    if (action) return action;

    const fallbacks: Record<string, string[]> = {
      nimbus_ride: ["hover", "idle"],
      kamehameha_charge: ["punch_1", "idle"],
      kamehameha_fire: ["punch_1", "idle"],
      kaioken: ["hover", "idle"],
      sleep: ["idle"],
      thinking: ["idle"],
      working: ["idle"],
      done: ["idle"],
      confused: ["idle"],
      scroll_unroll: ["idle"],
      drink: ["idle"],
      eat: ["idle"],
      stretch: ["idle"],
      laugh: ["idle"],
      yawn: ["idle"],
      scratch_head: ["idle"],
      stomach_growl: ["idle"],
      look_around: ["idle"],
      spar: ["idle"],
    };

    const fallbackChain = fallbacks[requestedAction] || ["idle"];
    for (const fallback of fallbackChain) {
      const fallbackAction = this.activePack.actions[fallback];
      if (fallbackAction) return fallbackAction;
    }
    return null;
  }

  clearCache(): void {
    this.cache.clear();
    this.packs.clear();
    this.activePack = null;
  }
}
