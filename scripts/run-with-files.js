// run-with-files.js
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import axios from "axios";
import ora from "ora";
import path from "path";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Load all golf-deals test data
const loadTestData = () => {
  const testDataDir = path.join(process.cwd(), 'test-data');
  const golfDealsFiles = [
    'golf-deals-promotion-payload.json',
    'golf-deals-newsletter-payload.json',
    'golf-deals-product-grid-payload.json'
  ];

  const testData = {};
  
  golfDealsFiles.forEach(filename => {
    const filePath = path.join(testDataDir, filename);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      
      // Extract email type from filename
      const emailType = filename.includes('promotion') ? 'Promotion' :
                       filename.includes('newsletter') ? 'Newsletter' :
                       filename.includes('product-grid') ? 'Product grid' : 'Unknown';
      
      testData[emailType] = {
        data,
        originalFilename: filename
      };
      console.log(`📁 Loaded ${emailType} test data from ${filename}`);
    } else {
      console.warn(`⚠️ Test data file not found: ${filename}`);
    }
  });

  return testData;
};

// Map each email_type to its specialized assistant ID
const specializedAssistants = {
  "Newsletter": "asst_So4cxsaziuSI6hZYAT330j1u",
  "Product grid": "asst_wpEAG1SSFXym8BLxqyzTPaVe",
  "Promotion": "asst_Kr6Sc01OP5oJgwIXQgV7qb2k"
};

const logTokenUsage = async (runId, label) => {
  const runMeta = await openai.beta.threads.runs.retrieve(runId.thread_id, runId.id);
  if (runMeta.usage) {
    console.log(`\n📊 Token usage for ${label}:`);
    console.log(`   Prompt:     ${runMeta.usage.prompt_tokens}`);
    console.log(`   Completion: ${runMeta.usage.completion_tokens}`);
    console.log(`   Total:      ${runMeta.usage.total_tokens}`);
  } else {
    console.warn(`⚠️ No token usage data available for ${label}`);
  }
};

const generateEmail = async (emailType, brandData, originalFilename) => {
  const selectedAssistantId = specializedAssistants[emailType];
  console.log(`\n🎯 Generating ${emailType} Email...`);

  const specializedThread = await openai.beta.threads.create();
  await openai.beta.threads.messages.create(specializedThread.id, {
    role: "user",
    content: `
You are a ${emailType} email assistant.
Use the following branding data to generate exactly ONE unique MJML email.
Follow the uploaded inspiration structure rules.
ONLY return valid MJML markdown code — NO extra commentary.

${JSON.stringify(brandData)}
`
  });

  const specializedRun = await openai.beta.threads.runs.create(specializedThread.id, {
    assistant_id: selectedAssistantId
  });

  const specializedSpinner = ora(` Running ${emailType} Assistant...`).start();

  // Wait for specialized run completion with timeout
  const specializedMaxWaitTime = 120000; // 2 minutes
  const specializedStartTime = Date.now();
  
  while (Date.now() - specializedStartTime < specializedMaxWaitTime) {
    const runStatus = await openai.beta.threads.runs.retrieve(specializedThread.id, specializedRun.id);

    if (runStatus.status === "completed") {
      specializedSpinner.succeed(`✅ ${emailType} assistant run completed.`);
      await logTokenUsage({ id: specializedRun.id, thread_id: specializedThread.id }, `${emailType} Assistant`);
      break;
    }

    if (runStatus.status === "failed") {
      specializedSpinner.fail(`❌ ${emailType} assistant run failed.`);
      console.error("Error info:", runStatus.last_error || "No error detail available.");
      return null;
    }

    if (runStatus.status === "expired") {
      specializedSpinner.fail(`❌ ${emailType} assistant run expired.`);
      return null;
    }

    if (runStatus.status === "cancelled") {
      specializedSpinner.fail(`❌ ${emailType} assistant run was cancelled.`);
      return null;
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  // Check if we timed out
  const finalSpecializedRunStatus = await openai.beta.threads.runs.retrieve(specializedThread.id, specializedRun.id);
  if (finalSpecializedRunStatus.status !== "completed") {
    specializedSpinner.fail(`❌ ${emailType} assistant run timed out after ${specializedMaxWaitTime / 1000} seconds. Status: ${finalSpecializedRunStatus.status}`);
    return null;
  }

  const messages = await openai.beta.threads.messages.list(specializedThread.id);
  const rawOutput = messages.data[0].content[0].text.value;

  // Clean the output by removing markdown code block delimiters
  const output = rawOutput.replace(/^```mjml\s*/, '').replace(/\s*```$/, '').trim();

  console.log(`\n💬 ${emailType} Assistant Output:\n\n`, output);

  // Create test-output directory if it doesn't exist
  const testOutputDir = path.join(process.cwd(), 'test-output');
  if (!fs.existsSync(testOutputDir)) {
    fs.mkdirSync(testOutputDir, { recursive: true });
  }

  // Remove the cleanMjmlAttributes function and all references to cleanedOutput
  // Save the raw output (after stripping markdown code block delimiters) directly to the file

  // Generate filename: replace "payload" with "mjml" and add timestamp
  const timestamp = Date.now(); // integer timestamp
  const baseName = originalFilename.replace('-payload.json', '');
  const outputFile = `${timestamp}-${baseName}-mjml.mjml`;
  const outputPath = path.join(testOutputDir, outputFile);
  
  fs.writeFileSync(outputPath, output);
  console.log(`📄 Final MJML email saved as ${outputFile}`);

  return {
    emailType,
    output,
    filename: outputFile,
    path: outputPath
  };
};

const run = async () => {
  console.log("🚀 Starting Golf Deals Email Generation Test (Async)");
  console.log("=" .repeat(60));

  // Load all test data
  const testData = loadTestData();
  
  if (Object.keys(testData).length === 0) {
    console.error("❌ No test data found. Please ensure golf-deals test files exist in test-data/");
    return;
  }

  console.log(`\n📋 Found ${Object.keys(testData).length} email types to test:`);
  Object.keys(testData).forEach(emailType => {
    console.log(`   - ${emailType}`);
  });

  // Generate all emails asynchronously
  console.log(`\n🔄 Generating all emails asynchronously...`);
  
  const generationPromises = Object.entries(testData).map(([emailType, { data, originalFilename }]) => 
    generateEmail(emailType, data, originalFilename)
  );

  const results = await Promise.all(generationPromises);

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log("📊 GENERATION SUMMARY");
  console.log(`${'='.repeat(60)}`);
  
  const successfulResults = results.filter(result => result !== null);
  const failedResults = results.filter(result => result === null);
  
  console.log(`✅ Successfully generated: ${successfulResults.length}/${Object.keys(testData).length} emails`);
  
  if (successfulResults.length > 0) {
    console.log(`\n📁 Generated files in test-output/:`);
    successfulResults.forEach(result => {
      console.log(`   - ${result.filename}`);
    });
  }
  
  if (failedResults.length > 0) {
    console.log(`\n❌ Failed generations: ${failedResults.length}`);
  }

  console.log(`\n✅ Test completed! Check the test-output/ folder for generated .mjml files.`);
};

run();
