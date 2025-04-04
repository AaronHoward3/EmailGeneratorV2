// run-assistant.js
import OpenAI from "openai";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const run = async () => {
  const assistantId = "asst_PDHD4TvZbW5urGdwLKVKO2Rt"; // ✅ Replace with your actual one
  const thread = await openai.beta.threads.create();

  // 🗣️ Step 1: Send user message
  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: "Generate 5 emails for the brand domain 'fender.com'.",
  });

  // 🚀 Step 2: Start the run
  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistantId,
  });

  // 🔄 Step 3: Poll + handle tool call
  let runStatus;
  while (true) {
    runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

    if (runStatus.status === "completed" || runStatus.status === "failed")
      break;

    if (runStatus.status === "requires_action") {
      const toolCall =
        runStatus.required_action.submit_tool_outputs.tool_calls[0];
      const { domain } = JSON.parse(toolCall.function.arguments);

      // 🛠️ Hit your deployed Render backend
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

  // 📦 Step 4: Print the final assistant response
  const messages = await openai.beta.threads.messages.list(thread.id);
  const latest = messages.data[0];
  console.log("💬 Assistant says:\n\n", latest.content[0].text.value);
};

run();
