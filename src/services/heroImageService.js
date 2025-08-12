// src/services/heroImageService.js
import OpenAI from "openai";
import dotenv from "dotenv";
import { uploadImage } from "./imageUploadService.js";
import { countTokens } from "../utils/tokenizer.js";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Non-negotiable rendering rules for hero images.
 * These are ALWAYS included in the final prompt sent to gpt-image-1
 * (regardless of whether we use a locally assembled prompt or a chat-generated idea).
 */
const INVARIANTS = `
STYLE & SUBJECT:
- Editorial lifestyle hero photograph for a promotional email
- modern, brand-safe, cinematic, natural light, polished
- people, environment, or product-in-use if provided (no abstract concept art)

COMPOSITION:
- centered or upper-third composition
- leave the lower third uncluttered for potential text overlay
- subtle bottom framing or gradient to ease transition into email body

STRICT NEGATIVES (MANDATORY):
- no text, lettering, signage, labels, symbols, wordmarks, or typography of any kind
- no brand logos or trademarks (on clothing, products, backdrops, or anywhere)
- no packaging or boxes with labels
- no watermarks

COLOR GUIDANCE:
- prefer balanced, natural tones with a single accent unless brand color is specified
`.trim();

/**
 * Assemble the final image prompt: brand specifics + invariants + a concise creative focus line.
 * This guarantees our strict “no text/logos/labels” rules are always present.
 */
function assemblePrompt({
  brandDesc,
  audience,
  primaryColor,
  extraGuidance,
  creativeFocus // short creative idea, may be empty
}) {
  const colorLine = primaryColor
    ? `Color: incorporate the primary brand color ${primaryColor} subtly as an accent`
    : `Color: use balanced, neutral tones with a single accent`;

  const parts = [
    `Subject/brand: ${brandDesc}`,
    `Audience: ${audience}`,
    colorLine,
    INVARIANTS,
    creativeFocus ? `CREATIVE FOCUS (brief): ${creativeFocus}` : null,
    extraGuidance ? `EXTRA GUIDANCE: ${extraGuidance}` : null
  ].filter(Boolean);

  return parts.join("\n");
}

/** Extract brand basics used for prompt assembly */
function extractBrandBits(brandData) {
  const brandDesc =
    brandData?.description ||
    brandData?.brand_summary ||
    brandData?.store_name ||
    "Modern ecommerce lifestyle brand";

  const primaryColor =
    Array.isArray(brandData?.colors) && brandData.colors.length
      ? brandData.colors[0]
      : null;

  const audience = brandData?.audience || "broad DTC audience";
  const extraGuidance = (brandData?.imageContext || "").toString().slice(0, 400);

  return { brandDesc, primaryColor, audience, extraGuidance };
}

/** Local fallback: build a complete, invariant-safe prompt with no chat calls */
function buildLocalPrompt(brandData) {
  const { brandDesc, primaryColor, audience, extraGuidance } = extractBrandBits(brandData);
  return assemblePrompt({
    brandDesc,
    primaryColor,
    audience,
    extraGuidance,
    creativeFocus: "" // none
  });
}

/**
 * Ask Chat Completions for a SHORT creative angle (one sentence),
 * but we will ALWAYS wrap it with our invariant template before sending to gpt-image-1.
 */
async function createCreativeFocusViaChat(brandData, model) {
  const { brandDesc, primaryColor, audience, extraGuidance } = extractBrandBits(brandData);

  const sys = `
You are a senior creative director and image prompt engineer.
Output ONE short, vivid line that describes a photography concept for an email hero image.
No preamble, no list, no formatting—just the single sentence idea.
It must not include any words instructing text overlays, logos, watermarks, labels, or typography.
`.trim();

  const user = `
Brand: ${brandDesc}
Audience: ${audience}
Primary color (optional): ${primaryColor || "n/a"}
Extra guidance (optional): ${extraGuidance || "n/a"}

Return only the single-line creative angle (<= 25 words).
`.trim();

  const resp = await openai.chat.completions.create({
    model,
    temperature: 0.6,
    max_tokens: 80,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user }
    ]
  });

  const line = resp.choices?.[0]?.message?.content?.trim() || "";
  return { creativeFocus: line, resp };
}

