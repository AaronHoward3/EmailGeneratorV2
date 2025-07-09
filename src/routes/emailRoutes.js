import express from "express";
import { generateEmails } from "../controllers/emailController.js";
import { cacheMiddleware, getCacheStats, clearCache, manualCleanup as cacheCleanup } from "../utils/responseCache.js";
import { getStoreStats, manualCleanup as storeCleanup } from "../utils/inMemoryStore.js";
import { getThreadPool } from "../utils/threadPool.js";
import { getCacheStats as getBlockCacheStats } from "../utils/blockCache.js";

const router = express.Router();

// Add caching middleware before the main handler
router.post("/generate-emails", cacheMiddleware, generateEmails);

// Performance monitoring routes
router.get("/stats", (req, res) => {
  try {
    const threadPool = getThreadPool();
    const stats = {
      timestamp: new Date().toISOString(),
      store: getStoreStats(),
      threadPool: threadPool.getStats(),
      responseCache: getCacheStats(),
      blockCache: getBlockCacheStats()
    };
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cache management routes
router.post("/cache/clear", (req, res) => {
  try {
    const clearedEntries = clearCache();
    res.json({
      success: true,
      message: `Cleared ${clearedEntries} cached responses`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/cache/cleanup", (req, res) => {
  try {
    const cacheResult = cacheCleanup();
    const storeResult = storeCleanup();
    
    res.json({
      success: true,
      message: "Cache cleanup completed",
      cache: cacheResult,
      store: storeResult
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router; 