// src/pipeline/twoPassGenerator.js
import OpenAI from "openai";
import ora from "ora";
import { chooseLayout, composeBaseMjml } from "../layout/layoutComposer.js";
import { specializedAssistants } from "../config/constants.js";
import { retryOpenAI } from "../utils/retryUtils.js";
import { getThreadPool } from "../utils/threadPool.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildRefinerPrompt({ baseMjml, emailType, designAesthetic, brandData, userContext }) {
  const safeCtx = (userContext || "").toString().trim().slice(0, 600);
  return `
You are an expert email designer and copywriter.

TASK:
- You are given a complete **MJML skeleton** built from fixed template blocks.
- Your job is to **only refine content**: replace text copy, adjust colors (max 3), set hrefs, and set image src values.
- **Do not change structure or add/remove blocks.**

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

OUTPUT:
- Return **MJML only** in a single \`\`\`mjml code block. No explanations.
`.trim();
}

/**
 * onStatus: optional callback(event, payload)
 * events: 'layout:chosen', 'assistant:refine:start', 'assistant:refine:done'
 */
export async function runTwoPassGeneration({
  emailType,
  designAesthetic = "bold_contrasting",
  brandData,
  userContext,
  wantsMjml,
  onStatus = () => {}
}) {
  // 1) layout & compose
  const layout = await chooseLayout(emailType, designAesthetic);
  const baseMjml = await composeBaseMjml(emailType, designAesthetic, layout);
  onStatus("layout:chosen", { layoutId: layout.layoutId });

  // 2) refine with correct assistant
  const assistantId =
    specializedAssistants[emailType]?.[designAesthetic] ||
    specializedAssistants[emailType]?.minimal_clean;

  if (!assistantId) {
    throw new Error(`No assistant configured for ${emailType}/${designAesthetic}`);
  }

  const threadPool = getThreadPool(process.env.NODE_ENV === "production" ? 15 : 10);
  const thread = await threadPool.getThread();

  const spinner = ora("Refining MJML with assistant...").start();
  try {
    onStatus("assistant:refine:start", { assistantId });

    const prompt = buildRefinerPrompt({
      baseMjml,
      emailType,
      designAesthetic,
      brandData,
      userContext
    });

    await retryOpenAI(async () => {
      await openai.beta.threads.messages.create(thread.id, { role: "user", content: prompt });
    });

    const run = await retryOpenAI(async () => {
      return await openai.beta.threads.runs.create(thread.id, { assistant_id: assistantId });
    });

    const maxWait = 90_000;
    const start = Date.now();
    let status;
    while (Date.now() - start < maxWait) {
      status = await retryOpenAI(async () => {
        return await openai.beta.threads.runs.retrieve(thread.id, run.id);
      });
      if (status.status === "completed") break;
      if (["failed", "expired", "cancelled"].includes(status.status)) {
        throw new Error(`Assistant run ${status.status}: ${status.last_error?.message || ""}`);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    if (status.status !== "completed") {
      throw new Error(`Assistant run timed out after ${maxWait / 1000}s`);
    }

    const messages = await retryOpenAI(async () => openai.beta.threads.messages.list(thread.id));
    const raw = messages.data[0].content[0].text.value;
    const refinedMjml = raw
      .replace(/^\s*```mjml/i, "")
      .replace(/```[\s\n\r]*$/g, "")
      .trim();

    spinner.succeed("Refinement complete");
    onStatus("assistant:refine:done", { ok: true });

    return { layout, refinedMjml };
  } finally {
    threadPool.returnThread(thread);
  }
}
