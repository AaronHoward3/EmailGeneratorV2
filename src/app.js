import express from "express";
import dotenv from "dotenv";
import emailRoutes from "./routes/emailRoutes.js";
import brandRoutes from "./routes/brandRoutes.js";

dotenv.config();

const app = express();

app.use(express.json());

// Routes
app.use("/", emailRoutes);
app.use("/api", brandRoutes);

export default app; 