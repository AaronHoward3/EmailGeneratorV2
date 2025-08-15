// src/pipeline/twoPassGenerator.js
// Two-pass: (1) layout + LLM refine (content only), (2) deterministic theming.

import OpenAI from "openai";
import ora from "ora";

import { chooseLayout, composeBaseMjml } from "../layout/layoutComposer.js";
import { retryOpenAI } from "../utils/retryUtils.js";
import { renderProductSection } from "../services/productSectionService.js";
import { injectBrandLinks } from "../utils/injectBrandLinks.js";
import { newMetrics } from "../utils/metrics.js";
import { countTokens } from "../utils/tokenizer.js";
import { formatMjml } from "../utils/formatMjml.js";

import { applyTheme } from "../theme/applyTheme.js";
import { resolveSkinId, makeSkin } from "../theme/skins.js";
import { buildBrandTokens } from "../theme/tokens.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildRefinerPrompt({ baseMjml, emailType, designAesthetic, brandData, userContext }) {
  const safeCtx = (userContext || "").toString().trim().slice(0, 600);
  return String.raw`You are an expert email designer and copywriter.

TASK:
- You are given a complete MJML skeleton built from fixed template blocks.
- Your job is to only refine content: replace text copy, set hrefs, set image src values.
- Do not change structure or add/remove blocks.
- Do NOT attempt to change colors or add new styles. Styling is handled later.

STRICT RULES:
- Keep all MJML tags and block structure as-is.
- Do NOT add header or footer sections.
- Do NOT remove <!-- Blockfile: ... --> markers inside <mj-raw>.
- Preserve https://CUSTOMHEROIMAGE.COM if present.
- All <mj-image> must be open+close tags; no self-closing.
- No font-family on MJML tags. Keep valid MJML.

INPUTS:
Email Type: ${emailType}
Design Aesthetic: ${designAesthetic || "minimal_clean"}
User Context: ${safeCtx || "None"}
Brand Data JSON:
${JSON.stringify(brandData || {}, null, 2)}

BASE MJML (Refine this only; keep structure the same):
\`\`\`mjml
${baseMjml}
\`\`\`
`;
}

async function buildProductSectionWithFallbacks({ emailType, products, designAesthetic, seed }) {
  if (!Array.isArray(products) || products.length === 0) return "";

  const attempts = [ designAesthetic, "skeleton", "minimal_clean", "bold_contrasting" ].filter(Boolean);

  for (const aesthetic of attempts) {
    try {
      const html = await renderProductSection( emailType, aesthetic, products, seed );
      if (html && typeof html === "string" && html.trim().length > 0) return html;
    } catch {}
  }
  return "";
}

function injectProductSectionIntoMjml(baseMjml, productHtml) {
  if (!productHtml) return baseMjml;

  const tokenRe = /\[\[\s*PRODUCT_SECTION\s*\]\]/i;
  if (tokenRe.test(baseMjml)) return baseMjml.replace(tokenRe, productHtml);

  const closeSectionRe = /<\/mj-section>/i;
  const match = baseMjml.match(closeSectionRe);
  if (match && match.index != null) {
    const insertAt = match.index + match[0].length;
    return baseMjml.slice(0, insertAt) + "\n" + productHtml + "\n" + baseMjml.slice(insertAt);
  }

  if (baseMjml.includes("</mj-body>")) {
    return baseMjml.replace("</mj-body>", `${productHtml}\n</mj-body>`);
  }
  return baseMjml + "\n" + productHtml;
}

export async function runTwoPassGeneration({
  emailType,
  designAesthetic = "minimal_clean",
  brandData,
  userContext,
  wantsMjml,
  onStatus = () => {},
  metrics,
  styleId
}) {
  const m = metrics ?? newMetrics({ emailType, designAesthetic });
  m.log("Generation started.", { emailType, designAesthetic });

  // 1) Layout selection & base MJML
  m.start("layout");
  const layout = await chooseLayout(emailType, designAesthetic);
  let baseMjml = await composeBaseMjml(emailType, designAesthetic, layout);
  m.end("layout");

  onStatus("layout:chosen", { layoutId: layout.layoutId });
  m.log("Layout chosen:", layout.layoutId);

  // 1.1) Product section
  if ((emailType === "Promotion" || emailType === "Productgrid") && Array.isArray(brandData?.products)) {
    m.start("productSection");
    const productHtml = await buildProductSectionWithFallbacks({
      emailType, products: brandData.products, designAesthetic, seed: layout.layoutId
    });
    baseMjml = injectProductSectionIntoMjml(baseMjml, productHtml);
    m.end("productSection");
  } else {
    baseMjml = baseMjml.replace(/\[\[\s*PRODUCT_SECTION\s*\]\]/gi, "");
  }

  // 1.2) Make hero clickable
  const brandUrl = brandData?.website || brandData?.brandUrl || brandData?.url || brandData?.homepage || "";
  baseMjml = injectBrandLinks(baseMjml, brandUrl);

  if (process.env.EG_DEBUG === "1") {
    console.log("\n=== BASE MJML (pre-refine) ===\n", baseMjml.slice(0, 1500), "\n=== /BASE ===\n");
  }

  // 2) Refine via model – copy only
  const spinner = ora("Refining MJML...").start();
  try {
    onStatus("assistant:refine:start", { model: process.env.REFINE_MODEL || "gpt-4o-mini" });
    m.start("emailRefine");

    const sys = wantsMjml
      ? "You return ONLY MJML content wrapped in ```mjml fences. No commentary."
      : "You will primarily output MJML. Keep structure intact.";
    const prompt = buildRefinerPrompt({ baseMjml, emailType, designAesthetic, brandData, userContext });

    try {
      const pt = await countTokens(`${sys}\n\n${prompt}`); m.addLocalUsage?.({ input: pt });
    } catch {}

    const resp = await retryOpenAI(async () =>
      openai.chat.completions.create({
        model: process.env.REFINE_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        messages: [{ role: "system", content: sys }, { role: "user", content: prompt }]
      })
    );

    m.addUsageFromResponse?.(resp);
    m.recordApiCall?.({ step: "refine", model: resp.model || process.env.REFINE_MODEL || "gpt-4o-mini", usage: resp.usage });

    const raw = resp.choices?.[0]?.message?.content || "";
    const refinedMjml = raw.replace(/^\s*```mjml/i, "").replace(/```[\s\n\r]*$/g, "").trim();

    try { const ot = await countTokens(refinedMjml); m.addLocalUsage?.({ output: ot }); } catch {}

    m.end("emailRefine");
    spinner.succeed("Refinement complete");
    onStatus("assistant:refine:done", { ok: true });

    // 3) Deterministic theming (NO LLM)
    const skinId = resolveSkinId(styleId || designAesthetic || "minimal_clean");
    // Compute the actual skin pack so we can return it for logging/metrics
    const tokens = buildBrandTokens({ brandData });
    const skin = makeSkin(tokens, skinId);

    const themedMjml = applyTheme(refinedMjml, { brandData }, skinId);

    // 4) Pretty format
    const prettyMjml = await formatMjml(themedMjml, {
      normalizeDataUris: true,
      stripTrackingParams: false
    });

    // Return the full skin pack (has .palette) instead of just the ID
    return { layout, refinedMjml: prettyMjml, styleUsed: skin, metrics: m };
  } catch (err) {
    spinner.stop();
    throw err;
  }
}

export default runTwoPassGeneration;
