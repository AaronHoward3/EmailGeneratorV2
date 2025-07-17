import express from "express";
import cors from "cors";
import emailRoutes from "./routes/emailRoutes.js";
import brandRoutes from "./routes/brandRoutes.js";
import { cacheMiddleware } from "./utils/responseCache.js";

const app = express();

// Basic concurrency limiting (only for non-Lambda environments)
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = process.env.NODE_ENV === 'production' ? 30 : 20;

// Only apply concurrency limiting if not in Lambda
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.use((req, res, next) => {
    if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
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
    app.use(compression.default());
  } catch (error) {
    console.log('Compression not available, continuing without it');
  }
}

// Root health check for Amplify
app.get("/", (req, res) => {
  res.json({ 
    status: "healthy", 
    service: "SBEmailGenerator API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    isLambda: !!process.env.AWS_LAMBDA_FUNCTION_NAME,
    activeRequests: process.env.AWS_LAMBDA_FUNCTION_NAME ? "N/A (Lambda)" : activeRequests,
    maxConcurrentRequests: process.env.AWS_LAMBDA_FUNCTION_NAME ? "N/A (Lambda)" : MAX_CONCURRENT_REQUESTS
  });
});

// Routes with response caching for email generation
app.use("/api", emailRoutes);
app.use("/api", brandRoutes);

app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    activeRequests,
    maxConcurrentRequests: MAX_CONCURRENT_REQUESTS
  });
});

export default app; 