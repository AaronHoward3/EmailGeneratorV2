import crypto from 'crypto';

const responseCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 500;

// Generate cache key from request body
export function generateCacheKey(requestBody) {
  // Create a deterministic key from the request
  const keyData = {
    brandData: requestBody.brandData,
    emailType: requestBody.emailType,
    userContext: requestBody.userContext?.trim().substring(0, 500) || "",
    storeId: requestBody.storeId
  };
  
  // Sort keys to ensure consistent ordering
  const sortedData = JSON.stringify(keyData, Object.keys(keyData).sort());
  return crypto.createHash('sha256').update(sortedData).digest('hex');
}

// Check if request is cacheable
export function isCacheable(requestBody) {
  // Don't cache requests with custom hero images (they're unique)
  if (requestBody.brandData?.customHeroImage === true) {
    return false;
  }
  
  // Don't cache very large user contexts (they're likely unique)
  if (requestBody.userContext && requestBody.userContext.length > 1000) {
    return false;
  }
  
  return true;
}

// Get cached response
export function getCachedResponse(cacheKey) {
  const cached = responseCache.get(cacheKey);
  if (!cached) return null;
  
  // Check if cache has expired
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    responseCache.delete(cacheKey);
    return null;
  }
  
  return cached.response;
}

// Cache a response
export function cacheResponse(cacheKey, response) {
  // Cleanup old entries first
  cleanupExpiredEntries();
  enforceSizeLimit();
  
  responseCache.set(cacheKey, {
    response,
    timestamp: Date.now()
  });
}

// Cleanup expired entries
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      responseCache.delete(key);
    }
  }
}

// Enforce size limit
function enforceSizeLimit() {
  if (responseCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest 10% of entries
    const entriesToRemove = Math.floor(MAX_CACHE_SIZE * 0.1);
    const sortedEntries = Array.from(responseCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, entriesToRemove);
    
    sortedEntries.forEach(([key]) => responseCache.delete(key));
  }
}

// Get cache statistics
export function getCacheStats() {
  cleanupExpiredEntries();
  return {
    totalEntries: responseCache.size,
    maxEntries: MAX_CACHE_SIZE,
    ttlMinutes: CACHE_TTL / (60 * 1000),
    hitRate: 0 // Would need to track hits/misses to calculate this
  };
}

// Clear all cache
export function clearCache() {
  const size = responseCache.size;
  responseCache.clear();
  return size;
}

// Manual cleanup
export function manualCleanup() {
  const beforeSize = responseCache.size;
  cleanupExpiredEntries();
  const afterSize = responseCache.size;
  return { beforeSize, afterSize, cleaned: beforeSize - afterSize };
}

// Cache middleware for Express
export function cacheMiddleware(req, res, next) {
  if (!isCacheable(req.body)) {
    return next();
  }
  
  const cacheKey = generateCacheKey(req.body);
  const cachedResponse = getCachedResponse(cacheKey);
  
  if (cachedResponse) {
    console.log(`🎯 Cache hit for key: ${cacheKey.substring(0, 8)}...`);
    return res.json(cachedResponse);
  }
  
  // Store original send function
  const originalSend = res.json;
  
  // Override send to cache the response
  res.json = function(data) {
    if (res.statusCode === 200) {
      cacheResponse(cacheKey, data);
      console.log(`💾 Cached response for key: ${cacheKey.substring(0, 8)}...`);
    }
    return originalSend.call(this, data);
  };
  
  next();
} 