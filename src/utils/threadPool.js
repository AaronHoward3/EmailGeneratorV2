import OpenAI from "openai";
import { createLogger } from './logger.js';

const logger = createLogger('ThreadPool');

class ThreadPool {
  constructor(maxThreads = 10) {
    this.threads = [];
    this.maxThreads = maxThreads;
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.activeThreads = new Set();
    this.creationPromises = new Map(); // Track thread creation promises
    this.lastCleanup = Date.now();
    
    // logger.info('Thread pool initialized', { maxThreads });
  }
  
  async getThread() {
    const startTime = performance.now();
    
    // Return existing thread if available
    if (this.threads.length > 0) {
      const thread = this.threads.pop();
      this.activeThreads.add(thread.id);
      
      // const duration = performance.now() - startTime;
      // logger.threadPoolOperation('get_existing', thread.id, duration, {
      //   availableThreads: this.threads.length,
      //   activeThreads: this.activeThreads.size
      // });
      
      return thread;
    }
    
    // Create new thread if under limit
    if (this.activeThreads.size < this.maxThreads) {
      // Check if we're already creating a thread
      if (this.creationPromises.has('creating')) {
        // Wait for the existing creation promise
        logger.debug('Waiting for existing thread creation');
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
        
        // const duration = performance.now() - startTime;
        // logger.threadPoolOperation('create_new', thread.id, duration, {
        //   activeThreads: this.activeThreads.size,
        //   maxThreads: this.maxThreads
        // });
        
        return thread;
      } finally {
        this.creationPromises.delete('creating');
      }
    }
    
    // Wait for a thread to become available with timeout
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const duration = performance.now() - startTime;
        logger.error('Thread pool timeout', {
          duration: `${duration.toFixed(2)}ms`,
          activeThreads: this.activeThreads.size,
          maxThreads: this.maxThreads
        });
        reject(new Error('Thread pool timeout - no threads available'));
      }, 10000);
      
      const checkForThread = () => {
        if (this.threads.length > 0) {
          clearTimeout(timeout);
          const thread = this.threads.pop();
          this.activeThreads.add(thread.id);
          
          const duration = performance.now() - startTime;
          logger.threadPoolOperation('get_waiting', thread.id, duration, {
            waitTime: `${duration.toFixed(2)}ms`
          });
          
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
    const startTime = performance.now();
    
    if (this.activeThreads.has(thread.id)) {
      this.activeThreads.delete(thread.id);
      
      if (this.threads.length < this.maxThreads) {
        this.threads.push(thread);
        
        const duration = performance.now() - startTime;
        logger.threadPoolOperation('return_to_pool', thread.id, duration, {
          availableThreads: this.threads.length,
          activeThreads: this.activeThreads.size
        });
      } else {
        // Delete thread if pool is full
        this.openai.beta.threads.del(thread.id).catch(error => {
          logger.error('Failed to delete thread', { threadId: thread.id, error: error.message });
        });
        
        const duration = performance.now() - startTime;
        logger.threadPoolOperation('delete_full_pool', thread.id, duration, {
          availableThreads: this.threads.length,
          maxThreads: this.maxThreads
        });
      }
    } else {
      logger.warn('Attempted to return thread not in active set', { threadId: thread.id });
    }
  }
  
  async cleanup() {
    const startTime = performance.now();
    logger.info('Starting thread pool cleanup');
    
    // Delete all threads in pool with timeout
    const deletePromises = this.threads.map(thread => 
      Promise.race([
        this.openai.beta.threads.del(thread.id),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]).catch(error => {
        logger.error('Failed to delete thread during cleanup', { 
          threadId: thread.id, 
          error: error.message 
        });
      })
    );
    
    await Promise.all(deletePromises);
    const deletedCount = this.threads.length;
    this.threads = [];
    this.activeThreads.clear();
    this.creationPromises.clear();
    
    const duration = performance.now() - startTime;
    logger.info('Thread pool cleanup completed', { 
      deletedCount, 
      duration: `${duration.toFixed(2)}ms` 
    });
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
          this.openai.beta.threads.del(thread.id).catch(error => {
            logger.error('Failed to delete thread during periodic cleanup', { 
              threadId: thread.id, 
              error: error.message 
            });
          })
        );
        await Promise.all(deletePromises);
        
        logger.info('Periodic thread pool cleanup completed', { 
          deletedCount: threadsToDelete.length,
          remainingThreads: this.threads.length
        });
      }
    }
  }
  
  getStats() {
    const stats = {
      availableThreads: this.threads.length,
      activeThreads: this.activeThreads.size,
      maxThreads: this.maxThreads,
      utilization: (this.activeThreads.size / this.maxThreads) * 100,
      creationInProgress: this.creationPromises.size > 0
    };
    
    logger.debug('Thread pool statistics', stats);
    
    return stats;
  }
}

// Singleton instance
let threadPoolInstance = null;

export const getThreadPool = (maxThreads = 10) => {
  if (!threadPoolInstance) {
    threadPoolInstance = new ThreadPool(maxThreads);
    
    // Set up periodic cleanup
    setInterval(() => {
      threadPoolInstance.periodicCleanup().catch(error => {
        logger.error('Periodic cleanup failed', { error: error.message });
      });
    }, 60000); // Check every minute
    
    // logger.info('Thread pool singleton created', { maxThreads });
  }
  return threadPoolInstance;
};

export const cleanupThreadPool = async () => {
  if (threadPoolInstance) {
    logger.info('Cleaning up thread pool singleton');
    await threadPoolInstance.cleanup();
    threadPoolInstance = null;
  }
}; 