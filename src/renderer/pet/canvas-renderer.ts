/**
 * Canvas 2D renderer for the pet.
 * Handles pixel-art rendering with nearest-neighbor scaling.
 */

import type { SpriteAction, SpriteFrame, Particle, EyeOffset } from "../../core/types";

export interface RenderState {
  x: number;
  y: number;
  facing: "left" | "right";
  scale: number;
  opacity: number;
  currentAction: string;
  frameIndex: number;
  bobOffset: number;
  eyeOffset: EyeOffset;
  isDragging: boolean;
  particles: Particle[];
  showNimbus: boolean;
  nimbusBobPhase: number;
  /** CSS-px shift that centres the pack's idle frame in the window. */
  shiftX: number;
  shiftY: number;
  /** Speech text above his head (Kamehameha chant). Plain text. */
  chant?: string;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;   // CSS px
  private height: number;  // CSS px
  private dpr: number = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.width = canvas.width;
    this.height = canvas.height;
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * Size the canvas in CSS px with a backing store at the screen's real pixel
   * density, so nothing gets stretched (and blurred) by the compositor.
   * smooth=false keeps nearest-neighbour sampling for pixel art.
   */
  resize(width: number, height: number, dpr: number = 1, smooth: boolean = false): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.style.imageRendering = smooth ? "auto" : "pixelated";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = smooth;
    this.ctx.imageSmoothingQuality = "high";
  }

  /** Round a CSS-px coordinate to the nearest physical pixel. */
  private snap(v: number): number {
    return Math.round(v * this.dpr) / this.dpr;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  render(
    state: RenderState,
    spriteSheet: HTMLImageElement | null,
    action: SpriteAction | null
  ): void {
    this.clear();

    if (!spriteSheet || !action) {
      this.drawVisiblePlaceholder(state);
      return;
    }

    const frame = this.getFrame(action, state.frameIndex);
    // Sprite stays centered in its window; the OS window itself moves on screen.
    // (state.x/y are screen coordinates and must NOT be used as canvas offsets.)
    const destX = this.snap(this.width / 2 - action.anchorX * state.scale + state.shiftX);
    const destY = this.snap(this.height / 2 - action.anchorY * state.scale + state.shiftY + state.bobOffset);
    const destW = this.snap(action.frameWidth * state.scale);
    const destH = this.snap(action.frameHeight * state.scale);

    if (state.showNimbus) {
      this.drawNimbus(state, destX, destY, destW, destH);
    }

    this.ctx.save();
    this.ctx.globalAlpha = state.opacity;

    if (state.facing === "left") {
      this.ctx.translate(destX + destW, destY);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(spriteSheet, frame.x, frame.y, frame.width, frame.height, 0, 0, destW, destH);
    } else {
      this.ctx.drawImage(spriteSheet, frame.x, frame.y, frame.width, frame.height, destX, destY, destW, destH);
    }

    this.ctx.restore();
    this.drawParticles(state.particles);
    if (state.chant) this.drawChant(state.chant, state.opacity);
  }

  private drawChant(text: string, opacity: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = "800 18px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(10, 20, 40, 0.85)";
    ctx.fillStyle = text.endsWith("HA!") ? "#bff4ff" : "#ffffff";
    const x = this.width / 2;
    const y = 8;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  private getFrame(action: SpriteAction, frameIndex: number): SpriteFrame {
    // Wrap by frameCount: without this, the row walks off the sheet after a
    // few seconds and drawImage samples blank pixels (invisible sprite).
    const safeCount = Math.max(1, action.frameCount);
    const idx = frameIndex % safeCount;
    const col = idx % action.framesPerRow;
    const row = Math.floor(idx / action.framesPerRow);
    return {
      x: col * action.frameWidth,
      y: row * action.frameHeight,
      width: action.frameWidth,
      height: action.frameHeight,
    };
  }

  /**
   * Draw a large, clearly visible placeholder character.
   */
  private drawVisiblePlaceholder(state: RenderState): void {
    const s = state.scale;
    // 50% larger: scale was 2, now 3, so multiply by s/2 relative to original 2x
    const ratio = s / 2;
    const cx = this.width / 2;
    const cy = this.height / 2;

    this.ctx.save();
    this.ctx.globalAlpha = state.opacity;

    // Body (orange gi) - 50% larger
    this.ctx.fillStyle = "#FF6600";
    this.ctx.fillRect(cx - 9 * ratio, cy - 6 * ratio, 18 * ratio, 15 * ratio);

    // Belt
    this.ctx.fillStyle = "#0000CC";
    this.ctx.fillRect(cx - 9 * ratio, cy + 3 * ratio, 18 * ratio, 3 * ratio);

    // Head
    this.ctx.fillStyle = "#FFDAB9";
    this.ctx.fillRect(cx - 7.5 * ratio, cy - 18 * ratio, 15 * ratio, 12 * ratio);

    // Hair (spiky black)
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(cx - 9 * ratio, cy - 24 * ratio, 18 * ratio, 6 * ratio);
    // Hair spikes
    for (let i = 0; i < 5; i++) {
      const sx = cx - 7.5 * ratio + i * 3.75 * ratio;
      this.ctx.beginPath();
      this.ctx.moveTo(sx, cy - 24 * ratio);
      this.ctx.lineTo(sx + 1.8 * ratio, cy - 30 * ratio);
      this.ctx.lineTo(sx + 3.75 * ratio, cy - 24 * ratio);
      this.ctx.fill();
    }

    // Eyes
    this.ctx.fillStyle = "#FFFFFF";
    this.ctx.fillRect(cx - 4.5 * ratio, cy - 15 * ratio, 3 * ratio, 3 * ratio);
    this.ctx.fillRect(cx + 1.5 * ratio, cy - 15 * ratio, 3 * ratio, 3 * ratio);
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(cx - 3 * ratio, cy - 14 * ratio, 1.5 * ratio, 1.5 * ratio);
    this.ctx.fillRect(cx + 1.5 * ratio, cy - 14 * ratio, 1.5 * ratio, 1.5 * ratio);

    // Mouth
    this.ctx.fillStyle = "#CC6666";
    this.ctx.fillRect(cx - 1.5 * ratio, cy - 10.5 * ratio, 3 * ratio, 1.5 * ratio);

    // Arms
    this.ctx.fillStyle = "#FF6600";
    this.ctx.fillRect(cx - 12 * ratio, cy - 4.5 * ratio, 4.5 * ratio, 9 * ratio);
    this.ctx.fillRect(cx + 12 * ratio, cy - 4.5 * ratio, 4.5 * ratio, 9 * ratio);

    // Hands
    this.ctx.fillStyle = "#FFDAB9";
    this.ctx.fillRect(cx - 12 * ratio, cy + 4.5 * ratio, 4.5 * ratio, 3 * ratio);
    this.ctx.fillRect(cx + 12 * ratio, cy + 4.5 * ratio, 4.5 * ratio, 3 * ratio);

    // Legs
    this.ctx.fillStyle = "#FF6600";
    this.ctx.fillRect(cx - 7.5 * ratio, cy + 9 * ratio, 6 * ratio, 9 * ratio);
    this.ctx.fillRect(cx + 1.5 * ratio, cy + 9 * ratio, 6 * ratio, 9 * ratio);

    // Boots
    this.ctx.fillStyle = "#0000CC";
    this.ctx.fillRect(cx - 9 * ratio, cy + 18 * ratio, 7.5 * ratio, 3 * ratio);
    this.ctx.fillRect(cx + 1.5 * ratio, cy + 18 * ratio, 7.5 * ratio, 3 * ratio);

    this.ctx.restore();
  }

  private drawNimbus(state: RenderState, destX: number, destY: number, destW: number, destH: number): void {
    const nimbusY = destY + destH - Math.round(4 * state.scale);
    const nimbusX = destX + Math.round(destW * 0.1);
    const nimbusW = Math.round(destW * 0.8);
    const nimbusH = Math.round(8 * state.scale);
    const bob = Math.sin(state.nimbusBobPhase * Math.PI * 2) * 2;

    this.ctx.save();
    this.ctx.globalAlpha = state.opacity * 0.9;
    this.ctx.fillStyle = "#FFD700";
    this.ctx.beginPath();
    this.ctx.ellipse(nimbusX + nimbusW / 2, nimbusY + nimbusH / 2 + bob, nimbusW / 2, nimbusH / 2, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawParticles(particles: Particle[]): void {
    this.ctx.save();
    for (const p of particles) {
      this.ctx.globalAlpha = p.alpha * (p.life / p.maxLife);
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), Math.round(p.size), Math.round(p.size));
    }
    this.ctx.restore();
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}
