import { env } from "../../config/env";
import type {
  RetrievalOptions,
  RetrievalResult,
  RetrievedChunk,
} from "../../types/chat";
import { formatContextText } from "../ai/contextBuilder";
import { assembleContext } from "../context/contextAssembler";
import { retrieve } from "./retrievalCore";
import { runQueryPipeline } from "../query/queryPipeline";
import { normalizeQueryText } from "../query/queryNormalizer";
import { loadUserVocabulary } from "../query/vocabularyLoader";
import {
  buildSpellingDictionaries,
  correctQuerySpelling,
} from "../query/spellCorrectionService";

/**
 * Retrieval service — spell-correct → query pipeline → RetrievalCore.
 *
 * Each call is fully request-scoped: local corrected query, fresh
 * queryAnalysis, and a new retrieve() — never reuse prior queryAnalysis,
 * noResults, or chunk lists from earlier messages.
 * Corrected query is for retrieval only; callers keep the original for the LLM.
 */
export async function retrieveRelevantChunks(
  options: RetrievalOptions
): Promise<RetrievalResult> {
  const trimmed = options.query.trim();

  if (!trimmed) {
    throw new Error("Retrieval query cannot be empty");
  }

  const startedAt = Date.now();
  const limit = options.limit ?? env.RAG_TOP_K;
  const minVectorScore = options.minScore ?? env.RAG_MIN_SCORE;

  const candidateLimit = env.ENABLE_RERANKER
    ? env.RETRIEVAL_CANDIDATES
    : Math.max(limit, env.RETRIEVAL_TOP_K);

  // --- rebuild all retrieval inputs from this request only ---
  const { normalized } = normalizeQueryText(trimmed);
  const vocabulary = await loadUserVocabulary(options.userId);
  const dicts = buildSpellingDictionaries(vocabulary);
  const { correctedQuery, corrections } = correctQuerySpelling(normalized, {
    primaryDictionary: dicts.primaryDictionary,
    fallbackDictionary: dicts.fallbackDictionary,
    phraseCorrections: dicts.phraseCorrections,
    minTokenLength: 4,
  });
  const queryForRetrieval = correctedQuery || normalized;

  const queryAnalysis = await runQueryPipeline(queryForRetrieval, {
    userId: options.userId,
  });

  const result = await retrieve({
    userId: options.userId,
    query: queryForRetrieval,
    queryAnalysis,
    limit,
    candidateLimit,
    minVectorScore,
    documentIds: options.documentIds,
    topic: options.topic,
    tags: options.tags,
    contentFocusedQuery: true,
  });

  const topScores = result.chunks.slice(0, 5).map((hit) => ({
    vectorScore: hit.vectorScore,
    finalScore: hit.finalScore,
    confidenceScore: hit.confidenceScore,
  }));

  console.log("[rag/retrieve]", {
    conversationId: options.conversationId ?? null,
    originalQuestion: trimmed,
    correctedQuery: queryForRetrieval,
    corrections,
    retrievalQuery: result.retrievalQuery,
    filteredKeywords: result.filteredKeywords ?? [],
    chunkCount: result.chunks.length,
    cacheHit: result.graphDebug?.cacheHit ?? false,
    topScores,
    elapsedMs: Date.now() - startedAt,
  });

  const chunks: RetrievedChunk[] = result.chunks.map((hit) => ({
    vectorId: hit.vectorId,
    score: hit.confidenceScore > 0 ? hit.confidenceScore : hit.finalScore,
    text: hit.text,
    metadata: {
      ...hit.metadata,
      confidenceScore: hit.confidenceScore,
      retrievalScore: hit.finalScore,
      ...(hit.crossEncoderScore !== undefined
        ? { crossEncoderScore: hit.crossEncoderScore }
        : {}),
      ...(hit.hybridScore !== undefined ? { hybridScore: hit.hybridScore } : {}),
      ...(hit.graphScore !== undefined ? { graphScore: hit.graphScore } : {}),
      ...(hit.graphConfidence !== undefined
        ? { graphConfidence: hit.graphConfidence }
        : {}),
    },
    topic: hit.topic,
    subtopic: hit.subtopic,
    title: hit.title,
    summary: hit.summary,
    keywords: hit.keywords ?? hit.matchedKeywords,
    tags: hit.tags,
    sectionPath: hit.sectionPath,
    contentPreview: hit.contentPreview,
  }));

  return {
    chunks,
    queryEmbeddingModel: result.queryEmbeddingModel,
  };
}

/** Format retrieved chunks into a context block for the LLM (with Phase 3 assembly) */
export async function buildContextFromChunks(
  userId: string,
  chunks: RetrievedChunk[]
): Promise<string> {
  const assembled = await assembleContext(userId, chunks);
  return formatContextText(assembled.chunks);
}

/** Assemble context chunks for RAG (expand, dedupe, order, budget) */
export async function assembleRetrievalContext(
  userId: string,
  seedChunks: RetrievedChunk[]
): Promise<RetrievedChunk[]> {
  const assembled = await assembleContext(userId, seedChunks);
  return assembled.chunks;
}
