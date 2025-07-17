import OpenAI from "openai";

class ThreadPool {
  constructor(maxThreads = 10) {
    this.threads = [];
    this.maxThreads = maxThreads;
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.activeThreads = new Set();
    this.creationPromises = new Map(); // Track thread creation promises
    this.lastCleanup = Date.now();
  }
  
  async getThread() {
    // Return existing thread if available
    if (this.threads.length > 0) {
      const thread = this.threads.pop();
      this.activeThreads.add(thread.id);
      return thread;
    }
    
    // Create new thread if under limit
    if (this.activeThreads.size < this.maxThreads) {
      // Check if we're already creating a thread
      if (this.creationPromises.has('creating')) {
        // Wait for the existing creation promise
        return this.creationPromises.get('creating');
      }
      
      // Create new thread with timeout
      const creationPromise = Promise.race([
        this.openai.beta.threads.create(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Thread creation timeout')), 5000)
        )
      ]);
      
      this.creationPromises.set('creating', creationPromise);
      
      try {
        const thread = await creationPromise;
        this.activeThreads.add(thread.id);
        return thread;
      } finally {
        this.creationPromises.delete('creating');
      }
    }
    
    // Wait for a thread to become available with timeout
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Thread pool timeout - no threads available'));
      }, 10000);
      
      const checkForThread = () => {
        if (this.threads.length > 0) {
          clearTimeout(timeout);
          const thread = this.threads.pop();
          this.activeThreads.add(thread.id);
          resolve(thread);
        } else if (this.activeThreads.size < this.maxThreads) {
          // Try to create a new thread
          this.getThread().then(resolve).catch(reject);
        } else {
          setTimeout(checkForThread, 100);
        }
      };
      checkForThread();
    });
  }
  
  returnThread(thread) {
    if (this.activeThreads.has(thread.id)) {
      this.activeThreads.delete(thread.id);
      
      if (this.threads.length < this.maxThreads) {
        this.threads.push(thread);
      } else {
        // Delete thread if pool is full
        this.openai.beta.threads.del(thread.id).catch(console.error);
      }
    }
  }
  
  async cleanup() {
    // Delete all threads in pool with timeout
    const deletePromises = this.threads.map(thread => 
      Promise.race([
        this.openai.beta.threads.del(thread.id),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]).catch(console.error)
    );
    
    await Promise.all(deletePromises);
    this.threads = [];
    this.activeThreads.clear();
    this.creationPromises.clear();
  }
  
  // Periodic cleanup to prevent memory leaks
  async periodicCleanup() {
    const now = Date.now();
    if (now - this.lastCleanup > 300000) { // Every 5 minutes
      this.lastCleanup = now;
      
      // Clean up some old threads if we have too many
      if (this.threads.length > this.maxThreads / 2) {
        const threadsToDelete = this.threads.splice(0, Math.floor(this.threads.length / 2));
        const deletePromises = threadsToDelete.map(thread => 
          this.openai.beta.threads.del(thread.id).catch(console.error)
        );
        await Promise.all(deletePromises);
        console.log(`🧹 Thread pool cleanup: deleted ${threadsToDelete.length} threads`);
      }
    }
  }
  
  getStats() {
    return {
      availableThreads: this.threads.length,
      activeThreads: this.activeThreads.size,
      maxThreads: this.maxThreads,
      utilization: (this.activeThreads.size / this.maxThreads) * 100,
      creationInProgress: this.creationPromises.size > 0
    };
  }
}

// Singleton instance
let threadPoolInstance = null;

export const getThreadPool = (maxThreads = 10) => {
  if (!threadPoolInstance) {
    threadPoolInstance = new ThreadPool(maxThreads);
    
    // Set up periodic cleanup
    setInterval(() => {
      threadPoolInstance.periodicCleanup().catch(console.error);
    }, 60000); // Check every minute
  }
  return threadPoolInstance;
};

export const cleanupThreadPool = async () => {
  if (threadPoolInstance) {
    await threadPoolInstance.cleanup();
    threadPoolInstance = null;
  }
}; 