import { TIMEOUTS } from "../config/constants.js";
import { generateCustomHeroAndEnrich } from "../services/heroImageService.js";
import { processFooterTemplate } from "../services/footerService.js";
import { generateSubjectLine } from "../services/subjectService.js";
import {
  saveMJML,
  updateMJML,
  getMJML,
  deleteMJML,
} from "../utils/inMemoryStore.js";
import { runTwoPassGeneration } from "../pipeline/twoPassGenerator.js";
import { newMetrics, setLastMetrics } from "../utils/metrics.js";
import { computeTextCostUSD } from "../utils/pricing.js";

function isSse(req) {
  return (req.headers.accept || "").includes("text/event-stream") || String(req.query.stream) === "1";
}
function sseInit(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
}
function sseSend(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data || {})}\n\n`);
}
function sseClose(res) {
  try { res.write("event: end\ndata: {}\n\n"); } catch {}
  try { res.end(); } catch {}
}

export async function generateEmails(req, res) {
  const requestStartTime = performance.now();
  const streaming = isSse(req);
  if (streaming) sseInit(res);

  let hb;
  if (streaming) {
    hb = setInterval(() => {
      try { res.write(":hb\n\n"); } catch {}
    }, 15000);
    req.on("close", () => clearInterval(hb));
  }

  const send = streaming ? (e, d) => sseSend(res, e, d) : () => {};

  try {
    send("start", { at: Date.now() });

    if (!req.body) {
      const err = { error: "Request body is missing. Ensure Content-Type: application/json." };
      if (streaming) { sseSend(res, "error", err); if (hb) clearInterval(hb); sseClose(res); return; }
      return res.status(400).json(err);
    }

    let { brandData, emailType, userContext, imageContext, storeId, designAesthetic } = req.body;
    if (!brandData || !emailType) {
      const err = { error: "Missing brandData or emailType in request body." };
      if (streaming) { sseSend(res, "error", err); if (hb) clearInterval(hb); sseClose(res); return; }
      return res.status(400).json(err);
    }

    const wantsMjml =
      (req.headers.accept || "").includes("text/mjml") ||
      (req.headers.accept || "").includes("application/mjml");

    // METRICS
    const m = newMetrics({ emailType, designAesthetic: designAesthetic || "bold_contrasting" });
    m.log("Request received.", {
      emailType,
      designAesthetic: designAesthetic || "bold_contrasting",
      hasProducts: Array.isArray(brandData?.products) ? brandData.products.length : 0,
      wantsCustomHero: brandData?.customHeroImage === true
    });

    if (userContext && typeof userContext === "string") {
      const cssColors = userContext.match(/\b(black|white|red|blue|green|yellow|orange|pink|purple|gray|grey|teal|cyan|magenta|lime|maroon|navy|olive|silver|gold|beige|brown|coral|crimson|indigo|ivory|khaki|lavender|mint|peach|plum|salmon|tan|turquoise)\b/gi);
      const hexColors = userContext.match(/#(?:[0-9a-fA-F]{3}){1,2}/g);
      const combined = [ ...(cssColors || []).map(c => c.toLowerCase()), ...(hexColors || []) ];
      if (combined.length) brandData.colors = combined.slice(0, 3);
    }
    if (imageContext) brandData.imageContext = imageContext.trim().slice(0, 300);

    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

    const wantsCustomHero = brandData.customHeroImage === true;
    if (wantsCustomHero) {
      brandData.primary_custom_hero_image_banner = "https://CUSTOMHEROIMAGE.COM";
      brandData.hero_image_url = "https://CUSTOMHEROIMAGE.COM";
    }

    brandData.header_image_url =
      brandData.banner_url && brandData.banner_url.trim() !== ""
        ? brandData.banner_url
        : brandData.logo_url || "";

    // Hero (parallel)
    if (wantsCustomHero) send("hero:start", {});
    const heroPromise = wantsCustomHero
      ? Promise.race([
          generateCustomHeroAndEnrich(brandData, storeId, jobId, { metrics: m }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Hero generation timeout")), TIMEOUTS.HERO_GENERATION)
          )
        ]).catch(err => {
          m.log("Hero generation failed:", err.message);
          return brandData;
        })
      : Promise.resolve(brandData);

    // Two-pass refine
    let refinedMjml;
    send("refine:start", {});
    const { layout, refinedMjml: mjml } = await runTwoPassGeneration({
      emailType,
      designAesthetic: designAesthetic || "bold_contrasting",
      brandData,
      userContext,
      wantsMjml,
      onStatus: (event, payload) => {
        if (event === "layout:chosen") send("layout:chosen", payload);
        if (event === "assistant:refine:start") send("refine:writing", payload);
        if (event === "assistant:refine:done") send("refine:done", payload);
        m.log(`status:${event}`, payload || {});
      },
      metrics: m
    });
    refinedMjml = mjml;

    // Cache for post-processing
    saveMJML(jobId, 0, refinedMjml);

    // Post-processing
    send("finalizing", {});
    const finalBrandData = await heroPromise;
    const storedMjmls = getMJML(jobId) || [];
    const footerMjml = await processFooterTemplate(finalBrandData);

    const fontHead = `
      <mj-head>
        <mj-attributes>
          <mj-text font-family="Helvetica Neue, Helvetica, Arial, sans-serif" />
          <mj-button font-family="Helvetica Neue, Helvetica, Arial, sans-serif" />
        </mj-attributes>
        <mj-style inline="inline">
          .header-image img { max-height: 200px !important; width: auto !important; height: auto !important; object-fit: contain !important; display: block !important; margin: 0 auto !important; }
          @media only screen and (max-width:480px) {
            .hero-headline { font-size: 28px !important; line-height: 1.2 !important; }
            .hero-subhead { font-size: 16px !important; }
            .header-image img { max-height: 150px !important; }
          }
        </mj-style>
      </mj-head>
    `;

    (storedMjmls || []).forEach((mjml, index) => {
      if (!mjml) return;
      let updated = mjml;

      if (finalBrandData.header_image_url && finalBrandData.header_image_url.trim() !== "") {
        const primaryColor =
          finalBrandData.colors && finalBrandData.colors.length > 0
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
              css-class="header-image">
            </mj-image>
          </mj-column>
        </mj-section>`;

        updated = updated.replace(/<mj-body[^>]*>/, (m) => `${m}${headerImageSection}`);
      }

      if (
        finalBrandData.customHeroImage === true &&
        finalBrandData.hero_image_url &&
        finalBrandData.hero_image_url.includes("http") &&
        !finalBrandData.hero_image_url.includes("CUSTOMHEROIMAGE")
      ) {
        updated = updated.replace(/src="https:\/\/CUSTOMHEROIMAGE\.COM"/g, `src="${finalBrandData.hero_image_url}"`);
        updated = updated.replace(/background-url="https:\/\/CUSTOMHEROIMAGE\.COM"/g, `background-url="${finalBrandData.hero_image_url}"`);
      }

      if (!updated.includes("<mj-head>")) {
        updated = updated.replace("<mjml>", `<mjml>${fontHead}`);
      }

      updated = updated.replace(/<!-- Footer Section -->[\s\S]*?<\/mj-body>/g, "</mj-body>");
      if (footerMjml && updated.includes("</mj-body>") && !updated.includes("mj-social")) {
        updated = updated.replace("</mj-body>", `${footerMjml}\n</mj-body>`);
      } else if (footerMjml && updated.includes("<mj-body") && !updated.includes("mj-social")) {
        updated = `${updated}\n${footerMjml}\n</mj-body>`;
      }

      updateMJML(jobId, index, updated);
    });

    const patched = getMJML(jobId) || [];
    const mjmlOut = patched[0] || refinedMjml;

    // SUBJECT LINE
    const subjectLine = await generateSubjectLine({
      brandData: finalBrandData,
      emailType,
      designAesthetic: designAesthetic || "bold_contrasting",
      userContext,
      refinedMjml: mjmlOut,
      metrics: m
    });

    // ---- COSTS: text + image + total ----
    const textCosts = computeTextCostUSD(m.apiCalls || []);
    const imageCosts = m.costs?.image; // possibly undefined if no image used
    const totalUSD =
      (textCosts?.totalUSD || 0) + (imageCosts?.imageTotalCostUSD || 0);

    const summary = m.summary({ layout: layout?.layoutId || null });
    summary.costsUSD = {
      text: textCosts,
      image: imageCosts,
      totalUSD: Math.round((totalUSD + Number.EPSILON) * 1e5) / 1e5
    };

    setLastMetrics(summary);
    m.log("Summary:", summary);

    setTimeout(() => deleteMJML(jobId), 1000);

    if (streaming) {
      sseSend(res, "metrics", summary);
      sseSend(res, "result", { subjectLine, mjml: mjmlOut });
      sseSend(res, "done", {});
      if (hb) clearInterval(hb);
      sseClose(res);
      return;
    }

    res.setHeader("X-Gen-RequestId", summary.requestId);
    res.setHeader("X-Gen-TotalMs", String(summary.totalMs));
    res.setHeader("X-Gen-InputTokens", String(summary.usage.inputTokens));
    res.setHeader("X-Gen-OutputTokens", String(summary.usage.outputTokens));

    if (wantsMjml && mjmlOut) {
      res.setHeader("Content-Type", "text/mjml");
      res.setHeader("X-Subject-Line", subjectLine);
      return res.send(mjmlOut);
    }

    return res.json({
      success: true,
      subjectLine,
      emails: [{ index: 1, content: mjmlOut }],
      layoutId: summary.layout,
      timesMs: summary.timesMs,
      totalMs: summary.totalMs,
      usage: summary.usage,
      costsUSD: summary.costsUSD,
      requestId: summary.requestId
    });
  } catch (error) {
    if (streaming) {
      sseSend(res, "error", { error: error.message });
      if (hb) clearInterval(hb);
      return sseClose(res);
    }
    console.error("Request processing failed:", error.message);
    return res.status(500).json({ error: error.message });
  } finally {
    const requestDuration = performance.now() - requestStartTime;
    console.log(`[${new Date().toISOString()}] Request completed: ${req.method} ${req.url} - ${res.statusCode} (${requestDuration.toFixed(0)}ms)`);
  }
}
