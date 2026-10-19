/**
 * Placeholder sprite generator (SPEC section 8): deterministic, original
 * pixel art drawn entirely by code. No third-party artwork is used.
 *
 * The default character is an ORIGINAL martial artist (red headband, short
 * brown hair, teal gi, cream trousers). It is deliberately not styled after
 * any existing character; people who want a specific look install a sprite
 * pack locally (see docs/decisions.md).
 *
 * Output: assets/goku/placeholder/*.png, assets/goku/actions.json,
 *         assets/goku/pack.json (incl. the Kamehameha beam effect).
 *
 *   npm run generate-sprites
 */

import * as fs from "fs";
import * as path from "path";
import { PNG } from "pngjs";

const ROOT = path.join(__dirname, "..");
const ASSETS = path.join(ROOT, "assets", "goku");
const OUT = path.join(ASSETS, "placeholder");

const F = 64; // frame size
const GROUND = 60; // feet rest on this row

type RGBA = [number, number, number, number];
const hex = (h: string, a = 255): RGBA => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
  a,
];

const C = {
  outline: hex("#1e1a22"),
  skin: hex("#f2c79b"),
  skinShade: hex("#d9a576"),
  hair: hex("#4a2e1f"),
  band: hex("#d63a3a"),
  gi: hex("#2a9d8f"),
  giShade: hex("#1f7a6f"),
  pants: hex("#ede3cc"),
  pantsShade: hex("#c9bea4"),
  belt: hex("#3b2f2f"),
  shoe: hex("#4b4f5c"),
  eye: hex("#1e1a22"),
  mouth: hex("#8a3b3b"),
  orbCore: hex("#f4fdff"),
  orb: hex("#7fe3ff"),
  orbEdge: hex("#2fa8e6"),
};

/* ------------------------------------------------------------------ canvas */

class Canvas {
  readonly w: number;
  readonly h: number;
  readonly px: Uint8ClampedArray;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Uint8ClampedArray(w * h * 4);
  }

  set(x: number, y: number, c: RGBA): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const a = c[3] / 255;
    if (a >= 1 || this.px[i + 3] === 0) {
      this.px[i] = c[0];
      this.px[i + 1] = c[1];
      this.px[i + 2] = c[2];
      this.px[i + 3] = Math.max(this.px[i + 3], c[3]);
    } else {
      this.px[i] = this.px[i] * (1 - a) + c[0] * a;
      this.px[i + 1] = this.px[i + 1] * (1 - a) + c[1] * a;
      this.px[i + 2] = this.px[i + 2] * (1 - a) + c[2] * a;
      this.px[i + 3] = Math.min(255, this.px[i + 3] + c[3] * (1 - this.px[i + 3] / 255));
    }
  }

  alpha(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.px[(y * this.w + x) * 4 + 3];
  }

  disc(cx: number, cy: number, r: number, c: RGBA): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, c);
      }
    }
  }

  /** Thick segment (capsule). */
  seg(x0: number, y0: number, x1: number, y1: number, thick: number, c: RGBA): void {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thick / 2, c);
    }
  }

  rect(x: number, y: number, w: number, h: number, c: RGBA): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  /** 1px dark outline around everything opaque (classic pixel-art look). */
  outline(c: RGBA): void {
    const edge: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y) > 0) continue;
        if (
          this.alpha(x - 1, y) > 128 ||
          this.alpha(x + 1, y) > 128 ||
          this.alpha(x, y - 1) > 128 ||
          this.alpha(x, y + 1) > 128
        ) {
          edge.push(x, y);
        }
      }
    }
    for (let i = 0; i < edge.length; i += 2) this.set(edge[i], edge[i + 1], c);
  }

  blit(src: Canvas, dx: number, dy: number): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        if (src.px[i + 3]) this.set(dx + x, dy + y, [src.px[i], src.px[i + 1], src.px[i + 2], src.px[i + 3]]);
      }
    }
  }

  /** Bounding box of opaque pixels: [minX, minY, maxX, maxY]. */
  bbox(): [number, number, number, number] {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y) > 0) {
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
      }
    }
    return [x0, y0, x1, y1];
  }

  save(file: string): void {
    const png = new PNG({ width: this.w, height: this.h });
    Buffer.from(this.px.buffer).copy(png.data);
    fs.writeFileSync(file, PNG.sync.write(png));
  }
}

