const store = new Map();

// Save or update a specific MJML at an index for a job
export const saveMJML = (...args) => {
  const [jobId, index, mjml] = args;
  if (jobId === undefined || index === undefined || mjml === undefined) {
    throw new Error(
      `saveMJML requires 3 parameters: jobId, index, mjml. Got: ${args.length}`
    );
  }

  const current = store.get(jobId) || [];
  current[index] = mjml;
  store.set(jobId, current);
};

// Get all MJMLs for a job (returns an array)
export const getMJML = (jobId) => {
  const result = store.get(jobId) || [];
  return result;
};

// Update a specific MJML at a given index
export const updateMJML = (jobId, index, updatedMJML) => {
  const current = store.get(jobId) || [];
  const oldLength = current[index]?.length || 0;
  current[index] = updatedMJML;
  store.set(jobId, current);
};

// Delete all MJMLs for a job
export const deleteMJML = (jobId) => {
  const existed = store.has(jobId);
  store.delete(jobId);
};

// Debug function to see what's in the store
export const debugStore = () => {
  console.log("📦 Current store contents:");
  for (const [jobId, mjmls] of store.entries()) {
    console.log(`  Job ${jobId}: ${mjmls.length} MJMLs`);
    mjmls.forEach((mjml, index) => {
      const preview = mjml ? mjml.substring(0, 50) + "..." : "null...";
      console.log(`    [${index}]: ${preview}`);
    });
  }
};
