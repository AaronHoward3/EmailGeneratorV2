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
import { processFooterTemplate } from "../services/footerService.js";
import { createLogger, performanceTracker } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const logger = createLogger('EmailController');

// Defer block cache initialization to first request for faster startup
let blockCacheInitialized = false;

export async function generateEmails(req, res) {
  const requestStartTime = performance.now();
  const requestId = req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  
  logger.requestStart(requestId, req.method, req.url, {
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  });

  try {
    // Initialize block cache on first request instead of startup
    if (!blockCacheInitialized) {
      await logger.trackPerformance('block_cache_initialization', async () => {
        try {
          await initializeBlockCache();
          blockCacheInitialized = true;
          logger.info('Block cache initialized successfully');
        } catch (error) {
          logger.error('Failed to initialize block cache', { error: error.message });
          // Continue without cache - will load blocks on demand
        }
      });
    }

    // Check if request body exists
    if (!req.body) {
      logger.error('Request body missing', { requestId });
      return res.status(400).json({ 
        error: "Request body is missing. Please ensure Content-Type: application/json is set." 
      });
    }

    let { brandData, emailType, userContext, imageContext, storeId, designAesthetic } = req.body;

    if (!brandData || !emailType) {
      logger.error('Missing required fields', { requestId, emailType, hasBrandData: !!brandData });
      return res
        .status(400)
        .json({ error: "Missing brandData or emailType in request body." });
    }

    const jobId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;
    logger.info('Starting email generation', { requestId, jobId, emailType });

    if (
      brandData.customHeroImage !== undefined &&
      typeof brandData.customHeroImage !== "boolean"
    ) {
      logger.error('Invalid customHeroImage type', { requestId, customHeroImage: brandData.customHeroImage });
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
        logger.info(`Overriding brandData.colors with user-defined colors`, { requestId, colors: brandData.colors });
      }
    }

    const wantsCustomHero = brandData.customHeroImage === true;
    if (wantsCustomHero) {
      brandData.primary_custom_hero_image_banner = "https://CUSTOMHEROIMAGE.COM";
      brandData.hero_image_url = "https://CUSTOMHEROIMAGE.COM";
      logger.info('Custom hero image requested', { requestId, jobId });
    }

    // Set header_image_url for hero/header blocks: use banner_url if present, else logo_url
    if (brandData.banner_url && brandData.banner_url.trim() !== "") {
      brandData.header_image_url = brandData.banner_url;
    } else {
      brandData.header_image_url = brandData.logo_url || "";
    }

    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;
    const totalStart = Date.now();
    
    logger.info('Email generation session started', {
      requestId,
      sessionId,
      jobId,
      emailType,
      wantsCustomHero,
      hasProducts: !!(brandData.products && brandData.products.length > 0)
    });

    // Get thread pool instance with optimized size based on environment
    const threadPoolSize = process.env.NODE_ENV === 'production' ? 15 : 10;
    const threadPool = getThreadPool(threadPoolSize);
    
    logger.debug('Thread pool initialized', { requestId, threadPoolSize });

    try {
      // Start hero image generation in parallel with timeout
      const heroPromise = wantsCustomHero
        ? logger.trackPerformance('hero_image_generation', async () => {
            return Promise.race([
              generateCustomHeroAndEnrich(brandData, storeId, jobId),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Hero generation timeout')), 45000)
              )
            ]);
          }, { requestId, jobId }).catch((err) => {
            logger.error("Failed to generate custom hero image", { 
              requestId, 
              jobId, 
              error: err.message 
            });
            return brandData;
          })
        : Promise.resolve(brandData);

      // Generate unique layouts with error handling
      let layouts;
      try {
        layouts = await logger.trackPerformance('layout_generation', async () => {
          const { designStyle = "Default" } = req.body;
          logger.debug("Requested designStyle", { requestId, designStyle });
          logger.debug("Available styles for type", { requestId, emailType, styles: Object.keys(specializedAssistants[emailType] || {}) });
          return getUniqueLayoutsBatch(emailType, designStyle, sessionId, 1, brandData);
        }, { requestId, sessionId, emailType });
        
        logger.debug('Layouts generated', { requestId, sessionId, layoutCount: layouts.length });
      } catch (err) {
        logger.error('Layout generator failed', { 
          requestId, 
          sessionId, 
          emailType, 
          error: err.message 
        });
        cleanupSession(sessionId);
        deleteMJML(jobId);
        res.status(500).json({ error: `Layout generator failed: ${err.message}` });
        return;
      }

      // Get threads from pool with timeout
      const threadPromises = layouts.map(() => 
        Promise.race([
          threadPool.getThread(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Thread pool timeout')), 10000)
          )
        ])
      );
      
      const threads = await logger.trackPerformance('thread_allocation', async () => {
        return Promise.all(threadPromises);
      }, { requestId, threadCount: layouts.length });
      
      logger.debug('Threads allocated', { requestId, threadCount: threads.length });

      const { designStyle = "Default" } = req.body;
      logger.debug("Requested designStyle", { requestId, designStyle });
      logger.debug("Available styles for type", { requestId, emailType, styles: Object.keys(specializedAssistants[emailType] || {}) });
      
      const assistantId = specializedAssistants[emailType]?.[designStyle] || specializedAssistants[emailType]?.["Default"];
      
      if (!assistantId || typeof assistantId !== "string") {
        logger.error('No assistant configured', { requestId, emailType, designStyle });
        return res
          .status(400)
          .json({ error: `No valid assistant found for emailType="${emailType}" and designStyle="${designStyle}"` });
      }

      // Generate emails with optimized retry logic and timeouts
      const emailPromises = layouts.map(async (layout, index) => {
        const thread = threads[index];
        const i = index + 1;
        const spinner = ora().start();
        const emailStartTime = performance.now();

        try {
          logger.debug('Starting email generation', { requestId, jobId, emailIndex: i, threadId: thread.id });

          const sectionDescriptions = Object.entries(layout)
            .filter(([key]) => key !== "layoutId")
            .filter(([key]) => wantsCustomHero || key !== "intro") // Exclude intro if no hero image
            .map(([key, val]) => `- Block (${key}): ${val}`)
            .join("\n");

          const layoutInstruction = `Use the following layout:\n${sectionDescriptions}\nYou may insert 1–3 utility blocks for spacing or visual design.`.trim();
          const safeUserContext = userContext?.trim().substring(0, 500) || "";
          const userInstructions = safeUserContext
            ? `\n📢 User Special Instructions:\n${userContext}\n`
            : "";

          // Add design aesthetic instructions if provided
          const designAestheticInstructions = designAesthetic
            ? `\n🎨 Design Aesthetic: ${designAesthetic}\n- Use this aesthetic to influence color scheme choices and block selection\n- Choose blocks that align with the ${designAesthetic} style\n- Adjust color combinations to match the ${designAesthetic} aesthetic\n`
            : "";

          const userPrompt = `You are an expert marketing content designer building a ${emailType} email.

Your job:
Generate one MJML email using uploaded block templates.
Use userContext for info about content, and use userTone for the email tone.
${designAestheticInstructions}

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
- For product blocks, use the exact product data provided in brandData.
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
  - - All text elements in hero or header sections must have left and right padding of at least 20px to prevent the text from running edge-to-edge.
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

📌 IMPORTANT: Above every content section, include a comment marker that must be embeded in an mj-raw block:
<!-- Blockfile: block-name.txt -->

${layoutInstruction}

${userInstructions}
${JSON.stringify({ ...brandData, email_type: emailType, designAesthetic }, null, 2)}`.trim();

          // Use retry logic for OpenAI API calls with shorter timeouts
          const messageStartTime = performance.now();
          await logger.trackPerformance('openai_message_creation', async () => {
            await retryOpenAI(async () => {
              await openai.beta.threads.messages.create(thread.id, {
                role: "user",
                content: userPrompt,
              });
            });
          }, { requestId, jobId, emailIndex: i, threadId: thread.id });

          const runStartTime = performance.now();
          const run = await logger.trackPerformance('openai_run_creation', async () => {
            return await retryOpenAI(async () => {
              return await openai.beta.threads.runs.create(thread.id, {
                assistant_id: assistantId,
              });
            });
          }, { requestId, jobId, emailIndex: i, threadId: thread.id, assistantId });

          const maxWaitTime = 90000; // Reduced from 120000 to 90000
          const runStart = Date.now();
          let runStatus;
          let pollCount = 0;

          // Use retry logic for run status checking with shorter intervals
          while (Date.now() - runStart < maxWaitTime) {
            pollCount++;
            const pollStartTime = performance.now();
            
            runStatus = await logger.trackPerformance('openai_run_poll', async () => {
              return await retryOpenAI(async () => {
                return await openai.beta.threads.runs.retrieve(thread.id, run.id);
              });
            }, { requestId, jobId, emailIndex: i, threadId: thread.id, pollCount });
            
            if (runStatus.status === "completed") {
              logger.debug('OpenAI run completed', { 
                requestId, 
                jobId, 
                emailIndex: i, 
                threadId: thread.id, 
                pollCount,
                totalPollTime: Date.now() - runStart
              });
              break;
            }
            
            if (["failed", "expired", "cancelled"].includes(runStatus.status)) {
              logger.error('OpenAI run failed', { 
                requestId, 
                jobId, 
                emailIndex: i, 
                threadId: thread.id, 
                status: runStatus.status,
                error: runStatus.last_error?.message
              });
              spinner.fail(`❌ Assistant error on email ${i}`);
              throw new Error(`Assistant error: ${runStatus.status}`);
            }
            
            await new Promise((r) => setTimeout(r, 1000)); // Reduced from 1500 to 1000
          }

          if (runStatus.status !== "completed") {
            logger.error('OpenAI run timed out', { 
              requestId, 
              jobId, 
              emailIndex: i, 
              threadId: thread.id, 
              maxWaitTime,
              finalStatus: runStatus.status
            });
            spinner.fail(`❌ Assistant run timed out on email ${i}`);
            throw new Error(`Assistant run timed out after ${maxWaitTime / 1000} seconds on email ${i}`);
          }

          const messagesStartTime = performance.now();
          const messages = await logger.trackPerformance('openai_messages_retrieval', async () => {
            return await retryOpenAI(async () => {
              return await openai.beta.threads.messages.list(thread.id);
            });
          }, { requestId, jobId, emailIndex: i, threadId: thread.id });
          
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

          // Only cache on success
          await logger.trackPerformance('mjml_caching', async () => {
            saveMJML(jobId, index, cleanedMjml);
          }, { requestId, jobId, emailIndex: i, index });
          
          logger.debug('MJML saved to cache', { requestId, jobId, emailIndex: i, index });
          
          if (subjectLine) {
            logger.debug('Subject line extracted', { requestId, jobId, emailIndex: i, subjectLine });
          }

          const emailDuration = performance.now() - emailStartTime;
          logger.performance(`Email ${i} generation`, emailDuration, { 
            requestId, 
            jobId, 
            emailIndex: i, 
            threadId: thread.id,
            tokens: runStatus.usage?.total_tokens || 0
          });

          spinner.succeed(`✅ Email ${i} generated successfully`);
          return {
            index: i,
            content: cleanedMjml,
            subjectLine: subjectLine,
            tokens: runStatus.usage?.total_tokens || 0,
          };
        } catch (error) {
          const emailDuration = performance.now() - emailStartTime;
          logger.error(`Failed to generate email ${i}`, { 
            requestId, 
            jobId, 
            emailIndex: i, 
            threadId: thread.id,
            error: error.message,
            duration: emailDuration
          });
          
          spinner.fail(`❌ Failed to generate email ${i}`);
          // Do NOT cache on error
          return { index: i, error: error.message };
        } finally {
          // Return thread to pool
          threadPool.returnThread(thread);
        }
      });

      // Wait for both hero and emails with timeout
      const [results, finalBrandData] = await logger.trackPerformance('parallel_processing', async () => {
        return Promise.all([
          Promise.all(emailPromises),
          heroPromise,
        ]);
      }, { requestId, jobId, emailCount: layouts.length });

      const storedMjmls = await logger.trackPerformance('mjml_retrieval', async () => {
        return getMJML(jobId) || [];
      }, { requestId, jobId });
      
      logger.debug('MJMLs retrieved from cache', { 
        requestId, 
        jobId, 
        mjmlCount: storedMjmls ? storedMjmls.length : 0 
      });

      // Process footer template
      const footerMjml = await logger.trackPerformance('footer_processing', async () => {
        return processFooterTemplate(finalBrandData);
      }, { requestId, jobId });
      
      logger.debug('Footer template processed', { 
        requestId, 
        jobId, 
        footerLength: footerMjml ? footerMjml.length : 0 
      });

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
      await logger.trackPerformance('email_post_processing', async () => {
        (storedMjmls || []).forEach((mjml, index) => {
          if (mjml) {
            let updated = mjml;

            // Add header image at the very top if we have one
            if (finalBrandData.header_image_url && finalBrandData.header_image_url.trim() !== "") {
              const headerImageSection = `
              <!-- Header Image Section -->
              <mj-section padding="0px" background-color="#ffffff">
                <mj-column>
                  <mj-image src="${finalBrandData.header_image_url}" href="[[store_url]]" alt="Header" padding="0px" />
                </mj-column>
              </mj-section>`;
              
              // Insert header image right after <mj-body> tag, handling different formatting
              updated = updated.replace(/<mj-body[^>]*>/, (match) => `${match}${headerImageSection}`);
              logger.debug('Header image added', { requestId, jobId, emailIndex: index + 1 });
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
              
              logger.debug('Hero image replaced', { requestId, jobId, emailIndex: index + 1 });
            }

            // Add font block if not present
            if (!updated.includes("<mj-head>")) {
              updated = updated.replace("<mjml>", `<mjml>${fontHead}`);
              logger.debug('Font block added', { requestId, jobId, emailIndex: index + 1 });
            }

            // Remove any existing footer section (by unique comment) - remove everything from comment to end of mj-body
            updated = updated.replace(/<!-- Footer Section -->[\s\S]*?<\/mj-body>/g, "</mj-body>");
            
            // Add footer before closing mj-body tag, but only if not already present
            if (footerMjml && updated.includes("</mj-body>") && !updated.includes("mj-social")) {
              updated = updated.replace("</mj-body>", `${footerMjml}\n</mj-body>`);
              logger.debug('Footer added', { requestId, jobId, emailIndex: index + 1 });
            } else if (footerMjml && updated.includes("<mj-body") && !updated.includes("mj-social")) {
              // If no closing tag, add footer and closing tag at the end
              updated = updated + `\n${footerMjml}\n</mj-body>`;
              logger.debug('Footer and closing tag added', { requestId, jobId, emailIndex: index + 1 });
            }

            updateMJML(jobId, index, updated);
          }
        });
      }, { requestId, jobId, emailCount: storedMjmls?.length || 0 });

      // Update finalResults with processed MJMLs
      const patchedMjmls = await logger.trackPerformance('final_mjml_retrieval', async () => {
        return getMJML(jobId) || [];
      }, { requestId, jobId });
      
      finalResults = results.map((result, index) => {
        if (result.content && patchedMjmls[index]) {
          return {
            ...result,
            content: patchedMjmls[index],
          };
        }
        return result;
      });

      logger.info('Email generation completed successfully', { 
        requestId, 
        jobId, 
        sessionId,
        emailCount: finalResults.length,
        successCount: finalResults.filter(r => !r.error).length,
        errorCount: finalResults.filter(r => r.error).length
      });
      
      const totalTokens = finalResults.reduce((sum, result) => sum + (result.tokens || 0), 0);

      cleanupSession(sessionId);

      setTimeout(() => {
        deleteMJML(jobId);
      }, 1000);

      const totalDuration = Date.now() - totalStart;
      logger.performance('Total email generation', totalDuration, {
        requestId,
        jobId,
        sessionId,
        totalTokens,
        emailCount: finalResults.length
      });
      
      // Log performance stats
      const storeStats = getStoreStats();
      const threadStats = threadPool.getStats();
      logger.info('Performance stats', {
        requestId,
        store: {
          totalEntries: storeStats.totalEntries,
          maxEntries: storeStats.maxEntries
        },
        threadPool: {
          utilization: threadStats.utilization.toFixed(1),
          activeThreads: threadStats.activeThreads,
          availableThreads: threadStats.availableThreads
        }
      });

      // Check if client wants MJML format
      const acceptHeader = req.headers.accept || '';
      const wantsMjml = acceptHeader.includes('text/mjml') || acceptHeader.includes('application/mjml');
      
      if (wantsMjml && finalResults.length > 0 && finalResults[0].content) {
        // Return the first email as MJML
        const mjmlContent = finalResults[0].content;
        res.setHeader('Content-Type', 'text/mjml');
        res.setHeader('X-Total-Tokens', totalTokens.toString());
        res.setHeader('X-Generation-Time', `${Date.now() - totalStart}ms`);
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
      logger.error('Email generation failed', { 
        requestId, 
        jobId, 
        sessionId, 
        error: error.message,
        stack: error.stack
      });
      cleanupSession(sessionId);
      deleteMJML(jobId);
      res.status(500).json({ error: error.message });
    }
  } catch (error) {
    logger.error('Request processing failed', { 
      requestId, 
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: error.message });
  } finally {
    const requestDuration = performance.now() - requestStartTime;
    logger.requestEnd(requestId, res.statusCode, requestDuration, {
      success: res.statusCode < 400
    });
  }
}
