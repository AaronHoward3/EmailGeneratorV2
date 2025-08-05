import OpenAI from "openai";
import ora from "ora";
import { specializedAssistants, TIMEOUTS } from "../config/constants.js";
import { getUniqueLayoutsBatch, cleanupSession } from "../utils/layoutGenerator.js";
import { getThreadPool } from "../utils/threadPool.js";
import { retryOpenAI } from "../utils/retryUtils.js";
import { generateCustomHeroAndEnrich } from "../services/heroImageService.js";
import {
  saveMJML,
  updateMJML,
  getMJML,
  deleteMJML,
} from "../utils/inMemoryStore.js";
import { processFooterTemplate } from "../services/footerService.js";
import { generateUserPrompt } from "../services/promptService.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEmails(req, res) {
  const requestStartTime = performance.now();
  
  console.log(`[${new Date().toISOString()}] Request started: ${req.method} ${req.url}`);

  try {
    // Check if request body exists
    if (!req.body) {
      console.error('Request body missing');
      return res.status(400).json({ 
        error: "Request body is missing. Please ensure Content-Type: application/json is set." 
      });
    }

    let { brandData, emailType, userContext, imageContext, storeId, designAesthetic } = req.body;

    if (!brandData || !emailType) {
      console.error('Missing required fields:', { emailType, hasBrandData: !!brandData });
      return res
        .status(400)
        .json({ error: "Missing brandData or emailType in request body." });
    }

    const jobId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;
    console.log('Starting email generation:', { jobId, emailType });

    if (
      brandData.customHeroImage !== undefined &&
      typeof brandData.customHeroImage !== "boolean"
    ) {
      console.error('Invalid customHeroImage type:', brandData.customHeroImage);
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
        console.log('Overriding brandData.colors with user-defined colors:', brandData.colors);
      }
    }

    const wantsCustomHero = brandData.customHeroImage === true;
    if (wantsCustomHero) {
      brandData.primary_custom_hero_image_banner = "https://CUSTOMHEROIMAGE.COM";
      brandData.hero_image_url = "https://CUSTOMHEROIMAGE.COM";
      console.log('Custom hero image requested:', { jobId });
    }

    // Check if client wants MJML format early to adjust AI prompt
    const acceptHeader = req.headers.accept || '';
    const wantsMjml = acceptHeader.includes('text/mjml') || acceptHeader.includes('application/mjml');

    // Set header_image_url for hero/header blocks: use banner_url if present, else logo_url
    if (brandData.banner_url && brandData.banner_url.trim() !== "") {
      brandData.header_image_url = brandData.banner_url;
    } else {
      brandData.header_image_url = brandData.logo_url || "";
    }

    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;
    const totalStart = Date.now();
    
    console.log('Email generation session started:', {
      sessionId,
      jobId,
      emailType,
      wantsCustomHero,
      hasProducts: !!(brandData.products && brandData.products.length > 0)
    });

    // Get thread pool instance with optimized size based on environment
    const threadPoolSize = process.env.NODE_ENV === 'production' ? 15 : 10;
    const threadPool = getThreadPool(threadPoolSize);

    try {
      // Start hero image generation in parallel with timeout
      const heroPromise = wantsCustomHero
        ? Promise.race([
            generateCustomHeroAndEnrich(brandData, storeId, jobId),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Hero generation timeout')), TIMEOUTS.HERO_GENERATION)
            )
          ]).catch((err) => {
            console.error("Failed to generate custom hero image:", err.message);
            return brandData;
          })
        : Promise.resolve(brandData);

      // Generate unique layouts with error handling
      let layouts;
      try {
        layouts = getUniqueLayoutsBatch(emailType, designAesthetic || "Default", sessionId, 1, brandData);
        console.log('Generated layout:', {
          emailType,
          designAesthetic,
          sessionId,
          layout: layouts[0],
          layoutId: layouts[0]?.layoutId
        });
      } catch (err) {
        console.error('Layout generator failed:', err.message);
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
      
      const threads = await Promise.all(threadPromises);
      
      const assistantId = specializedAssistants[emailType]?.[designAesthetic || "Default"] || specializedAssistants[emailType]?.["Default"];
      
      if (!assistantId || typeof assistantId !== "string") {
        console.error('No assistant configured:', { emailType, designAesthetic });
        return res
          .status(400)
          .json({ error: `No valid assistant found for emailType="${emailType}" and designAesthetic="${designAesthetic}"` });
      }

      // Generate emails with optimized retry logic and timeouts
      const emailPromises = layouts.map(async (layout, index) => {
        const thread = threads[index];
        const i = index + 1;
        const spinner = ora().start();

        try {
          const userPrompt = generateUserPrompt({
            emailType,
            layout,
            wantsCustomHero,
            wantsMjml,
            userContext,
            designAesthetic,
            brandData
          });

          // Use retry logic for OpenAI API calls with shorter timeouts
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

          const maxWaitTime = 90000; // Reduced from 120000 to 90000
          const runStart = Date.now();
          let runStatus;

          // Use retry logic for run status checking with shorter intervals
          while (Date.now() - runStart < maxWaitTime) {            
            runStatus = await retryOpenAI(async () => {
              return await openai.beta.threads.runs.retrieve(thread.id, run.id);
            });
            
            if (runStatus.status === "completed") {
              break;
            }
            
            if (["failed", "expired", "cancelled"].includes(runStatus.status)) {
              console.error('OpenAI run failed:', { 
                emailIndex: i, 
                status: runStatus.status,
                error: runStatus.last_error?.message
              });
              spinner.fail(`❌ Assistant error on email ${i}`);
              throw new Error(`Assistant error: ${runStatus.status}`);
            }
            
            await new Promise((r) => setTimeout(r, 1000)); // Reduced from 1500 to 1000
          }

          if (runStatus.status !== "completed") {
            console.error('OpenAI run timed out:', { 
              emailIndex: i, 
              maxWaitTime,
              finalStatus: runStatus.status
            });
            spinner.fail(`❌ Assistant run timed out on email ${i}`);
            throw new Error(`Assistant run timed out after ${maxWaitTime / 1000} seconds on email ${i}`);
          }

          const messages = await retryOpenAI(async () => {
            return await openai.beta.threads.messages.list(thread.id);
          });
          
          const rawContent = messages.data[0].content[0].text.value;
          console.log('Raw AI response:', rawContent.substring(0, 1000) + '...');
          
          // Parse subject line and MJML content based on response format
          let subjectLine = '';
          let cleanedMjml = rawContent;
          
          if (wantsMjml) {
            // For MJML format, just clean up the markdown code block
            cleanedMjml = rawContent
              .replace(/^\s*```mjml/i, "")
              .replace(/```[\s\n\r]*$/g, "")
              .trim();
          } else {
            // For JSON format, extract subject line if present
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
          }

          // Only cache on success
          saveMJML(jobId, index, cleanedMjml);

          spinner.succeed(`✅ Email ${i} generated successfully`);
          return {
            index: i,
            content: cleanedMjml,
            subjectLine: subjectLine,
            tokens: runStatus.usage?.total_tokens || 0,
          };
        } catch (error) {
          console.error(`Failed to generate email ${i}:`, error.message);
          
          spinner.fail(`❌ Failed to generate email ${i}`);
          // Do NOT cache on error
          return { index: i, error: error.message };
        } finally {
          // Return thread to pool
          threadPool.returnThread(thread);
        }
      });

      // Wait for both hero and emails with timeout
      const [results, finalBrandData] = await Promise.all([
        Promise.all(emailPromises),
        heroPromise,
      ]);

      const storedMjmls = getMJML(jobId) || [];

      // Process footer template
      const footerMjml = await processFooterTemplate(finalBrandData);
      console.log('Footer processed:', { 
        hasFooter: !!footerMjml, 
        footerLength: footerMjml?.length || 0,
        footerPreview: footerMjml?.substring(0, 200) + '...'
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
            .header-image img {
              max-height: 200px !important;
              width: auto !important;
              height: auto !important;
              object-fit: contain !important;
              display: block !important;
              margin: 0 auto !important;
            }
            @media only screen and (max-width:480px) {
              .hero-headline {
                font-size: 28px !important;
                line-height: 1.2 !important;
              }
              .hero-subhead {
                font-size: 16px !important;
              }
              .header-image img {
                max-height: 150px !important;
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
            // Get primary brand color for background, fallback to white
            const primaryColor = finalBrandData.colors && finalBrandData.colors.length > 0 
              ? finalBrandData.colors[0] 
              : "#ffffff";
            
            const headerImageSection = `
            <!-- Header Image Section -->
            <mj-section padding="0px" background-color="${primaryColor}">
              <mj-column>
                <mj-image 
                  src="${finalBrandData.header_image_url}" 
                  href="[[store_url]]" 
                  alt="Header" 
                  padding="0px"
                  width="600px"
                  align="center"
                  border-radius="0px"
                  css-class="header-image"
                />
              </mj-column>
            </mj-section>`;
            
            // Insert header image right after <mj-body> tag, handling different formatting
            updated = updated.replace(/<mj-body[^>]*>/, (match) => `${match}${headerImageSection}`);
          }

          // Replace placeholder hero image if available
          console.log('Hero image replacement check:', { 
            emailIndex: index + 1,
            wantsCustomHero,
            hasHeroImageUrl: !!finalBrandData.hero_image_url,
            heroImageUrl: finalBrandData.hero_image_url,
            containsCUSTOMHEROIMAGE: updated.includes("CUSTOMHEROIMAGE"),
            mjmlLength: updated.length,
            mjmlPreview: updated.substring(0, 500) + '...'
          });
          
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
            updated = updated.replace(
              /background-url="https:\/\/CUSTOMHEROIMAGE\.COM"/g,
              `background-url="${finalBrandData.hero_image_url}"`
            );
            
            console.log('Hero image replaced successfully:', { 
              emailIndex: index + 1,
              replacementCount: (updated.match(new RegExp(finalBrandData.hero_image_url, 'g')) || []).length
            });
          } else {
            console.warn('Hero image replacement skipped:', { 
              emailIndex: index + 1,
              wantsCustomHero,
              hasHeroImageUrl: !!finalBrandData.hero_image_url,
              reason: !wantsCustomHero ? 'wantsCustomHero is false' : 
                      !finalBrandData.hero_image_url ? 'no hero image URL' :
                      !finalBrandData.hero_image_url.includes("http") ? 'hero URL not valid' :
                      finalBrandData.hero_image_url.includes("CUSTOMHEROIMAGE") ? 'hero URL contains CUSTOMHEROIMAGE' : 'unknown'
            });
            
            // If hero generation failed (timeout), remove hero image sections to avoid broken images
            if (wantsCustomHero && finalBrandData.hero_image_url?.includes("CUSTOMHEROIMAGE")) {
              console.warn('Hero image missing or timed out — leaving placeholder in place to preserve layout');
              // You can optionally add a default fallback image here:
              // updated = updated.replace(/src="https:\/\/CUSTOMHEROIMAGE\.COM"/g, 'src="https://via.placeholder.com/600x300?text=Hero+Image"');
            }
          }

          // Add font block if not present
          if (!updated.includes("<mj-head>")) {
            updated = updated.replace("<mjml>", `<mjml>${fontHead}`);
          }

          // Remove any existing footer section (by unique comment) - remove everything from comment to end of mj-body
          updated = updated.replace(/<!-- Footer Section -->[\s\S]*?<\/mj-body>/g, "</mj-body>");
          
          // Add footer before closing mj-body tag, but only if not already present
          if (footerMjml && updated.includes("</mj-body>") && !updated.includes("mj-social")) {
            updated = updated.replace("</mj-body>", `${footerMjml}\n</mj-body>`);
            console.log('Footer added before closing mj-body tag');
          } else if (footerMjml && updated.includes("<mj-body") && !updated.includes("mj-social")) {
            // If no closing tag, add footer and closing tag at the end
            updated = updated + `\n${footerMjml}\n</mj-body>`;
            console.log('Footer added at the end with closing tag');
          } else {
            console.log('Footer not added:', { 
              hasFooter: !!footerMjml, 
              hasClosingTag: updated.includes("</mj-body>"),
              hasSocial: updated.includes("mj-social")
            });
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

      console.log('Email generation completed successfully:', { 
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
      console.error('Email generation failed:', error.message);
      cleanupSession(sessionId);
      deleteMJML(jobId);
      res.status(500).json({ error: error.message });
    }
  } catch (error) {
    console.error('Request processing failed:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    const requestDuration = performance.now() - requestStartTime;
    console.log(`[${new Date().toISOString()}] Request completed: ${req.method} ${req.url} - ${res.statusCode}`);
  }
}
