const store = new Map();
const TTL = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 1000;

// Cleanup function to remove expired entries
const cleanupExpiredEntries = () => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now - value.timestamp > TTL) {
      store.delete(key);
    }
  }
};

// Cleanup function to limit total entries
const enforceSizeLimit = () => {
  if (store.size >= MAX_ENTRIES) {
    // Remove oldest entries (first 10% of entries)
    const entriesToRemove = Math.floor(MAX_ENTRIES * 0.1);
    const keys = Array.from(store.keys()).slice(0, entriesToRemove);
    keys.forEach(key => store.delete(key));
  }
};

// Save or update a specific MJML at an index for a job
export const saveMJML = (...args) => {
  const [jobId, index, mjml] = args;
  if (jobId === undefined || index === undefined || mjml === undefined) {
    throw new Error(
      `saveMJML requires 3 parameters: jobId, index, mjml. Got: ${args.length}`
    );
  }

  // Cleanup before adding new entry
  cleanupExpiredEntries();
  enforceSizeLimit();

  const entry = store.get(jobId);
  const current = entry ? entry.mjmls || [] : [];
  current[index] = mjml;
  store.set(jobId, { 
    mjmls: current, 
    timestamp: Date.now() 
  });
};

// Get all MJMLs for a job (returns an array)
export const getMJML = (jobId) => {
  const entry = store.get(jobId);
  if (!entry) return [];
  
  // Check if entry has expired
  if (Date.now() - entry.timestamp > TTL) {
    store.delete(jobId);
    return [];
  }
  
  return entry.mjmls || [];
};

// Update a specific MJML at a given index
export const updateMJML = (jobId, index, updatedMJML) => {
  const entry = store.get(jobId);
  if (!entry) {
    throw new Error(`Job ${jobId} not found in store`);
  }
  
  // Check if entry has expired
  if (Date.now() - entry.timestamp > TTL) {
    store.delete(jobId);
    throw new Error(`Job ${jobId} has expired`);
  }
  
  const current = entry.mjmls || [];
  const oldLength = current[index]?.length || 0;
  current[index] = updatedMJML;
  
  // Update timestamp to extend TTL
  store.set(jobId, { 
    mjmls: current, 
    timestamp: Date.now() 
  });
};

// Delete all MJMLs for a job
export const deleteMJML = (jobId) => {
  const existed = store.has(jobId);
  store.delete(jobId);
  return existed;
};

// Get store statistics
export const getStoreStats = () => {
  cleanupExpiredEntries();
  return {
    totalEntries: store.size,
    maxEntries: MAX_ENTRIES,
    ttlMinutes: TTL / (60 * 1000)
  };
};

// Manual cleanup function for testing/debugging
export const manualCleanup = () => {
  const beforeSize = store.size;
  cleanupExpiredEntries();
  const afterSize = store.size;
  return { beforeSize, afterSize, cleaned: beforeSize - afterSize };
};

// Debug function to see what's in the store
export const debugStore = () => {
  cleanupExpiredEntries();
  console.log("📦 Current store contents:");
  console.log(`📊 Store stats: ${store.size}/${MAX_ENTRIES} entries, TTL: ${TTL/1000}s`);
  
  for (const [jobId, entry] of store.entries()) {
    const age = Math.floor((Date.now() - entry.timestamp) / 1000);
    const mjmls = entry.mjmls || [];
    console.log(`  Job ${jobId} (age: ${age}s): ${mjmls.length} MJMLs`);
    mjmls.forEach((mjml, index) => {
      const preview = mjml ? mjml.substring(0, 50) + "..." : "null...";
      console.log(`    [${index}]: ${preview}`);
    });
  }
};
