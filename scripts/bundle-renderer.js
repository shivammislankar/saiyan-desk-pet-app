/**
 * Bundle renderer entries to browser-ready IIFE files using esbuild.
 * tsc compiles main/preload as CommonJS; renderer files loaded via
 * <script> tags need bundled IIFE output (no exports/require at runtime).
 */

const path = require("path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");

const entries = [
  { in: "src/renderer/pet/renderer.ts", out: "dist/renderer/pet/renderer.js" },
  { in: "src/renderer/overlay/overlay-renderer.ts", out: "dist/renderer/overlay/overlay-renderer.js" },
  { in: "src/renderer/settings/settings-ui.ts", out: "dist/renderer/settings/settings-ui.js" },
  { in: "src/renderer/todo/todo-ui.ts", out: "dist/renderer/todo/todo-ui.js" },
  { in: "src/renderer/beam/beam.ts", out: "dist/renderer/beam/beam.js" },
];

for (const e of entries) {
  esbuild.buildSync({
    entryPoints: [path.join(root, e.in)],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    outfile: path.join(root, e.out),
    logLevel: "info",
  });
  console.log(`Bundled: ${e.out}`);
}

console.log("Renderer bundling done.");
