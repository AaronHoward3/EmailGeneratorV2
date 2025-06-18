import express from "express";
import cors from "cors";
import emailRoutes from "./routes/emailRoutes.js";
import brandRoutes from "./routes/brandRoutes.js";

const app = express();

// Basic concurrency limiting (only for non-Lambda environments)
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 20;

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

app.use(cors());
app.use(express.json({ limit: "10mb" }));

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

// Routes
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