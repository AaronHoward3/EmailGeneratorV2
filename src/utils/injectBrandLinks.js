// src/utils/injectBrandLinks.js

/**
 * Make hero images clickable to the brand homepage.
 * Handles:
 *  A) <mj-image src="...CUSTOMHEROIMAGE.COM"...>  -> adds/overrides href
 *  B) <mj-section background-url="...CUSTOMHEROIMAGE.COM"...> -> injects transparent click-layer button
 *  C) <mj-image class="hero-image"...> -> adds/overrides href (fallback)
 * Also replaces {{BRAND_URL}} placeholders.
 *
 * Idempotent: safe to call multiple times.
 */
export function injectBrandLinks(mjml, rawBrandUrl) {
  const brandUrl = normalizeBrandUrl(rawBrandUrl);
  if (!brandUrl) return mjml;

  let out = String(mjml);

  // Replace placeholder first (explicit support in your blocks)
  out = out.replace(/\{\{BRAND_URL\}\}/g, brandUrl);

  // --- Case A: explicit hero <mj-image ... src="...CUSTOMHEROIMAGE.COM"...>
  // If the tag already has an href, override it with the brandUrl to ensure correct target.
  out = out.replace(
    /<mj-image([^>]*?)\s(src=["'][^"']*CUSTOMHEROIMAGE\.COM[^"']*["'])([^>]*)>/gi,
    (m, pre, srcAttr, post) => {
      // remove any existing href to avoid duplicates
      const cleaned = m.replace(/\s+href=["'][^"']*["']/i, "");
      // insert href after <mj-image
      return cleaned.replace(/<mj-image/i, `<mj-image${pre} href="${brandUrl}" `);
    }
  );

  // --- Case B: hero section uses background-url with CUSTOMHEROIMAGE.COM ---
  // Inject a transparent full-width button as the first child (click layer).
  // Use a marker comment to avoid re-injecting on subsequent calls.
  out = out.replace(
    /<mj-section([^>]*?)\sbackground-url=["'][^"']*CUSTOMHEROIMAGE\.COM[^"']*["']([^>]*)>([\s\S]*?)<\/mj-section>/gi,
    (match, pre, post, inner) => {
      if (/<!--\s*injected-brand-click\s*-->/.test(inner)) {
        return match; // already injected
      }
      // If a button already points to brandUrl, skip injection
      if (new RegExp(`<mj-button[^>]*href=["']${escapeRegExp(brandUrl)}["']`, "i").test(inner)) {
        return match;
      }
      const clickLayer =
        `<!-- injected-brand-click --><mj-column width="100%"><mj-button href="${brandUrl}" background-color="transparent" color="transparent" font-size="0px" padding="0" border="0px">&nbsp;</mj-button></mj-column>`;
      // Put click layer at the very start of section content
      return `<mj-section${pre} background-url="https://CUSTOMHEROIMAGE.COM"${post}>${clickLayer}${inner}</mj-section>`;
    }
  );

  // --- Case C: fallback for blocks that tag the hero image explicitly ---
  // e.g., <mj-image class="hero-image" ...>
  out = out.replace(
    /<mj-image([^>]*class=["'][^"']*hero-image[^"']*["'][^>]*)>/gi,
    (m, attrs) => {
      // if already has href to brandUrl, skip
      if (new RegExp(`href=["']${escapeRegExp(brandUrl)}["']`, "i").test(m)) return m;
      // remove any href & add our href
      const cleaned = m.replace(/\s+href=["'][^"']*["']/i, "");
      return cleaned.replace(/<mj-image/i, `<mj-image href="${brandUrl}" `);
    }
  );

  return out;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeBrandUrl(u) {
  if (!u || typeof u !== "string") return "";
  let url = u.trim();
  if (!url) return "";
  // If it's just a domain, add https://
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  // rudimentary sanity: must contain a dot and no spaces
  if (!/\./.test(url) || /\s/.test(url)) return "";
  return url;
}