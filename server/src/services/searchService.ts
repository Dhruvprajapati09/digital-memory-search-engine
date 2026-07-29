import { AppError } from "../middleware/error.middleware";
import {
  generatePreviewSnippet,
  groupRankedChunksIntoDocuments,
  tokenizeQuery,
} from "./rankingService";
import { saveSearchQuery } from "./searchHistoryService";
import {
  retrieve,
  loadDocumentMetaForSearch,
} from "./retrieval/retrievalCore";
import { runQueryPipeline } from "./query/queryPipeline";
import { env } from "../config/env";
import type {
  SearchRequest,
  SearchResponse,
  SearchResult,
  SearchFilter,
  DateFilterPreset,
  SearchMode,
  ChunkSearchResult,
  SearchDebugInfo,
} from "../types/search";
import type { DocumentType } from "../models/Document";

const MIN_QUERY_LENGTH = 1;
const MAX_QUERY_LENGTH = 500;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function validateQuery(query: string): string {
  const trimmed = query.trim();

  if (trimmed.length < MIN_QUERY_LENGTH) {
    throw new AppError("Search query is required", 400);
  }

  if (trimmed.length > MAX_QUERY_LENGTH) {
    throw new AppError(
      `Search query must be at most ${MAX_QUERY_LENGTH} characters`,
      400
    );
  }

  return trimmed;
}

function parsePage(value: unknown): number {
  const page = parseInt(String(value ?? DEFAULT_PAGE), 10);
  return Number.isFinite(page) && page >= 1 ? page : DEFAULT_PAGE;
}

