#!/usr/bin/env node

import axios from 'axios';
import ora from 'ora';

const BASE_URL = process.env.API_URL || 'https://mjml-generator-service.springbot.com';

// Test payload for performance testing
const testPayload = {
  brandData: {
    brand_name: "Test Brand",
    primary_color: "#007BFF",
    secondary_color: "#6C757D",
    logo_url: "https://example.com/logo.png",
    banner_url: "https://example.com/banner.png",
    customHeroImage: false,
    products: [
      {
        name: "Test Product",
        image_url: "https://example.com/product.jpg",
        description: "A test product for performance testing",
        url: "https://example.com/product",
        price: "$99.99"
      }
    ]
  },
  emailType: "Newsletter",
  userContext: "This is a test email for performance monitoring",
  storeId: "test-store-123"
};

async function measureResponseTime(url, payload) {
  const startTime = Date.now();
  const spinner = ora(`Testing ${url}`).start();
  
  try {
    const response = await axios.post(url, payload, {
      timeout: 120000, // 2 minutes timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    spinner.succeed(`✅ ${url} - ${duration}ms`);
    
    return {
      success: true,
      duration,
      statusCode: response.status,
      tokens: response.headers['x-total-tokens'] || 'N/A',
      generationTime: response.headers['x-generation-time'] || 'N/A'
    };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    spinner.fail(`❌ ${url} - ${duration}ms - ${error.message}`);
    
    return {
      success: false,
      duration,
      error: error.message,
      statusCode: error.response?.status || 'N/A'
    };
  }
}

async function runPerformanceTest() {
  console.log('🚀 Starting Performance Test\n');
  
  const results = [];
  
  // Test health endpoint
  console.log('📊 Testing Health Endpoint...');
  const healthResult = await measureResponseTime(`${BASE_URL}/`, {});
  results.push({ endpoint: 'Health', ...healthResult });
  
  // Test stats endpoint
  console.log('\n📊 Testing Stats Endpoint...');
  const statsResult = await measureResponseTime(`${BASE_URL}/api/stats`, {});
  results.push({ endpoint: 'Stats', ...statsResult });
  
  // Test email generation
  console.log('\n📊 Testing Email Generation...');
  const emailResult = await measureResponseTime(`${BASE_URL}/api/generate-emails`, testPayload);
  results.push({ endpoint: 'Email Generation', ...emailResult });
  
  // Test with custom hero image
  console.log('\n📊 Testing Email Generation with Custom Hero...');
  const heroPayload = { ...testPayload, brandData: { ...testPayload.brandData, customHeroImage: true } };
  const heroResult = await measureResponseTime(`${BASE_URL}/api/generate-emails`, heroPayload);
  results.push({ endpoint: 'Email Generation (Custom Hero)', ...heroResult });
  
  // Print summary
  console.log('\n📈 Performance Test Summary\n');
  console.log('='.repeat(80));
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const duration = result.duration ? `${result.duration}ms` : 'N/A';
    const tokens = result.tokens !== 'N/A' ? `(${result.tokens} tokens)` : '';
    const generationTime = result.generationTime !== 'N/A' ? `[${result.generationTime}]` : '';
    
    console.log(`${status} ${result.endpoint.padEnd(30)} ${duration.padStart(10)} ${tokens} ${generationTime}`);
    
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log('='.repeat(80));
  
  // Calculate averages
  const successfulResults = results.filter(r => r.success);
  if (successfulResults.length > 0) {
    const avgDuration = successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length;
    console.log(`\n📊 Average Response Time: ${Math.round(avgDuration)}ms`);
  }
  
  // Performance recommendations
  console.log('\n💡 Performance Recommendations:');
  
  const emailGenResult = results.find(r => r.endpoint === 'Email Generation');
  if (emailGenResult && emailGenResult.success) {
    if (emailGenResult.duration > 30000) {
      console.log('⚠️  Email generation is taking longer than 30 seconds - consider optimizing OpenAI calls');
    } else if (emailGenResult.duration > 15000) {
      console.log('⚠️  Email generation is taking longer than 15 seconds - consider increasing AppRunner resources');
    } else {
      console.log('✅ Email generation performance is good');
    }
  }
  
  const healthCheckResult = results.find(r => r.endpoint === 'Health');
  if (healthCheckResult && healthCheckResult.success && healthCheckResult.duration > 1000) {
    console.log('⚠️  Health endpoint is slow - check server startup time');
  }
}

// Run the test
runPerformanceTest().catch(console.error); 