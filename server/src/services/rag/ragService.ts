import { generateChatCompletion } from "../ai/aiService";
import {
  retrieveRelevantChunks,
  buildContextFromChunks,
} from "../retrieval/retrievalService";
import { env } from "../../config/env";
import { AppError } from "../../middleware/error.middleware";
import type { ChatRequest, ChatResponse, ChatSource, RetrievedChunk } from "../../types/chat";

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions based ONLY on the provided context from the user's indexed documents.

Rules:
- Answer using only information found in the context below.
- If the context does not contain enough information to answer, say "I don't have enough information in your documents to answer that question."
- Cite specific details from the context when possible.
- Be concise and accurate.
- Do not invent facts not present in the context.`;

/**
 * RAG pipeline: retrieve relevant chunks → build context → generate answer with Mistral.
 */
export async function generateRagAnswer(
  userId: string,
  request: ChatRequest
): Promise<ChatResponse> {
  const question = request.question.trim();

  if (!question) {
    throw new AppError("Question is required", 400);
  }

  if (question.length > 2000) {
    throw new AppError("Question must be at most 2000 characters", 400);
  }

  let retrieval;

  try {
    retrieval = await retrieveRelevantChunks({
      userId,
      query: question,
      limit: request.topK ?? env.RAG_TOP_K,
      minScore: env.RAG_MIN_SCORE,
      documentIds: request.documentIds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("PINECONE") || message.includes("Pinecone")) {
      throw new AppError(`Vector database error: ${message}`, 503);
    }

    if (message.includes("Mistral") || message.includes("MISTRAL")) {
      throw new AppError(`AI service error: ${message}`, 502);
    }

    throw new AppError(`Retrieval failed: ${message}`, 500);
  }

  const { chunks } = retrieval;

  if (chunks.length === 0) {
    return {
      success: true,
      question,
      answer:
        "I couldn't find any relevant information in your indexed documents to answer this question. Try uploading and indexing more documents, or rephrase your question.",
      model: env.MISTRAL_CHAT_MODEL,
      sources: [],
      noResults: true,
    };
  }

  const context = buildContextFromChunks(chunks);

  const sources: ChatSource[] = chunks.map((chunk: RetrievedChunk) => ({
    documentId: chunk.metadata.documentId,
    chunkIndex: chunk.metadata.chunkIndex,
    topic: chunk.topic,
    title: chunk.title,
    score: Math.round(chunk.score * 100) / 100,
    preview: chunk.contentPreview ?? chunk.text.slice(0, 200),
  }));

  let completion;

  try {
    completion = await generateChatCompletion(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Context from indexed documents:\n\n${context}\n\n---\n\nQuestion: ${question}`,
        },
      ],
      { temperature: 0.2, maxTokens: 1024 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AppError(`Failed to generate answer: ${message}`, 502);
  }

  return {
    success: true,
    question,
    answer: completion.answer,
    model: completion.model,
    sources,
    noResults: false,
  };
}
