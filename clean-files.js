// clean-files.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const run = async () => {
  const files = await openai.files.list();
  const assistantFiles = files.data.filter((f) => f.purpose === "assistants");

  if (assistantFiles.length === 0) {
    console.log("✅ No assistant files found to delete.");
    return;
  }

  console.log(`🗑️ Deleting ${assistantFiles.length} assistant files:`);

  for (const file of assistantFiles) {
    await openai.files.del(file.id);
    console.log(`   ➤ Deleted: ${file.id} (${file.filename})`);
  }

  console.log("✅ Done cleaning vector store.");
};

run();
