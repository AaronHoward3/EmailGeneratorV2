export const specializedAssistants = {
  Newsletter: {
    Default: "asst_So4cxsaziuSI6hZYAT330j1u",
    minimal_clean: "asst_eTTf61YuIljqse55v4Sfre9O",
    bold_contrasting: "asst_PtW2huAkuDjh4Fv2ab5Pg00z",
    editorial_story: "asst_I6x7ygpURvP2IyuLtYrD7orG"
  },
  Productgrid: {
    Default: "asst_wpEAG1SSFXym8BLxqyzTPaVe"
  },
  AbandonedCart: {
    Default: "asst_IGjM9fcv8XZlf9z3l8nUM7l5"
  },
  Promotion: {
    Default: "asst_Kr6Sc01OP5oJgwIXQgV7qb2k",
    minimal_clean: "asst_j3yGRDTKiLs9q5SBEYE4Xl3w",
    editorial_story: "asst_9U2VdPdyciv7T18958UOqZHi",
    bold_contrasting: "asst_K6W7d5i1f7GEcCagXEpxaFp5"
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
    },
    minimal_clean: {
      sections: ["intro", "utility1", "content1", "utility2", "cta"],
      blocks: {
        intro: [
          "heroMinimal_N1.txt",
          "heroMinimal_N2.txt",
          "heroMinimal_N3.txt",
          "heroMinimal_N4.txt"
        ],
        utility1: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
        content1: [
          "contentMinimal_N1.txt",
          "contentMinimal_N2",
          "contentMinimal_N3.txt",
          "contentMinimal_N4.txt"
        ],
        utility2: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
        cta: [
          "ctaMinimal_N1.txt",
          "ctaMinimal_N2.txt",
          "ctaMinimal_N3.txt",
          "ctaMinimal_N4.txt"
        ]
      }
    },
    bold_contrasting: {
      sections: ["intro", "utility1", "content1", "utility2", "cta"],
      blocks: {
        intro: [
          "heroBold_N1.txt",
          "heroBold_N2.txt",
          "heroBold_N3.txt",
          "heroBold_N4.txt"
        ],
        utility1: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
        content1: [
          "contentBold_N1.txt",
          "contentBold_N2",
          "contentBold_N3.txt",
          "contentBold_N4.txt"
        ],
        utility2: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
        cta: [
          "ctaBold_N1.txt",
          "ctaBold_N2.txt",
          "ctaBold_N3.txt",
          "ctaBold_N4.txt"
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
    bold_contrasting: {
      sections: ["intro", "utility1", "content1", "utility2", "cta"],
      blocks: {
        intro: [
          "heroBold1.txt",
          "heroBold2.txt",
          "heroBold3.txt",
          "heroBold4.txt"
        ],
        utility1: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
        content1: [
          "contentBold1.txt",
          "contentBold2.txt",
          "contentBold3.txt",
          "contentBold4.txt"
        ],
        utility2: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
        cta: [
          "ctaBold1.txt",
          "ctaBold2.txt",
          "ctaBold3.txt",
          "ctaBold4.txt"
        ]
      }
    },
    editorial_story: {
      sections: ["intro", "utility1", "content1", "utility2", "cta"],
      blocks: {
        intro: [
          "heroEditorial1.txt",
          "heroEditorial2.txt",
          "heroEditorial3.txt",
          "heroEditorial4.txt"
        ],
        utility1: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
        content1: [
          "contentEditorial1.txt",
          "contentEditorial2.txt",
          "contentEditorial3.txt",
          "contentEditorial4.txt"
        ],
        utility2: ["divider-accent.txt", "divider-dotted.txt", "divider-line.txt", "labeled-divider.txt"],
        cta: [
          "ctaEditorial1.txt",
          "ctaEditorial2.txt",
          "ctaEditorial3.txt",
          "ctaEditorial4.txt"
        ]
      }
    },
    minimal_clean: {
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
