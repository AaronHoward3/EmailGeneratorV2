export const specializedAssistants = {
  Newsletter: "asst_So4cxsaziuSI6hZYAT330j1u",
  Productgrid: "asst_wpEAG1SSFXym8BLxqyzTPaVe",
  AbandonedCart: "asst_IGjM9fcv8XZlf9z3l8nUM7l5",
  Promotion: "asst_Kr6Sc01OP5oJgwIXQgV7qb2k",
};

export const BLOCK_DEFINITIONS = {
  Newsletter: {
    sections: ["intro", "content1", "content2", "cta"],
    blocks: {
      intro: [
        "hero-fullwidth.txt",
        "hero-founder-note.txt",
        "hero-quote.txt",
        "hero-highlight-list.txt",
        "hero-split.txt",
      ],
      content1: [
        "dive.txt",
        "brand-story.txt",
        "photo-overlay.txt",
      ],
      content2: [
        "content-text-grid.txt",
        "brand-story.txt",
        "company-direction.txt",
        "dive.txt",
      ],
      cta: [
        "cta-wrapup.txt",
        "bonus-tip.txt",
        "testimonial-closer.txt",
        "philosophy-outro.txt",
        "support-options.txt",
        "recap-summary.txt",
      ],
    },
  },
  Productgrid: {
    sections: ["intro", "content1", "cta"],
    blocks: {
      intro: [
        "hero-title.txt",
        "title-body.txt",
        "title-only.txt",
        "hero-overlay.txt",
      ],
      content1: [
        "alternating-grid.txt",
        "product-grid.txt",
        "single-product.txt",
        "Double-column.txt",
      ],
      cta: ["body-cta.txt", "cta-only.txt", "image-cta.txt"],
    },
  },
  AbandonedCart: {
    sections: ["intro", "content", "cta"],
    blocks: {
      intro: ["CenteredHero.txt", "TextHero.txt"],
      content: [
        "Centered.txt",
        "Grid.txt",
        "product-grid.txt",
        "ProductHIGH.txt",
      ],
      cta: ["CTAGrid.txt", "CTAIncentive.txt", "CTAReminder.txt"],
    },
  },
  Promotion: {
    sections: ["intro", "content", "cta"],
    blocks: {
      intro: ["PromoHeaderHero.txt", "BoldHeaderHero.txt", "EditorialHeaderHero.txt"],
      content: ["PromoBodyCopy.txt", "TextAboveImageBody.txt", "TwoColumnBody.txt"],
      cta: ["PromoCTA.txt", "LargeCTASection.txt", "CTASectionDark.txt"],
    },
  },
}; 