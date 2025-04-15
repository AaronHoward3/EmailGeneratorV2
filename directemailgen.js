// gpt-direct-email-generator.js (with retry logic)
import OpenAI from "openai";
import dotenv from "dotenv";
import axios from "axios";
import fs from "fs";
import path from "path";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const brandDomain = "patagonia.com"; // Change this to test different domains

const uploadTemplates = async () => {
  const filesDir = "./templates";
  const filenames = fs.readdirSync(filesDir);

  const uploads = await Promise.all(
    filenames.map(async (filename) => {
      const filePath = path.join(filesDir, filename);
      const file = await openai.files.create({
        file: fs.createReadStream(filePath),
        purpose: "assistants",
      });
      console.log(`✅ Uploaded: ${filename} (${file.id})`);
      return file;
    })
  );

  return uploads;
};

const fetchBrandInfo = async (domain) => {
  const response = await axios.post("http://localhost:3000/api/brand-info", { domain });
  return response.data;
};

async function retryWithBackoff(fn, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.status === 429) {
        console.warn(`⚠️ Rate limit hit. Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
  throw new Error("🔥 Rate limit persisted after retries.");
}

const run = async () => {
  const templates = await uploadTemplates();
  const brandInfo = await fetchBrandInfo(brandDomain);

  await new Promise((r) => setTimeout(r, 1000)); // Delay to prevent burst

  const examplesSummary = templates
    .map((file, i) => `Example ${i + 1}: ${file.filename}`)
    .join("\n");

  const systemPrompt = `You are a world-class email copywriter and creative director.\n\nYou’ve been given a branding dataset (see below), and 4 reference HTML email templates.\nUse these to generate 5 richly-designed, branded HTML marketing emails.\n\nBranding info: ${JSON.stringify(brandInfo, null, 2)}\n\nReference files:\n${examplesSummary}`;

  const userPrompt = `Create 5 unique, highly visual HTML emails using the brand above.\nEach email must include a subject line, preheader (in comments), and follow this structure:\n1. Welcome email + founder story\n2. Product launch announcement\n3. Educational content or tutorial\n4. Social proof + lifestyle branding\n5. Urgency/discount offer\n\nOutput only 5 separate HTML blocks inside triple backticks, one per email.`;

  const completion = await retryWithBackoff(() =>
    openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4-0125-preview",
      temperature: 0.8,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })
  );

  const result = completion.choices[0].message.content;
  fs.writeFileSync("all-emails.html", result);
  console.log("📄 Saved full output → all-emails.html");

  const regex = /```html\n([\s\S]*?)```/g;
  let match;
  let count = 0;

  while ((match = regex.exec(result)) !== null) {
    const html = match[1];
    const fileName = `email${++count}.html`;
    fs.writeFileSync(fileName, html);
    console.log(`✅ Saved: ${fileName}`);
    if (count >= 5) break;
  }
};

run();
