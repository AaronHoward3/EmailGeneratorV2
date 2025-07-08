// Retry function with exponential backoff
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = i === maxRetries - 1;
      
      if (isLastAttempt) {
        console.error(`❌ Final retry attempt failed after ${maxRetries} attempts:`, error.message);
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, i);
      console.warn(`⚠️ Attempt ${i + 1} failed, retrying in ${delay}ms:`, error.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Retry function with custom retry conditions
export async function retryWithConditions(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    shouldRetry = (error) => true,
    onRetry = (error, attempt, delay) => {},
    onFinalError = (error) => {}
  } = options;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = i === maxRetries - 1;
      
      // Check if we should retry this error
      if (!shouldRetry(error)) {
        console.error(`❌ Non-retryable error:`, error.message);
        throw error;
      }
      
      if (isLastAttempt) {
        console.error(`❌ Final retry attempt failed after ${maxRetries} attempts:`, error.message);
        onFinalError(error);
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, i);
      onRetry(error, i + 1, delay);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Specific retry function for OpenAI API calls
export async function retryOpenAI(fn, maxRetries = 3) {
  return retryWithConditions(fn, {
    maxRetries,
    baseDelay: 1000,
    shouldRetry: (error) => {
      // Retry on rate limits, timeouts, and network errors
      const retryableErrors = [
        'rate_limit_exceeded',
        'timeout',
        'network_error',
        'server_error',
        'service_unavailable'
      ];
      
      return retryableErrors.some(errType => 
        error.message?.toLowerCase().includes(errType) ||
        error.code?.toLowerCase().includes(errType)
      );
    },
    onRetry: (error, attempt, delay) => {
      console.warn(`⚠️ OpenAI API attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
    },
    onFinalError: (error) => {
      console.error(`❌ OpenAI API failed after all retries:`, error.message);
    }
  });
}

// Retry function for file operations
export async function retryFileOperation(fn, maxRetries = 3) {
  return retryWithConditions(fn, {
    maxRetries,
    baseDelay: 500,
    shouldRetry: (error) => {
      // Retry on file system errors that might be temporary
      const retryableErrors = [
        'EBUSY',
        'EACCES',
        'ENOENT', // File might be created between attempts
        'ENOTEMPTY'
      ];
      
      return retryableErrors.includes(error.code);
    },
    onRetry: (error, attempt, delay) => {
      console.warn(`⚠️ File operation attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
    }
  });
}

// Utility to create a retryable function wrapper
export function createRetryable(fn, options = {}) {
  return async (...args) => {
    return retryWithBackoff(() => fn(...args), options.maxRetries, options.baseDelay);
  };
} 