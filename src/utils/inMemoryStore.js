const store = new Map();

// Save or update a specific MJML at an index for a job
export const saveMJML = (jobId, index, mjml) => {
  const current = store.get(jobId) || [];
  current[index] = mjml;
  store.set(jobId, current);
};

// Get all MJMLs for a job (returns an array)
export const getMJML = (jobId) => {
  return store.get(jobId) || [];
};

// Update a specific MJML at a given index
export const updateMJML = (jobId, index, updatedMJML) => {
  const current = store.get(jobId) || [];
  current[index] = updatedMJML;
  store.set(jobId, current);
};

// Delete all MJMLs for a job
export const deleteMJML = (jobId) => {
  store.delete(jobId);
};
