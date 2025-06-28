import OpenAI from "openai";
import ora from "ora";
import { specializedAssistants } from "../config/constants.js";
import { getUniqueLayout, cleanupSession } from "../utils/layoutGenerator.js";
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
    `⏱️ [${sessionId}] generation started at ${new Date(
      totalStart
    ).toISOString()}`
  );

  try {
    // Start hero image generation in parallel
    const heroPromise = wantsCustomHero
      ? generateCustomHeroAndEnrich(brandData, storeId, jobId).catch((err) => {
          console.error(
            "❌ Failed to generate custom hero image:",
            err.message
          );
          return brandData;
        })
      : Promise.resolve(brandData);

    // Generate unique layouts
    const layouts = [];
    for (let i = 0; i < 3; i++) {
      const layout = getUniqueLayout(emailType, sessionId);
      if (!layout) {
        return res
          .status(500)
          .json({ error: "Could not generate unique layouts for all emails" });
      }
      layouts.push(layout);
    }

    // Create OpenAI threads
    const threads = await Promise.all(
      layouts.map(() => openai.beta.threads.create())
    );

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
      const spinner = ora(
        `Generating ${emailType} email ${i} using layout: ${layout.layoutId}`
      ).start();

      try {
        const sectionDescriptions = Object.entries(layout)
          .filter(([key]) => key !== "layoutId")
          .map(([key, val]) => `- Block (${key}): ${val}`)
          .join("\n");

        const layoutInstruction =
          `Use the following layout:\n${sectionDescriptions}\nYou may insert 1–3 utility blocks for spacing or visual design.`.trim();
        const safeUserContext = userContext?.trim().substring(0, 500) || "";
        const userInstructions = safeUserContext
          ? `\n📢 User Special Instructions:\n${userContext}\n`
          : "";

        const userPrompt = `You are an expert ${emailType} email assistant.

Your job:
Generate one MJML email using uploaded block templates.
Use userSubmittedContext for info about content, and use userSubmittedTone for the email tone.

Only Use correct product image for the corresponding product. Do not use any other images for products.
Must use at least 1 color block for a section background.
Only return MJML inside a single \\\mjml\\\ block, no other text.
Do not include header or footer. Start with <mjml><mj-body> and end with </mj-body></mjml> do not include text outside of those.
If "primary_custom_hero_image_banner" or "hero_image_url" is available in brandData, you must use it as the hero image.

VISUAL DESIGN RULES (from design system):
- **Max width**: 600–640px
- **Spacing**:
  - Between blocks: 40–60px
  - Internal padding: 20–30px
  - Buttons: 14–16px vertical / 28–32px horizontal
- **Typography**:
  - Headline: 32–48px, bold, 130% line height
  - Subhead: 20–24px
  - Body: 16–18px, 150% line height
- **CTA**:
  - Prominent, center- or left-aligned
  - Include supporting subtext + high-contrast button
- **Images**:
  - Use real brand photos only
  - Hero: 600×300–400px preferred, with proper alt text
  - Include at least 1 image-based block
- **Color**:
  - Use brand colors (from JSON)
  - Replace any template colors with brand colors
  - At least 1 background-colored section using brand.primary_color
  - Max 3 total colors in design
- **Mobile**:
  - Stack columns
  - Minimum font size 14px
  - Full-width CTAs on mobile

  Do NOT change the layout of the template blocks provided.
  
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

        const maxWaitTime = 120000;
        const runStart = Date.now();
        let runStatus;

        while (Date.now() - runStart < maxWaitTime) {
          runStatus = await openai.beta.threads.runs.retrieve(
            thread.id,
            run.id
          );
          if (runStatus.status === "completed") break;
          if (["failed", "expired", "cancelled"].includes(runStatus.status)) {
            spinner.fail(`❌ Assistant error on email ${i}`);
            throw new Error(`Assistant error: ${runStatus.status}`);
          }
          await new Promise((r) => setTimeout(r, 1500));
        }

        if (runStatus.status !== "completed") {
          spinner.fail(`❌ Assistant run timed out on email ${i}`);
          throw new Error(
            `Assistant run timed out after ${
              maxWaitTime / 1000
            } seconds on email ${i}`
          );
        }

        const messages = await openai.beta.threads.messages.list(thread.id);
        const rawContent = messages.data[0].content[0].text.value;
        let cleanedMjml = rawContent
          .replace(/^\s*```mjml/i, "")
          .replace(/```$/, "")
          .trim();

        // FIXED: Save MJML with proper index
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

    // Wait for both email generation and hero image
    const [results, finalBrandData] = await Promise.all([
      Promise.all(emailPromises),
      heroPromise,
    ]);

    // Debug: Check what we have stored
    const storedMjmls = getMJML(jobId);
    console.log(
      `📦 Retrieved ${storedMjmls.length} stored MJMLs for job ${jobId}`
    );

    // Replace hero image placeholder if custom hero was requested
    let finalResults = results;
    if (wantsCustomHero) {
      const realUrl = finalBrandData.hero_image_url?.trim();
      console.log(`🖼️ Final hero URL: ${realUrl}`);

      if (
        realUrl &&
        realUrl.includes("http") &&
        !realUrl.includes("CUSTOMHEROIMAGE")
      ) {
        // Update stored MJMLs with real hero URL
        storedMjmls.forEach((mjml, index) => {
          if (mjml) {
            const updated = mjml.replace(
              /https:\/\/CUSTOMHEROIMAGE\.COM/g,
              realUrl
            );
            updateMJML(jobId, index, updated);
            console.log(`🔄 Updated MJML at index ${index} with real hero URL`);
          }
        });

        // Get the updated MJMLs and build final results
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

        console.log(
          "🖼️ ✅ Successfully replaced placeholder hero in all MJMLs"
        );
      } else {
        console.log("⚠️ Hero URL not ready or invalid, using placeholder");
      }
    }

    // Calculate total tokens
    const totalTokens = finalResults.reduce(
      (sum, result) => sum + (result.tokens || 0),
      0
    );

    // Cleanup
    cleanupSession(sessionId);

    // Clean up stored MJMLs after successful response
    setTimeout(() => {
      deleteMJML(jobId);
      console.log(`🗑️ Cleaned up stored MJMLs for job ${jobId}`);
    }, 1000);

    console.log("🚀 Returning final emails");
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
