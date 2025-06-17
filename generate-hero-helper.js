// generate-hero-helper.js
import fs from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";
import { uploadHeroImage } from "./image-upload-service.js";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateCustomHeroAndEnrich(brandData) {
  const storeSlug =
    brandData.store_name?.toLowerCase().replace(/\s+/g, "-") || "custom-brand";

  // Step 1: Generate image prompt from assistant
  const thread = await openai.beta.threads.create();
  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: JSON.stringify(brandData),
  });

  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: "asst_UwEhWG62uCnBiFijrH2ZzVdd",
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

  // Step 2: Generate image
  const imageResponse = await openai.images.generate({
    model: "gpt-image-1",
    prompt: promptText,
    n: 1,
    output_format: "png",
    quality: "high",
  });

  const imageBase64 = imageResponse.data[0].b64_json;
  const outputPath = "./hero.png";
  fs.writeFileSync(outputPath, Buffer.from(imageBase64, "base64"));

  // Step 3: Upload using abstraction
  const timestamp = Date.now();
  const remoteFileName = `${storeSlug}/hero-${timestamp}.png`;
  const publicUrl = await uploadHeroImage(outputPath, remoteFileName);

  // Step 4: Enrich brandData inline
  const reordered = {};
  for (const key of Object.keys(brandData)) {
    reordered[key] = brandData[key];
    if (key === "store_url") {
      reordered["primary_custom_hero_image_banner"] = publicUrl;
    }
  }

  return reordered;
}
