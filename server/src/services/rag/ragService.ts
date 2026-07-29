import { generateAnswer } from "../ai/answerService";
import type { ChatRequest, ChatResponse, ChatSource } from "../../types/chat";

/**
 * RAG pipeline wrapper — delegates to the modular AI answer service
 * and maps the response to the legacy chat API shape.
 */
export async function generateRagAnswer(
  userId: string,
  request: ChatRequest
): Promise<ChatResponse> {
  const result = await generateAnswer(userId, {
    question: request.question,
    topK: request.topK,
    documentIds: request.documentIds,
  });

  const sources: ChatSource[] = result.sources.map((source) => ({
    documentId: source.documentId,
    chunkIndex: source.chunkIndex,
    topic: source.topic,
    title: source.title,
    score: source.score,
    preview: source.highlightedText,
  }));

  return {
    success: result.success,
    question: request.question.trim(),
    answer: result.answer,
    model: result.model,
    sources,
    noResults: result.noResults,
  };
}
