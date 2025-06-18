import OpenAI from "openai";
import ora from "ora";
import { specializedAssistants } from "../config/constants.js";
import { getUniqueLayout } from "../utils/layoutGenerator.js";
import { generateCustomHeroAndEnrich } from "../services/heroImageService.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEmails(req, res) {
  let { brandData, emailType, userContext, storeId } = req.body;

  if (!brandData || !emailType) {
    return res
      .status(400)
      .json({ error: "Missing brandData or emailType in request body." });
  }

  // Validate customHeroImage parameter
  if (brandData.customHeroImage !== undefined && typeof brandData.customHeroImage !== 'boolean') {
    return res
      .status(400)
      .json({ 
        error: "customHeroImage must be a boolean (true/false)" 
      });
  }

  const wantsCustomHero = brandData.customHeroImage === true;

  if (wantsCustomHero) {
    console.log("✨ Generating custom hero image and enriching JSON...");
    try {
      const enriched = await generateCustomHeroAndEnrich(brandData, storeId);
      brandData = enriched;
      console.log("✅ Brand data enriched with custom hero image.");

      if (brandData.primary_custom_hero_image_banner) {
        const url = brandData.primary_custom_hero_image_banner.trim();
        console.log(
          "🖼️ Custom hero image is being used:",
          url
        );
      } else {
        console.log("🚫 No custom hero image present in brand data.");
      }
    } catch (err) {
      console.error("❌ Failed to generate custom hero image:", err.message);
      console.log("⚠️ Falling back to original brand data.");
    }
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
Use userSubmittedContext for info about content, and use userSubmittedTone for the email tone.

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

    // Wait for run completion with timeout
    const maxWaitTime = 120000; // 2 minutes
    const startTime = Date.now();
    let runStatus;
    
    while (Date.now() - startTime < maxWaitTime) {
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      
      if (runStatus.status === "completed") {
        break;
      }
      
      if (runStatus.status === "failed") {
        spinner.fail(`❌ Assistant failed on email ${i}`);
        return res.status(500).json({
          error: `Assistant failed on email ${i}`,
          detail: runStatus.last_error,
        });
      }
      
      if (runStatus.status === "expired") {
        spinner.fail(`❌ Assistant run expired on email ${i}`);
        return res.status(500).json({
          error: `Assistant run expired on email ${i}`,
        });
      }
      
      if (runStatus.status === "cancelled") {
        spinner.fail(`❌ Assistant run was cancelled on email ${i}`);
        return res.status(500).json({
          error: `Assistant run was cancelled on email ${i}`,
        });
      }
      
      // Wait before checking again
      await new Promise((r) => setTimeout(r, 1500));
    }
    
    if (runStatus.status !== "completed") {
      spinner.fail(`❌ Assistant run timed out on email ${i}`);
      return res.status(500).json({
        error: `Assistant run timed out after ${maxWaitTime / 1000} seconds on email ${i}`,
        status: runStatus.status,
      });
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
} 