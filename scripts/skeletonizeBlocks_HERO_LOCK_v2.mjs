// scripts/skeletonizeBlocks_HERO_LOCK_v2.mjs
// Usage:
//   node scripts/skeletonizeBlocks_HERO_LOCK_v2.mjs "<srcDir>" "<outDir>"
//   node scripts/skeletonizeBlocks_HERO_LOCK_v2.mjs "lib/.../skeleton" "lib/.../skeleton"
//
// HARD GUARANTEES:
// - If a tag's open tag or its style= contains "CUSTOMHEROIMAGE" (any case), that tag is returned EXACTLY as-is (zero-touch).
//   We do not alter its attributes, its style, OR its inner content.
// - <mj-divider> tags are returned exactly as-is (keep divider styles).
// - For all other tags: strip color/border/font/shadow attrs, remove color-ish CSS from style="...".
// - <mj-image>/<mj-button> normalization is skipped if the matched tag contains CUSTOMHEROIMAGE anywhere.
// - <mj-text> with literal copy -> {{ body_text }}, unless tokenized already.
// - Remove <mj-head>; pretty-print output; idempotent.
//
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC = process.argv[2];
const OUT = process.argv[3];
if (!SRC || !OUT) {
  console.error("Usage: node scripts/skeletonizeBlocks_HERO_LOCK_v2.mjs <srcDir> <outDir>");
  process.exit(1);
}

const EXT = new Set([".txt", ".mjml"]);
const HERO_RE = /CUSTOMHEROIMAGE/i;

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

function removeHead(s) { return s.replace(/<mj-head[\s\S]*?<\/mj-head>/gi, ""); }
function normalizeSelfClosingImages(s) {
  return s.replace(/<mj-image\b([^>]*)\/>/gi, (_m, attrs) => `<mj-image${attrs}></mj-image>`);
}

function isDividerTag(openTag) {
  return /^<mj-divider\b/i.test(openTag);
}
function isHeroLocked(openTag) {
  return HERO_RE.test(openTag);
}

// Strip visual attrs unless divider/hero-locked
function stripVisualAttrs(openTag) {
  if (isDividerTag(openTag) || isHeroLocked(openTag)) return openTag;
  let t = openTag
    .replace(/\sbackground-(?:color|image|url)=(["'])[\s\S]*?\1/gi, "")
    .replace(/\scolor=(["'])[\s\S]*?\1/gi, "")
    .replace(/\sfont-(?:family|weight|style)=(["'])[\s\S]*?\1/gi, "")
    .replace(/\sborder(?:-[a-z-]+)?=(["'])[\s\S]*?\1/gi, "")
    .replace(/\sborder-radius=(["'])[\s\S]*?\1/gi, "")
    .replace(/\sbox-shadow=(["'])[\s\S]*?\1/gi, "")
    .replace(/\stext-(?:transform|decoration)=(["'])[\s\S]*?\1/gi, "")
    .replace(/\sletter-spacing=(["'])[\s\S]*?\1/gi, "");
  return t;
}

const COLORISH_CSS = /(?:^|;)\s*(?:color|background(?:-color|-image)?|border(?:-top|-right|-bottom|-left)?(?:-color)?|box-shadow)\s*:\s*[^;]+;?/gi;
function cleanStyleAttributes(fragment) {
  return fragment.replace(/<mj-([a-z-]+)([^>]*)>/gi, (m, tag, attrs) => {
    const open = `<mj-${tag}${attrs}>`;
    if (isDividerTag(open) || isHeroLocked(open)) return m; // zero-touch
    const match = attrs.match(/\sstyle=(["'])([\s\S]*?)\1/i);
    if (!match) return m;
    const css = match[2];
    if (HERO_RE.test(css)) return m; // zero-touch if style mentions CUSTOMHEROIMAGE
    const cleaned = css.replace(COLORISH_CSS, "").replace(/\s*;\s*$/,"").trim();
    const newAttrs = attrs.replace(match[0], cleaned ? ` style="${cleaned}"` : "");
    return `<mj-${tag}${newAttrs}>`;
  });
}

// Tag attribute stripping pass
function stripAttrsPerTag(s) {
  return s.replace(/<mj-([a-z-]+)([^>]*)>/gi, (whole, tag, attrs) => {
    const open = `<mj-${tag}${attrs}>`;
    return stripVisualAttrs(open);
  });
}

// Normalizers (skip any tag that includes CUSTOMHEROIMAGE) --------------------
function addClass(openTag, className) {
  return /\bmj-class=/i.test(openTag) ? openTag : openTag.replace(/<mj-([a-z-]+)\b/i, (m) => `${m} mj-class="${className}"`);
}

function normalizeButtons(s) {
  return s.replace(/<mj-button([^>]*)>([\s\S]*?)<\/mj-button>/gi, (whole, attrs, inner) => {
    if (HERO_RE.test(whole)) return whole; // zero-touch if contains CUSTOMHEROIMAGE anywhere
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
    if (HERO_RE.test(whole)) return whole; // zero-touch if CUSTOMHEROIMAGE appears anywhere
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
    if (HERO_RE.test(whole)) return whole; // zero-touch if CUSTOMHEROIMAGE appears anywhere
    const open = `<mj-text${attrs}>`;
    const content = tagHasTokens(inner) ? inner.trim() : "{{ body_text }}";
    return open + content + "</mj-text>";
  });
}

function skeletonize(content) {
  let out = String(content);
  out = removeHead(out);
  out = normalizeSelfClosingImages(out);
  out = stripAttrsPerTag(out);
  out = cleanStyleAttributes(out);
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

if (path.resolve(SRC) === path.resolve(OUT)) {
  const parent = path.dirname(SRC);
  const tmp = path.join(parent, ".tmp_herolock_v2_" + Date.now());
  processDir(SRC, tmp);
  const files = walk(tmp);
  for (const f of files) {
    const rel = path.relative(tmp, f);
    const dest = path.join(SRC, rel);
    ensureDir(path.dirname(dest));
    fs.copyFileSync(f, dest);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("\nDone. In-place HERO-LOCK v2 skeletonization completed for:", SRC);
} else {
  processDir(SRC, OUT);
  console.log("\nDone. Skeleton blocks written to:", OUT);
}
