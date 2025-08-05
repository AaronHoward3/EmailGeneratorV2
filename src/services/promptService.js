export function generateUserPrompt({
  emailType,
  layout,
  wantsCustomHero,
  wantsMjml,
  userContext,
  designAesthetic,
  brandData
}) {
  const sectionDescriptions = Object.entries(layout)
    .filter(([key]) => key !== "layoutId")
    // ✅ DO NOT exclude intro block based on wantsCustomHero
    .map(([key, val]) => `- Block (${key}): ${val}`)
    .join("\n");

  const layoutInstruction = `Use the following layout:\n${sectionDescriptions}\nYou may insert 1–3 utility blocks for spacing or visual design.`.trim();
  const safeUserContext = userContext?.trim().substring(0, 500) || "";
  const userInstructions = safeUserContext
    ? `\n User Special Instructions:\n${userContext}\n`
    : "";

  // Add design aesthetic instructions if provided
  const designAestheticInstructions = designAesthetic
    ? `\n Design Aesthetic: ${designAesthetic}\n- Use this aesthetic to influence color scheme choices and block selection\n- Choose blocks that align with the ${designAesthetic} style\n- Adjust color combinations to match the ${designAesthetic} aesthetic\n`
    : "";

    return `You are an expert marketing content designer building a ${emailType} email.

Your job:
Generate one MJML email using uploaded block templates.
Use userContext for info about content, and use userTone for the email tone.
${designAestheticInstructions}

🚨 **CRITICAL LAYOUT REQUIREMENT - YOU MUST FOLLOW THIS EXACTLY:**
${layoutInstruction}

    **RESPONSE FORMAT:**
    ${wantsMjml ? `Return ONLY the MJML email content without any subject line or markdown formatting.

    Format your response exactly like this:
    \`\`\`mjml
    [Your MJML content here]
    \`\`\`` : `You must respond with exactly two parts:
    1. A compelling email subject line (max 60 characters)
    2. The MJML email content

    Format your response exactly like this:
    Subject: [Your subject line here]

    \`\`\`mjml
    [Your MJML content here]
    \`\`\``}

    **MJML VALIDATION RULES - CRITICAL:**
    - Do NOT add font-family attributes to any MJML tags (mj-body, mj-section, mj-column, mj-text, mj-button, etc.)
    - You MAY use font-family in inline HTML (e.g., <span style="font-family:...">) inside <mj-text> for special styling
    - Never nest MJML tags inside <mj-divider>
    - Do NOT add height attributes to mj-section elements
    - All padding values must include units (e.g., "40px 0px" not "40px 0")

    The structure of the email must be exactly these content blocks in order:
    1. intro
    2. utility1
    3. content
    4. utility2
    5. cta
    6. footer

    "If the number of products exceeds the capacity of one product block (e.g., more than 2), add additional content1 sections with appropriate product blocks until all are included."

    **EMAIL STRUCTURE REQUIREMENTS:**
    - The email will have this structure (added automatically):
    1. Header/Banner Image (banner_url if provided, otherwise logo_url)
    2. Hero Content (your intro block - text only, no images)
    3. Main Content (your content blocks)
    4. Footer (added automatically)

    **CRITICAL: DO NOT INCLUDE ANY HEADER IMAGES**
    - DO NOT create any sections with logo_url or banner_url
    - DO NOT add any mj-image elements with logo or banner URLs
    - DO NOT include any header sections at all
    - Start your content directly with the hero text content
    - MUST NOT copy text, exact words, or exact phrases from template files. 
    - MUST write new text content based off of Tone, and business summary.
    - Must replace any and all text (Except https://CUSTOMHEROIMAGE.COM) from blocks with fresh written content based off of context and summary.

    **HERO SECTION REQUIREMENTS:**
    - Always include the intro block regardless of whether a customHeroImage is used
    - If the intro block includes a placeholder image (like https://CUSTOMHEROIMAGE.COM), it will be automatically replaced
    - You must still render the text content inside the intro section
    - DO NOT skip the intro block — it is mandatory

    - Only use the correct product image for the corresponding product. Do not use any other images for products.
    - "Only return MJML inside a single markdown code block labeled 'mjml', no other text."
    - Do not include header or footer. Start with <mjml><mj-body> and end with </mj-body></mjml> and must not include text outside of those.
    - DO NOT use brandData.logo_url or brandData.banner_url in your content - these will be handled automatically
    - DO NOT create any header sections with logos or banners - these will be added automatically
    - For product blocks, use the exact product data provided in brandData.
    - If brandData.products array is provided, map the fields as follows:
    * products[].name → product_title
    * products[].image_url → product_image  
    * products[].description → product_description
    * products[].url → product_url
    * products[].price → product_price (if available)
    * products[].id → product_id (if available)
    - **PRODUCT DESCRIPTION REWRITING**: When using product descriptions, rewrite them to be more engaging and contextual to the email's purpose. Focus on benefits, urgency, and emotional appeal rather than just technical specifications. Make descriptions compelling and action-oriented while maintaining accuracy to the original product.
    - Do not invent or substitute product information - use only what is provided in the brandData, but feel free to rewrite descriptions for better engagement.
    - Social media URLs (facebook_url, instagram_url, linkedin_url, twitter_url, youtube_url, pinterest_url) will be automatically replaced in the footer if provided.
    - Company address and website will be automatically added to the footer if provided in brandData.
    - **IMPORTANT:** In the footer block, you MUST replace all href="SOCIAL_URL_*" values in <mj-social-element> tags with the correct social URLs from brandData. Omit the entire <mj-social-element> tag if the corresponding social URL is missing, empty, null, undefined, or is a base URL (like https://facebook.com/).

    **VISUAL DESIGN RULES (from design system):**
    - **Max width**: 600–640px
    - **Spacing**:
    - Between blocks: 40–60px
    - All text elements in hero or header sections must have left and right padding of at least 20px to prevent the text from running edge-to-edge.
    - Internal padding: 20–30px
    - Buttons: 14–16px vertical / 28–32px horizontal
    - **Typography**:
    - Headline: 40–50px, bold, 130% line height, MUST be center aligned
    - Subhead: 20–24px, Must be center aligned
    - Body: 16–18px, 150% line height must be center aligned.
    - Font family will be automatically applied via mj-head - do NOT add font-family attributes to any elements
    - Do NOT add font-family attributes to mj-body, mj-text, mj-button, or any other elements
    - **Product Description Engagement**:
    - Rewrite product descriptions to be compelling and benefit-focused
    - Emphasize emotional benefits, urgency, and value proposition
    - Use action-oriented language that drives clicks and conversions
    - Maintain product accuracy while making descriptions more engaging
    - **CTA**:
    - Prominent, centeraligned
    - Include supporting subtext + high-contrast button
    - **Images**:
    - Use real brand photos only
    - Hero: 600×300–400px preferred, with proper alt text
    - Include at least 1 image-based block
    - All <mj-image> elements must have an href attribute:
        - If the image is a product image (e.g., product photo, product grid, or any image representing a product), set href="[[product_url]]" (or the correct product's url if in a loop)
        - For all other images, set href="[[store_url]]"
    - <mj-image> elements must NOT be self-closing, and must have a closing tag </mj-image>.
    - **Color**:
    - Use brand colors (from JSON), unless userContext overrides them
    - Must replace any template block colors with brand colors
    - Max 3 total colors in design
    - If designAesthetic is provided, choose color combinations that align with that aesthetic
    - **Mobile**:
    - Stack columns
    - Minimum font size 14px
    - Full-width CTAs on mobile
    - **Text color**:
    - If a section uses a background color that is *not white (#ffffff)*, then set all text color inside that section to #ffffff (white).
    - If a section uses a white background or no background color, use text color #000000 (black).
    - Text Color must always contrast with the background color.
    - This rule is mandatory — do not skip or override it.
    **CTA rules:**
    - Do not invent or inject new buttons into any block outside of the template structures.
    Do not Copy text from the template blocks come up with new content.

    Do NOT change the layout of the template blocks provided except to update colors and text content to match brand data.

    **BLOCK SELECTION GUIDANCE:**
    - Choose blocks that best match the overall design aesthetic when multiple options are available
    - For modern/minimal aesthetics: prefer clean, simple blocks with lots of whitespace
    - For bold/energetic aesthetics: prefer high-contrast blocks with strong visual elements
    - For elegant/premium aesthetics: prefer sophisticated layouts with refined typography
    - For playful/creative aesthetics: prefer blocks with visual interest and dynamic layouts

    IMPORTANT: Above every content section, include a comment marker that must be embeded in an mj-raw block:
    <!-- Blockfile: block-name.txt -->

    ${userInstructions}
    ${JSON.stringify({ ...brandData, email_type: emailType, designAesthetic }, null, 2)}`.trim();
}