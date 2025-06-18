import express from "express";
import cors from "cors";
import emailRoutes from "./routes/emailRoutes.js";
import brandRoutes from "./routes/brandRoutes.js";

const app = express();

// Basic concurrency limiting
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 5;

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

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Root health check for Amplify
app.get("/", (req, res) => {
  res.json({ 
    status: "healthy", 
    service: "SBEmailGenerator API",
    version: "1.0.0",
    activeRequests,
    maxConcurrentRequests: MAX_CONCURRENT_REQUESTS
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