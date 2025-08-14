// scripts/skeletonizeBlocks_HERO_LOCK.mjs
// Usage:
//   node scripts/skeletonizeBlocks_HERO_LOCK.mjs "<srcDir>" "<outDir>"
//   node scripts/skeletonizeBlocks_HERO_LOCK.mjs "lib/.../skeleton" "lib/.../skeleton"
//
// Guarantees:
// - NEVER removes or modifies any `background-url=` attribute anywhere (kept exactly as-is).
// - If a tag's open tag contains `CUSTOMHEROIMAGE` (in any attribute OR inside style="..."), that tag's
//   *entire attribute list* is left untouched (zero-touch). Children still processed normally.
// - <mj-divider> tags are left entirely untouched (you asked to keep divider lines/styles).
// - Other tags: strip visual attrs (color, background-color, font-*, border*, box-shadow, letter-spacing, text-*),
//   and remove color-ish declarations from style="..." if present.
// - Normalizes <mj-button> (href/label) and <mj-image> (src/alt/title) with tokens.
// - Replaces literal text inside <mj-text> with {{ body_text }} unless already tokenized.
// - Removes <mj-head>; pretty-prints; idempotent.
//
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC = process.argv[2];
const OUT = process.argv[3];
if (!SRC || !OUT) {
  console.error("Usage: node scripts/skeletonizeBlocks_HERO_LOCK.mjs <srcDir> <outDir>");
  process.exit(1);
}

const EXT = new Set([".txt", ".mjml"]);
const HERO_KEY = "CUSTOMHEROIMAGE";

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

