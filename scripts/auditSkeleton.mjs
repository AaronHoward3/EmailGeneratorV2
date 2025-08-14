// scripts/auditSkeleton.mjs
// Scans a directory of MJML/txt fragments and reports likely violations:
// - Hardcoded colors (hex/rgb/hsl/named) or gradients
// - Inline style= with color-ish declarations
// - <mj-text> that contains literal copy (no tokens)
// - <mj-button> missing tokenized href/label
// - <mj-image> missing tokenized src/alt
//
// Usage:
//   node scripts/auditSkeleton.mjs "lib/promotion-blocks/skeleton"
//   node scripts/auditSkeleton.mjs "lib/product-blocks/skeleton"
//   node scripts/auditSkeleton.mjs "lib/newsletter-blocks/skeleton"
import fs from "fs";
import path from "path";

const ROOT = process.argv[2];
if (!ROOT) {
  console.error("Usage: node scripts/auditSkeleton.mjs <dir>");
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

const COLOR_HEX = /#[0-9a-fA-F]{3,8}\b/g;
const COLOR_FN = /\b(?:rgb|rgba|hsl|hsla)\s*\(/gi;
const COLOR_NAMES = /\b(white|black|red|blue|green|yellow|purple|orange|pink|cyan|magenta|lime|teal|navy|maroon|gray|grey|silver|gold)\b/gi;
const GRADIENT = /linear-gradient|radial-gradient/gi;
const STYLE_COLORISH = /style=(["'])[\s\S]*?(?:color|background|border|box-shadow)[\s\S]*?\1/gi;

function hasHardcodedTextInMjText(s) {
  // Consider it "hardcoded" if <mj-text>...</mj-text> has letters but no {{...}} or [[...]] tokens.
  return s.replace(/<mj-text[\s\S]*?>/gi, "<mj-text>")
          .replace(/<\/mj-text>/gi, "</mj-text>")
          .match(/<mj-text>([\s\S]*?)<\/mj-text>/gi)
          ?.some(block => {
            const inner = block.replace(/^<mj-text>/i, "").replace(/<\/mj-text>$/i, "").trim();
            if (!inner) return false;
            if (/\{\{[\s\S]*?\}\}|\[\[[\s\S]*?\]\]/.test(inner)) return false;
            // If it contains letters or digits (beyond punctuation)
            return /[a-zA-Z0-9]/.test(inner);
          }) || false;
}

function auditFile(p) {
  const s = fs.readFileSync(p, "utf8");
  const issues = [];

  if (COLOR_HEX.test(s)) issues.push("hex-color");
  if (COLOR_FN.test(s)) issues.push("fn-color");
  if (COLOR_NAMES.test(s)) issues.push("named-color");
  if (GRADIENT.test(s)) issues.push("gradient");
  if (STYLE_COLORISH.test(s)) issues.push("style-colorish");

  if (/<mj-text[\s\S]*?<\/mj-text>/i.test(s) && hasHardcodedTextInMjText(s)) {
    issues.push("hardcoded-text");
  }

  if (/<mj-button[\s\S]*?<\/mj-button>/i.test(s)) {
    const buttons = s.match(/<mj-button[\s\S]*?<\/mj-button>/gi) || [];
    for (const b of buttons) {
      if (!/href=["']\{\{\s*cta_url\s*\}\}["']/i.test(b)) issues.push("button-href-not-token");
      const inner = b.replace(/<mj-button[\s\S]*?>/i, "").replace(/<\/mj-button>$/i, "").trim();
      if (inner && !/\{\{\s*cta_label\s*\}\}/i.test(inner) && !/\{\{[\s\S]*?\}\}|\[\[[\s\S]*?\]\]/.test(inner)) {
        issues.push("button-label-hardcoded");
      }
    }
  }

  if (/<mj-image[\s\S]*?<\/mj-image>/i.test(s)) {
    const images = s.match(/<mj-image[\s\S]*?<\/mj-image>/gi) || [];
    for (const im of images) {
      if (!/\bsrc=["']\{\{\s*image_url\s*\}\}["']/i.test(im)) issues.push("image-src-not-token");
      if (!/\balt=["']\{\{\s*image_alt\s*\}\}["']/i.test(im)) issues.push("image-alt-not-token");
    }
  }

  if (issues.length) return { file: p, issues };
  return null;
}

const files = walk(ROOT);
const results = files.map(auditFile).filter(Boolean);
if (!results.length) {
  console.log("✅ No issues found.");
  process.exit(0);
}
console.log("Found potential issues:");
for (const r of results) {
  console.log("- " + r.file);
  console.log("  • " + r.issues.join(", "));
}
process.exit(1);
