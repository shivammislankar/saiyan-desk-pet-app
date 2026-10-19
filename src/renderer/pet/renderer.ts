/**
 * Main renderer entry point.
 * Sets up the canvas, animation loop, and coordinates all renderer modules.
 */

import { CanvasRenderer, type RenderState } from "./canvas-renderer";
import { SpriteLoader } from "./sprite-loader";
import { HitTester } from "./hit-testing";
import { ParticleSystem } from "./particle-system";
import { SoundFx } from "./sound-fx";
import type { Vector2, EyeOffset, DisplayBounds, SpriteAction } from "../../core/types";

declare const gokuPetAPI: {
  getSettings: () => Promise<{ settings: Record<string, unknown> }>;
  saveSettings: (settings: unknown) => Promise<{ success: boolean; error?: string }>;
  getPacks: () => Promise<{ packs: Array<{ id: string; name: string; author: string; version: string; path: string }>; active: string }>;
  selectPack: (packId: string) => Promise<{ success: boolean; error?: string }>;
  onSettingsUpdate: (callback: (payload: { settings: Record<string, unknown> }) => void) => () => void;
  onAnimationChange: (callback: (payload: { action: string; frameIndex?: number; priority: number; loop: boolean; allowMovement: boolean; allowFacialOverride: boolean; facing?: "left" | "right" }) => void) => () => void;
  getDataDir: () => Promise<{ userData: string; dataDir: string }>;
  petDragStart: () => Promise<{ success: boolean }>;
  petDragEnd: () => Promise<{ success: boolean }>;
  petSetSize: (width: number, height: number) => Promise<{ success: boolean }>;
  fireBeam: (req: {
    handX: number;
    handY: number;
    facing: "left" | "right";
    scale: number;
    durationMs: number;
  }) => Promise<{ success: boolean; error?: string }>;
  toggleTodo: () => Promise<{ success: boolean }>;
};

// A press that moves less than this (screen px) and is released within
// CLICK_MAX_MS counts as a click (opens the to-do list) rather than a drag.
const CLICK_MAX_MOVE = 4;
const CLICK_MAX_MS = 400;

// Kamehameha timing (ms): charge frames share CHARGE_MS, then the fire pose
// is held while the beam overlay plays.
const KAME_CHARGE_MS = 1400;
const KAME_FIRE_MS = 1100;
const KAME_CHANT = ["Ka-", "Ka-me-", "Ka-me-ha-", "Ka-me-ha-me-"];

export class PetRenderer {
  private canvas: HTMLCanvasElement;
  private canvasRenderer: CanvasRenderer;
  private spriteLoader: SpriteLoader;
  private hitTester: HitTester;
  private particleSystem: ParticleSystem;
  private sound = new SoundFx(false);
  private animationId: number | null = null;
  private lastFrameTime: number = 0;
  private bobPhase: number = 0;
  private eyeOffset: EyeOffset = { x: 0, y: 0 };
  private targetEyeOffset: EyeOffset = { x: 0, y: 0 };
  private isDragging: boolean = false;
  private pressStart: { x: number; y: number; time: number } | null = null;
  private dragMoved: boolean = false;
  /** Active Kamehameha sequence (null when none); cleared to cancel. */
  private kamehameha: { timers: ReturnType<typeof setTimeout>[] } | null = null;
  private chant: string = "";
  private isRunning: boolean = false;
  private frameIndex: number = 0;
  private frameTimer: number = 0;
  private currentAction: string = "idle";
  private settings: Record<string, unknown> = {};
  private displayBounds: DisplayBounds | null = null;
  private nimbusBobPhase: number = 0;
  private showNimbus: boolean = false;

  private position: Vector2 = { x: 128, y: 128 };
  private velocity: Vector2 = { x: 0, y: 0 };
  private facing: "left" | "right" = "right";

  constructor() {
    this.canvas = document.getElementById("pet-canvas") as HTMLCanvasElement;
    this.canvasRenderer = new CanvasRenderer(this.canvas);
    this.canvasRenderer.resize(256, 256, window.devicePixelRatio || 1);
    this.spriteLoader = new SpriteLoader();
    this.hitTester = new HitTester(this.canvas);
    this.particleSystem = new ParticleSystem();
  }

