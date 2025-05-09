// run-with-files.js
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import axios from "axios";
import ora from "ora";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Set your domain and desired email type
const payload = {
  domain: "officefurnitureplus.com", // Change this to test a different brand
  email_type: "Newsletter" // Options: "Newsletter", "Product grid", "Promotion"
};

// Map each email_type to its specialized assistant ID
const specializedAssistants = {
  "Newsletter": "asst_So4cxsaziuSI6hZYAT330j1u",
  "Product grid": "asst_wpEAG1SSFXym8BLxqyzTPaVe",
  "Promotion": "asst_Kr6Sc01OP5oJgwIXQgV7qb2k"
};

const logTokenUsage = async (runId, label) => {
  const runMeta = await openai.beta.threads.runs.retrieve(runId.thread_id, runId.id);
  if (runMeta.usage) {
    console.log(`\n📊 Token usage for ${label}:`);
    console.log(`   Prompt:     ${runMeta.usage.prompt_tokens}`);
    console.log(`   Completion: ${runMeta.usage.completion_tokens}`);
    console.log(`   Total:      ${runMeta.usage.total_tokens}`);
  } else {
    console.warn(`⚠️ No token usage data available for ${label}`);
  }
};

const run = async () => {
  const routerAssistantId = "asst_cVwozzBigERvHa1EWIwhAopM";

  const userPrompt = `
You are a routing assistant.
Use the given domain and email_type to retrieve brand.dev data using your tool.
DO NOT generate any MJML or emails.
Just return brand info — it will be passed to a specialized assistant.
Input:
- domain: ${payload.domain}
- email_type: ${payload.email_type}
`;

  const thread = await openai.beta.threads.create();
  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: userPrompt
  });

  const routerRun = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: routerAssistantId
  });

  const spinner = ora("⏳ Fetching brand data from Router Assistant...").start();

  let brandDataWithHint = null;

  while (true) {
    const runStatus = await openai.beta.threads.runs.retrieve(thread.id, routerRun.id);

    if (runStatus.status === "completed") {
      spinner.succeed("✅ Router run completed.");
      await logTokenUsage({ id: routerRun.id, thread_id: thread.id }, "Router Assistant");
      break;
    }

    if (runStatus.status === "failed") {
      spinner.fail("❌ Router run failed.");
      console.error("Error info:", runStatus.last_error || "No error detail available.");
      return;
    }

    if (runStatus.status === "requires_action") {
      spinner.text = " Supplying brand data to Router Assistant...";

      const toolCall = runStatus.required_action.submit_tool_outputs.tool_calls[0];
      const { domain } = JSON.parse(toolCall.function.arguments);

      const response = await axios.post(
        "https://brand-dev-springbot.onrender.com/api/brand-info",
        { domain }
      );

      brandDataWithHint = {
        ...response.data,
        email_type: payload.email_type,
        _debug_note: `
Use real image URLs from brand.dev.
Only use full URLs like "https://media.brand.dev/..." in the MJML.
Return valid MJML in 3 markdown code blocks.
        `.trim()
      };

      await openai.beta.threads.runs.submitToolOutputs(thread.id, routerRun.id, {
        tool_outputs: [
          {
            tool_call_id: toolCall.id,
            output: JSON.stringify(brandDataWithHint)
          }
        ]
      });
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  // Route brand info to specialized assistant
  const selectedAssistantId = specializedAssistants[payload.email_type];
  console.log(`➡️ Using assistant for ${payload.email_type}: ${selectedAssistantId}`);
  if (!selectedAssistantId) {
    console.error("No specialized assistant found for email_type:", payload.email_type);
    return;
  }

  for (let i = 1; i <= 3; i++) {
    console.log(`\n🎯 Generating Email ${i}...`);

    const specializedThread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(specializedThread.id, {
      role: "user",
      content: `
You are a ${payload.email_type} email assistant.
Use the following branding data to generate exactly ONE unique MJML email.
Follow the uploaded inspiration structure rules.
ONLY return valid MJML markdown code — NO extra commentary.

${JSON.stringify(brandDataWithHint)}
`
    });

    const specializedRun = await openai.beta.threads.runs.create(specializedThread.id, {
      assistant_id: selectedAssistantId
    });

    const specializedSpinner = ora(` Running Specialized Assistant for Email ${i}...`).start();

    while (true) {
      const runStatus = await openai.beta.threads.runs.retrieve(specializedThread.id, specializedRun.id);

      if (runStatus.status === "completed") {
        specializedSpinner.succeed(`✅ Specialized assistant run completed for Email ${i}.`);
        await logTokenUsage({ id: specializedRun.id, thread_id: specializedThread.id }, `Specialized Assistant Email ${i}`);
        break;
      }

      if (runStatus.status === "failed") {
        specializedSpinner.fail(`❌ Specialized assistant run failed for Email ${i}.`);
        console.error("Error info:", runStatus.last_error || "No error detail available.");
        return;
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    const messages = await openai.beta.threads.messages.list(specializedThread.id);
    const output = messages.data[0].content[0].text.value;

    console.log(`\n💬 Specialized Assistant Output for Email ${i}:\n\n`, output);

    fs.writeFileSync(`email-${i}.mjml`, output);
    console.log(`📄 Final MJML email saved as email-${i}.mjml`);
  }
};

run();
