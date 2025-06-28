import OpenAI from "openai";
import dotenv from "dotenv";
import { uploadImage } from "./imageUploadService.js";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateCustomHeroAndEnrich(brandData, storeId, jobId) {
  // Use storeId directly, with fallback to store_name if not provided
  // Convert storeId to string if it's a number
  let storeSlug = storeId
    ? String(storeId)
    : brandData.store_name?.toLowerCase().replace(/\s+/g, "-") ||
      "custom-brand";

  // Clean up the slug to prevent issues
  storeSlug = storeSlug
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  console.log(`🖼️ Starting hero image generation for job ${jobId}`);

  try {
    // Step 1: Generate image prompt from assistant
    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: JSON.stringify(brandData),
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: "asst_UwEhWG62uCnBiFijrH2ZzVdd",
    });

    // Step 2: Wait for run completion with timeout
    const maxWaitTime = 60000; // 60 seconds
    const startTime = Date.now();
    let runStatus;

    while (Date.now() - startTime < maxWaitTime) {
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

      if (runStatus.status === "completed") {
        break;
      }

      if (runStatus.status === "failed") {
        throw new Error(
          `Assistant run failed: ${
            runStatus.last_error?.message || "Unknown error"
          }`
        );
      }

      if (runStatus.status === "expired") {
        throw new Error("Assistant run expired");
      }

      if (runStatus.status === "cancelled") {
        throw new Error("Assistant run was cancelled");
      }

      // Wait before checking again
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (runStatus.status !== "completed") {
      throw new Error(
        `Assistant run timed out after ${maxWaitTime / 1000} seconds. Status: ${
          runStatus.status
        }`
      );
    }

    const messages = await openai.beta.threads.messages.list(thread.id);
    const promptText = messages.data[0].content[0].text.value;

    console.log(`🎨 Generated image prompt for job ${jobId}`);

    // Step 3: Generate image
    const imageResponse = await openai.images.generate({
      model: "gpt-image-1",
      prompt: promptText,
      n: 1,
      output_format: "png",
      quality: "high",
    });

    const imageBase64 = imageResponse.data[0].b64_json;
    const imageBuffer = Buffer.from(imageBase64, "base64");

    console.log(`🖼️ Generated image for job ${jobId}`);

    // Step 4: Upload using abstraction with hash-based filename generation
    // Generate a random hash instead of using timestamp to avoid duplication issues
    const randomHash =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    // Generate a more robust filename with validation
    const sanitizedStoreSlug = storeSlug
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    // Use hash-based filename generation
    const filename = `hero-${randomHash}.png`;

    const publicUrl = await uploadImage(
      imageBuffer,
      filename,
      sanitizedStoreSlug
    );

    console.log(`📤 Uploaded hero image for job ${jobId}: ${publicUrl}`);

    // Step 5: Enrich brandData inline - FIXED: Set both fields
    const reordered = {
      ...brandData, // Copy all existing properties first
      primary_custom_hero_image_banner: publicUrl,
      hero_image_url: publicUrl, // Override/set both hero image fields
    };

    console.log(`✅ Hero image generation completed for job ${jobId}`);
    return reordered;
  } catch (error) {
    console.error(
      `❌ Hero image generation failed for job ${jobId}:`,
      error.message
    );
    // Return original brandData on error so the process can continue
    return brandData;
  }
}
