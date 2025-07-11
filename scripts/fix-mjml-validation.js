import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to recursively find all .txt files in the lib directory
function findTxtFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findTxtFiles(fullPath));
    } else if (item.endsWith('.txt')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Function to fix MJML validation errors
function fixMjmlValidation(content) {
  let fixed = content;
  
  // Fix 1: Remove font-family attributes from mj-text and mj-button elements
  fixed = fixed.replace(/font-family="[^"]*"/g, '');
  
  // Fix 2: Fix padding values that don't specify units (e.g., "40px 0" -> "40px 0px")
  fixed = fixed.replace(/padding="([0-9]+px) ([0-9]+)"/g, 'padding="$1 $2px"');
  fixed = fixed.replace(/padding="([0-9]+) ([0-9]+px)"/g, 'padding="$1px $2"');
  fixed = fixed.replace(/padding="([0-9]+) ([0-9]+)"/g, 'padding="$1px $2px"');
  
  // Fix 3: Remove background-position attributes from mj-section elements
  fixed = fixed.replace(/background-position="[^"]*"/g, '');
  
  // Fix 4: Remove height attributes from mj-section elements
  fixed = fixed.replace(/height="[^"]*"/g, '');
  
  // Fix 5: Remove font-family from mj-social elements
  fixed = fixed.replace(/<mj-social([^>]*)font-family="[^"]*"([^>]*)>/g, '<mj-social$1$2>');
  
  // Clean up any double spaces that might have been created
  fixed = fixed.replace(/\s+/g, ' ');
  
  return fixed;
}

// Main function
function main() {
  const libDir = path.join(__dirname, '..', 'lib');
  const txtFiles = findTxtFiles(libDir);
  
  console.log(`Found ${txtFiles.length} .txt files to process`);
  
  let totalFixed = 0;
  
  for (const filePath of txtFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      const fixedContent = fixMjmlValidation(content);
      
      if (originalContent !== fixedContent) {
        fs.writeFileSync(filePath, fixedContent, 'utf8');
        console.log(`Fixed: ${path.relative(process.cwd(), filePath)}`);
        totalFixed++;
      }
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error.message);
    }
  }
  
  console.log(`\nFixed ${totalFixed} files with MJML validation issues`);
}

// Run the script if called directly
main(); 