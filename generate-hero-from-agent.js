import fs from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.AIDAN_PERSONAL_OPENAI_API_KEY,
});

const brandFile = "./OFP-payload.json";
const outputImagePath = "./hero.png";
const assistantId = "asst_XsNVSz53XTKTu1WDiFSMFbeL";

async function main() {
  // Step 1: Read brand data
  const brandData = JSON.parse(fs.readFileSync(brandFile, "utf-8"));

  // Step 2: Create a new thread and send message to Art Director Assistant
  const thread = await openai.beta.threads.create();
  const userMessage = {
    role: "user",
    content: JSON.stringify({
      brand: brandData,
      request:
        "Generate a vivid visual concept for a promotional hero image. Return ONLY the raw prompt text, no explanation.",
    }),
  };
  await openai.beta.threads.messages.create(thread.id, userMessage);

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

  // Step 3: Generate image with promptText
  const imageResponse = await openai.images.generate({
    model: "gpt-image-1",
    prompt: promptText,
    n: 1,
    size: "1024x1024",
    output_format: "png",
    quality: "high",
  });

  const imageBase64 = imageResponse.data[0].b64_json;

  // Step 4: Save image
  fs.writeFileSync(outputImagePath, Buffer.from(imageBase64, "base64"));
  console.log("✅ Image saved to", outputImagePath);
}

main().catch((err) => {
  console.error("❌ Error:", err);
});
