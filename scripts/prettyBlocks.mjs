// scripts/prettyBlocks.mjs
// Usage:
//   node scripts/prettyBlocks.mjs "lib/promotion-blocks/skeleton"
//   node scripts/prettyBlocks.mjs "lib/product-blocks/skeleton"
//   node scripts/prettyBlocks.mjs "lib/newsletter-blocks/skeleton"

import fs from "fs";
import path from "path";

const ROOT = process.argv[2];
if (!ROOT) {
  console.error("Usage: node scripts/prettyBlocks.mjs <dir>");
  process.exit(1);
}
const EXT = new Set([".txt", ".mjml"]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(walk(p));
    else if (EXT.has(path.extname(p).toLowerCase())) files.push(p);
  }
  return files;
}

function prettyFragment(raw) {
  let s = String(raw || "").replace(/>\s+</g, ">\n<").replace(/\r\n/g, "\n");
  const lines = s.split("\n").map((l) => l.trim()).filter(Boolean);
  const open = /^<([a-z-]+)(?=\s|>)(?![^>]*\/>)[^>]*>$/i;
  const close = /^<\/([a-z-]+)>$/i;
  const selfc = /^<([a-z-]+)[^>]*\/>$/i;

  let depth = 0, out = [];
  for (const line of lines) {
    if (close.test(line)) depth = Math.max(0, depth - 1);
    out.push("  ".repeat(depth) + line);
    if (open.test(line) && !selfc.test(line)) depth += 1;
  }
  return out.join("\n") + "\n";
}

for (const file of walk(ROOT)) {
  const raw = fs.readFileSync(file, "utf8");
  // Heuristic: only act if it's mostly one line
  const newlineCount = (raw.match(/\n/g) || []).length;
  if (newlineCount < 3 || /<mj-/.test(raw) && !/\n\s*</.test(raw)) {
    const pretty = prettyFragment(raw);
    fs.writeFileSync(file, pretty, "utf8");
    console.log("✨ prettified", file);
  }
}
console.log("Done.");
