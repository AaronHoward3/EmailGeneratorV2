import OpenAI from "openai";
import dotenv from "dotenv";
import { uploadImage } from "./imageUploadService.js";
import { TIMEOUTS } from "../config/constants.js";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateCustomHeroAndEnrich(brandData, storeId, jobId) {
  let storeSlug = storeId
    ? String(storeId)
    : brandData.store_name?.toLowerCase().replace(/\s+/g, "-") || "custom-brand";

  storeSlug = storeSlug.replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");

  console.log(`🖼️ Starting hero image generation for job ${jobId}`);

  try {
    // Step 1: Generate prompt using assistant
    const thread = await openai.beta.threads.create();

    const seedContext = `
You are a creative visual assistant that generates powerful, specific, photographic image prompts for ecommerce brands.

Your job is to craft a single prompt for generating a lifestyle-themed hero image for a promotional email.

Use all available brand data and user instructions below to write the image prompt.

RULES:
- Your response must ONLY be the raw prompt text (no explanation, no formatting).
- Do NOT include JSON, markdown, headings, or code blocks.
- Use a cinematic, photographic tone in your prompt (not descriptive sentences).

--- BRAND DATA ---
${JSON.stringify(brandData, null, 2)}

--- USER INSTRUCTIONS ---
${brandData.imageContext || "None"}
`;

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: seedContext,
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: "asst_UwEhWG62uCnBiFijrH2ZzVdd",
    });

    // Step 2: Wait for assistant to finish
    const maxWaitTime = TIMEOUTS.HERO_GENERATION;
    const startTime = Date.now();
    let runStatus;

    while (Date.now() - startTime < maxWaitTime) {
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

      if (runStatus.status === "completed") break;

      if (runStatus.status === "failed") {
        throw new Error(`Assistant run failed: ${runStatus.last_error?.message || "Unknown error"}`);
      }

      if (runStatus.status === "expired") {
        throw new Error("Assistant run expired");
      }

      if (runStatus.status === "cancelled") {
        throw new Error("Assistant run was cancelled");
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    if (runStatus.status !== "completed") {
      throw new Error(`Assistant run timed out after ${maxWaitTime / 1000} seconds. Status: ${runStatus.status}`);
    }

    // Step 3: Get the image prompt text
    const messages = await openai.beta.threads.messages.list(thread.id);
    const promptText = messages.data[0].content[0].text.value.trim();

    console.log("📤 Generated image prompt:", promptText);

    // Step 4: Apply hardcoded safe image rules
    const finalPrompt = `
${promptText}

CRITICAL IMAGE REQUIREMENTS:
- Focus on LIFESTYLE photography - people enjoying activities, beautiful scenes, aspirational moments
- NO text, slogans, pricing, product names, or promotional overlays anywhere in the image
- NO product logos, brand labels, or product packaging visible
- NO watermarks, captions, or text callouts
- The image should be purely photographic lifestyle content
- Leave the bottom 1/3 of the image clear of major subjects for text overlay
- Create an emotional, aspirational mood that connects with the audience
- Use natural lighting and authentic, relatable scenes
- Avoid any commercial or promotional elements
`.trim();

    // Step 5: Generate image
    const imageResponse = await openai.images.generate({
      model: "gpt-image-1",
      prompt: finalPrompt,
      n: 1,
      output_format: "png",
      size: "1024x1536",
      quality: "high",
    });

    const imageBase64 = imageResponse.data[0].b64_json;
    const imageBuffer = Buffer.from(imageBase64, "base64");

    console.log(`🖼️ Generated image for job ${jobId}`);

    // Step 6: Upload to S3 or Supabase
    const randomHash =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    const filename = `hero-${randomHash}.png`;

    const publicUrl = await uploadImage(imageBuffer, filename, storeSlug);

    // Step 7: Return enriched brandData with hero image URLs
    return {
      ...brandData,
      primary_custom_hero_image_banner: publicUrl,
      hero_image_url: publicUrl,
    };
  } catch (error) {
    console.error(`❌ Hero image generation failed for job ${jobId}:`, error.message);
    return brandData;
  }
}
