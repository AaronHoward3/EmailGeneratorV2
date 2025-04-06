// run-with-files.js
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import axios from "axios";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  const assistantId = "asst_PDHD4TvZbW5urGdwLKVKO2Rt"; // ✅ Replace with your assistant ID
  const uploadedFileIds = await uploadFiles();

  const userPrompt = `
You are a world-class email copywriter and creative director. You’ve been given a complete branding dataset for a business, including their name, voice, visual identity, colors, fonts, logos, social links, and product positioning.

Create **five unique, fully fleshed-out HTML marketing emails**, each with a distinct tone, layout, and objective. These emails must feel premium, emotionally resonant, and conversion-focused.

Each email should:

- Be 150–250 words long, with personality, emotion, and rich storytelling
- Start with a strong subject line and optional preheader
- Use persuasive, emotionally engaging copy — not robotic or generic
- Follow a high-conversion structure: eye-catching headline, value-driven body, strong CTA
- Reflect Fender’s bold tone, legacy, and craftsmanship
- Use the brand's colors, font stack, and logo
- Visually stand apart from each other (different layout patterns, sections, image usage)
- Include optional elements: image grids, testimonial quotes, content blocks, visual background sections
- Use the template files to get inspiration for the design and structure

Each email should serve a different goal:

1. Welcome email + founder story
2. Product launch announcement
3. Educational value (music tips, tutorials)
4. Community/social proof + lifestyle branding
5. Urgency email with countdown/promo (e.g., limited sale, final hours)

Output: Valid, responsive HTML. Use inline styles. Structure should be **production-ready** for direct use in email clients. Design should be mobile-friendly, spaced, and clean.

Fender domain: fender.com

Write these like they came from Fender’s internal creative team. Capture their history, spirit, tone, and excellence.
`;

  const thread = await openai.beta.threads.create();

  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: userPrompt,
    attachments: uploadedFileIds.map((id) => ({
      file_id: id,
      tools: [{ type: "file_search" }], // ✅ FIXED tool type
    })),
  });

  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistantId,
  });

  // ⏳ Poll for status + handle brand info function call
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

      await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
        tool_outputs: [
          {
            tool_call_id: toolCall.id,
            output: JSON.stringify(response.data),
          },
        ],
      });
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  // 📨 Show final assistant response
  const messages = await openai.beta.threads.messages.list(thread.id);
  const latest = messages.data[0];

  console.log("\n💬 Assistant says:\n\n", latest.content[0].text.value);

  if (latest.content[0].text.annotations?.length) {
    console.log("\n📎 Cited files:");
    latest.content[0].text.annotations.forEach((ann, i) => {
      console.log(`  ${i + 1}. File ID: ${ann.file_citation.file_id}`);
      console.log(`     Snippet: "${ann.text.slice(0, 100)}..."`);
    });
  }

  const runMeta = await openai.beta.threads.runs.retrieve(thread.id, run.id);
  if (runMeta.usage) {
    console.log(
      `\n📊 Token usage → Prompt: ${runMeta.usage.prompt_tokens}, Completion: ${runMeta.usage.completion_tokens}, Total: ${runMeta.usage.total_tokens}`
    );
  }
};

run();