// Pretty printing
function pretty(raw) {
  let s = String(raw || "")
    .replace(/>\s+</g, ">\n<")
    .replace(/\r\n/g, "\n");
  const lines = s.split("\n").map(l => l.trim()).filter(Boolean);
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

function tagHasTokens(s) {
  return /\{\{[\s\S]*?\}\}|\[\[[\s\S]*?\]\]/.test(s);
}

// Remove <mj-head>
function removeHead(s) { return s.replace(/<mj-head[\s\S]*?<\/mj-head>/gi, ""); }

// Normalize <mj-image .../> → <mj-image ...></mj-image> for consistent handling
function normalizeSelfClosingImages(s) {
  return s.replace(/<mj-image\b([^>]*)\/>/gi, (_m, attrs) => `<mj-image${attrs}></mj-image>`);
}

// Attribute cleaners ----------------------------------------------------------
function heroOrBgUrlGuard(openTag) {
  // Zero-touch if this tag mentions CUSTOMHEROIMAGE OR has a background-url attribute at all.
  if (openTag.search(new RegExp(HERO_KEY, "i")) !== -1) return true;
  if (/\sbackground-url=(["'])[\s\S]*?\1/i.test(openTag)) return true;
  return false;
}

function stripVisualAttrs(tagName, openTag) {
  const name = tagName.toLowerCase();
  if (name === "mj-divider") return openTag; // Keep divider entirely

  // If guarded, leave attributes unchanged (BUT still normalize buttons/images/text later)
  if (heroOrBgUrlGuard(openTag)) return openTag;

  // Else strip visual attributes
  let t = openTag
    .replace(/\sbackground-color=(["'])[\s\S]*?\1/gi, "") // keep background-url elsewhere; only remove background-color
    .replace(/\scolor=(["'])[\s\S]*?\1/gi, "")
    .replace(/\sfont-(?:family|weight|style)=(["'])[\s\S]*?\1/gi, "")
    .replace(/\sborder(?:-[a-z-]+)?=(["'])[\s\S]*?\1/gi, "")
    .replace(/\sborder-radius=(["'])[\s\S]*?\1/gi, "")
    .replace(/\sbox-shadow=(["'])[\s\S]*?\1/gi, "")
    .replace(/\stext-(?:transform|decoration)=(["'])[\s\S]*?\1/gi, "")
    .replace(/\sletter-spacing=(["'])[\s\S]*?\1/gi, "");
  return t;
}

const COLORISH_CSS = /(?:^|;)\s*(?:color|background-color|border(?:-top|-right|-bottom|-left)?(?:-color)?|box-shadow)\s*:\s*[^;]+;?/gi;
// NOTE: We intentionally DO NOT match background-image/url in CSS, to avoid touching inline bg URLs.
// If style contains CUSTOMHEROIMAGE, we keep style as-is.
function cleanStyleAttributes(fragment) {
  return fragment.replace(/<mj-([a-z-]+)([^>]*)>/gi, (m, tag, attrs) => {
    if (tag.toLowerCase() === "mj-divider") return m; // preserve divider styles
    const openTag = `<mj-${tag}${attrs}>`;
    if (heroOrBgUrlGuard(openTag)) return m; // zero-touch for hero/bg-url tags

    const styleMatch = attrs.match(/\sstyle=(["'])([\s\S]*?)\1/i);
    if (!styleMatch) return m;

    const css = styleMatch[2];
    if (css.search(new RegExp(HERO_KEY, "i")) !== -1) return m; // zero-touch if hero token appears in style

    const cleaned = css.replace(COLORISH_CSS, "").replace(/\s*;\s*$/,"").trim();
    const newAttrs = attrs.replace(styleMatch[0], cleaned ? ` style="${cleaned}"` : "");
    return `<mj-${tag}${newAttrs}>`;
  });
}

// Normalizers ----------------------------------------------------------------
function addClass(openTag, className) {
  return /\bmj-class=/i.test(openTag) ? openTag : openTag.replace(/<mj-([a-z-]+)\b/i, (m) => `${m} mj-class="${className}"`);
}

function normalizeButtons(s) {
  return s.replace(/<mj-button([^>]*)>([\s\S]*?)<\/mj-button>/gi, (whole, attrs, inner) => {
    let a = attrs;
    if (!/\bhref=/.test(a)) a += ' href="{{ cta_url }}"';
    else a = a.replace(/\bhref=(["'])(?!\{\{)[\s\S]*?\1/gi, 'href="{{ cta_url }}"');
    const open = addClass(`<mj-button${a}>`, "btn");
    const label = tagHasTokens(inner) ? inner : "{{ cta_label }}";
    return open + label + "</mj-button>";
  });
}

function normalizeImages(s) {
  return s.replace(/<mj-image([^>]*)>([\s\S]*?)<\/mj-image>/gi, (whole, attrs, inner) => {
    let a = attrs;
    if (!/\bsrc=/.test(a)) a += ' src="{{ image_url }}"';
    else a = a.replace(/\bsrc=(["'])(?!\{\{)[^"']*\1/gi, 'src="{{ image_url }}"');
    if (!/\balt=/.test(a)) a += ' alt="{{ image_alt }}"';
    else a = a.replace(/\balt=(["'])(?!\{\{)[^"']*\1/gi, 'alt="{{ image_alt }}"');
    a = a.replace(/\btitle=(["'])(?!\{\{)[^"']*\1/gi, 'title="{{ image_title }}"');
    const open = addClass(`<mj-image${a}>`, "img");
    const content = tagHasTokens(inner) ? inner : "";
    return open + content + "</mj-image>";
  });
}

function normalizeText(s) {
  return s.replace(/<mj-text([^>]*)>([\s\S]*?)<\/mj-text>/gi, (whole, attrs, inner) => {
    const open = `<mj-text${attrs}>`;
    const content = tagHasTokens(inner) ? inner.trim() : "{{ body_text }}";
    return open + content + "</mj-text>";
  });
}

function stripAttrsPerTag(s) {
  return s.replace(/<mj-([a-z-]+)([^>]*)>/gi, (whole, tag, attrs) => {
    const open = `<mj-${tag}${attrs}>`;
    return stripVisualAttrs(tag, open);
  });
}

function skeletonize(content) {
  let out = String(content);
  out = removeHead(out);
  out = normalizeSelfClosingImages(out);
  out = stripAttrsPerTag(out);     // attribute-level stripping (hero/bg-url guarded)
  out = cleanStyleAttributes(out); // style= cleanup (hero/bg-url guarded)
  out = normalizeButtons(out);
  out = normalizeImages(out);
  out = normalizeText(out);
  out = pretty(out);
  return out;
}

function processDir(src, outDir) {
  const files = walk(src);
  files.forEach((srcFile) => {
    const rel = path.relative(src, srcFile);
    const outPath = path.join(outDir, rel);
    const raw = read(srcFile);
    const result = skeletonize(raw);
    write(outPath, result);
    console.log("✓", srcFile, "→", outPath);
  });
}

// Safe in-place: write to tmp then replace
if (path.resolve(SRC) === path.resolve(OUT)) {
  const parent = path.dirname(SRC);
  const tmp = path.join(parent, ".tmp_herolock_" + Date.now());
  processDir(SRC, tmp);
  const files = walk(tmp);
  for (const f of files) {
    const rel = path.relative(tmp, f);
    const dest = path.join(SRC, rel);
    ensureDir(path.dirname(dest));
    fs.copyFileSync(f, dest);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("\nDone. In-place HERO-LOCK skeletonization completed for:", SRC);
} else {
  processDir(SRC, OUT);
  console.log("\nDone. Skeleton blocks written to:", OUT);
}
