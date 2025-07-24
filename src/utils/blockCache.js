import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { createLogger } from './logger.js';

const logger = createLogger('BlockCache');

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
      logger.info('Starting block cache initialization');
      const startTime = performance.now();
      
      // Use a more efficient glob pattern and limit concurrent operations
      const globStartTime = performance.now();
      const blockFiles = await glob('lib/**/*.txt', { 
        cwd: process.cwd(),
        ignore: ['**/node_modules/**', '**/.git/**'],
        maxDepth: 4 // Limit directory depth for faster scanning
      });
      const globDuration = performance.now() - globStartTime;
      

      
      // Process files in batches to avoid overwhelming the system
      const BATCH_SIZE = 10;
      const loadedBlocks = [];
      
      for (let i = 0; i < blockFiles.length; i += BATCH_SIZE) {
        const batch = blockFiles.slice(i, i + BATCH_SIZE);
        const batchStartTime = performance.now();
        
        const batchPromises = batch.map(async (file) => {
          const fileStartTime = performance.now();
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
            
            const fileDuration = performance.now() - fileStartTime;
            logger.fileOperation('read', file, fileDuration, true, { blockName, size: content.length });
            
            return blockName;
          } catch (error) {
            const fileDuration = performance.now() - fileStartTime;
            logger.fileOperation('read', file, fileDuration, false, { error: error.message });
            logger.error(`Failed to load block ${file}`, { error: error.message });
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
      
      const loadTime = performance.now() - startTime;
      
      logger.info('Block cache initialization completed', {
        loadedBlocks: loadedBlocks.length,
        totalFiles: blockFiles.length,
        cacheSize: blockCache.size,
        totalSize: getCacheSize(),
        loadTime: `${loadTime.toFixed(2)}ms`
      });
      
      cacheInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize block cache', { error: error.message, stack: error.stack });
      throw error;
    } finally {
      initializationPromise = null;
    }
  })();
  
  return initializationPromise;
}

// Optimized block loading with better error handling
export async function loadBlock(blockName) {
  const startTime = performance.now();
  
  if (!cacheInitialized) {
    await initializeBlockCache();
  }
  
  // Check cache first
  const cached = blockCache.get(blockName);
  if (cached) {
    // Check if cache is still valid
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      const duration = performance.now() - startTime;
      logger.cacheOperation('get', blockName, true, duration, { size: cached.size });
      return cached.content;
    } else {
      // Cache expired, remove it
      blockCache.delete(blockName);
      logger.debug('Cache entry expired', { blockName });
    }
  }
  
  // Load from disk if not in cache - use more efficient path resolution
  try {
    const pathResolutionStart = performance.now();
    
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
    
    const pathResolutionDuration = performance.now() - pathResolutionStart;
    logger.performance('Path resolution', pathResolutionDuration, { blockName, filePath });
    
    const fileReadStart = performance.now();
    const content = await fs.readFile(filePath, 'utf8');
    const fullPath = path.resolve(filePath);
    const fileReadDuration = performance.now() - fileReadStart;
    
    logger.fileOperation('read', filePath, fileReadDuration, true, { 
      blockName, 
      size: content.length,
      resolvedPath: fullPath 
    });
    
    // Cache the block
    blockCache.set(blockName, {
      content,
      path: fullPath,
      timestamp: Date.now(),
      size: content.length
    });
    
    const totalDuration = performance.now() - startTime;
    logger.cacheOperation('set', blockName, false, totalDuration, { size: content.length });
    
    return content;
  } catch (error) {
    const totalDuration = performance.now() - startTime;
    logger.error(`Failed to load block ${blockName}`, { 
      error: error.message, 
      duration: totalDuration 
    });
    throw error;
  }
}

// Get cache statistics
export function getCacheStats() {
  const totalSize = getCacheSize();
  const blockCount = blockCache.size;
  
  const stats = {
    blockCount,
    totalSize,
    cacheSizeMB: (totalSize / 1024 / 1024).toFixed(2),
    ttlMinutes: CACHE_TTL / (60 * 1000),
    initialized: cacheInitialized
  };
  
  logger.debug('Cache statistics', stats);
  
  return stats;
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
  const startTime = performance.now();
  const now = Date.now();
  let cleaned = 0;
  
  for (const [blockName, block] of blockCache.entries()) {
    if (now - block.timestamp > CACHE_TTL) {
      blockCache.delete(blockName);
      cleaned++;
    }
  }
  
  const duration = performance.now() - startTime;
  
  if (cleaned > 0) {
    logger.info('Cache cleanup completed', { 
      cleaned, 
      remaining: blockCache.size,
      duration: `${duration.toFixed(2)}ms`
    });
  }
  
  return cleaned;
}

// Manual cache refresh
export async function refreshCache() {
  logger.info('Starting manual cache refresh');
  const startTime = performance.now();
  
  blockCache.clear();
  cacheInitialized = false;
  await initializeBlockCache();
  
  const duration = performance.now() - startTime;
  logger.info('Manual cache refresh completed', { duration: `${duration.toFixed(2)}ms` });
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