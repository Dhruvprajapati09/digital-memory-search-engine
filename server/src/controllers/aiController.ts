import { Request, Response } from "express";
import { asyncHandler, AppError } from "../middleware/error.middleware";
import { generateAnswer } from "../services/ai/answerService";
import { summarizeDocument } from "../services/ai/summarizer";
import type { AskRequest } from "../types/ai";

export const askHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const body = req.body as AskRequest;

  const documentIds = Array.isArray(body.documentIds)
    ? body.documentIds.filter((id) => typeof id === "string")
    : undefined;

  const result = await generateAnswer(req.user._id.toString(), {
    question: body.question,
    topK: typeof body.topK === "number" ? body.topK : undefined,
    documentIds,
  });

  res.status(200).json(result);
});

export const summaryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { documentId } = req.params;

    if (!documentId || typeof documentId !== "string") {
      throw new AppError("Document ID is required", 400);
    }

    const result = await summarizeDocument(
      req.user._id.toString(),
      documentId
    );

    res.status(200).json(result);
  }
);
