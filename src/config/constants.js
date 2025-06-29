export const specializedAssistants = {
  Newsletter: "asst_So4cxsaziuSI6hZYAT330j1u",
  Productgrid: "asst_wpEAG1SSFXym8BLxqyzTPaVe",
  AbandonedCart: "asst_IGjM9fcv8XZlf9z3l8nUM7l5",
  Promotion: "asst_Kr6Sc01OP5oJgwIXQgV7qb2k",
};

export const BLOCK_DEFINITIONS = {
  Newsletter: {
    sections: ["intro", "utility1", "content1", "utility2", "cta"],
    blocks: {
      intro: [
        "hero-fullwidth.txt",
        "hero-founder-note.txt",
        "hero-quote.txt",
        "hero-highlight-list.txt",
        "hero-split.txt",
      ],
      utility1: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
      content1: [
        "dive.txt",
        "brand-story.txt",
        "content-text-grid.txt",
        "company-direction.txt",
      ],
      utility2: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
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
    sections: ["intro", "utility1", "content1", "utility2", "cta"],
    blocks: {
      intro: [
        "hero-title.txt",
        "hero-overlay.txt",
      ],
      utility1: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
      content1: [
        "alternating-grid.txt",
        "product-grid.txt",
        "single-product.txt",
        "Double-column.txt",
      ],
      utility2: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
      cta: ["body-cta.txt", "cta-only.txt", "image-cta.txt"],
    },
  },
  AbandonedCart: {
    sections: ["intro", "utility1", "content1", "utility2", "cta"],
    blocks: {
      intro: ["CenteredHero.txt", "TextHero.txt"],
      utility1: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt",],
      content1: [
        "Centered.txt",
        "Grid.txt",
        "product-grid.txt",
        "ProductHIGH.txt",
      ],
      utility2: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
      cta: ["CTAGrid.txt", "CTAIncentive.txt", "CTAReminder.txt"],
    },
  },
  Promotion: {
    sections: ["intro", "utility1", "content1", "utility2", "cta"],
    blocks: {
      intro: ["PromoHeaderHero.txt", "BoldHeaderHero.txt", "HeroOVER.txt", "EditorialHeaderHero.txt"],
      utility1: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
      content1: ["PromoBodyCopy.txt", "TextAboveImageBody.txt", "SplitProduct.txt", "TwoColumnBody.txt"],
      utility2: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
      cta: ["PromoCTA.txt", "LargeCTASection.txt", "CTASectionDark.txt"],
    },
  },
}; 