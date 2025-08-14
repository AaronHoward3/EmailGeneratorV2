// scripts/skeletonizeBlocks.mjs
// Usage:
//   node scripts/skeletonizeBlocks.mjs "lib/promotion-blocks/minimal_clean" "lib/promotion-blocks/skeleton"
//   (repeat for product/newsletter)
// Notes:
// - Preserves line breaks
// - Never collapses to one line
// - Reindents fragments at the end

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC = process.argv[2];
const OUT = process.argv[3];
if (!SRC || !OUT) {
  console.error("Usage: node scripts/skeletonizeBlocks.mjs <srcDir> <outDir>");
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
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { ensureDir(path.dirname(p)); fs.writeFileSync(p, s, "utf8"); }

function stripVisualAttrs(tag) {
  // keep layout attrs like padding/align/width
  return tag
    .replace(/\sbackground-(?:color|url|image)=["'][^"']*["']/gi, "")
    .replace(/\scolor=["'][^"']*["']/gi, "")
    .replace(/\sfont-family=["'][^"']*["']/gi, "")
    .replace(/\sborder(?:-[a-z-]+)?=["'][^"']*["']/gi, "")
    .replace(/\sborder-radius=["'][^"']*["']/gi, "")
    .replace(/\sbox-shadow=["'][^"']*["']/gi, "")
    .replace(/\stext-transform=["'][^"']*["']/gi, "")
    .replace(/\sletter-spacing=["'][^"']*["']/gi, "")
    .replace(/\stext-decoration=["'][^"']*["']/gi, "")
    .replace(/\sfont-weight=["'][^"']*["']/gi, "")
    .replace(/\sfont-style=["'][^"']*["']/gi, "");
}

function ensureOpenCloseImages(s) {
  return s.replace(/<mj-image\b([^>]*)\/>/gi, (_m, attrs) => `<mj-image${attrs}></mj-image>`);
}

function addClass(tag, className) {
  return /mj-class=/i.test(tag) ? tag : tag.replace(/<mj-([a-z]+)\b/i, (m) => `${m} mj-class="${className}"`);
}

function tagHasText(tag, regexes) {
  const inner = tag.replace(/^<mj-text[^>]*>/i, "").replace(/<\/mj-text>\s*$/i, "");
  return regexes.some((r) => r.test(inner));
}

function prettyFragment(raw) {
  // Keep user newlines if present, but normalize where tags run together.
  let s = raw
    .replace(/>\s+</g, ">\n<")        // split adjacent tags to separate lines
    .replace(/\r\n/g, "\n");          // normalize EOL

  const lines = s.split("\n").map((l) => l.trim()).filter(Boolean);
  const open = /^<([a-z-]+)(?=\s|>)(?![^>]*\/>)[^>]*>$/i;
  const close = /^<\/([a-z-]+)>$/i;
  const selfc = /^<([a-z-]+)[^>]*\/>$/i;

  let depth = 0, out = [];
  for (const line of lines) {
    const isClose = close.test(line);
    if (isClose) depth = Math.max(0, depth - 1);
    out.push("  ".repeat(depth) + line);
    const isOpen = open.test(line);
    const isSelf = selfc.test(line);
    if (isOpen && !isSelf) depth += 1;
  }
  return out.join("\n") + "\n";
}

function skeletonize(content, fileName) {
  let out = String(content);

  // 1) Normalize images (no self-closing)
  out = ensureOpenCloseImages(out);

  // 2) Strip visuals on common tags (preserve line breaks)
  out = out.replace(/<mj-section[^>]*>/gi, stripVisualAttrs);
  out = out.replace(/<mj-column[^>]*>/gi, stripVisualAttrs);
  out = out.replace(/<mj-text[^>]*>/gi, stripVisualAttrs);
  out = out.replace(/<mj-image[^>]*>/gi, stripVisualAttrs);
  out = out.replace(/<mj-button[^>]*>/gi, stripVisualAttrs);
  out = out.replace(/<mj-divider[^>]*>/gi, stripVisualAttrs);

  // 3) Add semantic classes
  out = out.replace(/<mj-button[^>]*>/gi, (t) => addClass(t, "btn"));
  out = out.replace(/<mj-image[^>]*>/gi, (t) => addClass(t, "img"));

  const H1 = [/\{\{\s*hero_title\s*\}\}/i, /\{\{\s*title\s*\}\}/i, /\{\{\s*headline\s*\}\}/i, /\[\[\s*HERO_TITLE\s*\]\]/i];
  const H2 = [/\{\{\s*hero_subtitle\s*\}\}/i, /\{\{\s*subtitle\s*\}\}/i, /\{\{\s*subhead\s*\}\}/i, /\[\[\s*SUBTITLE\s*\]\]/i];

  out = out.replace(/<mj-text[\s\S]*?<\/mj-text>/gi, (t) => {
    if (/mj-class=/i.test(t)) return t;
    if (tagHasText(t, H1)) return addClass(t, "h1");
    if (tagHasText(t, H2)) return addClass(t, "h2");
    return t;
  });

  // 4) Remove any embedded <mj-head> fragments
  out = out.replace(/<mj-head[\s\S]*?<\/mj-head>/gi, "");

  // 5) DO NOT collapse whitespace globally — just pretty-print at the end
  out = prettyFragment(out);
  return out;
}

function main() {
  const files = walk(SRC);
  for (const src of files) {
    const rel = path.relative(SRC, src);
    const outPath = path.join(OUT, rel);
    const raw = read(src);
    const skel = skeletonize(raw, path.basename(src));
    write(outPath, skel);
    console.log("✓", src, "→", outPath);
  }
  console.log("\nDone. Skeleton blocks written to:", OUT);
}
main();
