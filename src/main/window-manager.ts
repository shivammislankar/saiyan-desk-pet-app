/**
 * Window manager: creates and manages the transparent sprite window and overlay windows.
 */

import { BrowserWindow, screen, ipcMain } from "electron";
import * as path from "path";
import { SettingsService } from "../services/settings-service";
import { PackService } from "../services/pack-service";
import type { OverlayShowPayload, OverlayHidePayload } from "../shared/ipc-contracts";

export class WindowManager {
  private settingsService: SettingsService;
  private packService: PackService;
  private spriteWindow: BrowserWindow | null = null;
  private overlayWindows: Map<string, BrowserWindow> = new Map();

  constructor(settingsService: SettingsService, packService: PackService) {
    this.settingsService = settingsService;
    this.packService = packService;
  }

  /**
   * Initialize the window manager and create the sprite window.
   */
  async initialize(): Promise<void> {
    this.createSpriteWindow();
    this.setupOverlayIpc();
  }

  /**
   * Create the transparent, frameless sprite window.
   */
  private createSpriteWindow(): void {
    const primaryDisplay = screen.getPrimaryDisplay();

    // Position on primary display by default
    const { workArea } = primaryDisplay;
    const windowWidth = 256;
    const windowHeight = 256;
    const startX = Math.round(workArea.x + workArea.width / 2 - windowWidth / 2);
    const startY = Math.round(workArea.y + workArea.height / 2 - windowHeight / 2);

    this.spriteWindow = new BrowserWindow({
      x: startX,
      y: startY,
      width: windowWidth,
      height: windowHeight,
      transparent: true,
      frame: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, "../preload/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    // Set always-on-top level
    this.spriteWindow.setAlwaysOnTop(true, "screen-saver");

    // Click behavior: the window captures mouse events so the renderer's
    // hit-testing can decide which clicks start drags vs pass through.
    // Transparent regions of the 256px window still capture clicks (known
    // limitation §5.2) rather than forwarding — this preserves drag initiation.
    this.spriteWindow.setIgnoreMouseEvents(false);

    // Restore last position if the display still exists, else stay centered.
    this.restorePosition();

    // Load the renderer
    const rendererPath = path.join(__dirname, "../renderer/pet/index.html");
    this.spriteWindow.loadFile(rendererPath);

    // Handle window events
    this.spriteWindow.on("closed", () => {
      this.spriteWindow = null;
    });

    // Forward renderer console messages to the main-process terminal
    // Electron 34+ puts the details on the event object; older versions pass
    // them as positional arguments (now deprecated). Accept both so a stale
    // node_modules can't break the build.
    (this.spriteWindow.webContents as unknown as NodeJS.EventEmitter).on(
      "console-message",
      (...args: unknown[]) => {
        const e = (args[0] ?? {}) as { message?: string; sourceId?: string; lineNumber?: number };
        const message = e.message ?? args[2];
        const line = e.lineNumber ?? args[3];
        const source = e.sourceId ?? args[4];
        console.log(`[renderer] ${String(message)} (${String(source)}:${String(line)})`);
      }
    );

    // Prevent context menu
    this.spriteWindow.webContents.on("context-menu", (e) => {
      e.preventDefault();
    });

    // Handle focus events - never steal focus
    this.spriteWindow.on("focus", () => {
      // Release focus immediately if we somehow got it
      this.spriteWindow?.blur();
    });
  }

  private dragTimer: ReturnType<typeof setInterval> | null = null;
  private dragOffset = { x: 0, y: 0 };
  private dragHistory: Array<{ x: number; y: number; time: number }> = [];
  private inertiaTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Begin a drag: follow the cursor until petDragEnd().
   */
  petDragStart(): void {
    const win = this.spriteWindow;
    if (!win || win.isDestroyed()) return;
    this.stopInertia();

    const cursor = screen.getCursorScreenPoint();
    const [wx, wy] = win.getPosition();
    this.dragOffset = { x: cursor.x - wx, y: cursor.y - wy };
    this.dragHistory = [{ x: cursor.x, y: cursor.y, time: Date.now() }];

    if (this.dragTimer) clearInterval(this.dragTimer);
    this.dragTimer = setInterval(() => {
      if (!this.spriteWindow || this.spriteWindow.isDestroyed()) return;
      const c = screen.getCursorScreenPoint();
      this.spriteWindow.setPosition(
        Math.round(c.x - this.dragOffset.x),
        Math.round(c.y - this.dragOffset.y)
      );
      this.dragHistory.push({ x: c.x, y: c.y, time: Date.now() });
      const cutoff = Date.now() - 200;
      this.dragHistory = this.dragHistory.filter((h) => h.time >= cutoff);
    }, 16);
  }

  /**
   * End a drag: throw with estimated release velocity, then settle + persist.
   */
  petDragEnd(): void {
    if (this.dragTimer) {
      clearInterval(this.dragTimer);
      this.dragTimer = null;
    }
    const win = this.spriteWindow;
    if (!win || win.isDestroyed()) return;

    const velocity = this.estimateDragVelocity();
    this.dragHistory = [];
    this.runInertia(velocity);
  }

  private estimateDragVelocity(): { x: number; y: number } {
    const h = this.dragHistory;
    if (h.length < 2) return { x: 0, y: 0 };
    const first = h[0];
    const last = h[h.length - 1];
    const dt = (last.time - first.time) / 1000;
    if (dt <= 0) return { x: 0, y: 0 };
    const vx = (last.x - first.x) / dt;
    const vy = (last.y - first.y) / dt;
    // Clamp absurd values from event bursts.
    const max = 3000;
    return {
      x: Math.max(-max, Math.min(max, vx)),
      y: Math.max(-max, Math.min(max, vy)),
    };
  }

  private runInertia(velocity: { x: number; y: number }): void {
    this.stopInertia();
    let { x: vx, y: vy } = velocity;
    if (Math.hypot(vx, vy) < 10) {
      this.persistPosition();
      return;
    }
    let last = Date.now();
    this.inertiaTimer = setInterval(() => {
      const win = this.spriteWindow;
      if (!win || win.isDestroyed()) {
        this.stopInertia();
        return;
      }
      const now = Date.now();
      const dt = Math.min(100, Math.max(0, now - last)) / 1000;
      last = now;

      // Exponential air friction, no gravity (hover model).
      const decay = Math.exp(-3 * dt);
      vx *= decay;
      vy *= decay;

      const [wx, wy] = win.getPosition();
      let nx = wx + vx * dt;
      let ny = wy + vy * dt;

      // Soft bounce inside the current display's work area.
      const display =
        screen.getDisplayNearestPoint({ x: Math.round(nx), y: Math.round(ny) }) ??
        screen.getPrimaryDisplay();
      const wa = display.workArea;
      const bounds = win.getBounds();
      const minX = wa.x;
      const maxX = wa.x + wa.width - bounds.width;
      const minY = wa.y;
      const maxY = wa.y + wa.height - bounds.height;
      if (nx < minX) {
        nx = minX;
        vx = Math.abs(vx) * 0.6;
      } else if (nx > maxX) {
        nx = maxX;
        vx = -Math.abs(vx) * 0.6;
      }
      if (ny < minY) {
        ny = minY;
        vy = Math.abs(vy) * 0.6;
      } else if (ny > maxY) {
        ny = maxY;
        vy = -Math.abs(vy) * 0.6;
      }

      win.setPosition(Math.round(nx), Math.round(ny));

      if (Math.hypot(vx, vy) < 10) {
        this.stopInertia();
        this.persistPosition();
      }
    }, 16);
  }

  private stopInertia(): void {
    if (this.inertiaTimer) {
      clearInterval(this.inertiaTimer);
      this.inertiaTimer = null;
    }
  }

  private restorePosition(): void {
    const win = this.spriteWindow;
    if (!win) return;
    const saved = this.settingsService.loadPosition();
    if (!saved) return;
    const displays = screen.getAllDisplays();
    const display = displays.find((d) => d.id.toString() === saved.displayId);
    if (!display) return; // original display gone: stay centered
    const wa = display.workArea;
    const bounds = win.getBounds();
    const x = Math.round(
      Math.min(
        Math.max(wa.x + saved.normalizedX * wa.width, wa.x),
        wa.x + wa.width - bounds.width
      )
    );
    const y = Math.round(
      Math.min(
        Math.max(wa.y + saved.normalizedY * wa.height, wa.y),
        wa.y + wa.height - bounds.height
      )
    );
    win.setPosition(x, y);
  }

  private persistPosition(): void {
    const win = this.spriteWindow;
    if (!win || win.isDestroyed()) return;
    const [wx, wy] = win.getPosition();
    const display = screen.getDisplayNearestPoint({ x: wx, y: wy });
    const wa = display.workArea;
    this.settingsService.savePosition({
      displayId: display.id.toString(),
      normalizedX: Math.min(1, Math.max(0, (wx - wa.x) / wa.width)),
      normalizedY: Math.min(1, Math.max(0, (wy - wa.y) / wa.height)),
    });
  }

  /**
   * Resize the pet window (requested by the renderer when the active pack's
   * frame size changes). Keeps the feet where they were: the bottom edge and
   * horizontal centre stay put, then the window is clamped to the work area.
   */
  setPetSize(width: unknown, height: unknown): { success: boolean; error?: string } {
    const win = this.spriteWindow;
    if (!win || win.isDestroyed()) return { success: false, error: "No pet window" };
    const valid = (v: unknown): v is number =>
      typeof v === "number" && Number.isInteger(v) && v >= 64 && v <= 1024;
    if (!valid(width) || !valid(height)) return { success: false, error: "Invalid size" };

    const old = win.getBounds();
    let x = Math.round(old.x + old.width / 2 - width / 2);
    let y = old.y + old.height - height;
    const wa = screen.getDisplayNearestPoint({
      x: Math.round(old.x + old.width / 2),
      y: Math.round(old.y + old.height / 2),
    }).workArea;
    x = Math.min(Math.max(x, wa.x), wa.x + wa.width - width);
    y = Math.min(Math.max(y, wa.y), wa.y + wa.height - height);

    win.setResizable(true);
    win.setBounds({ x, y, width, height });
    win.setResizable(false);
    return { success: true };
  }

  /**
   * Set up IPC handlers for overlay windows.
   */
  private setupOverlayIpc(): void {
    ipcMain.handle("overlay:show", async (_event, payload: OverlayShowPayload) => {
      this.showOverlay(payload);
      return { success: true };
    });

    ipcMain.handle("overlay:hide", async (_event, payload: OverlayHidePayload) => {
      this.hideOverlay(payload.displayId);
      return { success: true };
    });
  }

  /**
   * Show an overlay window for a specific display.
   */
  private showOverlay(payload: OverlayShowPayload): void {
    const existing = this.overlayWindows.get(payload.displayId);
    if (existing && !existing.isDestroyed()) {
      return; // Already showing
    }

    const overlayWindow = new BrowserWindow({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      transparent: true,
      frame: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    overlayWindow.setAlwaysOnTop(true, "screen-saver");
    overlayWindow.setIgnoreMouseEvents(true);

    const overlayPath = path.join(__dirname, "../renderer/overlay/overlay.html");
    overlayWindow.loadFile(overlayPath);

    overlayWindow.webContents.on("did-finish-load", () => {
      overlayWindow.webContents.send("overlay:payload", payload);
    });

    this.overlayWindows.set(payload.displayId, overlayWindow);
  }

  /**
   * Hide an overlay window for a specific display.
   */
  private hideOverlay(displayId: string): void {
    const overlayWindow = this.overlayWindows.get(displayId);
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.destroy();
    }
    this.overlayWindows.delete(displayId);
  }

  /**
   * Notify all windows of a settings update.
   */
  notifySettingsUpdate(): void {
    if (this.spriteWindow && !this.spriteWindow.isDestroyed()) {
      this.spriteWindow.webContents.send("settings:update", {
        settings: this.settingsService.getSettings(),
      });
    }
  }

  /**
   * Get the sprite window.
   */
  getSpriteWindow(): BrowserWindow | null {
    return this.spriteWindow;
  }

  /**
   * Update the sprite window position.
   */
  setSpritePosition(x: number, y: number): void {
    if (this.spriteWindow && !this.spriteWindow.isDestroyed()) {
      this.spriteWindow.setPosition(Math.round(x), Math.round(y));
    }
  }

  /**
   * Set click-through mode for the sprite window.
   */
  setClickThrough(ignore: boolean): void {
    if (this.spriteWindow && !this.spriteWindow.isDestroyed()) {
      this.spriteWindow.setIgnoreMouseEvents(ignore, { forward: true });
    }
  }

  /**
   * Clean up all windows.
   */
  shutdown(): void {
    if (this.dragTimer) {
      clearInterval(this.dragTimer);
      this.dragTimer = null;
    }
    this.stopInertia();
    for (const overlayWindow of this.overlayWindows.values()) {
      if (!overlayWindow.isDestroyed()) {
        overlayWindow.destroy();
      }
    }
    this.overlayWindows.clear();

    if (this.spriteWindow && !this.spriteWindow.isDestroyed()) {
      this.spriteWindow.destroy();
    }
    this.spriteWindow = null;
  }
}