function parseLimit(value: unknown): number {
  const limit = parseInt(String(value ?? DEFAULT_LIMIT), 10);

  if (!Number.isFinite(limit) || limit < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(limit, MAX_LIMIT);
}

function parseDocumentType(value: unknown): DocumentType | undefined {
  if (value === "pdf" || value === "image" || value === "note" || value === "video") {
    return value;
  }

  return undefined;
}

function parseSearchMode(value: unknown): SearchMode {
  if (value === "chunks") return "chunks";
  return "documents";
}

function buildSearchFilter(params: SearchRequest): SearchFilter {
  return {
    type: parseDocumentType(params.type),
    date: params.date as DateFilterPreset | undefined,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    topic: params.topic,
    tag: params.tag,
  };
}

/**
 * Search API: delegates retrieval to RetrievalCore, then shapes results for the UI.
 */
export async function searchDocuments(
  userId: string,
  params: SearchRequest
): Promise<SearchResponse> {
  const startedAt = Date.now();
  const query = validateQuery(params.q);
  const page = parsePage(params.page);
  const limit = parseLimit(params.limit);
  const mode = parseSearchMode(params.mode);
  const filter = buildSearchFilter(params);

  const candidateLimit = env.ENABLE_RERANKER
    ? Math.max(
        limit * page * env.RETRIEVAL_MULTIPLIER,
        env.RETRIEVAL_CANDIDATES
      )
    : Math.max(
        limit * page * env.RETRIEVAL_MULTIPLIER,
        env.RETRIEVAL_TOP_K
      );

  const queryAnalysis = await runQueryPipeline(query, { userId });

  const retrieval = await retrieve({
    userId,
    query,
    queryAnalysis,
    filter,
    topic: filter.topic,
    tags: filter.tag ? [filter.tag] : undefined,
    candidateLimit,
    limit: candidateLimit,
    minVectorScore: env.MIN_VECTOR_SCORE,
  });

  if (retrieval.noDocumentsInScope) {
    const searchTimeMs = Date.now() - startedAt;
    await saveSearchQuery(userId, query, 0, searchTimeMs);

    return {
      success: true,
      query,
      mode,
      totalResults: 0,
      page,
      limit,
      totalPages: 0,
      searchTimeMs,
      results: [],
      ...(mode === "chunks" ? { chunkResults: [] } : {}),
    };
  }

  const highlightTerms = tokenizeQuery(query);

  const buildSearchDebug = (): SearchDebugInfo | undefined => {
    if (!env.ENABLE_SEARCH_DEBUG) return undefined;

    const rd = retrieval.rerankDebug;
    const candidateCount =
      rd?.candidateCount ??
      retrieval.graphDebug?.candidateChunkCount ??
      retrieval.chunks.length;

    return {
      retrievalStage: retrieval.graphDebug?.enabled
        ? "hybrid-rrf-graph-rerank"
        : "hybrid-rrf-rerank",
      candidateCount,
      graph: retrieval.graphDebug,
      rerankLatencyMs: rd?.rerankLatencyMs,
      rerankProvider: rd?.provider,
      rerankStage: rd?.stage,
      rerankError: rd?.error,
      rerankRetryAttempts: rd?.retryAttempts,
      rankingChanges: rd?.rankingChanges,
      chunkScores: Object.fromEntries(
        retrieval.chunks.map((chunk) => [
          chunk.vectorId,
          {
            crossEncoderScore: chunk.crossEncoderScore,
            hybridScore: chunk.hybridScore,
            graphScore: chunk.graphScore,
            graphConfidence: chunk.graphConfidence,
            finalScore: chunk.finalScore,
            confidence: chunk.confidenceScore,
          },
        ])
      ),
    };
  };

  const searchDebug = buildSearchDebug();

  if (mode === "chunks") {
    const totalResults = retrieval.chunks.length;
    const totalPages = totalResults === 0 ? 0 : Math.ceil(totalResults / limit);
    const offset = (page - 1) * limit;
    const pageChunks = retrieval.chunks.slice(offset, offset + limit);

    const docIds = [...new Set(pageChunks.map((c) => c.documentId))];
    const documentMeta = await loadDocumentMetaForSearch(userId, docIds);

    const chunkResults: ChunkSearchResult[] = pageChunks.map((chunk) => {
      const docMeta = documentMeta.get(chunk.documentId);
      const isVideo = docMeta?.type === "video";

      return {
        chunkId: chunk.vectorId,
        documentId: chunk.documentId,
        documentTitle: docMeta?.title ?? "Untitled",
        documentType: (docMeta?.type ?? "note") as ChunkSearchResult["documentType"],
        chunkIndex: chunk.chunkIndex,
        score: Math.round(chunk.finalScore * 100) / 100,
        confidenceScore: chunk.confidenceScore,
        preview: generatePreviewSnippet(chunk.contentPreview, query),
        highlightTerms,
        topic: chunk.topic,
        subtopic: chunk.subtopic,
        title: chunk.title,
        sectionPath: chunk.sectionPath,
        matchedKeywords: chunk.matchedKeywords,
        ...(env.ENABLE_SEARCH_DEBUG
          ? {
              debug: {
                crossEncoderScore: chunk.crossEncoderScore,
                hybridScore: chunk.hybridScore,
                graphScore: chunk.graphScore,
                graphConfidence: chunk.graphConfidence,
                finalScore: chunk.finalScore,
                confidence: chunk.confidenceScore,
              },
            }
          : {}),
        ...(isVideo
          ? {
              timestamp: chunk.timestampFormatted,
              timestampSeconds: chunk.timestampSeconds,
              videoUrl: chunk.videoUrl ?? docMeta?.videoUrl,
            }
          : {}),
      };
    });

    const searchTimeMs = Date.now() - startedAt;
    await saveSearchQuery(userId, query, totalResults, searchTimeMs);

    return {
      success: true,
      query,
      mode,
      totalResults,
      page,
      limit,
      totalPages,
      searchTimeMs,
      results: [],
      chunkResults,
      ...(searchDebug ? { debug: searchDebug } : {}),
    };
  }

  const uniqueDocIds = [
    ...new Set(retrieval.chunks.map((c) => c.documentId)),
  ];
  const documentMeta = await loadDocumentMetaForSearch(userId, uniqueDocIds);

  const ranked = groupRankedChunksIntoDocuments(
    retrieval.chunks,
    documentMeta
  );

  const totalResults = ranked.length;
  const totalPages = totalResults === 0 ? 0 : Math.ceil(totalResults / limit);
  const offset = (page - 1) * limit;
  const pageResults = ranked.slice(offset, offset + limit);

  const results: SearchResult[] = pageResults.map((item) => {
    const docMeta = documentMeta.get(item.documentId);
    const topChunk = item.matchedChunks[0];
    const isVideo = item.type === "video";

    return {
      documentId: item.documentId,
      title: item.title,
      type: item.type,
      score: Math.round(item.finalScore * 100) / 100,
      preview: generatePreviewSnippet(item.bestChunkText, query),
      highlightTerms,
      matchedChunks: item.matchedChunks.map(
        ({
          chunkIndex,
          score,
          topic,
          subtopic,
          title,
          sectionPath,
          timestamp,
          timestampSeconds,
          videoUrl,
        }) => ({
          chunkIndex,
          score: Math.round(score * 100) / 100,
          topic,
          subtopic,
          title,
          sectionPath,
          timestamp,
          timestampSeconds,
          videoUrl,
        })
      ),
      createdAt: item.createdAt.toISOString(),
      topTopic: item.topTopic,
      topSubtopic: item.topSubtopic,
      ...(isVideo
        ? {
            channel: docMeta?.videoChannel,
            thumbnail: docMeta?.videoThumbnail,
            timestamp: topChunk?.timestamp,
            timestampSeconds: topChunk?.timestampSeconds,
            videoUrl: topChunk?.videoUrl ?? docMeta?.videoUrl,
            youtubeVideoId: docMeta?.youtubeVideoId,
          }
        : {}),
    };
  });

  const searchTimeMs = Date.now() - startedAt;

  await saveSearchQuery(userId, query, totalResults, searchTimeMs);

  return {
    success: true,
    query,
    mode: "documents",
    totalResults,
    page,
    limit,
    totalPages,
    searchTimeMs,
    results,
    ...(searchDebug ? { debug: searchDebug } : {}),
  };
}
