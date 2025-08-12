import express from "express";
import { generateEmails } from "../controllers/emailController.js";
import { getStoreStats, manualCleanup as storeCleanup } from "../utils/inMemoryStore.js";
import { getThreadPool } from "../utils/threadPool.js";
import { getLastMetrics } from "../utils/metrics.js";

const router = express.Router();

router.post("/generate-emails", generateEmails);

// Performance monitoring routes
router.get("/stats", (req, res) => {
  try {
    const threadPool = getThreadPool();
    const stats = {
      timestamp: new Date().toISOString(),
      store: getStoreStats(),
      threadPool: threadPool.getStats()
    };
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Store management routes
router.post("/store/cleanup", (req, res) => {
  try {
    const storeResult = storeCleanup();
    
    res.json({
      success: true,
      message: "Store cleanup completed",
      store: storeResult
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint
router.get("/last-metrics", (req, res) => {
  const summary = getLastMetrics();
  if (!summary) {
    return res.status(404).json({ error: "No metrics available yet" });
  }
  res.json(summary);
});

export default router; 