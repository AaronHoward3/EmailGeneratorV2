import express from "express";
import cors from "cors";
import emailRoutes from "./routes/emailRoutes.js";
import brandRoutes from "./routes/brandRoutes.js";
import { requestContext, createLogger } from "./utils/logger.js";

const app = express();
const logger = createLogger('App');

// Basic concurrency limiting (only for non-Lambda environments)
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = process.env.NODE_ENV === 'production' ? 30 : 20;

// Add request context middleware for logging
app.use(requestContext);

// Only apply concurrency limiting if not in Lambda
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.use((req, res, next) => {
    if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
      logger.warn('Server at capacity', {
        activeRequests,
        maxConcurrentRequests: MAX_CONCURRENT_REQUESTS,
        requestId: req.headers['x-request-id']
      });
      return res.status(503).json({
        error: "Server is busy. Please try again in a moment.",
        retryAfter: 30
      });
    }
    
    activeRequests++;
    
    res.on('finish', () => {
      activeRequests--;
    });
    
    next();
  });
}

// Optimize CORS for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://mjml-generator-service.springbot.com', 'https://springbot.com']
    : true,
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Optimize JSON parsing
app.use(express.json({ 
  limit: "10mb",
  strict: true,
  type: 'application/json'
}));

// Add compression for production
if (process.env.NODE_ENV === 'production') {
  try {
    const compression = await import('compression');
    app.use(
      compression.default({
        // 🚫 Never compress SSE, or proxies will buffer it
        filter: (req, res) => {
          const isSse =
            (req.headers.accept || "").includes("text/event-stream") ||
            String(req.query.stream) === "1";
          if (isSse) return false;
          return compression.default.filter(req, res);
        }
      })
    );
    logger.info('Compression middleware enabled (SSE disabled)');
  } catch (error) {
    logger.warn('Compression not available, continuing without it', { error: error.message });
  }
}

// Root health check for Amplify
app.get("/", (req, res) => {
  const startTime = performance.now();
  
  const healthData = { 
    status: "healthy", 
    service: "SBEmailGenerator API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    isLambda: !!process.env.AWS_LAMBDA_FUNCTION_NAME,
    activeRequests: process.env.AWS_LAMBDA_FUNCTION_NAME ? "N/A (Lambda)" : activeRequests,
    maxConcurrentRequests: process.env.AWS_LAMBDA_FUNCTION_NAME ? "N/A (Lambda)" : MAX_CONCURRENT_REQUESTS
  };
  
  const duration = performance.now() - startTime;
  logger.performance('Health check', duration, { requestId: req.headers['x-request-id'] });
  
  res.json(healthData);
});

// Routes with response caching for email generation
app.use("/api", emailRoutes);
app.use("/api", brandRoutes);

app.get("/health", (req, res) => {
  const startTime = performance.now();
  
  const healthData = { 
    status: "healthy", 
    activeRequests,
    maxConcurrentRequests: MAX_CONCURRENT_REQUESTS
  };
  
  const duration = performance.now() - startTime;
  logger.performance('Health endpoint', duration, { requestId: req.headers['x-request-id'] });
  
  res.json(healthData);
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error', {
    requestId: req.headers['x-request-id'],
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({ 
    error: 'Internal server error',
    requestId: req.headers['x-request-id']
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn('Route not found', {
    requestId: req.headers['x-request-id'],
    url: req.url,
    method: req.method
  });
  
  res.status(404).json({ 
    error: 'Route not found',
    requestId: req.headers['x-request-id']
  });
});

export default app; 