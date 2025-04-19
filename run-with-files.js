// run-with-files.js
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import axios from "axios";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const brandDomain = "officefurnitureplus.com"; // ✅ Change this to test a different brand

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
You are a world-class MJML email designer and copywriter.

You've been given:
- A full branding dataset from brand.dev (logos[], productImages[], lifestyleImages[], backdrops[], colors, fonts[], tone, slogan, socials)

🎯 Your task:
Design **3 unique MJML marketing emails**, each with a different **visual layout archetype**.

Each email should look like it was created by a different designer. Each layout should be **structurally distinct**, not just stylistically. This means different ordering, use of columns, section emphasis, hero image placement, CTA style, etc.

🧱 Visual Archetype Assignment:
1. Email 1 – **Hero-Heavy Lifestyle Layout**  
   - Starts with large full-width lifestyle image  
   - Soft intro text  
   - 2-column product section  
   - Social proof  
   - CTA

2. Email 2 – **Grid-Based Product Feature Layout**  
   - Starts with bold headline  
   - Tight 3-column product grid (from productImages[])  
   - No large hero  
   - Emphasis on features, CTA after each section  
   - Ends with testimonial and simple footer

3. Email 3 – **Storytelling/Founder-Focused Layout**  
   - No product grid  
   - Starts with logo + headline  
   - Founder story block  
   - Lifestyle image in middle  
   - Emotional copy + mission  
   - CTA

📸 Image usage:
- Each email must use **at least 5 real image URLs** from the branding data
- Only use: logos[], productImages[], lifestyleImages[], backdrops[]
- NO placeholder paths (like /images/logo.png)

🎨 Fonts:
- Use brand’s font with fallback: Helvetica, Arial, sans-serif  
- All fonts must use **inline CSS**

🧠 Copy Style:
- 500–700 words per email  
- Each email should reflect the brand tone but have a unique **objective + flow**  
- Use strong headings, emotional CTA language, and brand voice

💻 MJML Rules:
- Use only valid MJML  
- All styles must be inline  
- Use different MJML section and column structures per layout  
- Ensure mobile responsiveness  
- Include ALT text

📦 Output:
Return exactly 3 markdown code blocks Do NOT include any other text or comments.

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
Only use full URLs like "https://media.brand.dev/...". 
Do not use placeholder paths like "path/to/logo.png".
Use at least 4 images in the layout.
Use logos[], backdrops[], productImages[], and lifestyleImages[].
Return clean MJML only — no broken tags or corrupt content.
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
  fs.writeFileSync("all-emails.mjml", fullOutput);
  console.log("📄 Saved full output → all-emails.mjml");

  // ✂️ Extract and save each HTML email
  const regex = /```html\n([\s\S]*?)```/g;
  let match;
  let count = 0;

  while ((match = regex.exec(fullOutput)) !== null) {
    const html = match[1];
    const fileName = `email${++count}.mjml`;
    fs.writeFileSync(fileName, mjml);
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
