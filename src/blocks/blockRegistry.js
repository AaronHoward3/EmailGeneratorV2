// src/blocks/blockRegistry.js
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

// Project root → lib
function libRoot() {
  // __dirname is .../src/blocks → go up two → project root
  return path.resolve(__dirname, "..", "..", "lib");
}

function ensureSupportedType(emailType) {
  if (!TYPE_DIR[emailType]) {
    throw new Error(
      `Unsupported emailType "${emailType}". Use Newsletter | Productgrid | Promotion.`
    );
  }
}

// Build the search order for aesthetics.
// We prefer 'skeleton' (the new style-agnostic blocks) and then fall back.
function aestheticSearchOrder(requested) {
  const req = String(requested || "").trim().toLowerCase().replace(/\s+/g, "_");
  const order = ["skeleton"];
  if (req && req !== "skeleton") order.push(req);
  // legacy packs and a generic folder some repos use
  order.push("minimal_clean", "bold_contrasting", "default");
  // de-dup
  return Array.from(new Set(order));
}

async function dirExists(p) {
  try {
    const st = await fs.stat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(p) {
  try {
    const st = await fs.stat(p);
    return st.isFile();
  } catch {
    return false;
  }
}

function typeAestheticRoot(emailType, aesthetic) {
  return path.join(libRoot(), TYPE_DIR[emailType], aesthetic);
}

// Returns { baseDir, files } for the first aesthetic folder that has .txt blocks
async function resolveBlockFolder(emailType, requestedAesthetic, blockFolder) {
  ensureSupportedType(emailType);
  const order = aestheticSearchOrder(requestedAesthetic);

  const attempted = [];
  for (const aesthetic of order) {
    const base = path.join(typeAestheticRoot(emailType, aesthetic), blockFolder);
    attempted.push(base);
    if (!(await dirExists(base))) continue;

    const entries = await fs.readdir(base, { withFileTypes: true }).catch(() => []);
    const files = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".txt"))
      .map((e) => e.name)
      .sort();

    if (files.length > 0) {
      return { baseDir: base, files, aestheticUsed: aesthetic };
    }
  }

  const hint = attempted.map((p) => ` - ${p}`).join("\n");
  throw new Error(
    `No block folder with .txt files found for ${emailType}/${blockFolder}.\nSearched (in order):\n${hint}`
  );
}

export async function listBlockFiles(emailType, aesthetic, blockFolder) {
  const { files } = await resolveBlockFolder(emailType, aesthetic, blockFolder);
  return files;
}

export async function readBlockFile(emailType, aesthetic, blockFolder, filename) {
  ensureSupportedType(emailType);
  const order = aestheticSearchOrder(aesthetic);

  const attempted = [];
  for (const aest of order) {
    const p = path.join(typeAestheticRoot(emailType, aest), blockFolder, filename);
    attempted.push(p);
    if (await fileExists(p)) {
      // IMPORTANT: We do not mutate contents here (so CUSTOMHEROIMAGE stays intact).
      return fs.readFile(p, "utf8");
    }
  }

  const hint = attempted.map((p) => ` - ${p}`).join("\n");
  throw new Error(
    `Block file not found: ${emailType}/${blockFolder}/${filename}\nSearched (in order):\n${hint}`
  );
}

// Divider helpers unchanged
export async function listDividerFiles() {
  const base = path.join(libRoot(), "design-elements", "dividers");
  const entries = await fs.readdir(base, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".txt"))
    .map((e) => e.name)
    .sort();
}

export async function readDividerFile(filename) {
  const p = path.join(libRoot(), "design-elements", "dividers", filename);
  return fs.readFile(p, "utf8");
}
