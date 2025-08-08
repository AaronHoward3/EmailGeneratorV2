// src/services/subjectService.js
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate a single compelling subject line (<= 60 chars).
 * Returns a string. Falls back to a safe default on error.
 */
export async function generateSubjectLine({
  brandData = {},
  emailType = "Promotion",
  designAesthetic = "bold_contrasting",
  userContext = "",
  refinedMjml = ""
}) {
  const sys = `
You are a marketing copywriter. Write ONE compelling email subject line.
- Max 60 characters
- No emojis unless the tone clearly warrants it
- No spammy all caps
- Match the brand tone and the email type
Return ONLY the subject line text, nothing else.
`.trim();

  const user = `
brandData: ${JSON.stringify(brandData).slice(0, 4000)}
emailType: ${emailType}
designAesthetic: ${designAesthetic}
userContext: ${userContext || "None"}
contentHint (optional, may be empty): ${refinedMjml ? refinedMjml.slice(0, 2000) : ""}
`.trim();

  try {
    const resp = await openai.chat.completions.create({
      model: process.env.SUBJECTLINE_MODEL || "gpt-4o-mini",
      temperature: 0.8,
      max_tokens: 50,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ]
    });
    const text = resp.choices?.[0]?.message?.content?.trim();
    return (text || "").replace(/^["'“”]+|["'“”]+$/g, "").slice(0, 120);
  } catch (e) {
    console.warn("Subject line generation failed:", e.message);
    // Not fatal; return a safe generic fallback
    const name = brandData?.store_name || brandData?.name || "Your brand";
    return `${name}: New picks inside`;
  }
}
