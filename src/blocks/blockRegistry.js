import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Email type -> lib folder name
const TYPE_DIR = {
  Newsletter: "newsletter-blocks",
  Productgrid: "product-blocks",
  Promotion: "promotion-blocks",
};

// Only support these aesthetics for now
const VALID_AESTHETICS = new Set(["bold_contrasting", "minimal_clean"]);

// projectRoot/lib
function libRoot() {
  // __dirname is .../src/blocks → go up two → project root
  return path.resolve(__dirname, "..", "..", "lib");
}

function ensureSupported(emailType, aesthetic) {
  if (!TYPE_DIR[emailType]) {
    throw new Error(`Unsupported emailType "${emailType}". Use Newsletter | Productgrid | Promotion.`);
  }
  if (!VALID_AESTHETICS.has(aesthetic)) {
    throw new Error(`Unsupported aesthetic "${aesthetic}". Use bold_contrasting | minimal_clean.`);
  }
}

function typeAestheticRoot(emailType, aesthetic) {
  ensureSupported(emailType, aesthetic);
  return path.join(libRoot(), TYPE_DIR[emailType], aesthetic);
}

export async function listBlockFiles(emailType, aesthetic, blockFolder) {
  const base = path.join(typeAestheticRoot(emailType, aesthetic), blockFolder);
  let entries;
  try {
    entries = await fs.readdir(base, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Cannot read ${base}. Does it exist and contain .txt blocks? (${err.message})`);
  }
  return entries
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith(".txt"))
    .map(e => e.name)
    .sort();
}

export async function readBlockFile(emailType, aesthetic, blockFolder, filename) {
  const p = path.join(typeAestheticRoot(emailType, aesthetic), blockFolder, filename);
  return fs.readFile(p, "utf8");
}

export async function listDividerFiles() {
  const base = path.join(libRoot(), "design-elements", "dividers");
  const entries = await fs.readdir(base, { withFileTypes: true }).catch(() => []);
  return entries
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith(".txt"))
    .map(e => e.name)
    .sort();
}

export async function readDividerFile(filename) {
  const p = path.join(libRoot(), "design-elements", "dividers", filename);
  return fs.readFile(p, "utf8");
}