/* ---------------------------------------------------------------- skeleton */

/** Limb: absolute angles in degrees. 0 = pointing down, 90 = forward (right), 180 = up, -90 = back. */
interface Limb { upper: number; lower: number }

interface Pose {
  torso: number; // lean from vertical, + = forward
  front: { arm: Limb; leg: Limb };
  back: { arm: Limb; leg: Limb };
  eyes?: "open" | "closed" | "happy";
  mouth?: "flat" | "open" | "smile" | "shout";
  headTilt?: number; // px forward shift of the head
  air?: number; // lift off the ground (px); undefined = feet on GROUND
  orb?: number; // energy orb radius between the hands
  orbAt?: "hands";
}

const dir = (deg: number): [number, number] => {
  const r = (deg * Math.PI) / 180;
  return [Math.sin(r), Math.cos(r)];
};

const L = { torso: 13, upperArm: 8, foreArm: 8, thigh: 9, shin: 9, head: 7 };

interface Joints {
  hip: [number, number];
  shoulder: [number, number];
  head: [number, number];
  arms: { f: [number, number][]; b: [number, number][] };
  legs: { f: [number, number][]; b: [number, number][] };
}

function solve(p: Pose, hipX: number, hipY: number): Joints {
  const up = dir(180 + p.torso);
  const hip: [number, number] = [hipX, hipY];
  const shoulder: [number, number] = [hip[0] + up[0] * L.torso, hip[1] + up[1] * L.torso];
  const head: [number, number] = [
    shoulder[0] + up[0] * (L.head + 1) + (p.headTilt ?? 0),
    shoulder[1] + up[1] * (L.head + 1),
  ];
  const chain = (start: [number, number], a: number, b: number, l1: number, l2: number): [number, number][] => {
    const d1 = dir(a);
    const mid: [number, number] = [start[0] + d1[0] * l1, start[1] + d1[1] * l1];
    const d2 = dir(b);
    return [start, mid, [mid[0] + d2[0] * l2, mid[1] + d2[1] * l2]];
  };
  const sF: [number, number] = [shoulder[0] + 1.5, shoulder[1] + 1];
  const sB: [number, number] = [shoulder[0] - 1.5, shoulder[1] + 1];
  return {
    hip,
    shoulder,
    head,
    arms: {
      f: chain(sF, p.front.arm.upper, p.front.arm.lower, L.upperArm, L.foreArm),
      b: chain(sB, p.back.arm.upper, p.back.arm.lower, L.upperArm, L.foreArm),
    },
    legs: {
      f: chain([hip[0] + 2, hip[1]], p.front.leg.upper, p.front.leg.lower, L.thigh, L.shin),
      b: chain([hip[0] - 2, hip[1]], p.back.leg.upper, p.back.leg.lower, L.thigh, L.shin),
    },
  };
}

