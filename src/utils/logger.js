import { performance } from 'perf_hooks';

// Log levels
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

// Current log level (can be set via environment variable)
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase() || 'INFO'];

class Logger {
  constructor(module) {
    this.module = module;
    this.startTime = Date.now();
  }

  // Format timestamp for CloudWatch
  formatTimestamp() {
    return new Date().toISOString();
  }

  // Create structured log entry
  createLogEntry(level, message, data = {}) {
    const logEntry = {
      timestamp: this.formatTimestamp(),
      level: level,
      module: this.module,
      message: message,
      uptime: Date.now() - this.startTime,
      memory: process.memoryUsage(),
      ...data
    };

    // Add request context if available
    if (global.currentRequestId) {
      logEntry.requestId = global.currentRequestId;
    }

    return logEntry;
  }

  // Log with performance timing
  logWithTiming(level, message, data = {}, startTime = null) {
    if (startTime) {
      const duration = performance.now() - startTime;
      data.duration = `${duration.toFixed(2)}ms`;
    }

    const logEntry = this.createLogEntry(level, message, data);
    
    if (currentLogLevel >= LOG_LEVELS[level]) {
      console.log(JSON.stringify(logEntry));
    }
  }

  // Performance tracking wrapper
  async trackPerformance(operation, fn, additionalData = {}) {
    const startTime = performance.now();
    const operationId = `${this.module}_${operation}_${Date.now()}`;
    
    this.logWithTiming('INFO', `Starting ${operation}`, {
      operationId,
      operation,
      ...additionalData
    });

    try {
      const result = await fn();
      
      this.logWithTiming('INFO', `Completed ${operation}`, {
        operationId,
        operation,
        success: true,
        ...additionalData
      }, startTime);
      
      return result;
    } catch (error) {
      this.logWithTiming('ERROR', `Failed ${operation}`, {
        operationId,
        operation,
        success: false,
        error: error.message,
        stack: error.stack,
        ...additionalData
      }, startTime);
      
      throw error;
    }
  }

  // Standard log methods
  error(message, data = {}) {
    this.logWithTiming('ERROR', message, data);
  }

  warn(message, data = {}) {
    this.logWithTiming('WARN', message, data);
  }

  info(message, data = {}) {
    this.logWithTiming('INFO', message, data);
  }

  debug(message, data = {}) {
    this.logWithTiming('DEBUG', message, data);
  }

  trace(message, data = {}) {
    this.logWithTiming('TRACE', message, data);
  }

  // Performance-specific logging
  performance(operation, duration, data = {}) {
    this.logWithTiming('INFO', `Performance: ${operation}`, {
      operation,
      duration: `${duration.toFixed(2)}ms`,
      ...data
    });
  }

  // Memory usage logging
  memoryUsage(context = '') {
    const memUsage = process.memoryUsage();
    this.info(`Memory usage ${context}`, {
      rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`,
      heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      external: `${(memUsage.external / 1024 / 1024).toFixed(2)}MB`
    });
  }

  // Request-specific logging
  requestStart(requestId, method, url, data = {}) {
    global.currentRequestId = requestId;
    this.info(`Request started`, {
      requestId,
      method,
      url,
      userAgent: data.userAgent,
      ip: data.ip
    });
  }

  requestEnd(requestId, statusCode, duration, data = {}) {
    this.info(`Request completed`, {
      requestId,
      statusCode,
      duration: `${duration.toFixed(2)}ms`,
      ...data
    });
    global.currentRequestId = null;
  }

  // API call logging
  apiCall(service, operation, duration, success, data = {}) {
    this.info(`API call: ${service}.${operation}`, {
      service,
      operation,
      duration: `${duration.toFixed(2)}ms`,
      success,
      ...data
    });
  }

  // Cache operations logging
  cacheOperation(operation, key, hit, duration, data = {}) {
    this.debug(`Cache ${operation}`, {
      operation,
      key: key?.substring(0, 50), // Truncate long keys
      hit,
      duration: `${duration.toFixed(2)}ms`,
      ...data
    });
  }

  // Thread pool logging
  threadPoolOperation(operation, threadId, duration, data = {}) {
    this.debug(`Thread pool ${operation}`, {
      operation,
      threadId,
      duration: `${duration.toFixed(2)}ms`,
      ...data
    });
  }

  // File operation logging
  fileOperation(operation, path, duration, success, data = {}) {
    this.debug(`File ${operation}`, {
      operation,
      path: path?.substring(0, 100), // Truncate long paths
      duration: `${duration.toFixed(2)}ms`,
      success,
      ...data
    });
  }
}

// Create logger instances for different modules
export const createLogger = (module) => new Logger(module);

// Global performance tracking
export const performanceTracker = {
  marks: new Map(),
  
  mark(name) {
    this.marks.set(name, performance.now());
  },
  
  measure(name) {
    const startTime = this.marks.get(name);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.marks.delete(name);
      return duration;
    }
    return null;
  },
  
  measureAndLog(logger, name, additionalData = {}) {
    const duration = this.measure(name);
    if (duration !== null) {
      logger.performance(name, duration, additionalData);
    }
    return duration;
  }
};

// Request context middleware
export const requestContext = (req, res, next) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  global.currentRequestId = requestId;
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  next();
}; 