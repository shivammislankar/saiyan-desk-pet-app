/**
 * Display manager: tracks display configuration changes and provides display bounds.
 */

import { screen } from "electron";
import type { DisplayBounds } from "../core/types";

export class DisplayManager {
  private displays: DisplayBounds[] = [];
  private primaryDisplayId: string = "";

  constructor() {
    this.refreshDisplays();
  }

  /**
   * Refresh the display list.
   */
  refreshDisplays(): void {
    const allDisplays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();

    this.primaryDisplayId = primary.id.toString();
    this.displays = allDisplays.map((display) => ({
      id: display.id.toString(),
      bounds: { ...display.bounds },
      workArea: { ...display.workArea },
      scaleFactor: display.scaleFactor,
      isPrimary: display.id === primary.id,
    }));
  }

  /**
   * Get all displays.
   */
  getDisplays(): DisplayBounds[] {
    return [...this.displays];
  }

  /**
   * Get the primary display.
   */
  getPrimaryDisplay(): DisplayBounds | null {
    return this.displays.find((d) => d.isPrimary) || null;
  }

  /**
   * Get a display by ID.
   */
  getDisplayById(id: string): DisplayBounds | null {
    return this.displays.find((d) => d.id === id) || null;
  }

  /**
   * Find the display containing a point.
   */
  getDisplayAtPoint(x: number, y: number): DisplayBounds | null {
    for (const display of this.displays) {
      const { bounds } = display;
      if (x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height) {
        return display;
      }
    }
    return this.getPrimaryDisplay();
  }

  /**
   * Convert normalized coordinates to absolute position on a display.
   */
  normalizedToAbsolute(
    displayId: string,
    normalizedX: number,
    normalizedY: number
  ): { x: number; y: number } | null {
    const display = this.getDisplayById(displayId);
    if (!display) return null;

    const { workArea } = display;
    return {
      x: workArea.x + normalizedX * workArea.width,
      y: workArea.y + normalizedY * workArea.height,
    };
  }

  /**
   * Convert absolute position to normalized coordinates on a display.
   */
  absoluteToNormalized(
    x: number,
    y: number
  ): { displayId: string; normalizedX: number; normalizedY: number } | null {
    const display = this.getDisplayAtPoint(x, y);
    if (!display) return null;

    const { workArea } = display;
    return {
      displayId: display.id,
      normalizedX: (x - workArea.x) / workArea.width,
      normalizedY: (y - workArea.y) / workArea.height,
    };
  }

  /**
   * Handle display change events.
   */
  handleDisplayChange(): void {
    this.refreshDisplays();
  }
}