  async initialize(): Promise<void> {
    console.log("Initializing Goku Pet Renderer...");

    const settingsResult = await gokuPetAPI.getSettings();
    this.settings = settingsResult.settings;
    console.log("Settings loaded:", this.settings);

    try {
      const packsResult = await gokuPetAPI.getPacks();
      console.log("Available packs:", packsResult.packs);
      // Active pack (chosen in main), falling back to the built-in default.
      const pack =
        packsResult.packs.find((p) => p.id === packsResult.active) ??
        packsResult.packs.find((p) => p.id === "default");
      if (pack) {
        console.log(`Loading pack "${pack.id}" from:`, pack.path);
        await this.loadPack(pack.id, pack.path || "");
        if (!this.spriteLoader.getAction("idle") && pack.id !== "default") {
          console.warn(`Pack "${pack.id}" has no usable idle; falling back to default`);
          const fallback = packsResult.packs.find((p) => p.id === "default");
          if (fallback) await this.loadPack(fallback.id, fallback.path || "");
        }
      }
    } catch (error) {
      console.error("Failed to load packs:", error);
    }
    this.applyLayout();

    this.sound.enabled = this.settings.sound === true;

    gokuPetAPI.onSettingsUpdate((payload) => {
      this.settings = payload.settings;
      this.sound.enabled = this.settings.sound === true;
      if (!this.sound.enabled) this.sound.cancelLong();
      this.applySettings();
    });

    gokuPetAPI.onAnimationChange((payload) => {
      if (payload.action === "kamehameha") {
        this.playKamehameha(payload.facing ?? this.facing);
      } else {
        this.playStrike(payload.action, payload.frameIndex);
      }
    });

    this.setupMouseTracking();
    this.setupDragging();
    console.log("Starting render loop...");
    this.start();
  }

  private async loadPack(packId: string, packPath: string): Promise<void> {
    try {
      const packsResult = await gokuPetAPI.getPacks();
      const pack = packsResult.packs.find((p) => p.id === packId);
      if (!pack) return;

      if (packPath) {
        // Loads every action together with its own sheet.
        await this.spriteLoader.loadPack(packId, packPath);
        console.log("Sprite sheets loaded successfully!");
      }
    } catch (error) {
      console.error(`Failed to load pack ${packId}:`, error);
    }
  }

  /**
   * The action to draw right now and the sheet it lives on. Unknown actions
   * fall back to idle so a missing animation never blanks the pet.
   */
  private currentSprite(): { action: SpriteAction | null; sheet: HTMLImageElement | null } {
    const name = this.spriteLoader.getAction(this.currentAction) ? this.currentAction : "idle";
    return {
      action: this.spriteLoader.getAction(name),
      sheet: this.spriteLoader.getSheet(name),
    };
  }

  /**
   * Screen px per frame px. A pack's displayScale wins over the user's scale
   * setting (high-res packs are drawn 1:1). Pixel-art packs are snapped so one
   * art pixel covers a whole number of physical pixels at the current DPI.
   */
  private drawScale(): number {
    const pack = this.spriteLoader.getActivePack();
    const base = pack?.displayScale ?? ((this.settings.scale as number) || 2);
    if (pack?.rendering === "smooth") return base;
    const dpr = window.devicePixelRatio || 1;
    return Math.max(1, Math.round(base * dpr)) / dpr;
  }

  /**
   * Frames are placed by their anchor, but packs put the anchor in different
   * places (the default pack's is at the feet). Shift everything so the idle
   * frame sits centred in the window; all frames keep their relative alignment.
   */
  private anchorShift(scale: number): { x: number; y: number } {
    const idle = this.spriteLoader.getAction("idle");
    if (!idle) return { x: 0, y: 0 };
    return {
      x: (idle.anchorX - idle.frameWidth / 2) * scale,
      y: (idle.anchorY - idle.frameHeight / 2) * scale,
    };
  }

  private layoutDpr = 0;
  private windowSize = 256;

  /**
   * Size canvas and window to the active pack's frames: a 64px frame at 3x
   * keeps the original 256px window, a 256px HD frame gets ~336px.
   */
  private applyLayout(): void {
    const dpr = window.devicePixelRatio || 1;
    this.layoutDpr = dpr;
    const idle = this.spriteLoader.getAction("idle");
    const frame = Math.max(idle?.frameWidth ?? 64, idle?.frameHeight ?? 64);
    const size = Math.min(1024, Math.ceil((frame * this.drawScale() * 1.25 + 16) / 2) * 2);
    const smooth = this.spriteLoader.getActivePack()?.rendering === "smooth";
    this.canvasRenderer.resize(size, size, dpr, smooth);
    if (size !== this.windowSize) {
      this.windowSize = size;
      gokuPetAPI.petSetSize(size, size).catch((err) => console.error("resize failed:", err));
    }
  }

