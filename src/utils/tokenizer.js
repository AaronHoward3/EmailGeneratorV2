// Tries to use @dqbd/tiktoken for accurate counts; falls back to chars/4.
let enc = null;

async function getEncoder() {
  if (enc) return enc;
  try {
    const { encoding_for_model } = await import("@dqbd/tiktoken");
    enc = encoding_for_model("gpt-4o-mini"); // good default for 4o/mini families
  } catch {
    enc = null;
  }
  return enc;
}

export async function countTokens(text) {
  if (!text) return 0;
  const e = await getEncoder();
  const s = String(text);
  if (!e) return Math.ceil(s.length / 4); // heuristic fallback
  try {
    const tokens = e.encode(s);
    return tokens.length;
  } catch {
    return Math.ceil(s.length / 4);
  }
}
