import fs from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";
import { uploadHeroImage } from "./image-upload-service.js";
import path from "path";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const inputFile = "./OFP-payload.json";
const enrichedOutputFile = "./OFP-payload-enriched.json";
const outputImagePath = "./hero.png";
const assistantId = "asst_UwEhWG62uCnBiFijrH2ZzVdd";

async function main() {
  // Step 1: Load brand data
  const originalJson = JSON.parse(fs.readFileSync(inputFile, "utf-8"));
  const brandData = originalJson.brandData;

  const wantsCustomHero =
    brandData.customHeroImage &&
    brandData.customHeroImage.toLowerCase() === "yes";

  if (!wantsCustomHero) {
    console.log(
      "⚠️ Skipping hero image generation — 'customHeroImage' flag is off."
    );
    return;
  }

  const storeSlug =
    brandData.store_name?.toLowerCase().replace(/\s+/g, "-") || "custom-brand";

  // Step 2: Get image prompt from assistant
  const thread = await openai.beta.threads.create();
  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: JSON.stringify({
      brand: brandData,
      request:
        "Generate a vivid visual concept for a promotional hero image. Return ONLY the raw prompt text, no explanation.",
    }),
  });

  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistantId,
  });

  let runStatus;
  while (true) {
    runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    if (runStatus.status === "completed") break;
    if (runStatus.status === "failed") throw new Error("Assistant run failed");
    await new Promise((r) => setTimeout(r, 1000));
  }

  const messages = await openai.beta.threads.messages.list(thread.id);
  const promptText = messages.data[0].content[0].text.value;

  // Step 3: Generate image from prompt
  const imageResponse = await openai.images.generate({
    model: "gpt-image-1",
    prompt: promptText,
    n: 1,
    output_format: "png",
    quality: "high",
  });

  const imageBase64 = imageResponse.data[0].b64_json;

  // Step 4: Save image locally
  fs.writeFileSync(outputImagePath, Buffer.from(imageBase64, "base64"));
  console.log("✅ Image saved locally:", outputImagePath);

  // Step 5: Upload using abstraction
  const timestamp = Date.now();
  const remoteFileName = `${storeSlug}/hero-${timestamp}.png`;
  const publicUrl = await uploadHeroImage(outputImagePath, remoteFileName);

  console.log("✅ Image uploaded:", publicUrl);

  // Step 6: Enrich brand JSON and write to new file
  const enrichedBrandData = {
    ...brandData,
  };

  const reorderedBrandData = {};
  for (const key of Object.keys(enrichedBrandData)) {
    reorderedBrandData[key] = enrichedBrandData[key];
    if (key === "store_url") {
      reorderedBrandData["primary_custom_hero_image_banner"] = publicUrl;
    }
  }

  const enriched = {
    ...originalJson,
    brandData: reorderedBrandData,
  };

  fs.writeFileSync(
    "./OFP-payload-enriched.json",
    JSON.stringify(enriched, null, 2)
  );
  console.log("✅ Enriched JSON saved to ./OFP-payload-enriched.json");
}

main().catch((err) => {
  console.error("❌ Error:", err);
});