  private applySettings(): void {
    const nimbusMode = this.settings.nimbusMode as string;
    this.applyLayout();

    if (nimbusMode === "always") {
      this.showNimbus = true;
    } else if (nimbusMode === "never") {
      this.showNimbus = false;
    }
  }

  private setupMouseTracking(): void {
    document.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;

      const maxOffset = 4;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        const clampedDist = Math.min(dist, 100);
        this.targetEyeOffset = {
          x: (dx / dist) * maxOffset * (clampedDist / 100),
          y: (dy / dist) * maxOffset * (clampedDist / 100),
        };
      }
    });
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.loop();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private loop = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const deltaMs = now - this.lastFrameTime;
    this.lastFrameTime = now;

    this.update(deltaMs);
    this.render();

    this.animationId = requestAnimationFrame(this.loop);
  };

  /** Idle means completely still: no bob, no frame cycling, no nimbus bob. */
  private isIdle(): boolean {
    return this.currentAction === "idle" && !this.isDragging;
  }

  /** Still (no bob, no automatic frame advance): idle, or mid-Kamehameha. */
  private isHeld(): boolean {
    return this.isIdle() || this.kamehameha !== null;
  }

  private update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    // Window dragged to a monitor with different scaling: re-layout.
    if ((window.devicePixelRatio || 1) !== this.layoutDpr) this.applyLayout();
    if (this.isHeld()) {
      this.bobPhase = 0;
      this.nimbusBobPhase = 0;
    } else {
      this.bobPhase += dt;
      this.nimbusBobPhase += dt;
    }

    const eyeLerpFactor = Math.min(1, dt * 8);
    this.eyeOffset.x += (this.targetEyeOffset.x - this.eyeOffset.x) * eyeLerpFactor;
    this.eyeOffset.y += (this.targetEyeOffset.y - this.eyeOffset.y) * eyeLerpFactor;

    if (this.isIdle()) {
      this.frameIndex = 0;
      this.frameTimer = 0;
    } else if (this.kamehameha) {
      this.frameTimer = 0; // frames are stepped by the sequence itself
    } else {
      this.frameTimer += deltaMs;
    }
    const actionFps = this.spriteLoader.getAction(this.currentAction)?.fps ?? 8;
    const frameDuration = 1000 / actionFps;
    if (this.frameTimer >= frameDuration) {
      this.frameIndex++;
      this.frameTimer -= frameDuration;
    }

    this.particleSystem.update(deltaMs);

    if (this.settings.nimbusMode === "when-idle") {
      const isIdle =
        Math.abs(this.velocity.x) < 1 &&
        Math.abs(this.velocity.y) < 1 &&
        !this.isDragging;
      this.showNimbus = isIdle;
    }

    if (!this.isDragging) {
      const friction = Math.pow(0.95, deltaMs / 16);
      this.velocity.x *= friction;
      this.velocity.y *= friction;

      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;

      if (Math.abs(this.velocity.x) > 0.5) {
        this.facing = this.velocity.x < 0 ? "left" : "right";
      }
    }
  }

  private render(): void {
    const scale = this.drawScale();
    const opacity = (this.settings.opacity as number) || 1;
    const bobOffset = this.isHeld() ? 0 : Math.sin(this.bobPhase * 1.5 * Math.PI * 2) * 4;

    const state: RenderState = {
      x: this.position.x,
      y: this.position.y,
      facing: this.facing,
      scale,
      opacity,
      currentAction: this.currentAction,
      frameIndex: this.frameIndex,
      bobOffset,
      eyeOffset: this.eyeOffset,
      isDragging: this.isDragging,
      particles: this.particleSystem.getParticles(),
      showNimbus: this.showNimbus,
      nimbusBobPhase: this.nimbusBobPhase,
      shiftX: this.anchorShift(scale).x,
      shiftY: this.anchorShift(scale).y,
      chant: this.chant,
    };

    const { action, sheet } = this.currentSprite();
    this.canvasRenderer.render(state, sheet, action);
    this.hitTester.updateSpriteState(
      sheet,
      action,
      this.frameIndex,
      action?.anchorX || 16,
      action?.anchorY || 16,
      scale,
      this.facing
    );
  }

  startDrag(): void {
    this.isDragging = true;
    this.velocity = { x: 0, y: 0 };
  }

  updateDrag(x: number, y: number): void {
    this.position.x = x;
    this.position.y = y;
  }

  endDrag(velocityX: number, velocityY: number): void {
    this.isDragging = false;
    this.velocity = { x: velocityX, y: velocityY };
  }

  /**
   * Wire mouse press/release to main-process window dragging.
   * Drag starts only on visible sprite pixels (hit test); the main process
   * moves the window and applies throw inertia on release.
   */
  private setupDragging(): void {
    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || this.isDragging) return;
      if (!this.hitTestAt(e.clientX, e.clientY)) return;
      this.cancelKamehameha(); // grabbing him interrupts the attack
      this.isDragging = true;
      this.dragMoved = false;
      this.pressStart = { x: e.screenX, y: e.screenY, time: performance.now() };
      // The drag pose waits until the cursor actually moves, so a plain
      // click doesn't flash it.
      gokuPetAPI.petDragStart().catch((err) => console.error("drag start failed:", err));
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.isDragging || this.dragMoved || !this.pressStart) return;
      const moved = Math.hypot(e.screenX - this.pressStart.x, e.screenY - this.pressStart.y);
      if (moved > CLICK_MAX_MOVE) {
        this.dragMoved = true;
        this.currentAction = "drag";
        this.frameIndex = 0;
        this.frameTimer = 0;
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (!this.isDragging) return;
      const start = this.pressStart;
      const moved = start ? Math.hypot(e.screenX - start.x, e.screenY - start.y) : Infinity;
      const isClick =
        !this.dragMoved && moved <= CLICK_MAX_MOVE && !!start && performance.now() - start.time <= CLICK_MAX_MS;

      this.isDragging = false;
      this.pressStart = null;
      if (this.currentAction === "drag") {
        this.currentAction = "idle";
        this.frameIndex = 0;
        this.frameTimer = 0;
      }
      gokuPetAPI.petDragEnd().catch((err) => console.error("drag end failed:", err));
      if (isClick) {
        gokuPetAPI.toggleTodo().catch((err) => console.error("to-do toggle failed:", err));
      }
    });
  }

  /**
   * Hit test: bounding box of the current frame, refined by pixel alpha
   * when the sprite sheet is readable (falls back to bbox otherwise).
   */
  private hitTestAt(clientX: number, clientY: number): boolean {
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const scale = this.drawScale();
    const { action, sheet } = this.currentSprite();
    const fw = action?.frameWidth ?? 64;
    const fh = action?.frameHeight ?? 64;
    const ax = action?.anchorX ?? 32;
    const ay = action?.anchorY ?? 56;
    const dims = this.canvasRenderer.getDimensions();
    const shift = this.anchorShift(scale);
    const left = dims.width / 2 - ax * scale + shift.x;
    const top = dims.height / 2 - ay * scale + shift.y;
    const w = fw * scale;
    const h = fh * scale;

    if (px < left || px >= left + w || py < top || py >= top + h) return false;
    if (!sheet || !action) return true;

    try {
      const off = document.createElement("canvas");
      off.width = sheet.naturalWidth;
      off.height = sheet.naturalHeight;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return true;
      octx.drawImage(sheet, 0, 0);
      const safeCount = Math.max(1, action.frameCount);
      const idx = this.frameIndex % safeCount;
      const col = idx % action.framesPerRow;
      const row = Math.floor(idx / action.framesPerRow);
      let sx = col * fw + Math.floor((px - left) / scale);
      if (this.facing === "left") {
        sx = col * fw + (fw - 1 - Math.floor((px - left) / scale));
      }
      const sy = row * fh + Math.floor((py - top) / scale);
      const data = octx.getImageData(sx, sy, 1, 1).data;
      return data[3] > 10;
    } catch {
      return true; // unreadable pixels: trust the bounding box
    }
  }

  /**
   * Play a one-shot strike (keyboard combat): set the pose, spark at the
   * fist/foot, then fall back to idle using the action's own fps.
   */
  private playStrike(action: string, frameIndex?: number): void {
    if (this.kamehameha) return; // the Kamehameha outranks keyboard strikes
    const resolved = this.spriteLoader.getAction(action) ? action : "strikes";
    this.currentAction = resolved;
    this.frameIndex = frameIndex ?? 0;
    this.frameTimer = 0;

    // Strikes sheet: frames 0-3 are punches, 4-7 kicks.
    const isKick = resolved === "strikes" ? this.frameIndex >= 4 : resolved.includes("kick");
    if (isKick) this.sound.kick();
    else this.sound.punch();

    const scale = this.drawScale();
    const { width: cw, height: ch } = this.canvasRenderer.getDimensions();
    const cx = cw / 2;
    const cy = ch / 2;
    const reachX = cx + (this.facing === "right" ? 1 : -1) * 22 * scale;
    this.particleSystem.spawnBurst(reachX, cy, 6, 60, 250, 3, "#FFE066");

    const def = this.spriteLoader.getAction(resolved);
    const fps = def?.fps ?? 12;
    const duration = Math.max(120, (1 / fps) * 1000 + 60); // One frame duration
    const token = resolved;
    setTimeout(() => {
      // Don't stomp a drag or a newer strike.
      if (this.currentAction === token && !this.isDragging) {
        this.currentAction = "idle";
        this.frameIndex = 0;
        this.frameTimer = 0;
      }
    }, duration);
  }

  /**
   * Kamehameha: charge frames with the chant, then the fire pose while the
   * beam overlay (main process) shoots from his hands. Outranks strikes;
   * dragging cancels it.
   */
  private playKamehameha(facing: "left" | "right"): void {
    if (this.isDragging || this.kamehameha) return;
    const charge = this.spriteLoader.getAction("kamehameha_charge");
    const fire = this.spriteLoader.getAction("kamehameha_fire");
    if (!charge && !fire) return;

    const seq = { timers: [] as ReturnType<typeof setTimeout>[] };
    this.kamehameha = seq;
    this.facing = facing;
    const at = (ms: number, fn: () => void) => {
      seq.timers.push(
        setTimeout(() => {
          if (this.kamehameha === seq) fn();
        }, ms)
      );
    };

    this.sound.charge(KAME_CHARGE_MS);
    const steps = Math.max(1, charge?.frameCount ?? 1);
    const stepMs = KAME_CHARGE_MS / steps;
    for (let i = 0; i < steps; i++) {
      at(i * stepMs, () => {
        this.currentAction = charge ? "kamehameha_charge" : "idle";
        this.frameIndex = i;
        this.chant = KAME_CHANT[Math.min(KAME_CHANT.length - 1, Math.floor((i / steps) * KAME_CHANT.length))];
      });
    }

    at(KAME_CHARGE_MS, () => {
      this.currentAction = fire ? "kamehameha_fire" : this.currentAction;
      this.frameIndex = 0;
      this.chant = "HA!";
      this.sound.beam(KAME_FIRE_MS);
      this.fireBeam(facing);
    });

    at(KAME_CHARGE_MS + KAME_FIRE_MS, () => {
      this.endKamehameha();
    });
  }

  /** Ask main to show the beam at the hands of the fire frame. */
  private fireBeam(facing: "left" | "right"): void {
    const pack = this.spriteLoader.getActivePack();
    const fire = this.spriteLoader.getAction("kamehameha_fire");
    if (!pack?.kamehameha || !fire) return;
    const scale = this.drawScale();
    const shift = this.anchorShift(scale);
    const dims = this.canvasRenderer.getDimensions();
    const left = dims.width / 2 - fire.anchorX * scale + shift.x;
    const top = dims.height / 2 - fire.anchorY * scale + shift.y;
    const handFrameX = facing === "right" ? pack.kamehameha.handX : fire.frameWidth - pack.kamehameha.handX;
    gokuPetAPI
      .fireBeam({
        handX: left + handFrameX * scale,
        handY: top + pack.kamehameha.handY * scale,
        facing,
        scale,
        durationMs: KAME_FIRE_MS,
      })
      .catch((err) => console.error("beam failed:", err));
  }

  private endKamehameha(): void {
    this.kamehameha = null;
    this.chant = "";
    if (!this.isDragging) {
      this.currentAction = "idle";
      this.frameIndex = 0;
      this.frameTimer = 0;
    }
  }

  private cancelKamehameha(): void {
    if (!this.kamehameha) return;
    this.sound.cancelLong();
    for (const t of this.kamehameha.timers) clearTimeout(t);
    this.endKamehameha();
  }

  requestAnimation(action: string, duration?: number): void {
    this.currentAction = action;
    this.frameIndex = 0;
    this.frameTimer = 0;

    if (duration) {
      setTimeout(() => {
        if (this.currentAction === action) {
          this.currentAction = "idle";
        }
      }, duration);
    }
  }

  shutdown(): void {
    this.stop();
    this.particleSystem.clear();
    this.spriteLoader.clearCache();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    const renderer = new PetRenderer();
    renderer.initialize().catch(console.error);
  });
} else {
  const renderer = new PetRenderer();
  renderer.initialize().catch(console.error);
}
