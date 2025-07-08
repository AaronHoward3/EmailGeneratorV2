import OpenAI from "openai";

class ThreadPool {
  constructor(maxThreads = 10) {
    this.threads = [];
    this.maxThreads = maxThreads;
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.activeThreads = new Set();
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
      const thread = await this.openai.beta.threads.create();
      this.activeThreads.add(thread.id);
      return thread;
    }
    
    // Wait for a thread to become available
    return new Promise((resolve) => {
      const checkForThread = () => {
        if (this.threads.length > 0) {
          const thread = this.threads.pop();
          this.activeThreads.add(thread.id);
          resolve(thread);
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
    // Delete all threads in pool
    const deletePromises = this.threads.map(thread => 
      this.openai.beta.threads.del(thread.id).catch(console.error)
    );
    await Promise.all(deletePromises);
    this.threads = [];
    this.activeThreads.clear();
  }
  
  getStats() {
    return {
      availableThreads: this.threads.length,
      activeThreads: this.activeThreads.size,
      maxThreads: this.maxThreads,
      utilization: (this.activeThreads.size / this.maxThreads) * 100
    };
  }
}

// Singleton instance
let threadPoolInstance = null;

export const getThreadPool = (maxThreads = 10) => {
  if (!threadPoolInstance) {
    threadPoolInstance = new ThreadPool(maxThreads);
  }
  return threadPoolInstance;
};

export const cleanupThreadPool = async () => {
  if (threadPoolInstance) {
    await threadPoolInstance.cleanup();
    threadPoolInstance = null;
  }
}; 