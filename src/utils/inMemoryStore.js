const store = new Map();

// Save or update a specific MJML at an index for a job
export const saveMJML = (jobId, index, mjml) => {
  if (mjml === undefined) {
    throw new Error(
      `saveMJML requires 3 parameters: jobId, index, mjml. Got: ${arguments.length}`
    );
  }

  const current = store.get(jobId) || [];
  current[index] = mjml;
  store.set(jobId, current);

  console.log(
    `📦 Saved MJML for job ${jobId} at index ${index} (length: ${mjml.length} chars)`
  );
};

// Get all MJMLs for a job (returns an array)
export const getMJML = (jobId) => {
  const result = store.get(jobId) || [];
  console.log(`📦 Retrieved ${result.length} MJMLs for job ${jobId}`);
  return result;
};

// Update a specific MJML at a given index
export const updateMJML = (jobId, index, updatedMJML) => {
  const current = store.get(jobId) || [];
  const oldLength = current[index]?.length || 0;
  current[index] = updatedMJML;
  store.set(jobId, current);

  console.log(
    `🔄 Updated MJML for job ${jobId} at index ${index} (${oldLength} -> ${updatedMJML.length} chars)`
  );
};

// Delete all MJMLs for a job
export const deleteMJML = (jobId) => {
  const existed = store.has(jobId);
  store.delete(jobId);
  console.log(`🗑️ Deleted MJMLs for job ${jobId} (existed: ${existed})`);
};

// Debug function to see what's in the store
export const debugStore = () => {
  console.log("📦 Current store contents:");
  for (const [jobId, mjmls] of store.entries()) {
    console.log(`  Job ${jobId}: ${mjmls.length} MJMLs`);
    mjmls.forEach((mjml, index) => {
      const preview = mjml ? mjml.substring(0, 50) + "..." : "null";
      console.log(`    [${index}]: ${preview}`);
    });
  }
};
