import express from "express";
import { protect } from "../middleware/auth.middleware";
import { askHandler, summaryHandler } from "../controllers/aiController";

const router = express.Router();

router.use(protect);

/** Ask a natural-language question against indexed documents */
router.post("/ask", askHandler);

/** Generate a structured summary for a specific document */
router.post("/summary/:documentId", summaryHandler);

export default router;
