import { Request, Response } from "express";
import { asyncHandler, AppError } from "../middleware/error.middleware";
import { generateRagAnswer } from "../services/rag/ragService";
import {
  askInConversation,
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
} from "../services/chat/chatService";
import { getConversationalResponse } from "../services/chat/conversationIntent";
import type { AskInConversationRequest, ChatRequest, CreateConversationRequest } from "../types/chat";

export const askQuestionHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const body = req.body as ChatRequest;

    if (!body.question || typeof body.question !== "string") {
      throw new AppError("Question is required", 400);
    }

    const documentIds = Array.isArray(body.documentIds)
      ? body.documentIds.filter((id) => typeof id === "string")
      : undefined;

    const conversationalResponse = getConversationalResponse(body.question);
    if (conversationalResponse) {
      res.status(200).json({
        success: true,
        question: body.question.trim(),
        answer: conversationalResponse.answer,
        model: "local",
        sources: [],
        noResults: false,
      });
      return;
    }

    const result = await generateRagAnswer(req.user._id.toString(), {
      question: body.question,
      documentIds,
      topK: typeof body.topK === "number" ? body.topK : undefined,
    });

    res.status(200).json(result);
  }
);

export const listConversationsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const conversations = await listConversations(req.user._id.toString());

    res.status(200).json({ success: true, conversations });
  }
);

export const createConversationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const body = req.body as CreateConversationRequest;
    const conversation = await createConversation(req.user._id.toString(), {
      documentIds: Array.isArray(body?.documentIds) ? body.documentIds : undefined,
      title: typeof body?.title === "string" ? body.title : undefined,
    });

    res.status(201).json({ success: true, conversation });
  }
);

export const getConversationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { id } = req.params;
    if (!id || typeof id !== "string") {
      throw new AppError("Conversation not found", 404);
    }

    const conversation = await getConversation(req.user._id.toString(), id);

    res.status(200).json({ success: true, conversation });
  }
);

export const deleteConversationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { id } = req.params;
    if (!id || typeof id !== "string") {
      throw new AppError("Conversation not found", 404);
    }

    await deleteConversation(req.user._id.toString(), id);

    res.status(200).json({ success: true });
  }
);

export const askInConversationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { id } = req.params;
    if (!id || typeof id !== "string") {
      throw new AppError("Conversation not found", 404);
    }

    const body = req.body as AskInConversationRequest;

    if (!body.question || typeof body.question !== "string") {
      throw new AppError("Question is required", 400);
    }

    const result = await askInConversation(
      req.user._id.toString(),
      id,
      body.question
    );

    res.status(200).json({
      success: true,
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage,
    });
  }
);