function drawFighter(p: Pose): { canvas: Canvas; hand: [number, number] } {
  // Solve once to find how far the feet reach, then place the hips so the
  // lowest foot sits on GROUND (or lift by p.air).
  const probe = solve(p, 32, 30);
  const lowest = Math.max(probe.legs.f[2][1], probe.legs.b[2][1]) + 2;
  const hipY = 30 + (GROUND - lowest) - (p.air ?? 0);
  const j = solve(p, 32, hipY);

  const cv = new Canvas(F, F);
  const limb = (pts: [number, number][], c1: RGBA, c2: RGBA, t1: number, t2: number) => {
    cv.seg(pts[0][0], pts[0][1], pts[1][0], pts[1][1], t1, c1);
    cv.seg(pts[1][0], pts[1][1], pts[2][0], pts[2][1], t2, c2);
  };
  const foot = (pts: [number, number][], c: RGBA) => {
    const [x, y] = pts[2];
    cv.seg(x - 1, y + 1, x + 2.5, y + 1, 3.2, c);
  };

  // Back limbs (shaded).
  limb(j.legs.b, C.pantsShade, C.pantsShade, 5.5, 4.5);
  foot(j.legs.b, C.shoe);
  limb(j.arms.b, C.giShade, C.skinShade, 4, 3.5);
  cv.disc(j.arms.b[2][0], j.arms.b[2][1], 2.4, C.skinShade);

  // Torso (gi), belt.
  cv.seg(j.hip[0], j.hip[1], j.shoulder[0], j.shoulder[1], 9, C.gi);
  const up = dir(180 + p.torso);
  const bx = j.hip[0] + up[0] * 2.5, by = j.hip[1] + up[1] * 2.5;
  cv.seg(bx - 4.5, by, bx + 4.5, by, 2.2, C.belt);
  cv.seg(bx + 3, by + 1, bx + 1, by + 4, 1.4, C.belt); // belt tail
  // Gi lapel.
  cv.seg(j.shoulder[0] - 1, j.shoulder[1] + 1, j.shoulder[0] + 1.5, j.shoulder[1] + 5, 1.2, C.giShade);

  // Front leg.
  limb(j.legs.f, C.pants, C.pants, 5.5, 4.5);
  foot(j.legs.f, C.shoe);

  // Head.
  const [hx, hy] = j.head;
  cv.disc(hx, hy, L.head - 0.5, C.skin);
  // Hair: cap over the top/back, a small fringe.
  for (let y = Math.floor(hy - 7); y <= hy - 1; y++) {
    for (let x = Math.floor(hx - 7); x <= hx + 7; x++) {
      if ((x - hx) ** 2 + (y - hy) ** 2 <= 6.8 ** 2 && (y < hy - 2 || x < hx - 3)) cv.set(x, y, C.hair);
    }
  }
  cv.seg(hx - 6, hy - 1, hx - 6, hy + 3, 2.5, C.hair);
  cv.disc(hx + 3, hy - 5.5, 1.6, C.hair); // fringe tuft
  // Headband and its tails flowing back.
  cv.seg(hx - 6.5, hy - 2.2, hx + 6.5, hy - 2.2, 1.8, C.band);
  cv.seg(hx - 7, hy - 2, hx - 11, hy + 1, 1.5, C.band);
  cv.seg(hx - 7, hy - 1.5, hx - 10, hy + 3, 1.3, C.band);

  // Face (facing right).
  const eyes = p.eyes ?? "open";
  if (eyes === "open") {
    cv.rect(Math.round(hx + 2), Math.round(hy - 0.5), 1, 2, C.eye);
    cv.rect(Math.round(hx + 5), Math.round(hy - 0.5), 1, 2, C.eye);
  } else if (eyes === "closed") {
    cv.rect(Math.round(hx + 1), Math.round(hy + 0.5), 2, 1, C.eye);
    cv.rect(Math.round(hx + 4), Math.round(hy + 0.5), 2, 1, C.eye);
  } else {
    // happy ^ ^
    cv.set(hx + 2, hy, C.eye); cv.set(hx + 3, hy - 1, C.eye); cv.set(hx + 4, hy, C.eye);
    cv.set(hx + 5, hy, C.eye); cv.set(hx + 6, hy - 1, C.eye);
  }
  const mouth = p.mouth ?? "flat";
  const mx = Math.round(hx + 3.5), my = Math.round(hy + 3.5);
  if (mouth === "flat") cv.rect(mx, my, 2, 1, C.mouth);
  if (mouth === "smile") { cv.rect(mx, my, 2, 1, C.mouth); cv.set(mx - 1, my - 1, C.mouth); cv.set(mx + 2, my - 1, C.mouth); }
  if (mouth === "open") cv.rect(mx, my - 1, 2, 2, C.mouth);
  if (mouth === "shout") cv.rect(mx, my - 1, 3, 3, C.mouth);

  // Front arm + fist on top.
  limb(j.arms.f, C.gi, C.skin, 4, 3.5);
  cv.disc(j.arms.f[2][0], j.arms.f[2][1], 2.5, C.skin);

  cv.outline(C.outline);

  // Energy orb (drawn after the outline so it glows over it).
  const hand: [number, number] = [
    (j.arms.f[2][0] + j.arms.b[2][0]) / 2,
    (j.arms.f[2][1] + j.arms.b[2][1]) / 2,
  ];
  if (p.orb) {
    const [ox, oy] = hand;
    cv.disc(ox, oy, p.orb + 1.5, [...C.orbEdge.slice(0, 3), 150] as RGBA);
    cv.disc(ox, oy, p.orb, C.orb);
    cv.disc(ox, oy, Math.max(1, p.orb * 0.5), C.orbCore);
  }
  return { canvas: cv, hand: [j.arms.f[2][0] + 2, j.arms.f[2][1]] };
}

