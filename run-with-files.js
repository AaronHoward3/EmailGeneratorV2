// run-with-files.js
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import axios from "axios";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const brandDomain = "puma.com"; // ✅ Change this to test a different brand

const uploadFiles = async () => {
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
      return file.id;
    })
  );

  return uploads;
};

const run = async () => {
  const assistantId = "asst_BGTGdYxL9H0DUFnaObBzZlmN";
  const uploadedFileIds = await uploadFiles();

  const userPrompt = `
You are a world-class HTML email designer and storytelling copywriter.

You've been given:
- A complete branding dataset from brand.dev
  (includes: logos[], productImages[], lifestyleImages[], backdrops[], colors, fonts[], tone, slogan, socials)

🎯 Your task:
Design **ONE** fully fleshed-out, premium-quality marketing email that could be sent by the brand today. BE CREATIVE WITH DESIGN!
Layout Should be unique and visually appealing. Use the brand's colors, fonts, and logo.

🧱 Layout Requirements (must include all):
1. Subject line and preheader (in HTML comments)
2. Logo header
3. Full-width hero image (from backdrops[] or lifestyleImages[])
4. Founder intro or brand mission block (story-driven)
5. Product showcase using a 2–3 column grid (from productImages[])
6. Lifestyle storytelling section (image + ambient text)
7. A testimonial, review, or quote from a happy customer
8. Strong CTA block with button and contrasting color
9. Footer with social icons and brand logo

📸 Images:
- Use **at least 5 real image URLs** from the branding dataset
- Do **not** use placeholders like "{heroImage}" or "/images/logo.png"
- Only use URLs from logos[], productImages[], lifestyleImages[], backdrops[]

🎨 Typography:
Use the brand’s primary font 
Fallback: Helvetica, Arial, sans-serif  
Apply fonts using inline CSS only

💬 Copywriting Style:
- Write between **500–700 words** of original, branded copy
- Match the brand’s emotional tone (bold, premium, earthy, etc.)
- Use clear hierarchy: h1, h2, paragraphs, CTA buttons

💻 Technical Rules:
- Use semantic, responsive HTML
- All styles must be inline (no <style> tags)
- Ensure mobile readability with smart layout
- Include ALT text for all images

📦 Output format:
Return ONLY one markdown code block with the complete email

${brandDomain} domain: ${brandDomain}
`;

  const thread = await openai.beta.threads.create();

  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: userPrompt,
    attachments: uploadedFileIds.map((id) => ({
      file_id: id,
      tools: [{ type: "file_search" }],
    })),
  });

  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistantId,
  });

  let runStatus;
  while (true) {
    runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

    if (runStatus.status === "completed" || runStatus.status === "failed")
      break;

    if (runStatus.status === "requires_action") {
      const toolCall =
        runStatus.required_action.submit_tool_outputs.tool_calls[0];
      const { domain } = JSON.parse(toolCall.function.arguments);

      const response = await axios.post(
        "https://brand-dev-springbot.onrender.com/api/brand-info",
        { domain }
      );

      const brandDataWithHint = {
            ...response.data,
            _debug_note: `
Use real image URLs from brand.dev. 
Do not use placeholder paths like "path/to/logo.png".
Use at least 4 images in the layout.
Use logos[], backdrops[], productImages[], and lifestyleImages[].
Return clean HTML only — no broken tags or corrupt content.
            `.trim(),
          };
      await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
        tool_outputs: [
          {
            tool_call_id: toolCall.id,
            output: JSON.stringify(brandDataWithHint),
          },
        ],
      });
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  const messages = await openai.beta.threads.messages.list(thread.id);
  const latest = messages.data[0];
  const fullOutput = latest.content[0].text.value;

  console.log("\n💬 Assistant says:\n\n", fullOutput);

  // 🧠 Save entire text blob
  fs.writeFileSync("all-emails.html", fullOutput);
  console.log("📄 Saved full output → all-emails.html");

  // ✂️ Extract and save each HTML email
  const regex = /```html\n([\s\S]*?)```/g;
  let match;
  let count = 0;

  while ((match = regex.exec(fullOutput)) !== null) {
    const html = match[1];
    const fileName = `email${++count}.html`;
    fs.writeFileSync(fileName, html);
    console.log(`✅ Saved: ${fileName}`);
  }

  // 📊 Usage
  const runMeta = await openai.beta.threads.runs.retrieve(thread.id, run.id);
  if (runMeta.usage) {
    console.log(
      `\n📊 Token usage → Prompt: ${runMeta.usage.prompt_tokens}, Completion: ${runMeta.usage.completion_tokens}, Total: ${runMeta.usage.total_tokens}`
    );
  }
};

run();
