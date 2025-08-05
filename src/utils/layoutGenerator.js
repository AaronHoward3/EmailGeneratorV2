import { BLOCK_DEFINITIONS } from '../config/constants.js';

function pickRandom(arr, exclude = []) {
  const filtered = arr.filter((item) => !exclude.includes(item));
  if (filtered.length === 0) return arr[Math.floor(Math.random() * arr.length)];
  return filtered[Math.floor(Math.random() * filtered.length)];
}

// ✅ designStyle now included and defaulted to "Default"
export function getUniqueLayoutsBatch(emailType, designStyle = "Default", sessionId, count = 3, brandData = null) {
  // ✅ Pull layout definition based on type + style
  const typeConfig = BLOCK_DEFINITIONS[emailType]?.[designStyle];

  if (!typeConfig) {
    throw new Error(`No block configuration found for email type: ${emailType}, designStyle: ${designStyle}`);
  }

  const { sections, blocks } = typeConfig;
  const layouts = [];
  // Check if products are available
  const hasProducts = brandData && brandData.products && brandData.products.length > 0;

  for (let i = 0; i < count; i++) {
    const layout = { layoutId: `${emailType}-${sessionId}-${i + 1}` };
    const usedBlocksPerSlot = {};

    sections.forEach((sectionName, sectionIndex) => {
      let availableBlocks = blocks[sectionName];

      if (!availableBlocks || availableBlocks.length === 0) {
        throw new Error(`No available blocks for section: ${sectionName}`);
      }

      // ✅ Always include the intro block
      if (sectionName === "intro") {
        if (brandData?.customHeroImage === true) {
          // Filter to prefer templates that contain CUSTOMHEROIMAGE placeholders
          const heroImageTemplates = availableBlocks.filter(block => 
            (block.includes("Hero") || block.includes("Bold") || block.includes("Promo")) &&
            block !== "hero-title.txt"
          );

          if (heroImageTemplates.length > 0) {
            availableBlocks = heroImageTemplates;
          }
        }
        // If customHeroImage is false, we still keep the intro block unfiltered
      }

      const used = usedBlocksPerSlot[sectionName] || [];
      const remaining = availableBlocks.filter(b => !used.includes(b));

      let chosen;
      if (remaining.length > 0) {
        chosen = remaining[Math.floor(Math.random() * remaining.length)];
      } else {
        // fallback if exhausted
        chosen = availableBlocks[Math.floor(Math.random() * availableBlocks.length)];
      }

      layout[sectionName] = chosen;

      if (!usedBlocksPerSlot[sectionName]) {
        usedBlocksPerSlot[sectionName] = [];
      }
      usedBlocksPerSlot[sectionName].push(chosen);
    });

    layouts.push(layout);
  }

  return layouts;
}

// Simple cleanup function for session management
export function cleanupSession(sessionId) {
  // Currently not needed since we use a simple array for layout history
  // This function exists to satisfy the import in emailController
  console.log(`🧹 Session cleanup completed for: ${sessionId}`);
}
