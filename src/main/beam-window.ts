/**
 * Kamehameha beam overlay (SPEC section 5.3): a transparent, click-through,
 * never-focused window created only while the beam is on screen and destroyed
 * right after. At most one exists at a time. Purely visual.
 */

import { BrowserWindow, nativeImage } from "electron";
import * as path from "path";
import { pathToFileURL } from "url";
import type { BeamEffect } from "../services/pack-service";

const GRACE_MS = 150; // keep the window briefly after the fade, then destroy

export interface FireBeamRequest {
  /** Hand position inside the pet window (CSS/DIP px). */
  handX: number;
  handY: number;
  facing: "left" | "right";
  /** Screen px per beam-image px (the pack's display scale). */
  scale: number;
  durationMs: number;
}

export class BeamWindow {
  private win: BrowserWindow | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  fire(pet: BrowserWindow, effect: BeamEffect, req: FireBeamRequest): void {
    this.destroy();

    const size = nativeImage.createFromPath(effect.imagePath).getSize();
    if (!size.width || !size.height) return;

    const scale = req.scale;
    const width = Math.round(size.width * scale);
    const height = Math.round(size.height * scale);
    const b = pet.getBounds();
    // The image is mirrored when facing left, so the origin is measured from its right edge.
    const originX = (req.facing === "right" ? effect.originX : size.width - effect.originX) * scale;
    const x = Math.round(b.x + req.handX - originX);
    const y = Math.round(b.y + req.handY - effect.originY * scale);

    const win = new BrowserWindow({
      x,
      y,
      width,
      height,
      transparent: true,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    win.setAlwaysOnTop(true, "screen-saver");
    win.setIgnoreMouseEvents(true);
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (e) => e.preventDefault());

    const originFraction = originX / width;
    win.loadFile(path.join(__dirname, "../renderer/beam/beam.html"), {
      query: {
        img: pathToFileURL(effect.imagePath).toString(),
        dir: req.facing,
        dur: String(Math.round(req.durationMs)),
        ox: originFraction.toFixed(4),
      },
    });
    win.once("ready-to-show", () => {
      if (!win.isDestroyed()) win.showInactive();
    });
    win.on("closed", () => {
      if (this.win === win) this.win = null;
    });

    this.win = win;
    this.timer = setTimeout(() => this.destroy(), req.durationMs + GRACE_MS);
  }

  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.win && !this.win.isDestroyed()) this.win.destroy();
    this.win = null;
  }
}
