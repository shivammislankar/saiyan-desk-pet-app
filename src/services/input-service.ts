/* eslint-disable no-restricted-imports */
// Privacy note: uiohook-napi is intentionally imported ONLY here (besides the
// pure normalizer). Raw keycodes never leave this file: they are converted to
// derived events by input-normalizer.ts and discarded immediately.
/**
 * Global input service (main process).
 * Listens to OS-level key edges and emits derived strike / Kamehameha
 * requests. Never logs, persists, or forwards raw key identities.
 */

import { uIOhook } from "uiohook-napi";
import { BrowserWindow, screen } from "electron";
import { normalizeKeyboardEvent } from "../core/input-normalizer";
import { KamehamehaTrigger, type KeyKind, type TriggerKey } from "../core/kamehameha-trigger";
import { SettingsService } from "./settings-service";

// Combined strikes sheet: 8 frames (punch_0..3, kick_0..3)
const STRIKE_FRAME_COUNT = 8;

export class InputService {
  private settingsService: SettingsService;
  private getWindow: () => BrowserWindow | null;
  private running = false;
  // Bounded, in-memory-only keypress timestamps for typing-rate metrics.
  private keyTimes: number[] = [];
  private kamehameha: KamehamehaTrigger;

  constructor(settingsService: SettingsService, getWindow: () => BrowserWindow | null) {
    this.settingsService = settingsService;
    this.getWindow = getWindow;
    this.kamehameha = new KamehamehaTrigger(this.kamehamehaOptions());
  }

  private kamehamehaOptions(): { trigger: TriggerKey; windowMs: number; cooldownMs: number } {
    const s = this.settingsService.getSettings();
    return {
      trigger: s.kamehamehaTrigger,
      windowMs: s.kamehamehaTiming,
      cooldownMs: s.kamehamehaCooldown,
    };
  }

  /**
   * Reduce a raw hook event to a coarse key kind. The raw event is not kept.
   */
  private keyKind(raw: unknown): { kind: KeyKind; category?: string } {
    const event = raw as { keycode?: number; rawcode?: number };
    const derived = normalizeKeyboardEvent({ keycode: event.keycode ?? event.rawcode ?? 0 });
    if (derived?.type === "modifierStateChanged") {
      const m = derived.data?.modifier;
      return { kind: m === "alt" || m === "ctrl" || m === "shift" || m === "meta" ? m : "key" };
    }
    if (derived?.type === "strikeRequested") {
      return { kind: "key", category: derived.data?.category as string | undefined };
    }
    return { kind: "key" }; // ignored keys (F-keys...) still cancel a pending Kamehameha
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    uIOhook.on("keydown", (raw: unknown) => {
      try {
        const { kind, category } = this.keyKind(raw);
        const settings = this.settingsService.getSettings();
        this.kamehameha.configure(this.kamehamehaOptions());
        this.kamehameha.keyDown(kind, Date.now());

        if (kind !== "key" || category === undefined) return;
        if (!settings.keyboardCombat) return;

        this.recordKeypress();
        const { action, frameIndex } = this.pickAction(category);
        this.send({
          action,
          frameIndex,
          priority: 60,
          loop: false,
          allowMovement: true,
          allowFacialOverride: false,
        });
      } catch (error) {
        console.error("Input service error:", error);
      }
    });

    uIOhook.on("keyup", (raw: unknown) => {
      try {
        const { kind } = this.keyKind(raw);
        const fire = this.kamehameha.keyUp(kind, Date.now());
        if (!fire || !this.settingsService.getSettings().kamehamehaEnabled) return;
        this.send({
          action: "kamehameha",
          priority: 90,
          loop: false,
          allowMovement: false,
          allowFacialOverride: false,
          facing: this.roomierSide(),
        });
      } catch (error) {
        console.error("Input service error:", error);
      }
    });

    uIOhook.start();
    console.log("Global input service started");
  }

  private send(payload: Record<string, unknown>): void {
    const win = this.getWindow();
    if (win && !win.isDestroyed()) win.webContents.send("animation:change", payload);
  }

  /**
   * Fire toward whichever side of the pet has more screen space.
   */
  private roomierSide(): "left" | "right" {
    const win = this.getWindow();
    if (!win || win.isDestroyed()) return "right";
    const b = win.getBounds();
    const wa = screen.getDisplayNearestPoint({
      x: Math.round(b.x + b.width / 2),
      y: Math.round(b.y + b.height / 2),
    }).workArea;
    const right = wa.x + wa.width - (b.x + b.width);
    const left = b.x - wa.x;
    return right >= left ? "right" : "left";
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    try {
      uIOhook.stop();
    } catch (error) {
      console.error("Failed to stop input service:", error);
    }
    this.keyTimes = [];
    this.kamehameha.reset();
  }

  /**
   * Current typing rate (keys/sec over a rolling 5s window). In-memory only.
   */
  getTypingRate(): number {
    const now = Date.now();
    this.keyTimes = this.keyTimes.filter((t) => now - t < 5000);
    return this.keyTimes.length / 5;
  }

  private recordKeypress(): void {
    const now = Date.now();
    this.keyTimes.push(now);
    // Bound memory: keep at most 100 recent samples.
    if (this.keyTimes.length > 100) {
      this.keyTimes.splice(0, this.keyTimes.length - 100);
    }
  }

  private pickAction(category: string | undefined): { action: string; frameIndex: number } {
    switch (category) {
      case "space":
        return { action: "strikes", frameIndex: 5 + Math.floor(Math.random() * 3) }; // kick frames (5-7)
      case "enter":
        return { action: "strikes", frameIndex: 2 + Math.floor(Math.random() * 2) }; // punch frames (2-3)
      case "backspace":
        return { action: "strikes", frameIndex: 0 }; // first punch frame (block-ish pose)
      default:
        return { action: "strikes", frameIndex: Math.floor(Math.random() * STRIKE_FRAME_COUNT) };
    }
  }
}
