export const specializedAssistants = {
  Newsletter: {
    Default: "asst_So4cxsaziuSI6hZYAT330j1u"
  },
  Productgrid: {
    Default: "asst_wpEAG1SSFXym8BLxqyzTPaVe"
  },
  AbandonedCart: {
    Default: "asst_IGjM9fcv8XZlf9z3l8nUM7l5"
  },
  Promotion: {
    Default: "asst_Kr6Sc01OP5oJgwIXQgV7qb2k",
    Minimal: "asst_j3yGRDTKiLs9q5SBEYE4Xl3w"
  }
};

export const BLOCK_DEFINITIONS = {
  Newsletter: {
    Default: {
      sections: ["intro", "utility1", "content1", "utility2", "cta"],
      blocks: {
        intro: [
          "hero-fullwidth.txt",
          "hero-founder-note.txt",
          "hero-quote.txt",
          "hero-highlight-list.txt",
          "hero-split.txt"
        ],
        utility1: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
        content1: [
          "dive.txt",
          "brand-story.txt",
          "content-text-grid.txt",
          "company-direction.txt"
        ],
        utility2: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
        cta: [
          "cta-wrapup.txt",
          "bonus-tip.txt",
          "testimonial-closer.txt",
          "philosophy-outro.txt",
          "support-options.txt",
          "recap-summary.txt"
        ]
      }
    }
  },
  Productgrid: {
    Default: {
      sections: ["intro", "utility1", "content1", "utility2", "cta"],
      blocks: {
        intro: [
          "hero-title.txt",
          "HeroOVER.txt",
          "BoldHeaderHero.txt"
        ],
        utility1: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
        content1: [
          "alternating-grid.txt",
          "product-grid.txt",
          "single-product.txt",
          "Double-column.txt"
        ],
        utility2: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
        cta: ["body-cta.txt", "cta-only.txt", "image-cta.txt"]
      }
    }
  },
  AbandonedCart: {
    Default: {
      sections: ["intro", "utility1", "content1", "utility2", "cta"],
      blocks: {
        intro: ["CenteredHero.txt", "Blockhero.txt", "TextHero.txt"],
        utility1: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
        content1: ["Centered.txt", "Grid.txt", "product-grid.txt", "ProductHIGH.txt"],
        utility2: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
        cta: ["CTAGrid.txt", "CTAIncentive.txt", "CTAReminder.txt"]
      }
    }
  },
  Promotion: {
    Default: {
      sections: ["intro", "utility1", "content1", "utility2", "cta"],
      blocks: {
        intro: [
          "promoHero_1.txt",
          "promoHero_2.txt",
          "promoHero_3.txt",
          "promoHero_4.txt",
          "promoHero_5.txt",
          "promoHero_6.txt",
          "promoHero_7.txt",
          "promoHero_8.txt",
          "promoHero_9.txt"
        ],
        utility1: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
        content1: [
          "promoBody_1.txt",
          "promoBody_2.txt",
          "promoBody_4.txt",
          "promoBody_5.txt",
          "promoBody_6.txt"
        ],
        utility2: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
        cta: [
          "ctaBlock_1.txt",
          "ctaBlock_2.txt",
          "ctaBlock_3.txt",
          "ctaBlock_4.txt",
          "ctaBlock_5.txt",
          "ctaBlock_6.txt",
          "ctaBlock_7.txt"
        ]
      }
    },
    Minimal: {
      sections: ["intro", "utility1", "content1", "utility2", "cta"],
      blocks: {
        intro: [
          "heroMinimal1.txt",
          "heroMinimal2.txt",
          "heroMinimal3.txt",
          "heroMinimal4.txt"
        ],
        utility1: [
          "divider-accent.txt",
          "divider-dotted.txt",
          "divider-line.txt",
          "labeled-divider.txt"
        ],
        content1: [
          "contentMinimal1.txt",
          "contentMinimal2.txt",
          "contentMinimal3.txt",
          "contentMinimal4.txt"
        ],
        utility2: [
          "divider-accent.txt",
          "divider-dotted.txt",
          "divider-line.txt",
          "labeled-divider.txt"
        ],
        cta: [
          "ctaMinimal1.txt",
          "ctaMinimal2.txt",
          "ctaMinimal3.txt",
          "ctaMinimal4.txt"
        ]
      }
    }
  }
};

export const TIMEOUTS = {
  HERO_GENERATION: 60000,
  EMAIL_GENERATION: 120000,
  ASSISTANT_RUN: 120000
};
