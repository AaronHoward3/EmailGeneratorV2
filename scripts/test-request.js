// test-request.js
import fs from "fs";
import axios from "axios";
import path from "path";

// Tone and style arrays for random selection
const tones = [
  "Professional & Reliable",
  "Friendly & Upbeat", 
  "Urgent & Promotional",
  "Casual & Conversational",
  "Luxury & Premium",
  "Bold & Confident",
  "Warm & Welcoming",
  "Modern & Trendy"
];

const styles = [
  "best practices ecommerce marketing email",
  "seasonal promotion campaign",
  "new product launch announcement", 
  "customer appreciation message",
  "limited time offer promotion",
  "brand story and values",
  "product catalog showcase",
  "exclusive member benefits"
];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateUserContext() {
  const tone = getRandomElement(tones);
  const style = getRandomElement(styles);
  const timestamp = Date.now();
  return `${tone} tone, ${style} - generated at ${timestamp}`;
}

// Load the base payload
const payload = JSON.parse(fs.readFileSync("test-data/golf-deals-promotion-payload.json", "utf-8"));

// Update userContext with unique content
payload.userContext = generateUserContext();

console.log("🎯 Generated userContext:", payload.userContext);

// Ensure test-output directory exists
const outputDir = path.join("test-output");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Helper: Print first N lines of MJML
function printMjmlSnippet(mjml, lines = 20) {
  const snippet = mjml.split(/\r?\n/).slice(0, lines).join("\n");
  console.log("\n📄 MJML Preview (first", lines, "lines):\n" + snippet + (mjml.split(/\r?\n/).length > lines ? "\n..." : ""));
}

// Helper: Warn if template variables or invalid MJML tags are found
function analyzeMjml(mjml) {
  let warnings = [];
  if (/\{\{.*?\}\}/.test(mjml)) {
    warnings.push("⚠️ Found template variables ({{...}}) in MJML output!");
  }
  if (/<mj-section[^>]*>\s*<mj-section/.test(mjml)) {
    warnings.push("⚠️ Found nested <mj-section> tags!");
  }
  if (/<mj-column[^>]*>\s*<mj-column/.test(mjml)) {
    warnings.push("⚠️ Found nested <mj-column> tags!");
  }
  if (/<mj-image[^>]*src=["']?\{\{.*?\}\}/.test(mjml)) {
    warnings.push("⚠️ Found mj-image with template variable src!");
  }
  if (/<mjml[^>]*>/.test(mjml) === false) {
    warnings.push("⚠️ No <mjml> root tag found!");
  }
  if (/<mj-body[^>]*>/.test(mjml) === false) {
    warnings.push("⚠️ No <mj-body> tag found!");
  }
  if (/<mj-head[^>]*>/.test(mjml) === false) {
    warnings.push("⚠️ No <mj-head> tag found! (font block missing?)");
  }
  if (/<mj-/.test(mjml) === false) {
    warnings.push("⚠️ No MJML tags found in output!");
  }
  if (warnings.length) {
    console.warn("\n=== MJML Analysis Warnings ===");
    warnings.forEach(w => console.warn(w));
    console.warn("============================\n");
  } else {
    console.log("\n✅ MJML output passed basic checks.");
  }
}

// Send the request
axios
  .post("http://localhost:3000/api/generate-emails", payload, {
    headers: {
      "Content-Type": "application/json",
    },
  })
  .then((res) => {
    console.log("✅ Response received successfully");
    const emails = res.data.emails || [];
    console.log("📧 Generated emails:", emails.length);
    console.log("⏱️ Total time:", res.data.totalTime || "N/A");
    console.log("🧠 Tokens used:", res.data.totalTokens || "N/A");
    if (emails.length > 0) {
      const mjml = emails[0].content || emails[0];
      // Save to file
      const outFile = path.join(outputDir, `mjml-output-${Date.now()}.mjml`);
      fs.writeFileSync(outFile, mjml, "utf-8");
      console.log("💾 MJML output saved to:", outFile);
      // Print snippet
      printMjmlSnippet(mjml, 20);
      // Analyze
      analyzeMjml(mjml);
    }
  })
  .catch((err) => {
    console.error("❌ Request failed:", err.response?.data || err.message);
  });
