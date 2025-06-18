import { BLOCK_DEFINITIONS } from '../config/constants.js';

function pickRandom(arr, exclude = []) {
  const filtered = arr.filter((item) => !exclude.includes(item));
  if (filtered.length === 0) return arr[Math.floor(Math.random() * arr.length)];
  return filtered[Math.floor(Math.random() * filtered.length)];
}

const layoutHistory = [];

export function getUniqueLayout(emailType) {
  const config = BLOCK_DEFINITIONS[emailType];
  if (!config) return null;

  let attempts = 0;
  while (attempts < 10) {
    const layout = {};
    const layoutIdParts = [];

    for (const section of config.sections) {
      const choice = pickRandom(config.blocks[section]);
      layout[section] = choice;
      layoutIdParts.push(choice);
    }

    const layoutId = layoutIdParts.join("|");

    if (!layoutHistory.includes(layoutId)) {
      layoutHistory.push(layoutId);
      return { ...layout, layoutId };
    }
    attempts++;
  }
  return null;
} 