import express from "express";
import { protect } from "../middleware/auth.middleware";
import {
  askInConversationHandler,
  askQuestionHandler,
  createConversationHandler,
  deleteConversationHandler,
  getConversationHandler,
  listConversationsHandler,
} from "../controllers/chatController";

const router = express.Router();

router.use(protect);

/** RAG chat — one-shot ask (legacy; no persistence) */
router.post("/ask", askQuestionHandler);

/** Conversation CRUD + ask-with-persist */
router.get("/conversations", listConversationsHandler);
router.post("/conversations", createConversationHandler);
router.get("/conversations/:id", getConversationHandler);
router.delete("/conversations/:id", deleteConversationHandler);
router.post("/conversations/:id/ask", askInConversationHandler);

export default router;
