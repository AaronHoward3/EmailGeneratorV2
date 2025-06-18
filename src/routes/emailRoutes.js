import express from "express";
import { generateEmails } from "../controllers/emailController.js";

const router = express.Router();

router.post("/generate-emails", generateEmails);

export default router; 