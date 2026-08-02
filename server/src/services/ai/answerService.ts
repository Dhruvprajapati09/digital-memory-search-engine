import { generateChatCompletion } from "./aiService";
import {
  buildContext,
  buildChunkDetails,
  buildSourcesFromChunks,
} from "./contextBuilder";
import {
  buildAnswerMessages,
  NO_ANSWER_MESSAGE,
  QuestionValidationError,
  validateQuestion,
} from "./promptBuilder";
import { detectResponsePlan } from "./responsePlan";
import { retrieveRelevantChunks } from "../retrieval/retrievalService";
import { env } from "../../config/env";
import { AppError } from "../../middleware/error.middleware";
import type { AskRequest, AskResponse, TokenUsage } from "../../types/ai";

const EMPTY_USAGE: TokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

function mapServiceError(err: unknown): AppError {
  const message = err instanceof Error ? err.message : String(err);

  if (message.includes("MISTRAL_API_KEY") || message.includes("not configured")) {
    return new AppError("AI service is not configured", 503);
  }

  if (message.includes("rate limit")) {
    return new AppError(message, 429);
  }

  if (message.includes("timed out") || message.includes("timeout")) {
    return new AppError(message, 504);
  }

  if (message.includes("PINECONE") || message.includes("Pinecone")) {
    return new AppError(`Vector database error: ${message}`, 503);
  }

  if (message.includes("Mistral")) {
    return new AppError(`AI service error: ${message}`, 502);
  }

  return new AppError(`Answer generation failed: ${message}`, 500);
}

/**
 * Full AI answer pipeline:
 * validate → retrieve → rank → build context → prompt → LLM → cite sources.
 */
export async function generateAnswer(
  userId: string,
  request: AskRequest
): Promise<AskResponse> {
  const startTime = Date.now();

  let question: string;

  try {
    question = validateQuestion(request.question);
  } catch (err) {
    if (err instanceof QuestionValidationError) {
      throw new AppError(err.message, err.statusCode);
    }
    throw err;
  }

  const topK = request.topK ?? env.RAG_TOP_K;

  if (topK < 1 || topK > 50) {
    throw new AppError("topK must be between 1 and 50", 400);
  }

  const responsePlan = detectResponsePlan(question);
  const priorMessages = request.priorMessages ?? [];
  const priorHasNoResults = priorMessages.some((m) =>
    m.content.includes("couldn't find that information")
  );

  console.log("[rag/answer]", {
    conversationId: request.conversationId ?? null,
    question,
    styles: responsePlan.styles,
    length: responsePlan.length,
    format: responsePlan.format,
    priorCount: priorMessages.length,
    priorHasNoResults,
  });

  let retrieval;

  try {
    retrieval = await retrieveRelevantChunks({
      userId,
      query: question,
      limit: topK,
      minScore: env.RAG_MIN_SCORE,
      documentIds: request.documentIds,
      conversationId: request.conversationId,
    });
  } catch (err) {
    throw mapServiceError(err);
  }

  const { chunks: rawChunks } = retrieval;

  if (rawChunks.length === 0) {
    console.log("[rag/answer]", {
      conversationId: request.conversationId ?? null,
      question,
      chunkCount: 0,
      noResults: true,
    });
    return {
      success: true,
      answer: `${NO_ANSWER_MESSAGE} Try uploading and indexing more documents, or rephrase your question.`,
      sources: [],
      chunks: [],
      processingTime: Date.now() - startTime,
      model: env.MISTRAL_CHAT_MODEL,
      usage: EMPTY_USAGE,
      noResults: true,
    };
  }

  const { text: context, chunks } = await buildContext(userId, rawChunks);
  const sources = buildSourcesFromChunks(chunks);
  const chunkDetails = buildChunkDetails(chunks);

  let completion;

  try {
    completion = await generateChatCompletion(
      buildAnswerMessages(
        question,
        context,
        request.priorMessages,
        responsePlan
      )
    );
  } catch (err) {
    throw mapServiceError(err);
  }

  console.log("[rag/answer]", {
    conversationId: request.conversationId ?? null,
    question,
    chunkCount: rawChunks.length,
    noResults: false,
    answerIsNoAnswer: completion.answer.includes(
      "couldn't find that information"
    ),
  });

  return {
    success: true,
    answer: completion.answer,
    sources,
    chunks: chunkDetails,
    processingTime: Date.now() - startTime,
    model: completion.model,
    usage: completion.usage ?? EMPTY_USAGE,
    noResults: false,
  };
}
