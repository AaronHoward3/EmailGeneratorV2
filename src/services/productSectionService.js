// src/services/productSectionService.js
import fs from "fs";
import path from "path";

// Map Email Type -> base folder name in your /lib structure
const TYPE_DIRS = {
  Promotion: "promotion-blocks",
  Productgrid: "product-blocks",
};

// Root is the repo's lib folder
const LIB_ROOT = path.resolve(process.cwd(), "lib");

function typeRoot(emailType, aesthetic) {
  const dir = TYPE_DIRS[emailType];
  if (!dir) return null;
  return path.join(LIB_ROOT, dir, aesthetic, "product-sections");
}

// Simple seeded RNG for reproducibility
function seededRng(seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => ((h = Math.imul(h ^ (h >>> 13), 1274126177)) >>> 0) / 0xffffffff;
}

function listCounts(emailType, aesthetic) {
  const root = typeRoot(emailType, aesthetic);
  if (!root || !fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .map((n) => parseInt(n, 10))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
}

function listVariants(emailType, aesthetic, count) {
  const root = typeRoot(emailType, aesthetic);
  if (!root) return [];
  const dir = path.join(root, String(count));
  if (!fs.existsSync(dir)) return [];
  const ex = /\.(txt|mjml)$/i; // allow .txt or .mjml
  return fs.readdirSync(dir)
    .filter((f) => ex.test(f))
    .map((f) => path.join(dir, f));
}

function chooseCount(counts, want) {
  if (counts.includes(want)) return want;
  const lower = counts.filter((c) => c <= want).pop();
  return lower ?? counts[0] ?? null;
}

function fillTemplate(tpl, prods) {
  let out = tpl;
  prods.forEach((p, idx) => {
    const i = idx + 1;
    out = out
      .replaceAll(`{{P${i}_TITLE}}`, p.title ?? "")
      .replaceAll(`{{P${i}_SUBTITLE}}`, p.subtitle ?? "")
      .replaceAll(`{{P${i}_PRICE}}`, p.price ?? "")
      .replaceAll(`{{P${i}_IMAGE_URL}}`, p.imageUrl ?? "")
      .replaceAll(`{{P${i}_BUTTON_TEXT}}`, p.buttonText ?? "View")
      .replaceAll(`{{P${i}_BUTTON_URL}}`, p.buttonUrl ?? "#");
  });
  // Remove any unused placeholders
  out = out.replace(/\{\{P\d+_[A-Z_]+\}\}/g, "");
  return out;
}

/**
 * Render a product section MJML from the per-type folder.
 *
 * @param {Object} opts
 * @param {"Promotion"|"Productgrid"} opts.emailType
 * @param {"bold_contrasting"|"minimal_clean"} opts.aesthetic
 * @param {Array} opts.products
 * @param {string} opts.seed
 * @returns {string} filled MJML
 */
export function renderProductSection({
  emailType,
  aesthetic,
  products,
  seed = "default",
}) {
  const counts = listCounts(emailType, aesthetic);
  if (counts.length === 0) return "";

  const want = products.length;
  const pickCount = chooseCount(counts, want);
  if (!pickCount) return "";

  const variants = listVariants(emailType, aesthetic, pickCount);
  if (variants.length === 0) return "";

  const rng = seededRng(seed);
  const pickIdx = Math.floor(rng() * variants.length);
  const chosenPath = variants[pickIdx];
  const tpl = fs.readFileSync(chosenPath, "utf8");

  const slice = products.slice(0, pickCount);
  return fillTemplate(tpl, slice);
}
