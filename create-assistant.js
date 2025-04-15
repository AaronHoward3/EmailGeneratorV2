// create-assistant.js
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const assistant = await openai.beta.assistants.create({
  name: "Springbot Email Generator-Aaron",
  instructions: `
  You are a branding-savvy email generator. Use the getBrandInfo function to retrieve structured brand identity from a domain, then generate 5 distinct, high-conversion HTML emails.`,
  model: "gpt-4o",
  tools: [
    {
      type: "function",
      function: {
        name: "getBrandInfo",
        description: "Fetch brand identity and visual metadata by domain name.",
        parameters: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: 'e.g., "fender.com"',
            },
          },
          required: ["domain"],
        },
      },
    },
  ],
});

console.log("✅ Assistant created:", assistant.id);
