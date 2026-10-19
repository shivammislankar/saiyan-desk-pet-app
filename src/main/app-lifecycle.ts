/**
 * Application lifecycle management.
 * Handles startup, shutdown, display changes, and data directory configuration.
 */

import { app, ipcMain, screen, Tray, Menu } from "electron";
import { WindowManager } from "./window-manager";
import { createTrayIcon } from "./tray-icon";
import { SettingsService } from "../services/settings-service";

export class AppLifecycle {
  private windowManager: WindowManager;
  private settingsService: SettingsService;
  private tray: Tray | null = null;
  private isShuttingDown: boolean = false;

  constructor(windowManager: WindowManager, settingsService: SettingsService) {
    this.windowManager = windowManager;
    this.settingsService = settingsService;
  }

  /**
   * Initialize lifecycle management.
   */
  initialize(): void {
    this.setupDisplayChangeListener();
    this.setupTray();
  }

  /**
   * Set up display change listeners.
   */
  private setupDisplayChangeListener(): void {
    screen.on("display-added", () => {
      console.log("Display added");
      this.handleDisplayChange();
    });

    screen.on("display-removed", () => {
      console.log("Display removed");
      this.handleDisplayChange();
    });

    screen.on("display-metrics-changed", () => {
      console.log("Display metrics changed");
      this.handleDisplayChange();
    });
  }

  /**
   * Handle display configuration changes.
   */
  private handleDisplayChange(): void {
    // Ensure the sprite window is still on a valid display
    const spriteWindow = this.windowManager.getSpriteWindow();
    if (!spriteWindow) return;

    const windowBounds = spriteWindow.getBounds();
    const displays = screen.getAllDisplays();

    // Check if the window is still on a valid display
    const onValidDisplay = displays.some((display) => {
      const { bounds } = display;
      return (
        windowBounds.x >= bounds.x &&
        windowBounds.x < bounds.x + bounds.width &&
        windowBounds.y >= bounds.y &&
        windowBounds.y < bounds.y + bounds.height
      );
    });

    if (!onValidDisplay) {
      // Move to primary display
      const primary = screen.getPrimaryDisplay();
      const { workArea } = primary;
      spriteWindow.setPosition(
        Math.round(workArea.x + workArea.width / 2 - windowBounds.width / 2),
        Math.round(workArea.y + workArea.height / 2 - windowBounds.height / 2)
      );
    }
  }

  /**
   * Set up the system tray.
   */
  private setupTray(): void {
    const icon = createTrayIcon();
    if (icon.isEmpty()) {
      console.warn("Tray icon failed to load; the tray menu may be hard to find");
    }

    this.tray = new Tray(icon);
    this.tray.setToolTip("Saiyan Desk Pet (click for Sound and Quit)");

    this.tray.setContextMenu(this.buildTrayMenu());
    // Left-click shows the same menu (the settings window isn't built yet).
    this.tray.on("click", () => this.tray?.popUpContextMenu());
  }

  private buildTrayMenu(): Menu {
    return Menu.buildFromTemplate([
      { label: "Show Settings", click: () => this.openSettings() },
      { type: "separator" },
      {
        label: "Sound",
        type: "checkbox",
        checked: this.settingsService.getSettings().sound,
        click: (item) => void this.setSound(item.checked),
      },
      { label: "Pause Animations (coming soon)", enabled: false, click: () => this.togglePause() },
      { label: "Quit", click: () => app.quit() },
    ]);
  }

  /** Sound on/off (SPEC: off by default, with an immediate mute control). */
  private async setSound(on: boolean): Promise<void> {
    try {
      await this.settingsService.updateSetting("sound", on);
      this.windowManager.notifySettingsUpdate();
    } catch (error) {
      console.error("Failed to change sound setting:", error);
    }
    this.tray?.setContextMenu(this.buildTrayMenu());
  }

  /**
   * Open the settings window.
   */
  private openSettings(): void {
    // Settings window will be implemented in Phase 4
    console.log("Open settings - not yet implemented");
  }

  /**
   * Toggle pause state.
   */
  private togglePause(): void {
    console.log("Toggle pause - not yet implemented");
  }

  /**
   * Register the data directory IPC handler.
   */
  registerDataDirHandler(): void {
    ipcMain.handle("app:get-data-dir", () => {
      return {
        userData: app.getPath("userData"),
        dataDir: this.settingsService.getDataDirectory(),
      };
    });
  }

  /**
   * Clean up resources on shutdown.
   */
  shutdown(): void {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    // Destroy tray
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }

    // Save settings
    this.settingsService.shutdown();

    // Clean up windows
    this.windowManager.shutdown();
  }
}
