import OpenAI from "openai";
import { countTokens } from "../utils/tokenizer.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate a single compelling subject line (<= 60 chars).
 * Adds official usage + local counts to metrics.
 */
export async function generateSubjectLine({
  brandData = {},
  emailType = "Promotion",
  designAesthetic = "bold_contrasting",
  userContext = "",
  refinedMjml = "",
  metrics,
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
    // local count for prompt
    try {
      const inTokens = await countTokens(`${sys}\n\n${user}`);
      metrics?.addLocalUsage?.({ input: inTokens });
    } catch {}

    metrics?.start?.("subjectLine");
    const resp = await openai.chat.completions.create({
      model: process.env.SUBJECTLINE_MODEL || "gpt-4o-mini",
      temperature: 0.8,
      max_tokens: 50,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ]
    });
    metrics?.end?.("subjectLine");

    // official usage
    metrics?.addUsageFromResponse?.(resp);

    const text = resp.choices?.[0]?.message?.content?.trim();
    const subject = (text || "").replace(/^["'“”]+|["'“”]+$/g, "").slice(0, 120);

    // local count for output
    try {
      const outTokens = await countTokens(subject);
      metrics?.addLocalUsage?.({ output: outTokens });
    } catch {}

    metrics?.log?.("Subject line generated:", subject);
    return subject;
  } catch (e) {
    console.warn("Subject line generation failed:", e.message);
    const name = brandData?.store_name || brandData?.name || "Your brand";
    return `${name}: New picks inside`;
  }
}