/** Price table fallback when Images API doesn't return usage */
function fallbackImagePriceUSD({ size = "1024x1536", quality = "high" }) {
  const table = {
    low:    { "1024x1024": 0.011, "1024x1536": 0.016, "1536x1024": 0.016 },
    medium: { "1024x1024": 0.042, "1024x1536": 0.063, "1536x1024": 0.063 },
    high:   { "1024x1024": 0.167, "1024x1536": 0.25,  "1536x1024": 0.25  }
  };
  return table[quality]?.[size] ?? 0.17;
}

export async function generateCustomHeroAndEnrich(brandData, storeId, jobId, { metrics } = {}) {
  let storeSlug = storeId
    ? String(storeId)
    : brandData.store_name?.toLowerCase().replace(/\s+/g, "-") || "custom-brand";
  storeSlug = storeSlug.replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");

  metrics?.log?.(`🖼️ Starting hero image generation for job ${jobId}`);

  try {
    const promptModel = process.env.HERO_PROMPT_MODEL || "gpt-4o-mini";
    const size = "1024x1536";
    const quality = "high";

    // 1) Get a short creative angle via chat (official usage), then wrap with invariants
    metrics?.start?.("imagePrompt");
    let creativeFocus = "";
    try {
      const { creativeFocus: line, resp } = await createCreativeFocusViaChat(brandData, promptModel);
      creativeFocus = line;
      metrics?.addUsageFromResponse?.(resp);
      metrics?.recordApiCall?.({
        step: "image_prompt",
        model: resp.model || promptModel,
        usage: resp.usage
      });
    } catch (err) {
      console.warn(`⚠️ Image prompt via chat failed (${err.message}). Falling back to local prompt.`);
    }

    const { brandDesc, primaryColor, audience, extraGuidance } = extractBrandBits(brandData);
    const promptText = creativeFocus
      ? assemblePrompt({ brandDesc, primaryColor, audience, extraGuidance, creativeFocus })
      : buildLocalPrompt(brandData);

    metrics?.end?.("imagePrompt");

    // (Optional) log final prompt for QA
    if (process.env.EG_LOG_IMAGE_PROMPT === "1") {
      metrics?.log?.("Image prompt (sanitized)", promptText.slice(0, 700));
    }

    // Local token visibility (not for billing)
    try {
      const imgPromptTokens = await countTokens(promptText);
      metrics?.addLocalUsage?.({ input: imgPromptTokens });
      metrics?.log?.("Image prompt tokens:", imgPromptTokens);
    } catch {}

    // 2) Generate the image
    metrics?.start?.("imageGeneration");
    const imageResponse = await openai.images.generate({
      model: "gpt-image-1",
      prompt: promptText,
      n: 1,
      output_format: "png",
      size,
      quality,
    });
    const imageBase64 = imageResponse.data[0].b64_json;
    const imageBuffer = Buffer.from(imageBase64, "base64");
    metrics?.end?.("imageGeneration");

    // 3) Image cost accounting
    const PRICE_PER_M = { IMAGE_OUTPUT: 40, TEXT_INPUT: 5 };
    const usage = imageResponse?.usage || null;
    let imgOutTokens = 0;
    let imgTextTokens = 0;
    if (usage) {
      imgOutTokens  = usage.output_tokens || 0;
      imgTextTokens = usage.input_tokens_details?.text_tokens || 0;
    }
    let imageOutputCostUSD = imgOutTokens ? (imgOutTokens / 1e6) * PRICE_PER_M.IMAGE_OUTPUT : null;
    let imageTextInputCostUSD = imgTextTokens ? (imgTextTokens / 1e6) * PRICE_PER_M.TEXT_INPUT : 0;
    if (imageOutputCostUSD === null) {
      imageOutputCostUSD = fallbackImagePriceUSD({ size, quality });
    }
    const imageTotalCostUSD = (imageOutputCostUSD || 0) + (imageTextInputCostUSD || 0);
    metrics.costs = metrics.costs || {};
    metrics.costs.image = { imageTextInputCostUSD, imageOutputCostUSD, imageTotalCostUSD };
    metrics?.log?.("Image cost USD:", metrics.costs.image);

    // 4) Upload and return URLs
    metrics?.start?.("imageUpload");
    const randomHash =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    const filename = `hero-${randomHash}.png`;

    const publicUrl = await uploadImage(imageBuffer, filename, storeSlug);
    metrics?.end?.("imageUpload");

    return {
      ...brandData,
      primary_custom_hero_image_banner: publicUrl,
      hero_image_url: publicUrl,
    };
  } catch (error) {
    console.error(`❌ Hero image generation failed for job ${jobId}:`, error.message);
    return brandData; // keep the pipeline alive
  }
}
