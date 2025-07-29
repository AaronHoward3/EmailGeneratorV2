import { jest } from '@jest/globals';
import { getStoreStats, manualCleanup } from '../../src/utils/inMemoryStore.js';
import { getThreadPool } from '../../src/utils/threadPool.js';

describe('Performance Optimizations', () => {
  beforeEach(() => {
    // Clean up before each test
    manualCleanup();
  });

  describe('Memory Management', () => {
    test('should enforce TTL and size limits in store', () => {
      const stats = getStoreStats();
      
      expect(stats.maxEntries).toBe(1000);
      expect(stats.ttlMinutes).toBe(5);
      expect(stats.totalEntries).toBeLessThanOrEqual(stats.maxEntries);
    });

    test('should cleanup expired entries', () => {
      const beforeCleanup = getStoreStats();
      const cleanupResult = manualCleanup();
      const afterCleanup = getStoreStats();
      
      expect(cleanupResult).toBeDefined();
      expect(cleanupResult.beforeSize).toBeGreaterThanOrEqual(cleanupResult.afterSize);
    });
  });

  describe('Thread Pool', () => {
    test('should manage thread pool efficiently', () => {
      const threadPool = getThreadPool(5);
      const stats = threadPool.getStats();
      
      expect(stats.maxThreads).toBe(5);
      expect(stats.activeThreads).toBeLessThanOrEqual(stats.maxThreads);
      expect(stats.utilization).toBeGreaterThanOrEqual(0);
      expect(stats.utilization).toBeLessThanOrEqual(100);
    });
  });



  describe('Performance Metrics', () => {
    test('should track all performance metrics', () => {
      const storeStats = getStoreStats();
      const threadPool = getThreadPool();
      const threadStats = threadPool.getStats();
      
      // Verify all stats are available
      expect(storeStats).toBeDefined();
      expect(threadStats).toBeDefined();
      
      // Verify reasonable values
      expect(storeStats.totalEntries).toBeGreaterThanOrEqual(0);
      expect(threadStats.utilization).toBeGreaterThanOrEqual(0);
    });
  });
}); 