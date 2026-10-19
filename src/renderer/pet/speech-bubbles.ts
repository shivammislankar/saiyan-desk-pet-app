/**
 * Speech bubble renderer.
 * Draws pixel-art style speech bubbles with text.
 */

export interface SpeechBubble {
  text: string;
  x: number;
  y: number;
  opacity: number;
  maxWidth: number;
}

const FONT_SIZE = 8;
const PADDING = 4;
const LINE_HEIGHT = 10;
const MAX_WIDTH = 120;
const MAX_CHARS = 100;

export class SpeechBubbleRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /**
   * Draw a speech bubble at the given position.
   */
  draw(bubble: SpeechBubble): void {
    const { ctx } = this;

    // Validate and truncate text
    let text = bubble.text;
    if (text.length > MAX_CHARS) {
      text = text.substring(0, MAX_CHARS - 3) + "...";
    }

    // Calculate text dimensions
    ctx.font = `${FONT_SIZE}px monospace`;
    const lines = this.wrapText(text, MAX_WIDTH - PADDING * 2);
    const textWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const bubbleWidth = textWidth + PADDING * 2;
    const bubbleHeight = lines.length * LINE_HEIGHT + PADDING * 2;

    // Position bubble above the character
    const bx = bubble.x - bubbleWidth / 2;
    const by = bubble.y - bubbleHeight - 8;

    ctx.save();
    ctx.globalAlpha = bubble.opacity;

    // Draw bubble background
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;

    // Main bubble rectangle
    ctx.beginPath();
    ctx.roundRect(bx, by, bubbleWidth, bubbleHeight, 4);
    ctx.fill();
    ctx.stroke();

    // Tail
    ctx.beginPath();
    ctx.moveTo(bubble.x - 4, by + bubbleHeight);
    ctx.lineTo(bubble.x, by + bubbleHeight + 6);
    ctx.lineTo(bubble.x + 4, by + bubbleHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw text
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], bx + PADDING, by + PADDING + i * LINE_HEIGHT);
    }

    ctx.restore();
  }

  /**
   * Wrap text to fit within a maximum width.
   */
  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = this.ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [""];
  }

  /**
   * Calculate bubble dimensions without drawing.
   */
  measure(text: string): { width: number; height: number } {
    let truncated = text;
    if (truncated.length > MAX_CHARS) {
      truncated = truncated.substring(0, MAX_CHARS - 3) + "...";
    }

    this.ctx.font = `${FONT_SIZE}px monospace`;
    const lines = this.wrapText(truncated, MAX_WIDTH - PADDING * 2);
    const textWidth = Math.max(...lines.map((l) => this.ctx.measureText(l).width));

    return {
      width: textWidth + PADDING * 2,
      height: lines.length * LINE_HEIGHT + PADDING * 2,
    };
  }
}
