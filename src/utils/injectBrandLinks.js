// src/utils/injectBrandLinks.js

/**
 * Make hero areas clickable to the brand homepage and enforce non self-closing <mj-image>.
 * Handles:
 *  A) <mj-image src="...CUSTOMHEROIMAGE.COM"...>  -> add/override href=brandUrl
 *  B) <mj-section background-url="...CUSTOMHEROIMAGE.COM"...> -> inject transparent click-layer button (idempotent)
 *  C) <mj-image class="hero-image"...> -> add/override href=brandUrl (fallback)
 *  D) If none matched, add href=brandUrl to the first <mj-image> in the first <mj-section> (only if it lacks href)
 * Also replaces {{BRAND_URL}} placeholders.
 */

export function injectBrandLinks(mjml, rawBrandUrl) {
  let out = String(mjml || "");

  // Always enforce open/close <mj-image> first (even if brand URL missing)
  out = ensureOpenCloseImages(out);

  const brandUrl = normalizeBrandUrl(rawBrandUrl);
  if (!brandUrl) {
    // Still return with images normalized to open/close form
    return out;
  }

  // Replace {{BRAND_URL}} placeholders
  out = out.replace(/\{\{BRAND_URL\}\}/g, brandUrl);

  // --- Case A: explicit hero <mj-image ... src="...CUSTOMHEROIMAGE.COM"...>
  out = out.replace(
    /<mj-image([^>]*?)\s(src=["'][^"']*CUSTOMHEROIMAGE\.COM[^"']*["'])([^>]*)>([\s\S]*?)<\/mj-image>/gi,
    (full, pre, _src, post, inner) => addOrReplaceHref(full, brandUrl, /*force*/ true)
  );

  // --- Case B: hero section uses background-url with CUSTOMHEROIMAGE.COM ---
  // Inject a transparent button as a click layer at the start of the section content.
  out = out.replace(
    /<mj-section([^>]*?)\sbackground-url=["'][^"']*CUSTOMHEROIMAGE\.COM[^"']*["']([^>]*)>([\s\S]*?)<\/mj-section>/gi,
    (match, pre, post, inner) => {
      // Idempotent: skip if already injected
      if (/<!--\s*injected-brand-click\s*-->/.test(inner)) return match;
      // If a button already points to brandUrl inside, skip
      if (new RegExp(`<mj-button[^>]*href=["']${escapeRegExp(brandUrl)}["']`, "i").test(inner)) return match;

      const clickLayer =
        `<!-- injected-brand-click -->` +
        `<mj-column width="100%">` +
        `<mj-button href="${brandUrl}" background-color="transparent" color="transparent" font-size="0px" padding="0" border="0px">&nbsp;</mj-button>` +
        `</mj-column>`;

      // Put click layer at the very start of section content, keep original background-url intact
      return `<mj-section${pre} background-url="${extractBgUrl(match) || 'https://CUSTOMHEROIMAGE.COM'}"${post}>${clickLayer}${inner}</mj-section>`;
    }
  );

  // --- Case C: fallback for blocks that tag the hero image explicitly (class*="hero-image")
  out = out.replace(
    /<mj-image([^>]*class=["'][^"']*hero-image[^"']*["'][^>]*)>([\s\S]*?)<\/mj-image>/gi,
    (full) => addOrReplaceHref(full, brandUrl, /*force*/ true)
  );

  // --- Case D: final fallback — first image in first section (only if it lacks href)
  out = linkFirstImageInFirstSection(out, brandUrl);

  return out;
}

/* ------------------------ helpers ------------------------ */

function ensureOpenCloseImages(mjml) {
  // Convert any self-closing <mj-image .../> to <mj-image ...></mj-image>
  return mjml.replace(/<mj-image\b([^>]*)\/>/gi, (_m, attrs) => `<mj-image${attrs}></mj-image>`);
}

function addOrReplaceHref(mjImageTag, url, forceReplace = false) {
  // mjImageTag is a full "<mj-image ...>...</mj-image>" tag (open+close guaranteed by ensureOpenCloseImages)
  const hasHref = /\shref=/i.test(mjImageTag);
  if (hasHref) {
    if (!forceReplace) return mjImageTag;
    // Replace existing href value
    return mjImageTag.replace(/\shref=["'][^"']*["']/i, ` href="${url}"`);
  }
  // Insert href before closing '>'
  return mjImageTag.replace(/<mj-image/i, `<mj-image href="${url}"`);
}

function linkFirstImageInFirstSection(mjml, brandUrl) {
  const sectionMatch = mjml.match(/<mj-section[\s\S]*?<\/mj-section>/i);
  if (!sectionMatch) return mjml;

  const section = sectionMatch[0];
  // Find first <mj-image> WITHOUT href
  const imgRe = /<mj-image(?![^>]*\shref=)[^>]*>[\s\S]*?<\/mj-image>/i;
  if (!imgRe.test(section)) return mjml;

  const updatedSection = section.replace(imgRe, (tag) => addOrReplaceHref(tag, brandUrl, /*force*/ false));
  return mjml.replace(section, updatedSection);
}

function extractBgUrl(sectionTag) {
  const m = sectionTag.match(/\sbackground-url=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeBrandUrl(u) {
  if (!u || typeof u !== "string") return "";
  let url = u.trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) url = "https://" + url.replace(/^\/+/, "");
  // rudimentary sanity
  if (!/\./.test(url) || /\s/.test(url)) return "";
  return url;
}

export default injectBrandLinks;