/* ------------------------------------------------------------------- poses */

const stance = { front: { upper: 16, lower: 4 }, back: { upper: -16, lower: -4 } };
const wide = { front: { upper: 26, lower: 8 }, back: { upper: -26, lower: -8 } };
const guardF: Limb = { upper: 35, lower: 150 };
const guardB: Limb = { upper: 25, lower: 140 };

const POSES: Record<string, Pose> = {
  idle: { torso: 2, front: { arm: guardF, leg: stance.front }, back: { arm: guardB, leg: stance.back } },
  jab: { torso: 10, front: { arm: { upper: 90, lower: 90 }, leg: wide.front }, back: { arm: guardB, leg: wide.back }, mouth: "shout" },
  cross: { torso: 18, front: { arm: { upper: -5, lower: 130 }, leg: wide.front }, back: { arm: { upper: 82, lower: 88 }, leg: wide.back }, mouth: "shout" },
  uppercut: { torso: -6, front: { arm: { upper: 150, lower: 172 }, leg: { upper: 30, lower: 0 } }, back: { arm: guardB, leg: { upper: -24, lower: -2 } }, mouth: "shout" },
  jumpUppercut: { torso: -4, air: 6, front: { arm: { upper: 172, lower: 178 }, leg: { upper: 40, lower: -10 } }, back: { arm: { upper: 20, lower: 60 }, leg: { upper: -10, lower: -30 } }, mouth: "shout" },
  frontKick: { torso: -12, front: { arm: guardF, leg: { upper: 82, lower: 88 } }, back: { arm: { upper: -30, lower: 20 }, leg: { upper: -4, lower: 0 } }, mouth: "shout" },
  highKick: { torso: -26, front: { arm: { upper: 10, lower: 120 }, leg: { upper: 118, lower: 128 } }, back: { arm: { upper: -60, lower: -30 }, leg: { upper: -8, lower: 0 } }, mouth: "shout" },
  flyingKick: { torso: -10, air: 8, front: { arm: guardF, leg: { upper: 70, lower: 78 } }, back: { arm: { upper: -50, lower: 10 }, leg: { upper: 30, lower: -70 } }, mouth: "shout" },
  block: { torso: -6, front: { arm: { upper: 50, lower: 165 }, leg: stance.front }, back: { arm: { upper: 60, lower: 155 }, leg: stance.back }, eyes: "closed", mouth: "flat" },
  charge0: { torso: -8, front: { arm: { upper: -35, lower: -10 }, leg: wide.front }, back: { arm: { upper: -45, lower: -15 }, leg: wide.back }, mouth: "flat" },
  charge1: { torso: -10, front: { arm: { upper: -40, lower: -15 }, leg: wide.front }, back: { arm: { upper: -48, lower: -20 }, leg: wide.back }, orb: 1.5, mouth: "open" },
  charge2: { torso: -12, front: { arm: { upper: -42, lower: -20 }, leg: wide.front }, back: { arm: { upper: -50, lower: -25 }, leg: wide.back }, orb: 2.5, mouth: "open" },
  charge3: { torso: -14, front: { arm: { upper: -44, lower: -25 }, leg: wide.front }, back: { arm: { upper: -52, lower: -28 }, leg: wide.back }, orb: 3.5, mouth: "shout" },
  fire: { torso: 14, front: { arm: { upper: 86, lower: 90 }, leg: { upper: 30, lower: 10 } }, back: { arm: { upper: 80, lower: 88 }, leg: { upper: -30, lower: -10 } }, mouth: "shout" },
  drag: { torso: 0, air: 6, front: { arm: { upper: 168, lower: 176 }, leg: { upper: 8, lower: -6 } }, back: { arm: { upper: 160, lower: 172 }, leg: { upper: -4, lower: 6 } }, mouth: "open" },
  cheer: { torso: 0, front: { arm: { upper: 140, lower: 160 }, leg: stance.front }, back: { arm: { upper: 135, lower: 150 }, leg: stance.back }, eyes: "happy", mouth: "smile" },
  think: { torso: 0, headTilt: -1, front: { arm: { upper: 30, lower: 165 }, leg: stance.front }, back: { arm: { upper: 10, lower: 0 }, leg: stance.back }, mouth: "flat" },
  sleep: { torso: 6, headTilt: 1, front: { arm: { upper: 6, lower: 2 }, leg: stance.front }, back: { arm: { upper: 4, lower: 0 }, leg: stance.back }, eyes: "closed", mouth: "flat" },
  fly: { torso: 55, air: 10, front: { arm: { upper: 120, lower: 115 }, leg: { upper: -40, lower: -50 } }, back: { arm: { upper: -40, lower: -20 }, leg: { upper: -30, lower: -55 } }, mouth: "flat" },
};

