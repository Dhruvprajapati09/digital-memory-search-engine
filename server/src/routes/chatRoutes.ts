import express from "express";
import { protect } from "../middleware/auth.middleware";
import { askQuestionHandler } from "../controllers/chatController";

const router = express.Router();

router.use(protect);

/** RAG chat — retrieve context from Pinecone and generate answer with Mistral */
router.post("/ask", askQuestionHandler);

export default router;
