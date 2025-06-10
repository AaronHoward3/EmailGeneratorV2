import dotenv from "dotenv";
dotenv.config();

import express from "express";
import OpenAI from "openai";
import fs from "fs";
import ora from "ora";
import { generateCustomHeroAndEnrich } from "./generate-hero-helper.js";

const app = express();
const port = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());

const specializedAssistants = {
  Newsletter: "asst_So4cxsaziuSI6hZYAT330j1u",
  Productgrid: "asst_wpEAG1SSFXym8BLxqyzTPaVe",
  AbandonedCart: "asst_IGjM9fcv8XZlf9z3l8nUM7l5",
  Promotion: "asst_Kr6Sc01OP5oJgwIXQgV7qb2k",
};

const BLOCK_DEFINITIONS = {
  Newsletter: {
    sections: ["intro", "content1", "content2", "cta"],
    blocks: {
      intro: [
        "hero-fullwidth.txt",
        "hero-founder-note.txt",
        "hero-quote.txt",
        "hero-highlight-list.txt",
        "hero-split.txt",
      ],
      content1: [
        "feature-deep-dive.txt",
        "brand-story.txt",
        "photo-overlay.txt",
        "triplecontent.txt",
      ],
      content2: [
        "content-text-grid.txt",
        "brand-story.txt",
        "company-direction.txt",
        "educational-insight.txt",
      ],
      cta: [
        "cta-wrapup.txt",
        "bonus-tip.txt",
        "testimonial-closer.txt",
        "philosophy-outro.txt",
        "support-options.txt",
        "recap-summary.txt",
      ],
    },
  },
  Productgrid: {
    sections: ["intro", "content1", "cta"],
    blocks: {
      intro: [
        "hero-overlay.txt",
        "hero-title.txt",
        "title-body.txt",
        "title-only.txt",
      ],
      content1: [
        "alternating-grid.txt",
        "product-grid.txt",
        "single-product.txt",
      ],
      cta: ["body-cta.txt", "cta-only.txt", "image-cta.txt"],
    },
  },
  AbandonedCart: {
    sections: ["intro", "content", "cta"],
    blocks: {
      intro: ["CenteredHero.txt", "TextHero.txt"],
      content: [
        "Centered.txt",
        "Grid.txt",
        "product-grid.txt",
        "ProductHIGH.txt",
      ],
      cta: ["CTAGrid.txt", "CTAIncentive.txt", "CTAReminder.txt"],
    },
  },
};

function pickRandom(arr, exclude = []) {
  const filtered = arr.filter((item) => !exclude.includes(item));
  if (filtered.length === 0) return arr[Math.floor(Math.random() * arr.length)];
  return filtered[Math.floor(Math.random() * filtered.length)];
}

const layoutHistory = [];

function getUniqueLayout(emailType) {
  const config = BLOCK_DEFINITIONS[emailType];
  if (!config) return null;

  let attempts = 0;
  while (attempts < 10) {
    const layout = {};
    const layoutIdParts = [];

    for (const section of config.sections) {
      const choice = pickRandom(config.blocks[section]);
      layout[section] = choice;
      layoutIdParts.push(choice);
    }

    const layoutId = layoutIdParts.join("|");

    if (!layoutHistory.includes(layoutId)) {
      layoutHistory.push(layoutId);
      return { ...layout, layoutId };
    }
    attempts++;
  }
  return null;
}

app.post("/generate-emails", async (req, res) => {
  let { brandData, emailType, userContext } = req.body;

  if (!brandData || !emailType) {
    return res
      .status(400)
      .json({ error: "Missing brandData or emailType in request body." });
  }

  const wantsCustomHero =
    brandData.customHeroImage &&
    brandData.customHeroImage.toLowerCase() === "yes";

  if (wantsCustomHero) {
    console.log("✨ Generating custom hero image and enriching JSON...");
    const enriched = await generateCustomHeroAndEnrich(brandData);
    brandData = enriched;
  }

  const assistantId = specializedAssistants[emailType];
  console.log(`🧠 Using assistant for ${emailType}: ${assistantId}`);

  if (!assistantId) {
    return res
      .status(400)
      .json({ error: `No assistant configured for: ${emailType}` });
  }

  const responses = [];
  let totalTokens = 0;

  for (let i = 1; i <= 3; i++) {
    const layout = getUniqueLayout(emailType);
    if (!layout) {
      responses.push({
        index: i,
        error: "No unique layout could be selected.",
      });
      continue;
    }

    const sectionDescriptions = Object.entries(layout)
      .filter(([key]) => key !== "layoutId")
      .map(([key, val]) => `- Block (${key}): ${val}`)
      .join("\n");

    const layoutInstruction =
      `Use the following layout:\n${sectionDescriptions}\nYou may insert 1–3 utility blocks for spacing or visual design.`.trim();

    const spinner = ora(
      `Generating ${emailType} email ${i} using layout: ${layout.layoutId}`
    ).start();
    const thread = await openai.beta.threads.create();

    const safeUserContext = userContext?.trim().substring(0, 500) || "";
    const userInstructions = safeUserContext
      ? `\n📢 User Special Instructions:\n${safeUserContext}\n`
      : "";

    const userPrompt =
      `Ignore any previous context. You are starting from scratch for this email.

You are an expert ${emailType} email assistant.

Your job:
Generate one MJML email using uploaded block templates.

Must use at least one color block using brand colors.
Make sure to use at least one block with an image field.
Only return MJML inside a single \`\`\`mjml\`\`\` block, no other text.
Do not include header or footer. Start with <mjml><mj-body> and end with </mj-body></mjml> do not include text outside of those.
Do not use vibe images for products. Use real product images from provided brand data.
You may also insert 1–2 utility blocks to add spacing or design elements:
- divider-line.txt, divider-dotted.txt, divider-accent.txt, spacer-md.txt, labeled-divider.txt

📌 IMPORTANT: Above every content section, include a comment like:
<!-- Blockfile: block-name.txt -->

${layoutInstruction}

${userInstructions}

${JSON.stringify({ ...brandData, email_type: emailType }, null, 2)}`.trim();

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: userPrompt,
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
    });

    let runStatus;
    while (true) {
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      if (runStatus.status === "completed") break;
      if (runStatus.status === "failed") {
        spinner.fail(`❌ Assistant failed on email ${i}`);
        return res.status(500).json({
          error: `Assistant failed on email ${i}`,
          detail: runStatus.last_error,
        });
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    if (runStatus.usage?.total_tokens) {
      totalTokens += runStatus.usage.total_tokens;
    }

    const messages = await openai.beta.threads.messages.list(thread.id);
    const rawContent = messages.data[0].content[0].text.value;

    let cleanedMjml = rawContent
      .replace(/^\s*```mjml/i, "")
      .replace(/```$/, "")
      .trim();

    if (cleanedMjml.includes("<mjml") && cleanedMjml.includes("</mjml>")) {
      fs.writeFileSync(`email-${i}.mjml`, cleanedMjml);
      responses.push({ index: i, content: cleanedMjml });
      spinner.succeed(`✅ Email ${i} generated successfully`);
    } else {
      responses.push({
        index: i,
        warning: "MJML formatting invalid",
        content: cleanedMjml,
      });
      spinner.fail(`⚠️ Email ${i} generated but MJML wrapper may be invalid`);
    }
  }

  console.log(`🧠 Total OpenAI tokens used: ${totalTokens}`);
  res.json({ success: true, totalTokens, emails: responses });
});

app.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});
