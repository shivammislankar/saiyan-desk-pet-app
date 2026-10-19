/**
 * Overlay renderer for full-screen effects (Kamehameha beam, aura flashes, etc.).
 * Runs in a transparent, click-through overlay window.
 */

export interface OverlayEffect {
  type: "kamehameha" | "aura_flash" | "impact_flare";
  x: number;
  y: number;
  width: number;
  height: number;
  progress: number; // 0 to 1
  direction: "left" | "right";
}

export class OverlayRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private effect: OverlayEffect | null = null;
  private animationId: number | null = null;

  constructor() {
    this.canvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.resize();

    window.addEventListener("resize", () => this.resize());
  }

  /**
   * Resize the canvas to fill the window.
   */
  resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * Show an effect.
   */
  showEffect(effect: OverlayEffect): void {
    this.effect = effect;
    if (this.animationId === null) {
      this.loop();
    }
  }

  /**
   * Clear the current effect.
   */
  clear(): void {
    this.effect = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Animation loop.
   */
  private loop = (): void => {
    if (!this.effect) {
      this.animationId = null;
      return;
    }

    this.render();
    this.animationId = requestAnimationFrame(this.loop);
  };

  /**
   * Render the current effect.
   */
  private render(): void {
    if (!this.effect) return;

    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    switch (this.effect.type) {
      case "kamehameha":
        this.renderKamehameha(this.effect);
        break;
      case "aura_flash":
        this.renderAuraFlash(this.effect);
        break;
      case "impact_flare":
        this.renderImpactFlare(this.effect);
        break;
    }
  }

  /**
   * Render a Kamehameha beam.
   */
  private renderKamehameha(effect: OverlayEffect): void {
    const { ctx } = this;
    const beamWidth = 20 + effect.progress * 30;
    const startX = effect.x;
    const endX = effect.direction === "right" ? this.canvas.width : 0;
    const y = effect.y;

    ctx.save();

    // Beam glow
    const gradient = ctx.createLinearGradient(startX, y - beamWidth, startX, y + beamWidth);
    gradient.addColorStop(0, "rgba(0, 150, 255, 0)");
    gradient.addColorStop(0.5, `rgba(0, 150, 255, ${0.6 * (1 - effect.progress * 0.5)})`);
    gradient.addColorStop(1, "rgba(0, 150, 255, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(
      Math.min(startX, endX),
      y - beamWidth,
      Math.abs(endX - startX),
      beamWidth * 2
    );

    // Beam core
    ctx.fillStyle = `rgba(200, 230, 255, ${0.8 * (1 - effect.progress * 0.3)})`;
    ctx.fillRect(
      Math.min(startX, endX),
      y - beamWidth * 0.3,
      Math.abs(endX - startX),
      beamWidth * 0.6
    );

    ctx.restore();
  }

  /**
   * Render an aura flash.
   */
  private renderAuraFlash(effect: OverlayEffect): void {
    const { ctx } = this;
    const radius = 50 + effect.progress * 100;
    const alpha = 0.3 * (1 - effect.progress);

    ctx.save();
    const gradient = ctx.createRadialGradient(
      effect.x, effect.y, 0,
      effect.x, effect.y, radius
    );
    gradient.addColorStop(0, `rgba(255, 200, 0, ${alpha})`);
    gradient.addColorStop(1, "rgba(255, 200, 0, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Render an impact flare.
   */
  private renderImpactFlare(effect: OverlayEffect): void {
    const { ctx } = this;
    const size = 30 * (1 - effect.progress);
    const alpha = 0.8 * (1 - effect.progress);

    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 200, ${alpha})`;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Start the animation.
   */
  start(): void {
    if (this.animationId === null) {
      this.loop();
    }
  }

  /**
   * Stop the animation.
   */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}

// Initialize
const overlayRenderer = new OverlayRenderer();

// Listen for overlay payload from main process
window.addEventListener("message", (event) => {
  if (event.data?.type === "overlay:payload") {
    const payload = event.data.payload;
    overlayRenderer.showEffect({
      type: payload.effect || "kamehameha",
      x: payload.x,
      y: payload.y,
      width: payload.width,
      height: payload.height,
      progress: 0,
      direction: "right",
    });
  }
});
