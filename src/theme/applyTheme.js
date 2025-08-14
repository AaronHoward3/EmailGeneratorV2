// src/theme/applyTheme.js
// Deterministic theming with wrapper-only gradient for gradient skin:
// - head injection
// - body wrapper gradient via data-URI (no url(...))
// - sections transparent under gradient (no bg-color / bg-url)
// - bold_contrasting slabs kept for that skin only
// - auto-contrast for text/buttons

import { buildBrandTokens } from "./tokens.js";
import { makeSkin } from "./skins.js";

function attrs(obj){ return Object.entries(obj).map(([k,v]) => `${k}="${String(v)}"`).join(" "); }
function stripAttr(tag, patterns){ let out = tag; for (const p of patterns) out = out.replace(p,""); return out; }
function addOrReplaceAttr(tag, name, value) {
  const re = new RegExp(`\\s${name}="[^"]*"`, "i");
  if (re.test(tag)) return tag.replace(re, ` ${name}="${value}"`);
  return tag.replace(/<([a-z-]+)/i, (m) => `${m} ${name}="${value}"`);
}
function mix(a,b,t=0.5){
  const H=h=>h.replace("#",""); const A=H(a).padStart(6,"0"), B=H(b).padStart(6,"0");
  const p=x=>parseInt(x,16), to2=v=>Math.round(v).toString(16).padStart(2,"0");
  const r=(1-t)*p(A.slice(0,2))+t*p(B.slice(0,2));
  const g=(1-t)*p(A.slice(2,4))+t*p(B.slice(2,4));
  const b_=(1-t)*p(A.slice(4,6))+t*p(B.slice(4,6));
  return `#${to2(r)}${to2(g)}${to2(b_)}`;
}
function hexToRgb(hex){
  const h = (hex||"").replace("#",""); const f = h.length===3? h.split("").map(c=>c+c).join("") : h.padStart(6,"0");
  const n=parseInt(f,16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};
}
function _lin(v){v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4)}
function _L(hex){const {r,g,b}=hexToRgb(hex);return 0.2126*_lin(r)+0.7152*_lin(g)+0.0722*_lin(b)}
function contrast(bg, fg){const a=_L(bg), b=_L(fg); const [hi,lo]=a>b?[a,b]:[b,a]; return (hi+0.05)/(lo+0.05)}
function bestTextOn(bg){ return contrast(bg,"#ffffff")>=contrast(bg,"#111111") ? "#ffffff" : "#111111"; }

// SVG data-URI gradient (NO url(...) wrapper). MJML needs raw URL string in background-url.
function svgGradientDataUri(angleDeg, c1, c2) {
  const rad = (angleDeg % 360) * Math.PI / 180;
  const x = Math.cos(rad), y = Math.sin(rad);
  const map = (v) => (v + 1) / 2;
  const x1 = map(-x).toFixed(3), y1 = map(-y).toFixed(3);
  const x2 = map(x).toFixed(3),  y2 = map(y).toFixed(3);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="2400" preserveAspectRatio="none">
  <defs>
    <linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`.trim();

  const enc = encodeURIComponent(svg).replace(/%0A/g, "").replace(/%20/g, " ");
  return `data:image/svg+xml;utf8,${enc}`;
}

function buildHead(skin) {
  const H = skin.fonts.heading, B = skin.fonts.body;
  const fontTags = []
    .concat((H?.hrefs||[]).map(h=>`<mj-font name="${H.name}" href="${h}"></mj-font>`))
    .concat((B?.hrefs||[]).map(h=>`<mj-font name="${B.name}" href="${h}"></mj-font>`))
    .join("\n      ");

  const buttonBase = { "inner-padding":"14px 22px", "font-weight":"700", "text-decoration":"none", "border-radius":`${skin.radii.btn}px` };
  let btnCss = "";
  if (skin.buttons.variant === "filled") {
    btnCss = `.btn a{background-color:${skin.palette.brand};color:#ffffff;border:0;}`;
  } else if (skin.buttons.variant === "outline") {
    btnCss = `.btn a{background-color:transparent;color:${skin.palette.text};border:${skin.border.width}px ${skin.border.style} ${skin.palette.border};}`;
  } else if (skin.buttons.variant === "ghost") {
    btnCss = `.btn a{background-color:transparent;color:${skin.palette.brand};border:0;}`;
  } else if (skin.buttons.variant === "gradient") {
    btnCss = `.btn a{background-image:linear-gradient(90deg, ${skin.palette.brand}, ${skin.palette.brandAlt});color:#ffffff;border:0;}`;
  }

  const css =
    `a{color:${skin.palette.brand};}a:hover{color:${skin.palette.brandAlt};}` +
    `.btn-secondary a{background-color:${skin.palette.brandAlt};color:#ffffff;border:0;}` +
    `${btnCss}` +
    (skin.shadow?.card ? `.card{box-shadow:${skin.shadow.card};}` : "");

  const cardAttrs = {
    "background-color": skin.palette.cardBg,
    "padding": "24px",
    "border-radius": `${skin.radii.card}px`,
    "css-class": "card"
  };

  return `
  <mj-head>
    ${fontTags}
    <mj-attributes>
      <mj-all font-family="${B?.name || "Inter"}, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"></mj-all>
      <mj-text color="${skin.palette.text}" font-size="${skin.bodySize}px" line-height="1.6"></mj-text>
      <mj-button ${attrs(buttonBase)} font-family="${B?.name || "Inter"}, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" mj-class="btn"></mj-button>
      <mj-image border-radius="${skin.radii.img}px" padding="0"></mj-image>
      <mj-divider border-color="${skin.palette.border}" border-width="${skin.border.width}px" border-style="${skin.border.style}"></mj-divider>
      <mj-class name="h1" font-family="${H?.name || "Inter"}, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" font-weight="${skin.h1.weight}" font-size="${skin.h1.size}px" line-height="1.2" text-transform="none" letter-spacing="0" color="${skin.palette.text}"></mj-class>
      <mj-class name="h2" font-family="${H?.name || "Inter"}, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" font-weight="${skin.h2.weight}" font-size="${skin.h2.size}px" line-height="1.3" text-transform="none" letter-spacing="0" color="${skin.palette.text}"></mj-class>
      <mj-class name="muted" color="${skin.palette.muted}"></mj-class>
      <mj-class name="btn"></mj-class>
      <mj-class name="btn-secondary"></mj-class>
      <mj-class name="img" padding="0" border-radius="${skin.radii.img}px"></mj-class>
      <mj-class name="card" ${attrs(cardAttrs)}></mj-class>
    </mj-attributes>
    <mj-style>${css}</mj-style>
  </mj-head>`.trim();
}

