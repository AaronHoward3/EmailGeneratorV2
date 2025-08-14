// scripts/skeletonizeBlocks_v2.mjs
// Usage examples:
//   node scripts/skeletonizeBlocks_v2.mjs "lib/promotion-blocks/bold_contrasting" "lib/promotion-blocks/skeleton"
//   node scripts/skeletonizeBlocks_v2.mjs "lib/product-blocks/bold_contrasting" "lib/product-blocks/skeleton"
//   node scripts/skeletonizeBlocks_v2.mjs "lib/newsletter-blocks/bold_contrasting" "lib/newsletter-blocks/skeleton"
// In-place:
//   node scripts/skeletonizeBlocks_v2.mjs "lib/promotion-blocks/skeleton" "lib/promotion-blocks/skeleton"
//
// What it does (additions vs v1):
// - Strips color-related declarations inside style="" while preserving layout declarations like text-align/padding where possible
// - Replaces hardcoded text in <mj-text> with {{ body_text }} (unless it already has tokens)
// - Normalizes <mj-button> label + href to {{ cta_label }} and {{ cta_url }}
// - Normalizes <mj-image src/alt> to {{ image_url }} / {{ image_alt }}
// - Keeps existing tokenized placeholders intact ({{...}} or [[...]])
// - Pretty-prints consistently
//
// Safe to re-run; idempotent.
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC = process.argv[2];
const OUT = process.argv[3];
if (!SRC || !OUT) {
  console.error("Usage: node scripts/skeletonizeBlocks_v2.mjs <srcDir> <outDir>");
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

// ----- Pretty printer (preserve user newlines; ensure tag-per-line; indent) -----
function prettyFragment(raw) {
  let s = String(raw || "")
    .replace(/>\s+</g, ">\n<")    // split adjacent tags to separate lines
    .replace(/\r\n/g, "\n");     // normalize EOL

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

// ----- Helpers -----
function ensureOpenCloseImages(s) {
  return s.replace(/<mj-image\b([^>]*)\/>/gi, (_m, attrs) => `<mj-image${attrs}></mj-image>`);
}
function addClass(tag, className) {
  return /\bmj-class=/i.test(tag) ? tag : tag.replace(/<mj-([a-z]+)\b/i, (m) => `${m} mj-class="${className}"`);
}
function stripVisualAttrs(tag) {
  // remove the usual color/brand/style attrs, but keep layout-y things
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
const COLORISH_CSS = /(?:^|;)\s*(?:color|background(?:-color|-image)?|border(?:-top|-right|-bottom|-left)?(?:-color)?|box-shadow)\s*:\s*[^;]+;?/gi;

function cleanStyleAttributes(fragment) {
  // Remove color-ish declarations inside style="..."
  return fragment.replace(/\sstyle=(["'])([\s\S]*?)\1/gi, (m, q, css) => {
    const cleaned = css.replace(COLORISH_CSS, "").replace(/\s*;\s*$/,"").trim();
    if (!cleaned) return ""; // drop empty style=""
    return ` style=${q}${cleaned}${q}`;
  });
}

function tagHasTokens(s) {
  return /\{\{[\s\S]*?\}\}|\[\[[\s\S]*?\]\]/.test(s);
}

function normalizeButtons(s) {
  return s.replace(/<mj-button([^>]*)>([\s\S]*?)<\/mj-button>/gi, (whole, attrs, inner) => {
    // normalize href to token if not tokenized
    let newAttrs = attrs;
    if (!/\bhref=/.test(newAttrs)) {
      newAttrs += ' href="{{ cta_url }}"';
    } else {
      newAttrs = newAttrs.replace(/\bhref=(["'])(?!\{\{)[\s\S]*?\1/gi, 'href="{{ cta_url }}"');
    }
    // add class
    const openTag = `<mj-button${newAttrs}>`;
    const label = tagHasTokens(inner) ? inner : "{{ cta_label }}";
    return addClass(openTag, "btn") + label + "</mj-button>";
  });
}

function normalizeImages(s) {
  s = s.replace(/<mj-image([^>]*)>([\s\S]*?)<\/mj-image>/gi, (whole, attrs, inner) => {
    let a = attrs;
    // src
    if (!/\bsrc=/.test(a)) a += ' src="{{ image_url }}"';
    else a = a.replace(/\bsrc=(["'])(?!\{\{)[^"']*\1/gi, 'src="{{ image_url }}"');
    // alt
    if (!/\balt=/.test(a)) a += ' alt="{{ image_alt }}"';
    else a = a.replace(/\balt=(["'])(?!\{\{)[^"']*\1/gi, 'alt="{{ image_alt }}"');
    // title (optional)
    a = a.replace(/\btitle=(["'])(?!\{\{)[^"']*\1/gi, 'title="{{ image_title }}"');
    const open = addClass(`<mj-image${a}>`, "img");
    // keep inner content if it contains tokens, otherwise drop
    const content = tagHasTokens(inner) ? inner : "";
    return open + content + "</mj-image>";
  });
  return s;
}

function normalizeTextBlocks(s) {
  return s.replace(/<mj-text([^>]*)>([\s\S]*?)<\/mj-text>/gi, (whole, attrs, inner) => {
    // Add semantic classes if header-ish tokens detected
    const H1 = [/\{\{\s*hero_title\s*\}\}/i, /\{\{\s*title\s*\}\}/i, /\{\{\s*headline\s*\}\}/i, /\[\[\s*HERO_TITLE\s*\]\]/i];
    const H2 = [/\{\{\s*hero_subtitle\s*\}\}/i, /\{\{\s*subtitle\s*\}\}/i, /\{\{\s*subhead\s*\}\}/i, /\[\[\s*SUBTITLE\s*\]\]/i];

    let tagOpen = `<mj-text${attrs}>`;
    if (!/\bmj-class=/.test(attrs)) {
      const isH1 = H1.some((r) => r.test(inner));
      const isH2 = H2.some((r) => r.test(inner));
      if (isH1) tagOpen = addClass(tagOpen, "h1");
      else if (isH2) tagOpen = addClass(tagOpen, "h2");
    }

    // If inner already tokenized, keep it. Otherwise replace with a neutral token.
    const content = tagHasTokens(inner) ? inner.trim() : "{{ body_text }}";
    return tagOpen + content + "</mj-text>";
  });
}

function removeHeadFragments(s) {
  return s.replace(/<mj-head[\s\S]*?<\/mj-head>/gi, "");
}

function skeletonize(content) {
  let out = String(content);

  // Normalize self-closing images -> open/close
  out = ensureOpenCloseImages(out);

  // Strip <mj-head> and any inline color-ish style declarations
  out = removeHeadFragments(out);
  out = cleanStyleAttributes(out);

  // Strip visual attributes on common tags
  out = out.replace(/<mj-section[^>]*>/gi, stripVisualAttrs);
  out = out.replace(/<mj-column[^>]*>/gi, stripVisualAttrs);
  out = out.replace(/<mj-text[^>]*>/gi, stripVisualAttrs);
  out = out.replace(/<mj-image[^>]*>/gi, stripVisualAttrs);
  out = out.replace(/<mj-button[^>]*>/gi, stripVisualAttrs);
  out = out.replace(/<mj-divider[^>]*>/gi, stripVisualAttrs);

  // Normalize components
  out = normalizeButtons(out);
  out = normalizeImages(out);
  out = normalizeTextBlocks(out);

  // Pretty print
  out = prettyFragment(out);
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

// Support safe in-place writes by writing to a temp dir then swapping
if (path.resolve(SRC) === path.resolve(OUT)) {
  const parent = path.dirname(SRC);
  const tmp = path.join(parent, ".tmp_skeletonize_" + Date.now());
  processDir(SRC, tmp);
  // Move tmp -> SRC (overwrite)
  const files = walk(tmp);
  for (const f of files) {
    const rel = path.relative(tmp, f);
    const dest = path.join(SRC, rel);
    ensureDir(path.dirname(dest));
    fs.copyFileSync(f, dest);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("\nDone. In-place skeletonization completed for:", SRC);
} else {
  processDir(SRC, OUT);
  console.log("\nDone. Skeleton blocks written to:", OUT);
}
