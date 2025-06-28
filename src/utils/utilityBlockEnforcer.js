import * as cheerio from "cheerio";

/**
 * Enforces a utility block (spacer) between each consecutive content section.
 * @param {string} mjml - the raw MJML string
 * @returns {string} - patched MJML with utility blocks guaranteed between sections
 */
export function enforceUtilityBlocks(mjml) {
  const $ = cheerio.load(mjml, { xmlMode: true });

  // find all top-level mj-section elements
  const sections = $("mj-body > mj-section");

  if (sections.length < 2) {
    // nothing to do if only 1 section
    return mjml;
  }

  // list of utility blocks you allow
  const utilityBlocks = [
    "divider-line.txt",
    "divider-dotted.txt",
    "divider-accent.txt",
    "spacer-md.txt",
    "labeled-divider.txt"
  ];

  // utility block fallback
  const defaultUtility = `
    <mj-section padding="0">
      <mj-column>
        <mj-divider border-color="#e0e0e0" border-width="1px" />
      </mj-column>
    </mj-section>
  `;

  // loop between each pair of consecutive sections
  for (let i = 0; i < sections.length - 1; i++) {
    const current = sections[i];
    const next = sections[i + 1];

    // check if a utility block is already between them
    const currentIndex = $(current).index();
    const nextIndex = $(next).index();

    if (nextIndex - currentIndex > 1) {
      // something is already between them — likely a utility block
      continue;
    }

    // inject the defaultUtility after the current
    $(current).after(defaultUtility);
  }

  return $.xml();
}