// sheet -> frames (pose names)
const SHEETS: Record<string, string[]> = {
  "idle.png": ["idle"],
  "fly.png": ["fly"],
  "drag.png": ["drag"],
  "punch_1.png": ["jab", "cross"],
  "punch_2.png": ["cross"],
  "punch_3.png": ["jab"],
  "uppercut.png": ["uppercut", "jumpUppercut"],
  "kick_1.png": ["frontKick"],
  "kick_2.png": ["highKick", "flyingKick"],
  "block.png": ["block"],
  "kamehameha_charge.png": ["charge0", "charge1", "charge2", "charge3"],
  "kamehameha_fire.png": ["fire"],
  "cheer.png": ["cheer"],
  "think.png": ["think"],
  "sleep.png": ["sleep"],
  "train.png": ["jab", "cross", "jab", "uppercut"],
  "spar.png": ["frontKick", "jab", "highKick", "cross"],
  // Keyboard strikes (src/services/input-service.ts): Backspace -> 0,
  // Enter -> 2-3 (uppercuts), Space -> 5-7 (kicks), other keys -> any.
  "strikes.png": ["jab", "cross", "uppercut", "jumpUppercut", "frontKick", "frontKick", "highKick", "flyingKick"],
};

// action -> [sheet, fps, loop]
const ACTIONS: Record<string, [string, number, boolean]> = {
  idle: ["idle.png", 6, true],
  hover: ["idle.png", 6, true],
  nimbus_ride: ["idle.png", 6, true],
  fly: ["fly.png", 8, true],
  drag: ["drag.png", 8, true],
  punch_1: ["punch_1.png", 12, false],
  punch_2: ["punch_2.png", 12, false],
  punch_3: ["punch_3.png", 12, false],
  uppercut: ["uppercut.png", 12, false],
  kick_1: ["kick_1.png", 12, false],
  kick_2: ["kick_2.png", 12, false],
  block: ["block.png", 8, false],
  kamehameha_charge: ["kamehameha_charge.png", 4, false],
  kamehameha_fire: ["kamehameha_fire.png", 4, false],
  kaioken: ["idle.png", 8, true],
  laugh: ["cheer.png", 6, false],
  done: ["cheer.png", 6, false],
  stretch: ["cheer.png", 6, false],
  thinking: ["think.png", 4, true],
  scratch_head: ["think.png", 6, false],
  confused: ["think.png", 6, false],
  look_around: ["idle.png", 4, false],
  scroll_unroll: ["idle.png", 6, false],
  working: ["train.png", 6, true],
  train: ["train.png", 8, true],
  spar: ["spar.png", 12, false],
  peek: ["idle.png", 6, false],
  drink: ["idle.png", 6, false],
  eat: ["idle.png", 6, false],
  sleep: ["sleep.png", 4, true],
  yawn: ["sleep.png", 4, false],
  stomach_growl: ["think.png", 6, false],
  strikes: ["strikes.png", 12, false],
};

