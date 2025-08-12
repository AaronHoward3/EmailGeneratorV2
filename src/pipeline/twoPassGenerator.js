// src/pipeline/twoPassGenerator.js
import OpenAI from "openai";
import ora from "ora";

import { chooseLayout, composeBaseMjml } from "../layout/layoutComposer.js";
import { retryOpenAI } from "../utils/retryUtils.js";
import { renderProductSection } from "../services/productSectionService.js";
import { injectBrandLinks } from "../utils/injectBrandLinks.js";
import { newMetrics } from "../utils/metrics.js";
import { countTokens } from "../utils/tokenizer.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildRefinerPrompt({ baseMjml, emailType, designAesthetic, brandData, userContext }) {
  const safeCtx = (userContext || "").toString().trim().slice(0, 600);
  return String.raw`You are an expert email designer and copywriter.

TASK:
- You are given a complete MJML skeleton built from fixed template blocks.
- Your job is to only refine content: replace text copy, adjust colors (max 3), set hrefs, and set image src values.
- Do not change structure or add/remove blocks.

STRICT RULES:
- Keep all MJML tags and block structure as-is.
- Do NOT add header or footer sections.
- Do NOT remove <!-- Blockfile: ... --> markers inside <mj-raw>.
- Preserve https://CUSTOMHEROIMAGE.COM if present.
- All <mj-image> must be open+close tags; no self-closing.
- No font-family on MJML tags. Keep valid MJML.

INPUTS:
Email Type: ${emailType}
Design Aesthetic: ${designAesthetic || "bold_contrasting"}
User Context: ${safeCtx || "None"}
Brand Data JSON:
${JSON.stringify(brandData || {}, null, 2)}

BASE MJML (Refine this only; keep structure the same):
\`\`\`mjml
${baseMjml}
\`\`\`
`;
}

export async function runTwoPassGeneration({
  emailType,
  designAesthetic = "bold_contrasting",
  brandData,
  userContext,
  wantsMjml,
  onStatus = () => {},
  metrics,
}) {
  const m = metrics ?? newMetrics({ emailType, designAesthetic });
  m.log("Generation started.", { emailType, designAesthetic });

  // 1) Layout selection & compose base MJML
  m.start("layout");
  const layout = await chooseLayout(emailType, designAesthetic);
  let baseMjml = await composeBaseMjml(emailType, designAesthetic, layout);
  m.end("layout");

  onStatus("layout:chosen", { layoutId: layout.layoutId });
  m.log("Layout chosen:", layout.layoutId);

  // 1.1) Insert product section if needed
  m.start("productSection");
  if ((emailType === "Promotion" || emailType === "Productgrid") && Array.isArray(brandData?.products)) {
    const section = renderProductSection({
      emailType,
      aesthetic: designAesthetic,
      products: brandData.products || [],
      seed: layout.layoutId
    });
    baseMjml = baseMjml.replace("[[PRODUCT_SECTION]]", section || "");
  } else {
    baseMjml = baseMjml.replace("[[PRODUCT_SECTION]]", "");
  }
  m.end("productSection");

  // 1.2) Make hero images clickable to brand homepage
  const brandUrl =
    brandData?.website || brandData?.brandUrl || brandData?.url || brandData?.homepage || "";
  baseMjml = injectBrandLinks(baseMjml, brandUrl);

  if (process.env.EG_DEBUG === "1") {
    console.log("\n=== BASE MJML (pre-refine) ===\n", baseMjml.slice(0, 1500), "\n=== /BASE ===\n");
  }

  // 2) Refine via Chat Completions (returns official `usage`)
  const spinner = ora("Refining MJML...").start();
  try {
    onStatus("assistant:refine:start", { model: process.env.REFINE_MODEL || "gpt-4o-mini" });
    m.start("emailRefine");

    const sys = wantsMjml
      ? "You return ONLY MJML content wrapped in ```mjml fences. No commentary."
      : "You will primarily output MJML. Keep structure intact.";
    const prompt = buildRefinerPrompt({
      baseMjml,
      emailType,
      designAesthetic,
      brandData,
      userContext
    });

    // optional local count
    try {
      const pt = await countTokens(`${sys}\n\n${prompt}`);
      m.addLocalUsage?.({ input: pt });
    } catch {}

    const resp = await retryOpenAI(async () =>
      openai.chat.completions.create({
        model: process.env.REFINE_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: prompt }
        ]
      })
    );

    // Official usage + record call for pricing
    m.addUsageFromResponse?.(resp);
    m.recordApiCall?.({
      step: "refine",
      model: resp.model || process.env.REFINE_MODEL || "gpt-4o-mini",
      usage: resp.usage
    });

    const raw = resp.choices?.[0]?.message?.content || "";
    const refinedMjml = raw.replace(/^\s*```mjml/i, "").replace(/```[\s\n\r]*$/g, "").trim();

    // optional local count
    try {
      const ot = await countTokens(refinedMjml);
      m.addLocalUsage?.({ output: ot });
    } catch {}

    m.end("emailRefine");
    spinner.succeed("Refinement complete");
    onStatus("assistant:refine:done", { ok: true });

    return { layout, refinedMjml, metrics: m };
  } catch (err) {
    spinner.stop();
    throw err;
  }
}
