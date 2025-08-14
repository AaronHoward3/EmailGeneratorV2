// src/theme/tokens.js
// Build canonical theme tokens from payload + guardrails.

function normHex(h) {
  const s = String(h || "").trim();
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return null;
  if (s.length === 4) return ("#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
  return s.toLowerCase();
}
function hexToRgb(hex) {
  const h = (hex || "").replace("#","");
  const f = h.length===3 ? h.split("").map(c=>c+c).join("") : h.padStart(6,"0");
  const n = parseInt(f,16);
  return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
}
function luminance(hex) {
  const {r,g,b} = hexToRgb(hex||"#000");
  const lin = v=>{ v/=255; return v<=0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); };
  return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
}
function isDark(hex){ return luminance(hex) < 0.18; }

export function buildBrandTokens(brandLike = {}, opts = {}) {
  const b = brandLike.brandData ? brandLike.brandData : brandLike;

  const tokens = {
    pageBg:        normHex(b.body_color)          || "#ffffff",
    sectionBg:     normHex(b.body_color)          || "#ffffff",
    text:          normHex(b.text_color)          || "#141414",
    muted:         normHex(b.muted_color)         || "#9aa1a8",
    brand:         normHex(b.primary_color)       || "#2a6df5",
    brandAlt:      normHex(b.link_color)          || "#6bb1ff",
    border:        normHex(b.button_border_color) || "#e5e7eb",
    cardBg:        normHex(b.card_bg)             || normHex(b.body_color) || "#ffffff",
    buttonText:    normHex(b.button_text_color)   || "#ffffff",
  };

  // If cardBg too dark for a light page, align to pageBg
  if (isDark(tokens.cardBg) && !isDark(tokens.pageBg)) {
    tokens.cardBg = tokens.pageBg;
  }

  // Optional gradient tokens derived from brand + brandAlt
  tokens.gradient = {
    from: tokens.brand,
    to:   tokens.brandAlt || tokens.brand,
    angle: 135,
  };

  return tokens;
}
