import OpenAI from "openai";
import ora from "ora";
import { specializedAssistants } from "../config/constants.js";
import { getUniqueLayout, cleanupSession } from "../utils/layoutGenerator.js";
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

  // Generate a unique session ID for this request
  const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

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

  // Generate all layouts upfront to ensure uniqueness within this request
  const layouts = [];
  for (let i = 0; i < 3; i++) {
    const layout = getUniqueLayout(emailType, sessionId);
    if (!layout) {
      return res.status(500).json({ 
        error: "Could not generate unique layouts for all emails" 
      });
    }
    layouts.push(layout);
  }

  // Set a timeout that's shorter than API Gateway's 30-second limit
  const API_TIMEOUT = 25000; // 25 seconds to leave buffer
  const startTime = Date.now();

  // Generate emails with timeout awareness
  const emailPromises = layouts.map(async (layout, index) => {
    const i = index + 1;
    const spinner = ora(
      `Generating ${emailType} email ${i} using layout: ${layout.layoutId}`
    ).start();

    try {
      // Check if we're approaching the timeout
      if (Date.now() - startTime > API_TIMEOUT - 5000) {
        spinner.warn(`⚠️ Skipping email ${i} due to approaching timeout`);
        return {
          index: i,
          warning: "Skipped due to API Gateway timeout constraints",
          timeout: true
        };
      }

      const sectionDescriptions = Object.entries(layout)
        .filter(([key]) => key !== "layoutId")
        .map(([key, val]) => `- Block (${key}): ${val}`)
        .join("\n");

      const layoutInstruction =
        `Use the following layout:\n${sectionDescriptions}\nYou may insert 1–3 utility blocks for spacing or visual design.`.trim();

      const thread = await openai.beta.threads.create();

      const safeUserContext = userContext?.trim().substring(0, 500) || "";
      const userInstructions = safeUserContext
        ? `\n📢 User Special Instructions:\n${userContext}\n`
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
      const maxWaitTime = Math.min(120000, API_TIMEOUT - (Date.now() - startTime) - 2000); // 2 minutes or remaining time
      const runStartTime = Date.now();
      let runStatus;
      
      while (Date.now() - runStartTime < maxWaitTime) {
        // Check if we're approaching the overall API timeout
        if (Date.now() - startTime > API_TIMEOUT - 3000) {
          spinner.warn(`⚠️ Email ${i} timed out due to API Gateway constraints`);
          return {
            index: i,
            warning: "Timed out due to API Gateway 30-second limit",
            timeout: true
          };
        }

        runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        
        if (runStatus.status === "completed") {
          break;
        }
        
        if (runStatus.status === "failed") {
          spinner.fail(`❌ Assistant failed on email ${i}`);
          throw new Error(`Assistant failed on email ${i}: ${runStatus.last_error?.message || 'Unknown error'}`);
        }
        
        if (runStatus.status === "expired") {
          spinner.fail(`❌ Assistant run expired on email ${i}`);
          throw new Error(`Assistant run expired on email ${i}`);
        }
        
        if (runStatus.status === "cancelled") {
          spinner.fail(`❌ Assistant run was cancelled on email ${i}`);
          throw new Error(`Assistant run was cancelled on email ${i}`);
        }
        
        // Wait before checking again
        await new Promise((r) => setTimeout(r, 1500));
      }
      
      if (runStatus.status !== "completed") {
        spinner.warn(`⚠️ Email ${i} timed out after ${maxWaitTime / 1000} seconds`);
        return {
          index: i,
          warning: `Timed out after ${maxWaitTime / 1000} seconds`,
          timeout: true
        };
      }

      const messages = await openai.beta.threads.messages.list(thread.id);
      const rawContent = messages.data[0].content[0].text.value;

      let cleanedMjml = rawContent
        .replace(/^\s*```mjml/i, "")
        .replace(/```$/, "")
        .trim();

      if (cleanedMjml.includes("<mjml") && cleanedMjml.includes("</mjml>")) {
        spinner.succeed(`✅ Email ${i} generated successfully`);
        return { 
          index: i, 
          content: cleanedMjml,
          tokens: runStatus.usage?.total_tokens || 0
        };
      } else {
        spinner.fail(`⚠️ Email ${i} generated but MJML wrapper may be invalid`);
        return {
          index: i,
          warning: "MJML formatting invalid",
          content: cleanedMjml,
          tokens: runStatus.usage?.total_tokens || 0
        };
      }
    } catch (error) {
      spinner.fail(`❌ Failed to generate email ${i}`);
      return {
        index: i,
        error: error.message
      };
    }
  });

  try {
    // Wait for all emails to complete or timeout
    const results = await Promise.all(emailPromises);
    
    // Calculate total tokens
    const totalTokens = results.reduce((sum, result) => sum + (result.tokens || 0), 0);
    
    // Clean up session
    cleanupSession(sessionId);
    
    console.log(`🧹 Session cleanup completed for: ${sessionId}`);
    console.log(`🧠 Total OpenAI tokens used: ${totalTokens}`);

    // Check if any emails timed out
    const timedOutEmails = results.filter(r => r.timeout);
    const successfulEmails = results.filter(r => r.content && !r.timeout);
    
    if (timedOutEmails.length > 0) {
      console.log(`⚠️ ${timedOutEmails.length} emails timed out due to API Gateway constraints`);
      res.json({ 
        success: true, 
        totalTokens, 
        emails: results,
        warning: `Generated ${successfulEmails.length} emails. ${timedOutEmails.length} emails timed out due to API Gateway's 30-second limit. Consider generating fewer emails or using a different approach for longer operations.`,
        partialResults: true
      });
    } else {
      res.json({ success: true, totalTokens, emails: results });
    }
  } catch (error) {
    // Clean up session on error
    cleanupSession(sessionId);
    res.status(500).json({ error: error.message });
  }
} 