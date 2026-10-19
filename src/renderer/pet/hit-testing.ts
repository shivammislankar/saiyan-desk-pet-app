/**
 * Hit testing: determines if a point is over the visible part of the sprite.
 * Uses pixel-level alpha testing when possible, falls back to bounding box.
 */

import type { SpriteAction, Rectangle } from "../../core/types";

export interface HitTestResult {
  hit: boolean;
  x: number;
  y: number;
}

export class HitTester {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private spriteSheet: HTMLImageElement | null = null;
  private currentAction: SpriteAction | null = null;
  private frameIndex: number = 0;
  private anchorX: number = 0;
  private anchorY: number = 0;
  private scale: number = 1;
  private facing: "left" | "right" = "right";

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  }

  /**
   * Update the current sprite state for hit testing.
   */
  updateSpriteState(
    spriteSheet: HTMLImageElement | null,
    action: SpriteAction | null,
    frameIndex: number,
    anchorX: number,
    anchorY: number,
    scale: number,
    facing: "left" | "right"
  ): void {
    this.spriteSheet = spriteSheet;
    this.currentAction = action;
    this.frameIndex = frameIndex;
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    this.scale = scale;
    this.facing = facing;
  }

  /**
   * Test if a point hits the visible sprite pixels.
   */
  testPoint(x: number, y: number): HitTestResult {
    if (!this.spriteSheet || !this.currentAction) {
      return { hit: false, x, y };
    }

    // Calculate the source frame
    const frame = this.getFrame(this.currentAction, this.frameIndex);

    // Calculate destination position
    const destX = -this.anchorX * this.scale;
    const destY = -this.anchorY * this.scale;
    const destW = this.currentAction.frameWidth * this.scale;
    const destH = this.currentAction.frameHeight * this.scale;

    // Check bounding box first
    if (x < destX || x >= destX + destW || y < destY || y >= destY + destH) {
      return { hit: false, x, y };
    }

    // Calculate source pixel coordinates
    let srcX: number;
    if (this.facing === "left") {
      srcX = frame.x + frame.width - 1 - Math.floor((x - destX) / this.scale);
    } else {
      srcX = frame.x + Math.floor((x - destX) / this.scale);
    }
    const srcY = frame.y + Math.floor((y - destY) / this.scale);

    // Bounds check
    if (srcX < 0 || srcX >= this.spriteSheet.naturalWidth || srcY < 0 || srcY >= this.spriteSheet.naturalHeight) {
      return { hit: false, x, y };
    }

    // Read pixel alpha
    try {
      const imageData = this.ctx.getImageData(srcX, srcY, 1, 1);
      const alpha = imageData.data[3];
      return { hit: alpha > 10, x, y };
    } catch {
      // If getImageData fails (tainted canvas), fall back to bounding box
      return { hit: true, x, y };
    }
  }

  /**
   * Get the bounding rectangle of the current sprite.
   */
  getBoundingBox(): Rectangle | null {
    if (!this.currentAction) return null;

    return {
      x: -this.anchorX * this.scale,
      y: -this.anchorY * this.scale,
      width: this.currentAction.frameWidth * this.scale,
      height: this.currentAction.frameHeight * this.scale,
    };
  }

  /**
   * Get the source frame rectangle.
   */
  private getFrame(action: SpriteAction, frameIndex: number): { x: number; y: number; width: number; height: number } {
    const col = frameIndex % action.framesPerRow;
    const row = Math.floor(frameIndex / action.framesPerRow);
    return {
      x: col * action.frameWidth,
      y: row * action.frameHeight,
      width: action.frameWidth,
      height: action.frameHeight,
    };
  }
}
