// server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import OpenAI from "openai";
import fs from "fs";
import ora from "ora";

const app = express();
const port = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());

const specializedAssistants = {
  Newsletter: "asst_So4cxsaziuSI6hZYAT330j1u",
  Productgrid: "asst_wpEAG1SSFXym8BLxqyzTPaVe",
  Promotion: "asst_Kr6Sc01OP5oJgwIXQgV7qb2k"
};

app.post("/generate-emails", async (req, res) => {
  const { brandData, emailType } = req.body;

  if (!brandData || !emailType) {
    return res.status(400).json({ error: "Missing brandData or emailType in request body." });
  }

  const assistantId = specializedAssistants[emailType];
  if (!assistantId) {
    return res.status(400).json({ error: `No assistant configured for: ${emailType}` });
  }

  const responses = [];
  let totalTokens = 0;

  for (let i = 1; i <= 3; i++) {
    const spinner = ora(`Generating ${emailType} email ${i}...`).start();
    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `
You are an expert ${emailType} email assistant.

Your job:
Generate one MJML email using uploaded block templates.

Only return MJML inside a single \`\`\`mjml\`\`\` block.

Do not include header or footer. Start with <mjml><mj-body> and end with </mj-body></mjml>.

Do NOT repeat the same structure as the previous 2 emails.

${JSON.stringify({ ...brandData, email_type: emailType }, null, 2)}
      `.trim()
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId
    });

    while (true) {
      const runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

      if (runStatus.status === "completed") {
        spinner.succeed(`✅ Completed email ${i}`);
        if (runStatus.usage?.total_tokens) {
          totalTokens += runStatus.usage.total_tokens;
        }
        break;
      }

      if (runStatus.status === "failed") {
        spinner.fail(`❌ Failed on email ${i}`);
        return res.status(500).json({ error: `Assistant failed on email ${i}`, detail: runStatus.last_error });
      }

      await new Promise((res) => setTimeout(res, 1500));
    }

    const messages = await openai.beta.threads.messages.list(thread.id);
    const rawContent = messages.data[0].content[0].text.value;

    // Strip markdown-style code block if present
    const cleanedMjml = rawContent
      .replace(/^\s*```mjml/i, "")
      .replace(/```$/, "")
      .trim();

    // Validate MJML wrapper
    if (cleanedMjml.includes("<mjml") && cleanedMjml.includes("</mjml>")) {
      fs.writeFileSync(`email-${i}.mjml`, cleanedMjml);
      console.log(`✅ Saved email-${i}.mjml`);
      responses.push({ index: i, content: cleanedMjml });
    } else {
      console.warn(`⚠️ Skipped saving email ${i} – MJML wrapper missing`);
      responses.push({ index: i, content: cleanedMjml, warning: "MJML wrapper missing, file not saved." });
    }
  }

  console.log(`🧠 Total OpenAI tokens used: ${totalTokens}`);
  res.json({ success: true, totalTokens, emails: responses });
});

app.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});
