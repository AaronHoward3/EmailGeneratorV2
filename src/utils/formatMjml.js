// src/utils/formatMjml.js
// Pretty-prints MJML with optional URL hygiene.
// Uses optional deps (xml-formatter / prettier) if installed; otherwise falls back to a built-in formatter.

export async function formatMjml(input, opts = {}) {
  const s = String(input || "");
  if (!s.trim()) return s;

  // 1) Try xml-formatter (optional)
  try {
    const mod = await import("xml-formatter");
    const xmlFormatter = mod?.default || mod;
    let out = xmlFormatter(s, {
      indentation: "  ",
      collapseContent: true,
      lineSeparator: "\n",
    });
    return postProcess(out, opts);
  } catch {}

  // 2) Try prettier as HTML (optional)
  try {
    const prettier = (await import("prettier/standalone")).default;
    const parserHtml = (await import("prettier/parser-html")).default;
    let out = prettier.format(s, {
      parser: "html",
      plugins: [parserHtml],
      printWidth: 100,
      tabWidth: 2,
      htmlWhitespaceSensitivity: "ignore",
    });
    return postProcess(out, opts);
  } catch {}

  // 3) Fallback (no deps)
  return postProcess(naivePretty(s), opts);
}

function postProcess(raw, opts) {
  const o = { normalizeDataUris: true, stripTrackingParams: false, ...(opts || {}) };
  let out = raw;

  if (o.normalizeDataUris) out = normalizeSvgDataUris(out);
  if (o.stripTrackingParams) out = stripTrackingQuery(out, o.stripTrackingParams);

  // IMPORTANT: Do NOT decode %20 etc. in http(s) links here; it can break deliverability/click-tracking.
  return out;
}

/* ---------------- helpers ---------------- */

function naivePretty(raw) {
  const compact = raw.replace(/>\s+</g, ">\n<").replace(/\r\n/g, "\n");
  const lines = compact.split("\n").map((l) => l.trim()).filter(Boolean);

  const open = /^<([a-z-]+)(?=\s|>)(?![^>]*\/>)[^>]*>$/i;
  const close = /^<\/([a-z-]+)>$/i;
  const selfc = /^<([a-z-]+)[^>]*\/>$/i;

  let depth = 0, out = [];
  for (const line of lines) {
    if (close.test(line)) depth = Math.max(0, depth - 1);
    out.push("  ".repeat(depth) + line);
    if (open.test(line) && !selfc.test(line)) depth += 1;
  }
  return out.join("\n") + "\n";
}

// Convert text-encoded SVG data URIs (with or without css url(...)) into base64.
// Matches: background-url="data:image/svg+xml,ENC" OR background-url="url('data:image/svg+xml,ENC')"
function normalizeSvgDataUris(mjml) {
  const re = /\b(background-url|src|href)=["'](?:url\(["']?)?data:image\/svg\+xml,([^"'()]+)(?:["']?\))?["']/gi;
  return mjml.replace(re, (_m, attr, encoded) => {
    try {
      const svg = decodeURIComponent(encoded);
      const b64 = Buffer.from(svg, "utf8").toString("base64");
      return `${attr}="data:image/svg+xml;base64,${b64}"`;
    } catch {
      return _m;
    }
  });
}

// Remove known tracking params (opt-in). Pass true or an array of keys.
// Example enable: stripTrackingParams: true  OR  stripTrackingParams: ["utm_source","utm_medium","gclid"]
function stripTrackingQuery(mjml, mode) {
  const KNOWN = [
    /^utm_/i, /^mc_/i, /^mkt_tok$/i,
    /^gclid$/i, /^fbclid$/i, /^msclkid$/i,
    /^_hsmi$/i, /^_hsenc$/i, /^vero_id$/i, /^icid$/i
  ];

  return mjml.replace(
    /\b(?:href|src|background-url)=["'](https?:\/\/[^"']+)["']/gi,
    (m, url) => {
      try {
        const u = new URL(url);
        for (const [k] of u.searchParams) {
          const shouldDrop = Array.isArray(mode)
            ? mode.includes(k) || KNOWN.some(rx => rx.test(k))
            : KNOWN.some(rx => rx.test(k));
          if (shouldDrop) u.searchParams.delete(k);
        }
        const cleaned = u.toString();
        return m.replace(url, cleaned);
      } catch {
        return m;
      }
    }
  );
}

export default formatMjml;
