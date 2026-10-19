/**
 * Copy static assets (HTML files) to dist/ directory.
 * Run after TypeScript compilation.
 */

const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "..", "src", "renderer");
const distDir = path.join(__dirname, "..", "dist", "renderer");

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.name.endsWith(".html")) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied: ${path.relative(path.join(__dirname, ".."), destPath)}`);
    }
  }
}

console.log("Copying HTML assets to dist/...");
copyDir(srcDir, distDir);
console.log("Done.");
