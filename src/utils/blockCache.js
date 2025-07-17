import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

const blockCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
let cacheInitialized = false;
let initializationPromise = null;

// Optimized cache initialization with lazy loading
export async function initializeBlockCache() {
  if (cacheInitialized) return;
  
  // Prevent multiple simultaneous initializations
  if (initializationPromise) {
    return initializationPromise;
  }
  
  initializationPromise = (async () => {
    try {
      console.log('🔄 Initializing block cache...');
      const startTime = Date.now();
      
      // Use a more efficient glob pattern and limit concurrent operations
      const blockFiles = await glob('lib/**/*.txt', { 
        cwd: process.cwd(),
        ignore: ['**/node_modules/**', '**/.git/**'],
        maxDepth: 4 // Limit directory depth for faster scanning
      });
      
      // Process files in batches to avoid overwhelming the system
      const BATCH_SIZE = 10;
      const loadedBlocks = [];
      
      for (let i = 0; i < blockFiles.length; i += BATCH_SIZE) {
        const batch = blockFiles.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (file) => {
          try {
            const content = await fs.readFile(file, 'utf8');
            const blockName = path.basename(file, '.txt');
            const fullPath = path.resolve(file);
            
            blockCache.set(blockName, {
              content,
              path: fullPath,
              timestamp: Date.now(),
              size: content.length
            });
            
            return blockName;
          } catch (error) {
            console.error(`❌ Failed to load block ${file}:`, error.message);
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        loadedBlocks.push(...batchResults.filter(Boolean));
        
        // Small delay between batches to prevent overwhelming the system
        if (i + BATCH_SIZE < blockFiles.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      const loadTime = Date.now() - startTime;
      
      console.log(`✅ Block cache initialized: ${loadedBlocks.length} blocks loaded in ${loadTime}ms`);
      console.log(`📊 Cache stats: ${blockCache.size} blocks, ${getCacheSize()} bytes`);
      
      cacheInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize block cache:', error);
      throw error;
    } finally {
      initializationPromise = null;
    }
  })();
  
  return initializationPromise;
}

// Optimized block loading with better error handling
export async function loadBlock(blockName) {
  if (!cacheInitialized) {
    await initializeBlockCache();
  }
  
  // Check cache first
  const cached = blockCache.get(blockName);
  if (cached) {
    // Check if cache is still valid
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.content;
    } else {
      // Cache expired, remove it
      blockCache.delete(blockName);
    }
  }
  
  // Load from disk if not in cache - use more efficient path resolution
  try {
    // Try common block directories first for faster lookup
    const commonPaths = [
      `lib/newsletter-blocks/block1/${blockName}.txt`,
      `lib/newsletter-blocks/block2/${blockName}.txt`,
      `lib/newsletter-blocks/block3/${blockName}.txt`,
      `lib/product-blocks/block1/${blockName}.txt`,
      `lib/product-blocks/block2/${blockName}.txt`,
      `lib/product-blocks/block3/${blockName}.txt`,
      `lib/promotion-blocks/block1/${blockName}.txt`,
      `lib/promotion-blocks/block2/${blockName}.txt`,
      `lib/promotion-blocks/block3/${blockName}.txt`,
      `lib/abandoned-blocks/block1/${blockName}.txt`,
      `lib/abandoned-blocks/block2/${blockName}.txt`,
      `lib/abandoned-blocks/block3/${blockName}.txt`,
      `lib/*/design-elements/${blockName}.txt`
    ];
    
    let filePath = null;
    for (const path of commonPaths) {
      try {
        await fs.access(path);
        filePath = path;
        break;
      } catch {
        // Continue to next path
      }
    }
    
    if (!filePath) {
      // Fallback to glob if not found in common paths
      const blockFiles = await glob(`lib/**/${blockName}.txt`, { 
        cwd: process.cwd(),
        maxDepth: 4
      });
      
      if (blockFiles.length === 0) {
        throw new Error(`Block not found: ${blockName}`);
      }
      
      filePath = blockFiles[0];
    }
    
    const content = await fs.readFile(filePath, 'utf8');
    const fullPath = path.resolve(filePath);
    
    // Cache the block
    blockCache.set(blockName, {
      content,
      path: fullPath,
      timestamp: Date.now(),
      size: content.length
    });
    
    return content;
  } catch (error) {
    console.error(`❌ Failed to load block ${blockName}:`, error.message);
    throw error;
  }
}

// Get cache statistics
export function getCacheStats() {
  const totalSize = getCacheSize();
  const blockCount = blockCache.size;
  
  return {
    blockCount,
    totalSize,
    cacheSizeMB: (totalSize / 1024 / 1024).toFixed(2),
    ttlMinutes: CACHE_TTL / (60 * 1000),
    initialized: cacheInitialized
  };
}

// Get total cache size in bytes
function getCacheSize() {
  let totalSize = 0;
  for (const block of blockCache.values()) {
    totalSize += block.size;
  }
  return totalSize;
}

// Clear expired entries
export function cleanupCache() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [blockName, block] of blockCache.entries()) {
    if (now - block.timestamp > CACHE_TTL) {
      blockCache.delete(blockName);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cache cleanup: removed ${cleaned} expired blocks`);
  }
  
  return cleaned;
}

// Manual cache refresh
export async function refreshCache() {
  console.log('🔄 Refreshing block cache...');
  blockCache.clear();
  cacheInitialized = false;
  await initializeBlockCache();
}

// Get list of all cached blocks
export function getCachedBlocks() {
  return Array.from(blockCache.keys());
}

// Check if a block is cached
export function isBlockCached(blockName) {
  const cached = blockCache.get(blockName);
  if (!cached) return false;
  
  // Check if cache is still valid
  return Date.now() - cached.timestamp < CACHE_TTL;
} 