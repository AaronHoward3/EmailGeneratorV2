// src/services/productSectionService.js
import fs from "fs";
import path from "path";

/**
 * Product Section Resolver
 * - Looks first in:   lib/<type>/skeleton/product-sections/<count>/*.txt
 * - Falls back to:    lib/<type>/<aesthetic>/product-sections/<count>/*.txt
 * - Picks the best count <= desired (or closest available)
 * - Fills placeholders: {{P{N}_TITLE}}, {{P{N}_SUBTITLE}}, {{P{N}_PRICE}},
 *   {{P{N}_IMAGE_URL}}, {{P{N}_BUTTON_TEXT}}, {{P{N}_BUTTON_URL}}
 */

// Map Email Type -> base folder name in your /lib structure
const TYPE_DIRS = {
  Promotion: "promotion-blocks",
  Productgrid: "product-blocks",
  Newsletter: "newsletter-blocks", // in case you want product sections in newsletters
};

// Root is the repo's lib folder
const LIB_ROOT = path.resolve(process.cwd(), "lib");
const TXT_EXT = new Set([".txt", ".mjml"]);

function typeRoot(emailType) {
  const dir = TYPE_DIRS[emailType];
  if (!dir) return null;
  return path.join(LIB_ROOT, dir);
}

function skeletonRoot(emailType) {
  const base = typeRoot(emailType);
  if (!base) return null;
  return path.join(base, "skeleton", "product-sections");
}

function legacyAestheticRoot(emailType, aesthetic) {
  const base = typeRoot(emailType);
  if (!base) return null;
  if (!aesthetic) return null;
  return path.join(base, aesthetic, "product-sections");
}

function listCounts(rootDir) {
  try {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => parseInt(e.name, 10))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

function listVariantFiles(dirForCount) {
  try {
    const entries = fs.readdirSync(dirForCount, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && TXT_EXT.has(path.extname(e.name).toLowerCase()))
      .map((e) => path.join(dirForCount, e.name));
  } catch {
    return [];
  }
}

function chooseCount(availableCounts, want) {
  if (!availableCounts.length) return null;
  if (!want || want <= 0) return availableCounts[0];

  const underOrEqual = availableCounts.filter((c) => c <= want);
  if (underOrEqual.length) return underOrEqual[underOrEqual.length - 1]; // closest <= want

  // otherwise choose the smallest available (fallback)
  return availableCounts[0];
}

// Simple deterministic RNG by seed (mulberry32)
function seededRng(seed) {
  let h = 1779033703 ^ String(seed).split("").reduce((a, c) => (Math.imul(a ^ c.charCodeAt(0), 3432918353) | 0), 0);
  h = Math.imul(h ^ (h >>> 16), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
  let t = (h ^ (h >>> 16)) >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
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
      .replaceAll(`{{P${i}_BUTTON_URL}}`, p.buttonUrl ?? p.buttonURL ?? p.url ?? "");
  });
  return out;
}

/**
 * Render a product section MJML fragment.
 * @param {("Promotion"|"Productgrid"|"Newsletter")} emailType
 * @param {string} aesthetic  // kept for backward-compatibility; used only for fallback
 * @param {Array} products    // [{title, subtitle, price, imageUrl, buttonText, buttonUrl}]
 * @param {string|number} seed
 * @param {number|null} desiredCount
 */
export function renderProductSection(emailType, aesthetic, products, seed = "default", desiredCount = null) {
  const want = desiredCount ?? (products?.length || 0);

  // 1) Try skeleton location first
  const root1 = skeletonRoot(emailType);
  const counts1 = root1 ? listCounts(root1) : [];
  let baseRoot = root1;
  let counts = counts1;

  // 2) Fallback: legacy per-aesthetic location
  if (!counts.length) {
    const root2 = legacyAestheticRoot(emailType, aesthetic);
    const counts2 = root2 ? listCounts(root2) : [];
    baseRoot = root2;
    counts = counts2;
  }

  if (!baseRoot || !counts.length) {
    return ""; // no product sections found
  }

  const pickCount = chooseCount(counts, want);
  if (!pickCount) return "";

  const dirForCount = path.join(baseRoot, String(pickCount));
  const variants = listVariantFiles(dirForCount);
  if (!variants.length) return "";

  const rng = seededRng(seed);
  const pickIdx = Math.floor(rng() * variants.length);
  const tplPath = variants[pickIdx];
  const tpl = fs.readFileSync(tplPath, "utf8");

  const slice = products.slice(0, pickCount);
  return fillTemplate(tpl, slice);
}

export default { renderProductSection };
