import OpenAI from "openai";
import ora from "ora";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { specializedAssistants } from "../config/constants.js";
import { getUniqueLayoutsBatch, cleanupSession } from "../utils/layoutGenerator.js";
import { getThreadPool } from "../utils/threadPool.js";
import { retryOpenAI } from "../utils/retryUtils.js";
import { initializeBlockCache } from "../utils/blockCache.js";
import { generateCustomHeroAndEnrich } from "../services/heroImageService.js";
import {
  saveMJML,
  updateMJML,
  getMJML,
  deleteMJML,
  getStoreStats,
} from "../utils/inMemoryStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize block cache on module load
initializeBlockCache().catch(console.error);

// Function to process footer template with brand data
async function processFooterTemplate(brandData) {
  try {
    const footerPath = path.join(__dirname, '../../lib/promotion-blocks/design-elements/footer.txt');
    console.log('🦶 Footer path:', footerPath);
    let footerTemplate = await fs.readFile(footerPath, 'utf8');
    console.log('🦶 Footer template loaded, length:', footerTemplate.length);
    
    // Get current year
    const currentYear = new Date().getFullYear();
    
    // Replace basic placeholders with actual data
    let processedFooter = footerTemplate
      .replace(/\[\[logo_url\]\]/g, brandData.logo_url || '')
      .replace(/\[\[current_year\]\]/g, currentYear.toString())
      .replace(/\[\[website_url\]\]/g, brandData.website_url || brandData.website || '')
      .replace(/\[\[store_url\]\]/g, brandData.store_url || brandData.website_url || brandData.website || '')
      .replace(/\[\[store_email\]\]/g, '')
      .replace(/\[\[header_color\]\]/g, brandData.header_color || '#70D0F0');
    
    console.log('🦶 Processed footer length:', processedFooter.length);
    console.log('🦶 Brand data keys:', Object.keys(brandData));
    console.log('🦶 Social links:', brandData.social_links);
    console.log('🦶 Store address:', brandData.store_address);
    console.log('🦶 Website URL:', brandData.website_url || brandData.website);
    
    // Note: [[store_name]], [[unsubscribe]], and [[store_address]] are left as tags for send-time replacement
    
    // Process social media URLs - only include if they're not base URLs
    const socialPlatforms = [
      { templateKey: 'facebook_url', dataKey: 'facebook' },
      { templateKey: 'instagram_url', dataKey: 'instagram' },
      { templateKey: 'linkedin_url', dataKey: 'linkedin' },
      { templateKey: 'twitter_url', dataKey: 'twitter' },
      { templateKey: 'twitter_url', dataKey: 'x' }, // Handle X/Twitter
      { templateKey: 'youtube_url', dataKey: 'youtube' },
      { templateKey: 'pinterest_url', dataKey: 'pinterest' }
    ];
    
    // Process each social platform
    socialPlatforms.forEach(({ templateKey, dataKey }) => {
      // Check both direct property and nested in social_links
      let url = brandData[templateKey];
      if (!url && brandData.social_links && brandData.social_links[dataKey]) {
        url = brandData.social_links[dataKey];
      }
      
      if (url && url !== `https://${dataKey}.com/` && url !== `https://www.${dataKey}.com/` && url !== `http://${dataKey}.com/` && url !== `http://www.${dataKey}.com/`) {
        // Replace the URL placeholder
        processedFooter = processedFooter.replace(new RegExp(`\\[\\[${templateKey}\\]\\]`, 'g'), url);
        // Remove the conditional markers for this platform
        processedFooter = processedFooter.replace(new RegExp(`\\[\\[#if ${templateKey}\\]\\]`, 'g'), '');
        processedFooter = processedFooter.replace(new RegExp(`\\[\\[\\/if\\]\\]`, 'g'), '');
      } else {
        // Remove the entire conditional block if URL is base URL or missing
        const regex = new RegExp(`\\[\\[#if ${templateKey}\\]\\][\\s\\S]*?\\[\\[\\/if\\]\\]`, 'g');
        processedFooter = processedFooter.replace(regex, '');
        // Also remove any remaining template variables for this platform
        processedFooter = processedFooter.replace(new RegExp(`\\[\\[${templateKey}\\]\\]`, 'g'), '');
      }
    });
    
    // Process store_address conditional
    if (brandData.store_address) {
      processedFooter = processedFooter.replace(new RegExp(`\\[\\[store_address\\]\\]`, 'g'), brandData.store_address);
      processedFooter = processedFooter.replace(new RegExp(`\\[\\[#if store_address\\]\\]`, 'g'), '');
      processedFooter = processedFooter.replace(new RegExp(`\\[\\[\\/if\\]\\]`, 'g'), '');
    } else {
      // Remove the entire conditional block if store_address is missing
      const regex = /\[\[#if store_address\]\][\s\S]*?\[\[\/if\]\]/g;
      processedFooter = processedFooter.replace(regex, '');
    }
    
    // Process website_url conditional
    if (brandData.website_url || brandData.website) {
      processedFooter = processedFooter.replace(new RegExp(`\\[\\[#if website_url\\]\\]`, 'g'), '');
      processedFooter = processedFooter.replace(new RegExp(`\\[\\[\\/if\\]\\]`, 'g'), '');
    } else {
      // Remove the entire conditional block if website_url is missing
      const regex = /\[\[#if website_url\]\][\s\S]*?\[\[\/if\]\]/g;
      processedFooter = processedFooter.replace(regex, '');
    }
    
    // Clean up any remaining conditional markers
    processedFooter = processedFooter.replace(/\[\[#if [^\]]+\]\]/g, '');
    processedFooter = processedFooter.replace(/\[\[\/if\]\]/g, '');
    
    return processedFooter;
  } catch (error) {
    console.error('Error processing footer template:', error);
    return '';
  }
}

export async function generateEmails(req, res) {
  // Check if request body exists
  if (!req.body) {
    return res.status(400).json({ 
      error: "Request body is missing. Please ensure Content-Type: application/json is set." 
    });
  }

  let { brandData, emailType, userContext, imageContext, storeId } = req.body;

  if (!brandData || !emailType) {
    return res
      .status(400)
      .json({ error: "Missing brandData or emailType in request body." });
  }

  const jobId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;

  if (
    brandData.customHeroImage !== undefined &&
    typeof brandData.customHeroImage !== "boolean"
  ) {
    return res
      .status(400)
      .json({ error: "customHeroImage must be a boolean (true/false)" });
  }

  if (imageContext) {
  brandData.imageContext = imageContext.trim().substring(0, 300);
}

// Override colors if userContext includes any CSS color names
if (userContext && typeof userContext === "string") {
  const cssColors = userContext.match(/\b(black|white|red|blue|green|yellow|orange|pink|purple|gray|grey|teal|cyan|magenta|lime|maroon|navy|olive|silver|gold|beige|brown|coral|crimson|indigo|ivory|khaki|lavender|mint|peach|plum|salmon|tan|turquoise)\b/gi);
  const hexColors = userContext.match(/#(?:[0-9a-fA-F]{3}){1,2}/g);

  const combinedColors = [
    ...(cssColors || []).map(c => c.toLowerCase()),
    ...(hexColors || [])
  ];

  if (combinedColors.length > 0) {
    brandData.colors = combinedColors.slice(0, 3); // Limit to top 3
    console.log(`🎨 Overriding brandData.colors with user-defined colors:`, brandData.colors);
  }
}


  const wantsCustomHero = brandData.customHeroImage === true;
  if (wantsCustomHero) {
    brandData.primary_custom_hero_image_banner = "https://CUSTOMHEROIMAGE.COM";
    brandData.hero_image_url = "https://CUSTOMHEROIMAGE.COM";
  }

  // Set header_image_url for hero/header blocks: use banner_url if present, else logo_url
  if (brandData.banner_url && brandData.banner_url.trim() !== "") {
    brandData.header_image_url = brandData.banner_url;
  } else {
    brandData.header_image_url = brandData.logo_url || "";
  }

  const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;
  const totalStart = Date.now();
  console.log(
    `⏱️ [${sessionId}] generation started at ${new Date(totalStart).toISOString()}`
  );

  // Get thread pool instance
  const threadPool = getThreadPool(10);

  try {
    // Start hero image generation in parallel
    const heroPromise = wantsCustomHero
      ? generateCustomHeroAndEnrich(brandData, storeId, jobId).catch((err) => {
          console.error("❌ Failed to generate custom hero image:", err.message);
          return brandData;
        })
      : Promise.resolve(brandData);

    // Generate unique layouts
    let layouts;
    try {
      layouts = getUniqueLayoutsBatch(emailType, sessionId, 1, brandData);
    } catch (err) {
      console.error(`❌ Layout generator failed for type=${emailType}: ${err.message}`);
      cleanupSession(sessionId);
      deleteMJML(jobId);
      res.status(500).json({ error: `Layout generator failed: ${err.message}` });
      return;
    }

    // Get threads from pool instead of creating new ones
    const threads = await Promise.all(layouts.map(() => threadPool.getThread()));

    const assistantId = specializedAssistants[emailType];
    if (!assistantId) {
      return res
        .status(400)
        .json({ error: `No assistant configured for: ${emailType}` });
    }

    // Generate emails with retry logic
    const emailPromises = layouts.map(async (layout, index) => {
      const thread = threads[index];
      const i = index + 1;
      const spinner = ora().start();

      try {
        const sectionDescriptions = Object.entries(layout)
          .filter(([key]) => key !== "layoutId")
          .map(([key, val]) => `- Block (${key}): ${val}`)
          .join("\n");

        const layoutInstruction = `Use the following layout:\n${sectionDescriptions}\nYou may insert 1–3 utility blocks for spacing or visual design.`.trim();
        const safeUserContext = userContext?.trim().substring(0, 500) || "";
        const userInstructions = safeUserContext
          ? `\n📢 User Special Instructions:\n${userContext}\n`
          : "";

        const userPrompt = `You are an expert marketing content designer building a ${emailType} email.

Your job:
Generate one MJML email using uploaded block templates.
Use userContext for info about content, and use userTone for the email tone.

**RESPONSE FORMAT:**
You must respond with exactly two parts:
1. A compelling email subject line (max 60 characters)
2. The MJML email content

Format your response exactly like this:
Subject: [Your subject line here]

\`\`\`mjml
[Your MJML content here]
\`\`\`

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

No other content sections are allowed beyond these 5. 

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

**HERO SECTION REQUIREMENTS:**
- For the intro block, you may use hero templates that contain placeholder images (like "HeroOVER.txt")
- The placeholder images will be automatically replaced with the generated hero image
- The hero section should contain text content overlaid on the image
- DO NOT manually replace placeholder images - this will be handled automatically
- You may use templates with mj-raw blocks that contain placeholder images

**HERO TEMPLATE CHOICES:**
- Use "hero-with-text-cta" when you want a text-based primary section with headline, description, and CTA button
- Use "hero-with-featured-product" when you want to feature a specific product with large image, name, description, and buy button

- Only use the correct product image for the corresponding product. Do not use any other images for products.
- "Only return MJML inside a single markdown code block labeled 'mjml', no other text."
- Do not include header or footer. Start with <mjml><mj-body> and end with </mj-body></mjml> and must not include text outside of those.
- DO NOT use brandData.logo_url or brandData.banner_url in your content - these will be handled automatically
- DO NOT create any header sections with logos or banners - these will be added automatically
- If brandData.header_color is provided, use it as the background color for content sections (not headers)
- Always use the exact colors provided in brandData for header_color - do not substitute with other colors
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
- Social media URLs (facebook_url, instagram_url, linkedin_url, twitter_url, youtube_url, pinterest_url) will be automatically added to the footer if provided and not base URLs.
- Company address and website will be automatically added to the footer if provided in brandData.

**VISUAL DESIGN RULES (from design system):**
- **Max width**: 600–640px
- **Spacing**:
  - Between blocks: 40–60px
  - - All text elements in hero or header sections must have left and right padding of at least 20px to prevent the text from running edge-to-edge.
  - Internal padding: 20–30px
  - Buttons: 14–16px vertical / 28–32px horizontal
- **Typography**:
  - Headline: 40–50px, bold, 130% line height
  - Subhead: 20–24px
  - Body: 16–18px, 150% line height
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
- **Color**:
  - Use brand colors (from JSON)
  - Must replace any template block colors with brand colors
  - Max 3 total colors in design
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


Do NOT change the layout of the template blocks provided except to update colors and text content to match brand data.

📌 IMPORTANT: Above every content section, include a comment marker that must be embeded in an mj-raw block:
<!-- Blockfile: block-name.txt -->

${layoutInstruction}

${userInstructions}
${JSON.stringify({ ...brandData, email_type: emailType }, null, 2)}`.trim();

        // Use retry logic for OpenAI API calls
        await retryOpenAI(async () => {
          await openai.beta.threads.messages.create(thread.id, {
            role: "user",
            content: userPrompt,
          });
        });

        const run = await retryOpenAI(async () => {
          return await openai.beta.threads.runs.create(thread.id, {
            assistant_id: assistantId,
          });
        });

        const maxWaitTime = 120000;
        const runStart = Date.now();
        let runStatus;

        // Use retry logic for run status checking
        while (Date.now() - runStart < maxWaitTime) {
          runStatus = await retryOpenAI(async () => {
            return await openai.beta.threads.runs.retrieve(thread.id, run.id);
          });
          
          if (runStatus.status === "completed") break;
          if (["failed", "expired", "cancelled"].includes(runStatus.status)) {
            spinner.fail(`❌ Assistant error on email ${i}`);
            throw new Error(`Assistant error: ${runStatus.status}`);
          }
          await new Promise((r) => setTimeout(r, 1500));
        }

        if (runStatus.status !== "completed") {
          spinner.fail(`❌ Assistant run timed out on email ${i}`);
          throw new Error(`Assistant run timed out after ${maxWaitTime / 1000} seconds on email ${i}`);
        }

        const messages = await retryOpenAI(async () => {
          return await openai.beta.threads.messages.list(thread.id);
        });
        
        const rawContent = messages.data[0].content[0].text.value;
        
        // Parse subject line and MJML content
        let subjectLine = '';
        let cleanedMjml = rawContent;
        
        // Extract subject line if present
        const subjectMatch = rawContent.match(/^Subject:\s*(.+)$/m);
        if (subjectMatch) {
          subjectLine = subjectMatch[1].trim();
          // Remove the subject line from the content
          cleanedMjml = rawContent.replace(/^Subject:\s*.+$/m, '').trim();
        }
        
        // Clean up MJML content
        cleanedMjml = cleanedMjml
          .replace(/^\s*```mjml/i, "")
          .replace(/```[\s\n\r]*$/g, "")
          .trim();

        saveMJML(jobId, index, cleanedMjml);
        console.log(`📦 Saved MJML for job ${jobId} at index ${index}`);
        if (subjectLine) {
          console.log(`📧 Subject line for email ${i}: ${subjectLine}`);
        }

        spinner.succeed(`✅ Email ${i} generated successfully`);
        return {
          index: i,
          content: cleanedMjml,
          subjectLine: subjectLine,
          tokens: runStatus.usage?.total_tokens || 0,
        };
      } catch (error) {
        spinner.fail(`❌ Failed to generate email ${i}`);
        return { index: i, error: error.message };
      } finally {
        // Return thread to pool
        threadPool.returnThread(thread);
      }
    });

    // Wait for both hero and emails
    const [results, finalBrandData] = await Promise.all([
      Promise.all(emailPromises),
      heroPromise,
    ]);

    const storedMjmls = getMJML(jobId) || [];
    console.log(`📦 Retrieved ${storedMjmls ? storedMjmls.length : 'undefined'} stored MJMLs for job ${jobId}`);
    console.log(`📦 storedMjmls type: ${typeof storedMjmls}, isArray: ${Array.isArray(storedMjmls)}`);

    // Process footer template
    const footerMjml = await processFooterTemplate(finalBrandData);
    console.log('🦶 Footer template processed successfully');
    console.log('🦶 Footer MJML length:', footerMjml ? footerMjml.length : 0);
    if (footerMjml) {
      console.log('🦶 Footer preview:', footerMjml.substring(0, 200) + '...');
    }

    // Replace placeholder hero with the real hero image
    let finalResults = results;
    const fontHead = `
      <mj-head>
        <mj-attributes>
          <mj-text font-family="Helvetica Neue, Helvetica, Arial, sans-serif" />
          <mj-button font-family="Helvetica Neue, Helvetica, Arial, sans-serif" />
        </mj-attributes>
        <mj-style inline="inline">
          @media only screen and (max-width:480px) {
            .hero-headline {
              font-size: 28px !important;
              line-height: 1.2 !important;
            }
            .hero-subhead {
              font-size: 16px !important;
            }
          }
        </mj-style>
      </mj-head>
    `;

    // Process all emails to add font block, header image, and footer
    (storedMjmls || []).forEach((mjml, index) => {
      if (mjml) {
        let updated = mjml;

                // Add header image at the very top if we have one
        if (finalBrandData.header_image_url && finalBrandData.header_image_url.trim() !== "") {
          const headerImageSection = `
<!-- Header Image Section -->
<mj-section padding="0px" background-color="#ffffff">
  <mj-column>
    <mj-image src="${finalBrandData.header_image_url}" alt="Header" padding="0px" />
  </mj-column>
</mj-section>`;
          
          // Insert header image right after <mj-body> tag, handling different formatting
          updated = updated.replace(/<mj-body[^>]*>/, (match) => `${match}${headerImageSection}`);
          console.log(`🖼️ Added header image to email ${index + 1}: ${finalBrandData.header_image_url}`);
        } else {
          console.log(`⚠️ No header image available for email ${index + 1}`);
        }

        // Replace placeholder hero image if available
        if (
          wantsCustomHero &&
          finalBrandData.hero_image_url &&
          finalBrandData.hero_image_url.includes("http") &&
          !finalBrandData.hero_image_url.includes("CUSTOMHEROIMAGE")
        ) {
          // Replace the CUSTOMHEROIMAGE placeholder
          updated = updated.replace(
            /src="https:\/\/CUSTOMHEROIMAGE\.COM"/g,
            `src="${finalBrandData.hero_image_url}"`
          );
          
          // Also replace other common placeholder patterns
          updated = updated.replace(
            /src="https:\/\/via\.placeholder\.com\/[^"]*"/g,
            `src="${finalBrandData.hero_image_url}"`
          );
          
          updated = updated.replace(
            /src="https:\/\/placeholder\.com\/[^"]*"/g,
            `src="${finalBrandData.hero_image_url}"`
          );
          
          console.log(`🖼️ Replaced placeholder hero image with generated image for email ${index + 1}`);
        } else if (wantsCustomHero) {
          console.log(`⚠️ Hero URL not ready or invalid for email ${index + 1}`);
        }

        // Add font block if not present
        if (!updated.includes("<mj-head>")) {
          updated = updated.replace("<mjml>", `<mjml>${fontHead}`);
          console.log(`🔤 Injected Helvetica font block for email ${index + 1}`);
        }

        // Remove any existing footer section (by unique comment) - remove everything from comment to end of mj-body
        updated = updated.replace(/<!-- Footer Section -->[\s\S]*?<\/mj-body>/g, "</mj-body>");
        
        // Add footer before closing mj-body tag, but only if not already present
        if (footerMjml && updated.includes("</mj-body>") && !updated.includes("mj-social")) {
          updated = updated.replace("</mj-body>", `${footerMjml}\n</mj-body>`);
          console.log(`🦶 Added footer to email ${index + 1}`);
          console.log(`🦶 Email ${index + 1} now contains footer:`, updated.includes('Unsubscribe'));
        } else if (footerMjml && updated.includes("<mj-body") && !updated.includes("mj-social")) {
          // If no closing tag, add footer and closing tag at the end
          updated = updated + `\n${footerMjml}\n</mj-body>`;
          console.log(`🦶 Added footer and closing tag to email ${index + 1} (no closing tag found)`);
          console.log(`🦶 Email ${index + 1} now contains footer:`, updated.includes('Unsubscribe'));
        } else {
          console.log(`🦶 Could not add footer to email ${index + 1} - footerMjml:`, !!footerMjml, 'has closing tag:', updated.includes("</mj-body>"), 'has body tag:', updated.includes("<mj-body"), 'footer already present:', updated.includes("mj-social"));
        }

        updateMJML(jobId, index, updated);
      }
    });

    // Update finalResults with processed MJMLs
    const patchedMjmls = getMJML(jobId) || [];
    finalResults = results.map((result, index) => {
      if (result.content && patchedMjmls[index]) {
        return {
          ...result,
          content: patchedMjmls[index],
        };
      }
      return result;
    });

    console.log("✅ Successfully processed all emails with font block, hero images, and footer");
    
    const totalTokens = finalResults.reduce((sum, result) => sum + (result.tokens || 0), 0);

    cleanupSession(sessionId);

    setTimeout(() => {
      deleteMJML(jobId);
    }, 1000);

    console.log(`✅ [${sessionId}] Total time: ${Date.now() - totalStart} ms`);
    console.log(`🧠 Total OpenAI tokens used: ${totalTokens}`);
    
    // Log performance stats
    const storeStats = getStoreStats();
    const threadStats = threadPool.getStats();
    console.log(`📊 Performance stats - Store: ${storeStats.totalEntries}/${storeStats.maxEntries}, Threads: ${threadStats.utilization.toFixed(1)}% utilization`);

    // Check if client wants MJML format
    const acceptHeader = req.headers.accept || '';
    const wantsMjml = acceptHeader.includes('text/mjml') || acceptHeader.includes('application/mjml');
    
    if (wantsMjml && finalResults.length > 0 && finalResults[0].content) {
      // Return the first email as MJML
      const mjmlContent = finalResults[0].content;
      res.setHeader('Content-Type', 'text/mjml');
      res.setHeader('X-Total-Tokens', totalTokens.toString());
      res.setHeader('X-Generation-Time', `${Date.now() - totalStart}ms`);
      if (finalResults[0].subjectLine) {
        res.setHeader('X-Subject-Line', finalResults[0].subjectLine);
      }
      res.send(mjmlContent);
    } else {
      // Return JSON response as before
      res.json({
        success: true,
        totalTokens,
        emails: finalResults,
      });
    }
  } catch (error) {
    console.error("❌ Email generation failed:", error);
    cleanupSession(sessionId);
    deleteMJML(jobId);
    res.status(500).json({ error: error.message });
  }
}
