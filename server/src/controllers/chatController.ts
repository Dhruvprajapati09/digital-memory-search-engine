import { Request, Response } from "express";
import { asyncHandler, AppError } from "../middleware/error.middleware";
import { generateRagAnswer } from "../services/rag/ragService";
import type { ChatRequest } from "../types/chat";

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

    const result = await generateRagAnswer(req.user._id.toString(), {
      question: body.question,
      documentIds,
      topK: typeof body.topK === "number" ? body.topK : undefined,
    });

    res.status(200).json(result);
  }
);
