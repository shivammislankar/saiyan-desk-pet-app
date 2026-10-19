/**
 * Settings service: manages persistent configuration with validation and migration.
 */

import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import {
  settingsSchema,
  defaultSettings,
  positionSchema,
  type PositionData,
  type Settings,
} from "../shared/schemas";

export class SettingsService {
  private settings: Settings = { ...defaultSettings };
  private settingsPath: string = "";
  private backupPath: string = "";
  private dataDirectory: string = "";
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize the settings service.
   */
  async initialize(): Promise<void> {
    this.dataDirectory = this.resolveDataDirectory();
    this.settingsPath = path.join(this.dataDirectory, "settings.json");
    this.backupPath = path.join(this.dataDirectory, "settings.json.bak");

    await this.loadSettings();
    this.isInitialized = true;
  }

  /**
   * Resolve the data directory based on environment variables and portable mode.
   */
  private resolveDataDirectory(): string {
    // Check for environment variable override
    const envDir = process.env.GOKUPET_DATA_DIR;
    if (envDir) {
      return path.resolve(envDir);
    }

    // Check for portable mode (portable.flag next to executable)
    const exeDir = path.dirname(app.getPath("exe"));
    const portableFlag = path.join(exeDir, "portable.flag");
    if (fs.existsSync(portableFlag)) {
      return path.join(exeDir, "data");
    }

    // Default: use Electron's userData path
    return app.getPath("userData");
  }

  /**
   * Get the data directory path.
   */
  getDataDirectory(): string {
    return this.dataDirectory;
  }

  /**
   * Load settings from disk.
   */
  // Default scale increased by 50% from 2 to 3
  static readonly DEFAULT_SCALE = 3;

  private async loadSettings(): Promise<void> {
    try {
      // Ensure data directory exists
      if (!fs.existsSync(this.dataDirectory)) {
        fs.mkdirSync(this.dataDirectory, { recursive: true });
      }

      if (!fs.existsSync(this.settingsPath)) {
        // First run: create default settings with increased scale
        this.settings = { ...defaultSettings, scale: SettingsService.DEFAULT_SCALE };
        await this.writeSettings(this.settings);
        return;
      }

      const raw = fs.readFileSync(this.settingsPath, "utf-8");
      const parsed = JSON.parse(raw);

      // Validate and migrate
      const result = settingsSchema.safeParse(parsed);
      if (result.success) {
        // Auto-migrate: if scale is 2 (old default), upgrade to 3
        if (this.settings.scale === 2) {
          this.settings.scale = SettingsService.DEFAULT_SCALE;
          await this.writeSettings(this.settings);
        }
        this.settings = result.data;
      } else {
        console.warn("Invalid settings, using defaults:", result.error.message);
        // Try to migrate or recover
        this.settings = await this.attemptRecovery(parsed);
        await this.writeSettings(this.settings);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      this.settings = { ...defaultSettings, scale: SettingsService.DEFAULT_SCALE };
    }
  }

  /**
   * Attempt to recover from corrupted settings.
   */
  private async attemptRecovery(corrupted: unknown): Promise<Settings> {
    // Try to preserve any valid fields from the corrupted settings
    if (typeof corrupted === "object" && corrupted !== null) {
      const partial = corrupted as Record<string, unknown>;
      const recovered: Record<string, unknown> = { ...defaultSettings };

      // Copy over any valid-looking fields
      for (const key of Object.keys(defaultSettings)) {
        if (key in partial) {
          recovered[key] = partial[key];
        }
      }

      const result = settingsSchema.safeParse(recovered);
      if (result.success) {
        return result.data;
      }
    }

    return { ...defaultSettings };
  }

  /**
   * Write settings to disk atomically.
   */
  private async writeSettings(settings: Settings): Promise<void> {
    try {
      // Write to temp file first
      const tempPath = `${this.settingsPath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2), "utf-8");

      // Backup existing settings
      if (fs.existsSync(this.settingsPath)) {
        fs.copyFileSync(this.settingsPath, this.backupPath);
      }

      // Rename temp to final
      fs.renameSync(tempPath, this.settingsPath);
    } catch (error) {
      console.error("Failed to write settings:", error);
      throw error;
    }
  }

  /**
   * Get current settings.
   */
  getSettings(): Settings {
    return { ...this.settings };
  }

  /**
   * Validate settings data.
   */
  validateSettings(data: unknown): { success: true; data: Settings } | { success: false; error: string } {
    const result = settingsSchema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error.message };
  }

  /**
   * Save settings with debouncing.
   */
  async saveSettings(settings: Settings): Promise<void> {
    this.settings = { ...settings };

    // Debounce writes
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      try {
        await this.writeSettings(this.settings);
      } catch (error) {
        console.error("Failed to save settings:", error);
      }
    }, 500);
  }

  /**
   * Update a single setting.
   */
  async updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    const updated = { ...this.settings, [key]: value };
    const result = settingsSchema.safeParse(updated);
    if (result.success) {
      await this.saveSettings(result.data);
    } else {
      throw new Error(`Invalid setting: ${result.error.message}`);
    }
  }

  /**
   * Load the persisted pet position (normalized + display id), if valid.
   */
  loadPosition(): PositionData | null {
    try {
      const positionPath = path.join(this.dataDirectory, "position.json");
      if (!fs.existsSync(positionPath)) return null;
      const parsed = JSON.parse(fs.readFileSync(positionPath, "utf-8"));
      const result = positionSchema.safeParse(parsed);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  /**
   * Persist the pet position atomically (called on drag end / settle, not per frame).
   */
  savePosition(position: PositionData): void {
    try {
      const result = positionSchema.safeParse(position);
      if (!result.success) return;
      const positionPath = path.join(this.dataDirectory, "position.json");
      const tempPath = `${positionPath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(result.data), "utf-8");
      fs.renameSync(tempPath, positionPath);
    } catch (error) {
      console.error("Failed to save position:", error);
    }
  }

  /**
   * Clean up resources.
   */
  shutdown(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    // Final save
    if (this.isInitialized) {
      this.writeSettings(this.settings).catch(console.error);
    }
  }
}