/* -------------------------------------------------------------------- beam */

/** Original energy beam: tapered at the hands, widening into a rounded head. */
function drawBeam(): { canvas: Canvas; originX: number; originY: number } {
  const W = 150, H = 44, cy = H / 2;
  const cv = new Canvas(W, H);
  const layers: [number, RGBA][] = [
    [1.0, [...C.orbEdge.slice(0, 3), 200] as RGBA],
    [0.72, C.orb],
    [0.38, C.orbCore],
  ];
  for (const [k, col] of layers) {
    for (let x = 0; x < W - 6; x++) {
      const t = x / (W - 6);
      // Narrow at the hands, swelling towards the head.
      const half = (3 + 15 * Math.pow(t, 0.6)) * k;
      for (let y = Math.floor(cy - half); y <= Math.ceil(cy + half); y++) cv.set(x, y, col);
    }
    cv.disc(W - 22, cy, 19 * k, col);
  }
  // A few streaks for motion.
  for (const [y0, len] of [[cy - 9, 40], [cy + 8, 55], [cy - 3, 70]] as [number, number][]) {
    cv.rect(W - 30 - len, Math.round(y0), len, 1, [255, 255, 255, 170]);
  }
  cv.outline([...C.orbEdge.slice(0, 3), 110] as RGBA);
  return { canvas: cv, originX: 0, originY: Math.round(cy) };
}

/* -------------------------------------------------------------------- main */

function main(): void {
  fs.mkdirSync(OUT, { recursive: true });

  const frames: Record<string, Canvas> = {};
  const hands: Record<string, [number, number]> = {};
  for (const [name, pose] of Object.entries(POSES)) {
    const { canvas, hand } = drawFighter(pose);
    frames[name] = canvas;
    hands[name] = hand;
  }

  const counts: Record<string, number> = {};
  for (const [file, names] of Object.entries(SHEETS)) {
    const sheet = new Canvas(F * names.length, F);
    names.forEach((n, i) => sheet.blit(frames[n], i * F, 0));
    sheet.save(path.join(OUT, file));
    counts[file] = names.length;
  }

  const beam = drawBeam();
  beam.canvas.save(path.join(OUT, "beam.png"));

  const actions: Record<string, unknown> = {};
  for (const [name, [sheet, fps, loop]] of Object.entries(ACTIONS)) {
    const n = counts[sheet];
    actions[name] = {
      sheet: `placeholder/${sheet}`,
      frameWidth: F,
      frameHeight: F,
      frameCount: n,
      framesPerRow: n,
      fps,
      anchorX: F / 2,
      anchorY: F / 2,
      loop,
      frameEvents: {},
      flip: false,
    };
  }
  fs.writeFileSync(path.join(ASSETS, "actions.json"), JSON.stringify({ actions }, null, 2) + "\n");

  const hand = hands.fire;
  const pack = {
    name: "Default (original placeholder)",
    author: "saiyan-desk-pet contributors",
    version: "2.0.0",
    license: "MIT",
    facing: "right",
    rendering: "pixelated",
    effects: {
      kamehameha: {
        image: "placeholder/beam.png",
        originX: beam.originX,
        originY: beam.originY,
        handX: Math.round(hand[0]),
        handY: Math.round(hand[1]),
      },
    },
  };
  fs.writeFileSync(path.join(ASSETS, "pack.json"), JSON.stringify(pack, null, 2) + "\n");

  console.log(
    `Generated ${Object.keys(POSES).length} poses, ${Object.keys(SHEETS).length} sheets, ` +
      `${Object.keys(ACTIONS).length} actions and the beam in assets/goku/placeholder/`
  );
}

main();
