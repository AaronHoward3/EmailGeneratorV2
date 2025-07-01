import { BLOCK_DEFINITIONS } from '../config/constants.js';

function pickRandom(arr, exclude = []) {
  const filtered = arr.filter((item) => !exclude.includes(item));
  if (filtered.length === 0) return arr[Math.floor(Math.random() * arr.length)];
  return filtered[Math.floor(Math.random() * filtered.length)];
}

const layoutHistory = [];

export function getUniqueLayoutsBatch(emailType, sessionId, count = 3) {
  const typeConfig = BLOCK_DEFINITIONS[emailType];

  if (!typeConfig) {
    throw new Error(`No block configuration found for email type: ${emailType}`);
  }

  const { sections, blocks } = typeConfig;
  const layouts = [];
  const usedBlocksPerSlot = {};

  for (let i = 0; i < count; i++) {
    const layout = { layoutId: `${emailType}-${sessionId}-${i + 1}` };

    sections.forEach((sectionName, sectionIndex) => {
      const availableBlocks = blocks[sectionName];
      if (!availableBlocks || availableBlocks.length === 0) {
        throw new Error(`No available blocks for section: ${sectionName}`);
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