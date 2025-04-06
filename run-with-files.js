// run-with-files.js
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import axios from "axios";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const brandDomain = "patagonia.com"; // ✅ Change this to test a different brand

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
  const assistantId = "asst_PDHD4TvZbW5urGdwLKVKO2Rt";
  const uploadedFileIds = await uploadFiles();

  const userPrompt = `
You are a world-class email copywriter and creative director.

You’ve been given:
- A complete branding dataset (from brand.dev)
- 4 real-world HTML examples (uploaded as reference files)

These examples — "Olukai Example Email", "Visual Electric Example Email", "New York Example Email", and "Fender Example Email" — each demonstrate unique layouts and email design features such as:

- Product grids and 2–3 column layouts
- Hero sections with backdrop images
- Split visual blocks (text + image)
- Interactive-feeling CTAs or carousels
- Testimonials, quotes, or community spotlights

You must reference these examples structurally. Treat them as layout templates and inspiration for your final HTML output.

The JSON retrieved from brand.dev includes:
- Primary logo(s): use for header or intro
- Brand colors: use for body, header, CTA backgrounds, and accents
- Backdrop images: use as full-width banners or visual breaks
- Font(s): apply consistently across heading/body/CTA
- Slogan and tone: infuse copy with the brand’s emotional signature
- Social links: include in the footer

🎯 Create **five visually distinct, fully fleshed-out HTML marketing emails**, each with a specific goal:

1. Welcome email + founder story
2. Product launch announcement
3. Educational value (music tips, tutorials)
4. Community/social proof + lifestyle branding
5. Urgency email with countdown/promo

Each email must:
- Be 200–300 words long with strong storytelling
- Begin with a subject line and preheader (in comments)
- Use the brand’s visual identity throughout: logo, colors, fonts, backdrop images
- Be structurally and visually different from one another
- Incorporate features like: product showcases, image grids, background sections, lifestyle storytelling, or testimonial quotes
- Include brand.dev social links in the footer
- Be styled with **inline CSS**, **mobile responsive**, and **production-ready**

📦 Output ONLY 5 valid HTML blocks in code blocks. Do NOT include any text or explanations outside the HTML.

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
        _debug_note:
          "Use all logos, backdrop images, colors, and fonts from this brand.dev payload for layout + design.",
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
