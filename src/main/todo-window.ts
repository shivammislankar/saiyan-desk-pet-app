/**
 * To-do popup: a small panel that opens beside the pet when it is clicked.
 * Unlike the pet window it takes focus (you type into it). It follows the pet
 * when the pet moves and stays inside the work area of the pet's display.
 */

import { BrowserWindow, screen } from "electron";
import * as path from "path";

const PANEL_WIDTH = 300;
const PANEL_HEIGHT = 380;
const GAP = 8;

export class TodoWindow {
  private win: BrowserWindow | null = null;
  private getPetWindow: () => BrowserWindow | null;
  private onPetMove = (): void => this.reposition();

  constructor(getPetWindow: () => BrowserWindow | null) {
    this.getPetWindow = getPetWindow;
  }

  isOpen(): boolean {
    return !!this.win && !this.win.isDestroyed();
  }

  toggle(): void {
    if (this.isOpen()) this.close();
    else this.open();
  }

  open(): void {
    if (this.isOpen()) {
      this.win!.focus();
      return;
    }
    const pet = this.getPetWindow();
    if (!pet || pet.isDestroyed()) return;

    const { x, y } = this.computePosition(pet);
    this.win = new BrowserWindow({
      x,
      y,
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      frame: false,
      transparent: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "../preload/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    this.win.setAlwaysOnTop(true, "screen-saver");

    // No navigation or popups out of the panel.
    this.win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    this.win.webContents.on("will-navigate", (e) => e.preventDefault());
    this.win.webContents.on("context-menu", (e) => e.preventDefault());

    this.win.loadFile(path.join(__dirname, "../renderer/todo/index.html"));
    this.win.once("ready-to-show", () => {
      this.win?.show();
      this.win?.focus();
    });
    this.win.on("closed", () => {
      pet.removeListener("move", this.onPetMove);
      this.win = null;
    });

    pet.on("move", this.onPetMove);
  }

  close(): void {
    if (this.isOpen()) this.win!.close();
    this.win = null;
  }

  /**
   * Keep the panel next to the pet while it is dragged or thrown.
   */
  private reposition(): void {
    const pet = this.getPetWindow();
    if (!this.isOpen() || !pet || pet.isDestroyed()) return;
    const { x, y } = this.computePosition(pet);
    this.win!.setPosition(x, y);
  }

  /**
   * Right of the pet if there is room, otherwise left; vertically centred on
   * the pet and clamped to the work area of the pet's display.
   */
  private computePosition(pet: BrowserWindow): { x: number; y: number } {
    const b = pet.getBounds();
    const centre = { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
    const wa = screen.getDisplayNearestPoint(centre).workArea;

    let x = b.x + b.width + GAP;
    if (x + PANEL_WIDTH > wa.x + wa.width) {
      x = b.x - PANEL_WIDTH - GAP;
    }
    x = Math.min(Math.max(x, wa.x), wa.x + wa.width - PANEL_WIDTH);

    let y = Math.round(b.y + b.height / 2 - PANEL_HEIGHT / 2);
    y = Math.min(Math.max(y, wa.y), wa.y + wa.height - PANEL_HEIGHT);
    return { x, y };
  }
}
