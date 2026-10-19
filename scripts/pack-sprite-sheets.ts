/**
 * Pack loose 128x128 frames (assets/goku/sprites/base_*.png) into one
 * horizontal strip sheet per action + regenerate assets/goku/actions.json.
 *
 * Usage: tsc --project tsconfig.scripts.json && node dist-scripts/pack-sprite-sheets.js
 */

import * as fs from "fs";
import * as path from "path";
import { PNG } from "pngjs";

const ASSETS = path.join(__dirname, "..", "assets", "goku");
const SRC = path.join(ASSETS, "sprites");
const OUT = path.join(ASSETS, "sheets");

const FORM = "base";
const W = 128;
const H = 128;
const ANCHOR_X = 64;
const ANCHOR_Y = 112;

interface ActionDef {
  frames: string[];
  fps: number;
  loop: boolean;
}

// Frame suffixes per action (files: base_<name>_<i>.png)
const ACTIONS: Record<string, ActionDef> = {
  idle: { frames: ["idle_0", "idle_1", "idle_2"], fps: 6, loop: true },
  fly: { frames: ["dash_0"], fps: 8, loop: true },
  hover: { frames: ["idle_0", "idle_1", "idle_2"], fps: 4, loop: true },
  nimbus_ride: { frames: ["idle_0", "idle_1", "idle_2"], fps: 4, loop: true },
  punch_1: { frames: ["punch_0", "punch_1"], fps: 12, loop: false },
  punch_2: { frames: ["punch_2"], fps: 12, loop: false },
  punch_3: { frames: ["punch_3"], fps: 12, loop: false },
  kick_1: { frames: ["kick_0", "kick_1"], fps: 12, loop: false },
  kick_2: { frames: ["kick_2", "kick_3"], fps: 12, loop: false },
  uppercut: { frames: ["punch_3"], fps: 12, loop: false },
  block: { frames: ["block_0"], fps: 8, loop: false },
  kamehameha_charge: { frames: ["charge_0", "charge_1", "charge_2"], fps: 8, loop: false },
  kamehameha_fire: { frames: ["blast_0"], fps: 8, loop: false },
  kaioken: { frames: ["powerup_0", "powerup_1"], fps: 8, loop: true },
  laugh: { frames: ["victory_0"], fps: 6, loop: false },
  scroll_unroll: { frames: ["idle_0", "idle_1", "idle_2"], fps: 6, loop: false },
  peek: { frames: ["idle_0"], fps: 6, loop: false },
  stretch: { frames: ["victory_0"], fps: 6, loop: false },
  drink: { frames: ["idle_0"], fps: 6, loop: false },
  thinking: { frames: ["idle_0", "idle_1", "idle_2"], fps: 4, loop: true },
  done: { frames: ["victory_0"], fps: 6, loop: false },
  drag: { frames: ["jump_0"], fps: 8, loop: true },
  sleep: { frames: ["idle_0"], fps: 4, loop: true },
  working: { frames: ["idle_0", "idle_1", "idle_2"], fps: 4, loop: true },
  confused: { frames: ["idle_0"], fps: 6, loop: false },
  eat: { frames: ["idle_0"], fps: 6, loop: false },
  train: { frames: ["run_0", "run_1", "run_2", "run_3"], fps: 8, loop: true },
  scratch_head: { frames: ["idle_0"], fps: 6, loop: false },
  yawn: { frames: ["idle_0"], fps: 4, loop: false },
  stomach_growl: { frames: ["idle_0"], fps: 6, loop: false },
  look_around: { frames: ["idle_0", "idle_1", "idle_2"], fps: 4, loop: false },
  spar: { frames: ["punch_0", "punch_1", "kick_0", "kick_1"], fps: 12, loop: false },
};

function loadFrame(name: string): PNG {
  const p = path.join(SRC, `${FORM}_${name}.png`);
  if (!fs.existsSync(p)) throw new Error(`Missing frame: ${p}`);
  const png = PNG.sync.read(fs.readFileSync(p));
  if (png.width !== W || png.height !== H) {
    throw new Error(`Unexpected size ${png.width}x${png.height}: ${p}\n  Expected: ${W}x${H}. Did you update the source PNGs in assets/goku/sprites/?`);
  }
  return png;
}

export function packSpriteSheets(): void {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const actionsJson: Record<string, unknown> = {};
  const sheetCache = new Map<string, string>(); // frameKey -> sheet file

  for (const [action, def] of Object.entries(ACTIONS)) {
    const key = def.frames.join("+");
    let sheetFile = sheetCache.get(key);
    if (!sheetFile) {
      sheetFile = `${action}.png`;
      const sheet = new PNG({ width: W * def.frames.length, height: H });
      def.frames.forEach((f, i) => {
        const frame = loadFrame(f);
        PNG.bitblt(frame, sheet, 0, 0, W, H, i * W, 0);
      });
      fs.writeFileSync(path.join(OUT, sheetFile), PNG.sync.write(sheet));
      sheetCache.set(key, sheetFile);
      console.log(`Sheet: ${sheetFile} (${def.frames.length} frames)`);
    }
    actionsJson[action] = {
      sheet: `sheets/${sheetFile}`,
      frameWidth: W,
      frameHeight: H,
      frameCount: def.frames.length,
      framesPerRow: def.frames.length,
      fps: def.fps,
      anchorX: ANCHOR_X,
      anchorY: ANCHOR_Y,
      loop: def.loop,
      frameEvents: {},
      flip: false,
    };
  }

  fs.writeFileSync(
    path.join(ASSETS, "actions.json"),
    JSON.stringify({ actions: actionsJson }, null, 2)
  );
  console.log(`Wrote actions.json (${Object.keys(actionsJson).length} actions)`);
}

if (require.main === module) {
  packSpriteSheets();
}
