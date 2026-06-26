import DocumentModel from "../../models/Document";
import ChunkModel from "../../models/Chunk";
import { generateChatCompletion } from "./aiService";
import { buildContext } from "./contextBuilder";
import { buildSummaryMessages } from "./promptBuilder";
import { env } from "../../config/env";
import { AppError } from "../../middleware/error.middleware";
import type { DocumentSummaryResponse, TokenUsage } from "../../types/ai";
import type { RetrievedChunk } from "../../types/chat";

const EMPTY_USAGE: TokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

interface ParsedSummaryPayload {
  summary: string;
  topics: string[];
  keywords: string[];
  concepts: string[];
  highlights: string[];
}

/** In-memory summary cache keyed by documentId + updatedAt */
const summaryCache = new Map<string, DocumentSummaryResponse>();

function buildCacheKey(documentId: string, updatedAt: Date): string {
  return `${documentId}:${updatedAt.toISOString()}`;
}

function chunkToRetrievedChunk(
  chunk: {
    vectorId: string;
    text: string;
    chunkIndex: number;
    topic: string;
    subtopic?: string;
    title: string;
    summary: string;
    keywords: string[];
    tags: string[];
    sectionPath: string[];
    contentPreview: string;
  },
  documentId: string,
  documentTitle: string,
  userId: string
): RetrievedChunk {
  return {
    vectorId: chunk.vectorId,
    score: 1,
    text: chunk.text,
    metadata: {
      documentId,
      userId,
      chunkIndex: chunk.chunkIndex,
      type: "document",
      documentTitle,
      topic: chunk.topic,
      subtopic: chunk.subtopic,
      title: chunk.title,
      summary: chunk.summary,
      keywords: chunk.keywords,
      tags: chunk.tags,
      sectionPath: chunk.sectionPath,
      contentPreview: chunk.contentPreview,
    },
    topic: chunk.topic,
    subtopic: chunk.subtopic,
    title: chunk.title,
    summary: chunk.summary,
    keywords: chunk.keywords,
    tags: chunk.tags,
    sectionPath: chunk.sectionPath,
    contentPreview: chunk.contentPreview,
  };
}

function parseSummaryJson(raw: string): ParsedSummaryPayload {
  const trimmed = raw.trim();

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch ? jsonMatch[0] : trimmed;

  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {
      summary: trimmed,
      topics: [],
      keywords: [],
      concepts: [],
      highlights: [],
    };
  }

  const obj = parsed as Record<string, unknown>;

  const toStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
  };

  return {
    summary: typeof obj.summary === "string" ? obj.summary : trimmed,
    topics: toStringArray(obj.topics),
    keywords: toStringArray(obj.keywords),
    concepts: toStringArray(obj.concepts),
    highlights: toStringArray(obj.highlights),
  };
}

/**
 * Generate a structured summary for an indexed document.
 * Uses all document chunks as context, with token-bounded truncation.
 */
export async function summarizeDocument(
  userId: string,
  documentId: string
): Promise<DocumentSummaryResponse> {
  const startTime = Date.now();

  const document = await DocumentModel.findOne({ _id: documentId, userId });

  if (!document) {
    throw new AppError("Document not found", 404);
  }

  if (document.indexStatus !== "indexed") {
    throw new AppError(
      "Document must be indexed before it can be summarized",
      400
    );
  }

  const cacheKey = buildCacheKey(documentId, document.updatedAt);
  const cached = summaryCache.get(cacheKey);

  if (cached) {
    return { ...cached, processingTime: Date.now() - startTime };
  }

  const chunks = await ChunkModel.find({ documentId, userId })
    .sort({ chunkIndex: 1 })
    .select(
      "vectorId text chunkIndex topic subtopic title summary keywords tags sectionPath contentPreview"
    )
    .lean();

  if (chunks.length === 0) {
    throw new AppError("No indexed chunks found for this document", 404);
  }

  const retrieved = chunks.map((chunk) =>
    chunkToRetrievedChunk(
      chunk,
      documentId,
      document.title,
      userId
    )
  );

  const { text: context } = buildContext(retrieved);

  if (!context.trim()) {
    throw new AppError("Document content is empty", 400);
  }

  let completion;

  try {
    completion = await generateChatCompletion(
      buildSummaryMessages(document.title, context),
      { temperature: 0.1, maxTokens: env.MAX_OUTPUT_TOKENS }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("rate limit")) {
      throw new AppError(message, 429);
    }

    if (message.includes("timed out") || message.includes("timeout")) {
      throw new AppError(message, 504);
    }

    throw new AppError(`Failed to generate summary: ${message}`, 502);
  }

  const parsed = parseSummaryJson(completion.answer);

  const response: DocumentSummaryResponse = {
    success: true,
    title: document.title,
    documentId,
    summary: parsed.summary,
    topics: parsed.topics,
    keywords: parsed.keywords,
    concepts: parsed.concepts,
    highlights: parsed.highlights,
    processingTime: Date.now() - startTime,
    model: completion.model,
    usage: completion.usage ?? EMPTY_USAGE,
  };

  summaryCache.set(cacheKey, response);

  return response;
}

/** Clear cached summary for a document (e.g. after reindex) */
export function invalidateSummaryCache(documentId: string): void {
  for (const key of summaryCache.keys()) {
    if (key.startsWith(`${documentId}:`)) {
      summaryCache.delete(key);
    }
  }
}
