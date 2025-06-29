import OpenAI from "openai";
import ora from "ora";
import { enforceUtilityBlocks } from "../utils/utilityBlockEnforcer.js";
import { specializedAssistants } from "../config/constants.js";
import { getUniqueLayoutsBatch, cleanupSession } from "../utils/layoutGenerator.js";

import { generateCustomHeroAndEnrich } from "../services/heroImageService.js";
import {
  saveMJML,
  updateMJML,
  getMJML,
  deleteMJML,
} from "../utils/inMemoryStore.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEmails(req, res) {
  let { brandData, emailType, userContext, storeId } = req.body;

  if (!brandData || !emailType) {
    return res
      .status(400)
      .json({ error: "Missing brandData or emailType in request body." });
  }

  const jobId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

  if (
    brandData.customHeroImage !== undefined &&
    typeof brandData.customHeroImage !== "boolean"
  ) {
    return res
      .status(400)
      .json({ error: "customHeroImage must be a boolean (true/false)" });
  }

  const wantsCustomHero = brandData.customHeroImage === true;
  if (wantsCustomHero) {
    brandData.primary_custom_hero_image_banner = "https://CUSTOMHEROIMAGE.COM";
    brandData.hero_image_url = "https://CUSTOMHEROIMAGE.COM";
  }

  const sessionId = `${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 15)}`;
  const totalStart = Date.now();
  console.log(
    `⏱️ [${sessionId}] generation started at ${new Date(totalStart).toISOString()}`
  );

  try {
    // Start hero image generation in parallel
    const heroPromise = wantsCustomHero
      ? generateCustomHeroAndEnrich(brandData, storeId, jobId).catch((err) => {
          console.error("❌ Failed to generate custom hero image:", err.message);
          return brandData;
        })
      : Promise.resolve(brandData);

    // Generate unique layouts
const layouts = getUniqueLayoutsBatch(emailType, sessionId, 3);


    // Create OpenAI threads
    const threads = await Promise.all(layouts.map(() => openai.beta.threads.create()));

    const assistantId = specializedAssistants[emailType];
    if (!assistantId) {
      return res
        .status(400)
        .json({ error: `No assistant configured for: ${emailType}` });
    }

    // Generate emails
    const emailPromises = layouts.map(async (layout, index) => {
      const thread = threads[index];
      const i = index + 1;
      const spinner = ora().start();

      try {
        const sectionDescriptions = Object.entries(layout)
          .filter(([key]) => key !== "layoutId")
          .map(([key, val]) => `- Block (${key}): ${val}`)
          .join("\n");

        const layoutInstruction = `Use the following layout:\n${sectionDescriptions}\nYou may insert 1–3 utility blocks for spacing or visual design.`.trim();
        const safeUserContext = userContext?.trim().substring(0, 500) || "";
        const userInstructions = safeUserContext
          ? `\n📢 User Special Instructions:\n${userContext}\n`
          : "";

        const userPrompt = `You are an expert ${emailType} email assistant.

Your job:
Generate one MJML email using uploaded block templates.
Use userSubmittedContext for info about content, and use userSubmittedTone for the email tone.

The structure of the email must be exactly these content blocks in order:
  1. intro
  2. utility1
  3. content
  4. utility2
  5. cta

No other content sections are allowed beyond these 5. 

- Only use the correct product image for the corresponding product. Do not use any other images for products.
- Must use at least 1 color block for a section background.
- "Only return MJML inside a single markdown code block labeled 'mjml', no other text."
- Do not include header or footer. Start with <mjml><mj-body> and end with </mj-body></mjml> and do not include text outside of those.
- If brandData.hero_image_url is provided, you must use that image as the only hero image in the email. 
You may not substitute or add any other images in the hero section. This is mandatory.

**VISUAL DESIGN RULES (from design system):**
- **Max width**: 600–640px
- **Spacing**:
  - Between blocks: 40–60px
  - - All text elements in hero or header sections must have left and right padding of at least 20px to prevent the text from running edge-to-edge.
  - Internal padding: 20–30px
  - Buttons: 14–16px vertical / 28–32px horizontal
- **Typography**:
  - Headline: 40–50px, bold, 130% line height
  - Subhead: 20–24px
  - Body: 16–18px, 150% line height
  - All text and button elements must use Helvetica Neue, Helvetica, Arial, sans-serif
- **CTA**:
  - Prominent, centeraligned
  - Include supporting subtext + high-contrast button
- **Images**:
  - Use real brand photos only
  - Hero: 600×300–400px preferred, with proper alt text
  - Include at least 1 image-based block
- **Color**:
  - Use brand colors (from JSON)
  - Must replace any template block colors with brand colors
  - Max 3 total colors in design
- **Mobile**:
  - Stack columns
  - Minimum font size 14px
  - Full-width CTAs on mobile
- **Text color**:
  - If a section uses a background color that is *not white (#ffffff)*, then set all text color inside that section to #ffffff (white).
  - If a section uses a white background or no background color, use text color #000000 (black).
  - Text Color must always contrast with the background color.
  - This rule is mandatory — do not skip or override it.

Do NOT change the layout of the template blocks provided except to update colors and text content to match brand data.

📌 IMPORTANT: Above every content section, include a comment marker:
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

        const maxWaitTime = 120000;
        const runStart = Date.now();
        let runStatus;

        while (Date.now() - runStart < maxWaitTime) {
          runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
          if (runStatus.status === "completed") break;
          if (["failed", "expired", "cancelled"].includes(runStatus.status)) {
            spinner.fail(`❌ Assistant error on email ${i}`);
            throw new Error(`Assistant error: ${runStatus.status}`);
          }
          await new Promise((r) => setTimeout(r, 1500));
        }

        if (runStatus.status !== "completed") {
          spinner.fail(`❌ Assistant run timed out on email ${i}`);
          throw new Error(`Assistant run timed out after ${maxWaitTime / 1000} seconds on email ${i}`);
        }

        const messages = await openai.beta.threads.messages.list(thread.id);
        const rawContent = messages.data[0].content[0].text.value;
        let cleanedMjml = rawContent
          .replace(/^\s*```mjml/i, "")
          .replace(/```$/, "")
          .trim();

        saveMJML(jobId, index, cleanedMjml);
        console.log(`📦 Saved MJML for job ${jobId} at index ${index}`);

        spinner.succeed(`✅ Email ${i} generated successfully`);
        return {
          index: i,
          content: cleanedMjml,
          tokens: runStatus.usage?.total_tokens || 0,
        };
      } catch (error) {
        spinner.fail(`❌ Failed to generate email ${i}`);
        return { index: i, error: error.message };
      }
    });

    // Wait for both hero and emails
    const [results, finalBrandData] = await Promise.all([
      Promise.all(emailPromises),
      heroPromise,
    ]);

    const storedMjmls = getMJML(jobId);
    console.log(`📦 Retrieved ${storedMjmls.length} stored MJMLs for job ${jobId}`);

    // Replace placeholder hero with the real hero image
    let finalResults = results;
    const fontHead = `
      <mj-head>
        <mj-attributes>
          <mj-text font-family="Helvetica Neue, Helvetica, Arial, sans-serif" />
          <mj-button font-family="Helvetica Neue, Helvetica, Arial, sans-serif" />
        </mj-attributes>
      </mj-head>
    `;

    if (
      wantsCustomHero &&
      finalBrandData.hero_image_url &&
      finalBrandData.hero_image_url.includes("http") &&
      !finalBrandData.hero_image_url.includes("CUSTOMHEROIMAGE")
    ) {
      storedMjmls.forEach((mjml, index) => {
        if (mjml) {
          let updated = mjml.replace(/https:\/\/CUSTOMHEROIMAGE\.COM/g, finalBrandData.hero_image_url);

          if (!updated.includes("<mj-head>")) {
            updated = updated.replace("<mjml>", `<mjml>${fontHead}`);
            console.log(`🔤 Injected Helvetica font block for email ${index + 1}`);
          }

          updateMJML(jobId, index, updated);
        }
      });

      const patchedMjmls = getMJML(jobId);
      finalResults = results.map((result, index) => {
        if (result.content && patchedMjmls[index]) {
          return {
            ...result,
            content: patchedMjmls[index],
          };
        }
        return result;
      });

      console.log("🖼️ ✅ Successfully replaced hero + enforced font block");
    } else {
      console.log("⚠️ Hero URL not ready or invalid, using placeholder");

      storedMjmls.forEach((mjml, index) => {
        if (mjml && !mjml.includes("<mj-head>")) {
          const injected = mjml.replace("<mjml>", `<mjml>${fontHead}`);
          updateMJML(jobId, index, injected);
          console.log(`🔤 Injected Helvetica font block for email ${index + 1} (fallback)`);
        }
      });
    }
    
    const totalTokens = finalResults.reduce((sum, result) => sum + (result.tokens || 0), 0);

    cleanupSession(sessionId);

    setTimeout(() => {
      deleteMJML(jobId);
    }, 1000);

    console.log(`✅ [${sessionId}] Total time: ${Date.now() - totalStart} ms`);
    console.log(`🧠 Total OpenAI tokens used: ${totalTokens}`);

    res.json({
      success: true,
      totalTokens,
      emails: finalResults,
    });
  } catch (error) {
    console.error("❌ Email generation failed:", error);
    cleanupSession(sessionId);
    deleteMJML(jobId);
    res.status(500).json({ error: error.message });
  }
}