export function applyTheme(mjml, payloadBrand, skinIdRaw) {
  const tokens = buildBrandTokens(payloadBrand);
  const skin = makeSkin(tokens, skinIdRaw);

  // 0) Replace any existing head with our head
  let out = String(mjml || "");
  out = out.replace(/<mj-head[\s\S]*?<\/mj-head>/gi, "");
  const head = buildHead(skin);
  out = out.includes("<mjml>") ? out.replace("<mjml>", `<mjml>\n${head}\n`) : `<mjml>\n${head}\n${out}`;

  // 1) Body background + optional gradient wrapper (SVG data-URI, no url(...))
  const gradientActive = !!(skin.pattern && skin.pattern.kind === "linear" && skin.extras.globalGradient);
  const g1 = skin.pattern?.grad1 || tokens.gradient.from;
  const g2 = skin.pattern?.grad2 || tokens.gradient.to;
  const ang = skin.pattern?.angle ?? tokens.gradient.angle;
  const gradMid = mix(g1,g2,0.5);

  out = out.replace(/<mj-body([^>]*)>/i, (m) => {
    let t = m.replace(/\sbackground-color="[^"]*"/i, "");
    t = t.replace(/<mj-body/i, `<mj-body background-color="${skin.palette.pageBg}"`);
    if (gradientActive) {
      const bgImg = svgGradientDataUri(ang, g1, g2);
      const wrapperOpen =
        `<mj-wrapper background-url="${bgImg}" background-color="${gradMid}" background-size="cover" background-repeat="no-repeat" background-position="center center">`;
      t += wrapperOpen;
    }
    return t;
  });
  if (gradientActive) {
    out = out.replace(/<\/mj-body>/i, `</mj-wrapper></mj-body>`);
  }

  // 2) Section processing
  out = out.replace(/<mj-section\b[^>]*>[\s\S]*?<\/mj-section>/gi, (section) => {
    let s = section;

    // When gradient is active: make sections fully transparent — no bg-color, no bg-url.
    if (gradientActive) {
      // strip any existing backgrounds
      s = s
        .replace(/(<mj-section\b[^>]*?)\s+background-color="[^"]*"/gi, "$1")
        .replace(/(<mj-section\b[^>]*?)\s+background-url="[^"]*"/gi, "$1");
    }
    // Bold-contrasting slabs (only when NOT gradient)
    else if (skin.extras.slabMode === "dark") {
      const hasBgColor = /\sbackground-color="[^"]*"/i.test(s);
      const hasBgUrl   = /\sbackground-url="[^"]*"/i.test(s);
      if (!hasBgColor && !hasBgUrl) {
        const slab = skin.extras.slabColor || "#111111";
        s = s.replace(/<mj-section\b/i, `<mj-section background-color="${slab}"`);
      }
    }
    // Default: ensure section background exists if none
    else {
      const hasBgColor = /\sbackground-color="[^"]*"/i.test(s);
      const hasBgUrl   = /\sbackground-url="[^"]*"/i.test(s);
      if (!hasBgColor && !hasBgUrl) {
        s = s.replace(/<mj-section\b/i, `<mj-section background-color="${skin.palette.sectionBg}"`);
      }
    }

    // Compute bg for contrast decisions:
    // For gradient: use gradient midpoint, since sections are transparent.
    const bg = gradientActive
      ? gradMid
      : (s.match(/<mj-section[^>]*\sbackground-color="([^"]*)"/i) || [])[1] || skin.palette.sectionBg;

    // TEXT: auto-contrast (override if poor)
    s = s.replace(/<mj-text([^>]*)>/gi, (m, attrs) => {
      const hasColorMatch = attrs.match(/\scolor="([^"]*)"/i);
      const cur = hasColorMatch ? hasColorMatch[1] : null;
      const desired = (cur && contrast(bg, cur) >= 4.5) ? cur : bestTextOn(bg);
      let t = m;
      if (hasColorMatch) t = t.replace(/\scolor="[^"]*"/i, ` color="${desired}"`);
      else t = `<mj-text${attrs} color="${desired}">`;
      return t;
    });

    // BUTTONS: normalize + contrast-aware
    s = s.replace(/<mj-button[^>]*>/gi, (tag) => {
      let t = stripAttr(tag, [/\sborder-radius="[^"]*"/i, /\sborder="[^"]*"/i, /\sbackground-color="[^"]*"/i, /\scolor="[^"]*"/i]);
      if (!/mj-class=/i.test(t)) t = t.replace(/<mj-button/i, `<mj-button mj-class="btn"`);
      if (skin.extras.colorOverrides) {
        const txt = bestTextOn(bg);
        if (skin.buttons.variant === "filled" || skin.buttons.variant === "gradient") {
          const bgBtn = contrast(bg, skin.palette.brand) >= contrast(bg, skin.palette.brandAlt) ? skin.palette.brand : skin.palette.brandAlt;
          t = addOrReplaceAttr(t, "background-color", bgBtn);
          t = addOrReplaceAttr(t, "color", txt);
          t = addOrReplaceAttr(t, "border", "0");
        } else if (skin.buttons.variant === "outline") {
          t = addOrReplaceAttr(t, "background-color", "transparent");
          t = addOrReplaceAttr(t, "color", txt);
          t = addOrReplaceAttr(t, "border", `1px solid ${txt}`);
        } else {
          t = addOrReplaceAttr(t, "background-color", "transparent");
          t = addOrReplaceAttr(t, "color", skin.palette.brand);
          t = addOrReplaceAttr(t, "border", "0");
        }
      }
      return t;
    });

    return s;
  });

  // 3) Cards
  out = out.replace(/<mj-column([^>]*)mj-class="card"([^>]*)>/gi, (m, pre, post) => {
    let t = `<mj-column${pre} mj-class="card"${post}>`;
    t = stripAttr(t, [/\sbackground-color="[^"]*"/i, /\sborder="[^"]*"/i, /\sborder-radius="[^"]*"/i]);
    t = addOrReplaceAttr(t, "background-color", skin.palette.cardBg);
    t = addOrReplaceAttr(t, "border", `${skin.border.width}px ${skin.border.style} ${skin.palette.border}`);
    t = addOrReplaceAttr(t, "border-radius", `${skin.radii.card}px`);
    return t;
  });

  // 4) Kill legacy fallback hexes for non-exempt skins
  if (!["neo_brutalist","luxe_mono"].includes(skin.id)) {
    const swaps = [
      { re: /color="#ffd700"/gi, repl: `color="${skin.palette.brand}"` },
      { re: /color="#ffb400"/gi, repl: `color="${skin.palette.brand}"` },
      { re: /color="#ff4d4d"/gi, repl: `color="${skin.palette.brandAlt}"` },
      { re: /background-color="#ffd700"/gi, repl: `background-color="${skin.palette.brand}"` },
      { re: /background-color="#ffb400"/gi, repl: `background-color="${skin.palette.brand}"` },
      { re: /background-color="#ff4d4d"/gi, repl: `background-color="${skin.palette.brandAlt}"` },
    ];
    for (const { re, repl } of swaps) out = out.replace(re, repl);
  }

  return out;
}
