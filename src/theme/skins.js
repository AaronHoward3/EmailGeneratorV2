// src/theme/skins.js
// Skins are pure transforms of tokens → theme pack (rules).

const EXEMPT = new Set(["luxe_mono","neo_brutalist"]);

export function resolveSkinId(v) {
  const id = (v || "minimal_clean").toString().trim().toLowerCase().replace(/\s+/g, "_");
  const aliases = {
    gradient: "gradient_glow",
    "bold contrasting": "bold_contrasting",
    "bold-contrasting": "bold_contrasting",
    brutalist: "neo_brutalist",
    luxe: "luxe_mono",
    serif: "magazine_serif",
    editorial: "warm_editorial",
    warm: "warm_editorial",
    pastel: "pastel_soft",
  };
  return aliases[id] || id;
}

function hexToRgb(hex){const h=(hex||"").replace("#","");const f=h.length===3?h.split("").map(c=>c+c).join(""):h.padStart(6,"0");const n=parseInt(f,16);return{r:(n>>16)&255,g:(n>>8)&255,b:n&255}}
function _lin(v){v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4)}
function luminance(hex){const {r,g,b}=hexToRgb(hex||"#000");return 0.2126*_lin(r)+0.7152*_lin(g)+0.0722*_lin(b)}
function isDark(hex){return luminance(hex)<0.18}
function mix(a,b,t=0.5){
  const H=h=>h.replace("#",""); const A=H(a).padStart(6,"0"), B=H(b).padStart(6,"0");
  const p=x=>parseInt(x,16), to2=v=>Math.round(v).toString(16).padStart(2,"0");
  const r=(1-t)*p(A.slice(0,2))+t*p(B.slice(0,2));
  const g=(1-t)*p(A.slice(2,4))+t*p(B.slice(2,4));
  const b_=(1-t)*p(A.slice(4,6))+t*p(B.slice(4,6));
  return `#${to2(r)}${to2(g)}${to2(b_)}`;
}
function deriveSecondStop(c){
  // If only one color, derive a second stop by nudging toward white/black
  return isDark(c) ? mix(c, "#ffffff", 0.25) : mix(c, "#111111", 0.25);
}

export function makeSkin(tokens, skinIdRaw) {
  const skinId = resolveSkinId(skinIdRaw);

  // Common defaults for all non-exempt skins
  const base = {
    id: skinId,
    fonts: {
      heading: { name: "Inter", hrefs: [
        "https://fonts.googleapis.com/css2?family=Inter:wght@700;800&display=swap"
      ] },
      body: { name: "Inter", hrefs: [
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
      ] },
    },
    palette: {
      pageBg: tokens.pageBg,
      sectionBg: tokens.sectionBg,
      text: tokens.text,
      muted: tokens.muted,
      brand: tokens.brand,
      brandAlt: tokens.brandAlt || tokens.brand,
      border: tokens.border,
      cardBg: tokens.cardBg,
    },
    h1: { size: 42, weight: 800 },
    h2: { size: 28, weight: 700 },
    bodySize: 16,
    border: { width: 1, style: "solid" },
    radii: { card: 0, img: 0, btn: 0 },
    buttons: { variant: "filled" }, // filled/outline/ghost/gradient
    extras: {
      colorOverrides: true,
      buttonContrastFromBg: false,
      globalGradient: false,
      slabMode: null,   // "dark" | null
      slabColor: null,  // computed when slabMode is "dark"
    },
    pattern: null, // may be set by skin
    shadow: { card: "" }
  };

  if (EXEMPT.has(skinId)) {
    if (skinId === "luxe_mono") {
      base.fonts.heading.name = "Playfair Display";
      base.fonts.heading.hrefs = [
        "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap"
      ];
      base.fonts.body.name = "Georgia";
      base.radii = { card: 0, img: 0, btn: 0 };
      base.buttons.variant = "outline";
      base.extras.colorOverrides = false;
    }
    if (skinId === "neo_brutalist") {
      base.radii = { card: 0, img: 0, btn: 0 };
      base.buttons.variant = "ghost";
      base.extras.colorOverrides = false;
    }
    return base;
  }

  switch (skinId) {
    case "bold_contrasting": {
      base.radii = { card: 0, img: 0, btn: 0 };
      base.buttons.variant = "filled";
      // Enable dark slab background by default
      base.extras.slabMode = "dark";
      const brandDark = isDark(tokens.brand);
      const altDark   = isDark(tokens.brandAlt || tokens.brand);
      base.extras.slabColor = brandDark ? tokens.brand : (altDark ? (tokens.brandAlt || tokens.brand) : "#111111");
      break;
    }

    case "gradient_glow": {
      base.buttons.variant = "gradient";
      base.extras.globalGradient = true;
      base.extras.buttonContrastFromBg = true;

      let g1 = tokens.gradient.from;
      let g2 = tokens.gradient.to;
      if (!g2 || g2.toLowerCase() === g1.toLowerCase()) {
        g2 = deriveSecondStop(g1); // ensure visible gradient even if primary == link
      }

      base.pattern = {
        kind: "linear",
        grad1: g1,
        grad2: g2,
        angle: tokens.gradient.angle
      };
      break;
    }

    case "warm_editorial": {
      base.fonts.heading.name = "Sora";
      base.fonts.heading.hrefs = [
        "https://fonts.googleapis.com/css2?family=Sora:wght@700&display=swap"
      ];
      base.radii = { card: 8, img: 8, btn: 6 };
      base.buttons.variant = "outline";
      break;
    }

    case "magazine_serif": {
      base.fonts.heading.name = "Playfair Display";
      base.fonts.heading.hrefs = [
        "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap"
      ];
      base.radii = { card: 6, img: 4, btn: 4 };
      base.buttons.variant = "filled";
      break;
    }

    case "pastel_soft": {
      base.radii = { card: 10, img: 10, btn: 10 };
      base.buttons.variant = "ghost";
      break;
    }

    default: {
      // minimal_clean & unknown → gentle defaults
      base.radii = { card: 0, img: 0, btn: 0 };
      base.buttons.variant = "filled";
    }
  }

  return base;
}
