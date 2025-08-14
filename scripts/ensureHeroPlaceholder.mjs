// scripts/ensureHeroPlaceholder.mjs
// Ensures hero Block 1 fragments include background-url="https://CUSTOMHEROIMAGE.COM"
// - If background-url exists but isn't CUSTOMHEROIMAGE, it replaces it with the placeholder.
// - If missing, it injects it on the first <mj-section>.
// Usage:
//   node scripts/ensureHeroPlaceholder.mjs lib/promotion-blocks/skeleton lib/product-blocks/skeleton lib/newsletter-blocks/skeleton
import fs from "fs";
import path from "path";

const roots = process.argv.slice(2);
if (!roots.length) {
  console.error("Usage: node scripts/ensureHeroPlaceholder.mjs <dir> [more dirs...]");
  process.exit(1);
}
const EXT = new Set([".txt", ".mjml"]);
const PLACEHOLDER = "https://CUSTOMHEROIMAGE.COM";

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

function isHeroBlock1(filepath) {
  const lower = filepath.toLowerCase();
  return lower.includes("block1") || /\bhero/i.test(lower);
}

function ensurePlaceholder(content) {
  let s = content;
  // Already set to CUSTOMHEROIMAGE?
  if (new RegExp(`background-url=["']${PLACEHOLDER}["']`, "i").test(s)) return s;

  // Replace any background-url with our placeholder
  s = s.replace(/\sbackground-url=(["'])(.*?)\1/gi, (_m, q, val) => ` background-url=${q}${PLACEHOLDER}${q}`);

  // If no background-url at all on the first <mj-section>, inject it
  s = s.replace(/<mj-section\b(?![^>]*\bbackground-url=)/i, `<mj-section background-url="${PLACEHOLDER}"`);
  return s;
}

for (const root of roots) {
  const files = walk(root).filter(isHeroBlock1);
  for (const f of files) {
    const raw = fs.readFileSync(f, "utf8");
    const updated = ensurePlaceholder(raw);
    if (updated !== raw) {
      fs.writeFileSync(f, updated, "utf8");
      console.log("✓ fixed", f);
    } else {
      console.log("OK", f);
    }
  }
}
