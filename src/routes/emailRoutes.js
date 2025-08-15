import express from "express";
import { generateEmails } from "../controllers/emailController.js"; // NOTE: only generateEmails

const router = express.Router();

// One route supports both JSON and SSE.
// - JSON: normal POST with Accept: application/json
// - SSE : POST with Accept: text/event-stream  (Irios now does this)
router.post("/generate-emails", generateEmails);

export default router;
