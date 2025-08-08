import OpenAI from "openai";
import dotenv from "dotenv";
import { uploadImage } from "./imageUploadService.js";
import { TIMEOUTS } from "../config/constants.js";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// -------- Helpers --------

function buildLocalPrompt(brandData) {
  const desc =
    brandData?.description ||
    brandData?.brand_summary ||
    brandData?.store_name ||
    "Modern ecommerce lifestyle brand";
  const primaryColor = Array.isArray(brandData?.colors) && brandData.colors.length
    ? brandData.colors[0]
    : null;
  const audience = brandData?.audience || "broad DTC audience";
  const extra = (brandData?.imageContext || "").toString().slice(0, 400);

  // Keep it concise, explicit, and banner-friendly
  return `
Editorial lifestyle hero photograph for a promotional email.
Subject/brand: ${desc}
Audience: ${audience}
Style: modern, brand-safe, cinematic, natural light, polished.
Composition: centered or upper-third; leave lower third uncluttered for text overlay; subtle bottom framing/gradient for smooth transition into email body.
Color: ${primaryColor ? `incorporate the primary brand color ${primaryColor}` : "use balanced, neutral tones with a single accent"}
No text/letters/signage/symbols. No watermarks. No packaging. No logos.
Visual specificity: people, environment, or product-in-use (if provided), not abstract concept art.
${extra ? `Extra guidance: ${extra}` : ""}`.trim();
}

async function createPromptViaAssistant(brandData, assistantId, maxWaitMs) {
  const thread = await openai.beta.threads.create();
  const seed = `
You are a senior creative director and expert image prompt engineer.

Your task is to take structured brand data (as JSON) and imageContext, and generate a short, vivid prompt to create a marketing hero image using OpenAI’s gpt-image-1.

When user context is provided, use this to tailor the image prompt to match the context.

The generated image will serve as the top banner of a high-end promotional email. It must be:
- Editorial, modern, and brand-safe.
- Visually aligned with the brand’s tone, colors, industry, and target audience.
- Polished and modular: designed to visually “fit” into an email layout (with subtle gradients or bottom framing to transition cleanly into the email body). Use interesting methods to frame the subject to blend it seamlessly into a modular email design.
- Visually specific, not abstract or conceptual.

Rules:
- Return only the final prompt text. No markdown, no code fences, no JSON, no explanations.
- Keep the prompt under 400 tokens.
- Use rich visuals relevant to the brand.
- Always incorporate the brand’s primary color into the composition (if provided).
- Absolutely no text/letters/signage/symbols rendered in the image. No packaging.
- Use a centered or upper-third composition, and leave the lower third uncluttered for email overlay.
- Natural lighting, editorial polish.

--- BRAND DATA ---
${JSON.stringify(brandData, null, 2)}
`.trim();

  await openai.beta.threads.messages.create(thread.id, { role: "user", content: seed });
  const run = await openai.beta.threads.runs.create(thread.id, { assistant_id: assistantId });

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const status = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    if (status.status === "completed") break;
    if (["failed", "expired", "cancelled"].includes(status.status)) {
      throw new Error(`Assistant run ${status.status}: ${status.last_error?.message || ""}`);
    }
    await new Promise(r => setTimeout(r, 900));
  }

  const msgs = await openai.beta.threads.messages.list(thread.id);
  const prompt = msgs.data?.[0]?.content?.[0]?.text?.value?.trim();
  if (!prompt) throw new Error("Assistant returned empty prompt");
  return prompt;
}

// -------- Main --------

export async function generateCustomHeroAndEnrich(brandData, storeId, jobId) {
  let storeSlug = storeId
    ? String(storeId)
    : brandData.store_name?.toLowerCase().replace(/\s+/g, "-") || "custom-brand";

  storeSlug = storeSlug.replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");

  console.log(`🖼️ Starting hero image generation for job ${jobId}`);

  try {
    const assistantId = process.env.HERO_PROMPT_ASSISTANT_ID || "";
    let promptText;

    if (assistantId) {
      try {
        promptText = await createPromptViaAssistant(brandData, assistantId, TIMEOUTS.HERO_GENERATION);
      } catch (err) {
        // If the provided assistant is invalid (404) or fails for any reason, fallback locally
        console.warn(`⚠️ Hero prompt assistant failed (${err.message}). Falling back to local prompt.`);
        promptText = buildLocalPrompt(brandData);
      }
    } else {
      // No assistant configured — use local prompt
      promptText = buildLocalPrompt(brandData);
    }

    // Generate the image from the prompt
    const imageResponse = await openai.images.generate({
      model: "gpt-image-1",
      prompt: promptText,
      n: 1,
      output_format: "png",
      size: "1024x1536",
      quality: "high",
    });

    const imageBase64 = imageResponse.data[0].b64_json;
    const imageBuffer = Buffer.from(imageBase64, "base64");

    console.log(`🖼️ Generated image for job ${jobId}`);

    // Upload to S3 or Supabase
    const randomHash =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    const filename = `hero-${randomHash}.png`;

    const publicUrl = await uploadImage(imageBuffer, filename, storeSlug);

    // Return enriched brandData with hero image URLs
    return {
      ...brandData,
      primary_custom_hero_image_banner: publicUrl,
      hero_image_url: publicUrl,
    };
  } catch (error) {
    console.error(`❌ Hero image generation failed for job ${jobId}:`, error.message);
    return brandData; // do not break the overall email pipeline
  }
}
