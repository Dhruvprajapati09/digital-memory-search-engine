import mongoose from "mongoose";
import DocumentModel, { DocumentType } from "../../models/Document";
import { generateQueryEmbedding } from "../embeddingService";
import { vectorStore } from "../vectorStoreService";
import { fuseSearchResults } from "../search/hybridSearchService";
import {
  rankRankedChunks,
  applyPrecisionFilters,
  type DocumentMetaForRanking,
} from "../rankingService";
import { env } from "../../config/env";
import type { DateFilterPreset, RankedChunkHit } from "../../types/search";
import type { QueryPipelineResult } from "../../types/query";
import { runQueryPipeline, buildRankingQuery, buildRetrievalQuery } from "../query/queryPipeline";
import {
  buildExpandedEmbeddingQuery,
  buildExpandedSearchQuery,
} from "../query/queryExpansionService";
import { rerankerService } from "../reranker/rerankerService";
import type { RerankDebugInfo } from "../reranker/rerankerTypes";
import {
  retrieveGraphChunks,
  type GraphRetrievalResult,
} from "./graphRetrievalService";
import { fuseGraphSearchResults } from "./graphFusionService";

export interface RetrievalMetadataFilter {
  type?: DocumentType;
  date?: DateFilterPreset;
  dateFrom?: string;
  dateTo?: string;
  topic?: string;
  tag?: string;
}

export interface RetrievalCoreOptions {
  userId: string;
  query: string;
  /** Pre-computed query pipeline output (Phase 2); runs pipeline if omitted */
  queryAnalysis?: QueryPipelineResult;
  /** Max ranked chunks to return after fusion + scoring */
  limit?: number;
  /** Candidate pool size for vector + keyword legs (defaults to env) */
  candidateLimit?: number;
  minVectorScore?: number;
  /** Explicit document scope (e.g. RAG scoped to documents) */
  documentIds?: string[];
  /** Metadata filters applied via MongoDB document query */
  filter?: RetrievalMetadataFilter;
  /** Pinecone / chunk metadata filters (RAG or search topic/tag) */
  topic?: string;
  tags?: string[];
  /**
   * When true (Assistant RAG), embed/search/rank with a content-focused
   * retrieval query derived from keywords, and use softer precision.
   * SearchV2 should leave this false/undefined.
   */
  contentFocusedQuery?: boolean;
  /** Optional adaptive fusion weights for Search v2 */
  retrievalWeights?: {
    vector?: number;
    keyword?: number;
    graph?: number;
  };
}

export interface RetrievalCoreResult {
  normalizedQuery: string;
  /** Query used for embed / keyword / rank when contentFocusedQuery is on */
  retrievalQuery: string;
  queryAnalysis: QueryPipelineResult;
  chunks: RankedChunkHit[];
  queryEmbeddingModel: string;
  /** Empty when metadata filter excluded all documents */
  noDocumentsInScope: boolean;
  /** Phase 4 rerank diagnostics */
  rerankDebug?: RerankDebugInfo;
  /** Phase 5 graph retrieval diagnostics */
  graphDebug?: GraphRetrievalResult["debug"];
}

/** @deprecated Use queryPipeline.normalizeQueryText — kept for internal fallback */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

function mergeMetadataHintsIntoFilter(
  filter: RetrievalMetadataFilter | undefined,
  hints: QueryPipelineResult["metadataHints"]
): RetrievalMetadataFilter {
  const merged: RetrievalMetadataFilter = { ...filter };

  if (!merged.type && hints.documentType) {
    merged.type = hints.documentType;
  }
  if (!merged.topic && hints.topic) {
    merged.topic = hints.topic;
  }
  if (!merged.tag && hints.tags && hints.tags.length > 0) {
    merged.tag = hints.tags[0];
  }
  if (!merged.date && hints.date) {
    merged.date = hints.date;
  }
  if (!merged.dateFrom && hints.dateFrom) {
    merged.dateFrom = hints.dateFrom;
  }
  if (!merged.dateTo && hints.dateTo) {
    merged.dateTo = hints.dateTo;
  }

  return merged;
}

function resolveDateRange(filter: RetrievalMetadataFilter): {
  from?: Date;
  to?: Date;
} {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  switch (filter.date) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { from: start, to: endOfToday };
    }
    case "7d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      return { from, to: endOfToday };
    }
    case "30d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      return { from, to: endOfToday };
    }
    case "custom": {
      const from = filter.dateFrom ? new Date(filter.dateFrom) : undefined;
      const to = filter.dateTo ? new Date(filter.dateTo) : undefined;
      return { from, to };
    }
    default:
      return {};
  }
}

/**
 * Resolve document IDs from type/date metadata filters.
 * Returns undefined when no document-level filter is active.
 */
export async function resolveFilteredDocumentIds(
  userId: string,
  filter?: RetrievalMetadataFilter
): Promise<string[] | undefined> {
  if (!filter) return undefined;

  const hasTypeFilter = Boolean(filter.type);
  const dateRange = resolveDateRange(filter);
  const hasDateFilter = Boolean(dateRange.from || dateRange.to);

  if (!hasTypeFilter && !hasDateFilter) {
    return undefined;
  }

  const mongoFilter: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
    indexStatus: "indexed",
  };

  if (filter.type) {
    mongoFilter.type = filter.type;
  }

  if (dateRange.from || dateRange.to) {
    mongoFilter.createdAt = {};

    if (dateRange.from) {
      (mongoFilter.createdAt as Record<string, Date>).$gte = dateRange.from;
    }

    if (dateRange.to) {
      (mongoFilter.createdAt as Record<string, Date>).$lte = dateRange.to;
    }
  }

  const docs = await DocumentModel.find(mongoFilter).select("_id").lean();
  return docs.map((doc: { _id: mongoose.Types.ObjectId }) =>
    doc._id.toString()
  );
}

function intersectDocumentIds(
  a: string[] | undefined,
  b: string[] | undefined
): string[] | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  const setB = new Set(b);
  return a.filter((id) => setB.has(id));
}

async function loadDocumentMetaForRanking(
  userId: string,
  documentIds: string[]
): Promise<Map<string, DocumentMetaForRanking>> {
  if (documentIds.length === 0) {
    return new Map();
  }

  const documents = await DocumentModel.find({
    _id: { $in: documentIds },
    userId,
  })
    .select("_id title type createdAt originalFileName storedFileName filePath mimeType")
    .lean();

  const map = new Map<string, DocumentMetaForRanking>();

  for (const doc of documents) {
    map.set(doc._id.toString(), {
      title: doc.title,
      type: doc.type,
      createdAt: doc.createdAt,
      originalFileName: doc.originalFileName,
      storedFileName: doc.storedFileName,
      filePath: doc.filePath,
      mimeType: doc.mimeType,
    });
  }

  return map;
}

/**
 * Unified hybrid retrieval pipeline for UI search and RAG.
 *
 * Query → normalize → embed → metadata filter → parallel vector + keyword → RRF → rank → rerank → chunks
 */
export async function retrieve(
  options: RetrievalCoreOptions
): Promise<RetrievalCoreResult> {
  const queryAnalysis =
    options.queryAnalysis ??
    (await runQueryPipeline(options.query, { userId: options.userId }));

  const normalizedQuery = queryAnalysis.normalized;

  if (!normalizedQuery) {
    throw new Error("Retrieval query cannot be empty");
  }

  const limit = options.limit ?? env.RAG_TOP_K;
  const defaultCandidateLimit = env.ENABLE_RERANKER
    ? env.RETRIEVAL_CANDIDATES
    : Math.max(limit, env.RETRIEVAL_TOP_K);
  const candidateLimit =
    options.candidateLimit ?? defaultCandidateLimit;
  const minVectorScore = options.minVectorScore ?? env.MIN_VECTOR_SCORE;

  const effectiveFilter = env.ENABLE_METADATA_HINTS
    ? mergeMetadataHintsIntoFilter(options.filter, queryAnalysis.metadataHints)
    : options.filter;

  const filterTopic =
    options.topic ?? effectiveFilter?.topic ?? queryAnalysis.metadataHints.topic;
  const filterTags =
    options.tags ??
    (effectiveFilter?.tag
      ? [effectiveFilter.tag]
      : queryAnalysis.metadataHints.tags);

  const filteredByMetadata = await resolveFilteredDocumentIds(
    options.userId,
    effectiveFilter
  );

  const documentIds = intersectDocumentIds(
    options.documentIds,
    filteredByMetadata
  );

  if (documentIds !== undefined && documentIds.length === 0) {
    return {
      normalizedQuery,
      retrievalQuery: options.contentFocusedQuery
        ? buildRetrievalQuery(queryAnalysis)
        : normalizedQuery,
      queryAnalysis,
      chunks: [],
      queryEmbeddingModel: env.MISTRAL_EMBEDDING_MODEL,
      noDocumentsInScope: true,
    };
  }

  const retrievalQuery = options.contentFocusedQuery
    ? buildRetrievalQuery(queryAnalysis)
    : normalizedQuery;

  const keywordQuery = buildExpandedSearchQuery(
    retrievalQuery,
    queryAnalysis.keywords,
    queryAnalysis.expandedTerms
  );

  const embeddingQuery = buildExpandedEmbeddingQuery(
    retrievalQuery,
    queryAnalysis.keywords,
    queryAnalysis.expandedTerms
  );

  const rankingQuery = buildRankingQuery({
    ...queryAnalysis,
    normalized: retrievalQuery,
  });

  const embedding = await generateQueryEmbedding(embeddingQuery);

  const [vectorHits, keywordHits, graphResult] = await Promise.all([
    vectorStore.searchVector({
      vector: embedding.vector,
      userId: options.userId,
      limit: candidateLimit,
      minScore: minVectorScore,
      documentIds,
      topic: filterTopic,
      tags: filterTags,
    }),
    vectorStore.searchKeyword({
      query: keywordQuery,
      userId: options.userId,
      limit: candidateLimit,
      documentIds,
    }),
    retrieveGraphChunks({
      userId: options.userId,
      queryAnalysis,
      documentIds,
      limit: Math.min(candidateLimit, env.GRAPH_RETRIEVAL_CANDIDATES),
      maxDepth: env.GRAPH_RETRIEVAL_MAX_DEPTH,
    }),
  ]);

  const hybridFusedHits = fuseSearchResults(vectorHits, keywordHits, {
    rrfK: env.RRF_K,
    weightVector: options.retrievalWeights?.vector ?? env.RRF_WEIGHT_VECTOR,
    weightKeyword: options.retrievalWeights?.keyword ?? env.RRF_WEIGHT_KEYWORD,
  });

  const fusedHits = fuseGraphSearchResults(
    hybridFusedHits,
    graphResult.hits,
    {
      rrfK: env.RRF_K,
      graphWeight: options.retrievalWeights?.graph ?? env.GRAPH_RRF_WEIGHT,
    }
  );

  const uniqueDocIds = [
    ...new Set(
      fusedHits.map((hit) => hit.metadata.documentId).filter(Boolean)
    ),
  ];

  const documentMeta = await loadDocumentMetaForRanking(
    options.userId,
    uniqueDocIds
  );

  const ranked = rankRankedChunks(
    fusedHits,
    documentMeta,
    retrievalQuery,
    rankingQuery
  );

  const rerankResult = await rerankerService.rerank({
    query: retrievalQuery,
    candidates: ranked,
    documentMeta,
  });

  const preciseChunks = applyPrecisionFilters(rerankResult.chunks, {
    normalizedQuery: retrievalQuery,
    keywords: queryAnalysis.keywords,
    entities: queryAnalysis.entities,
    documentMeta,
    ...(options.contentFocusedQuery
      ? { minVectorScore: env.RAG_PRECISION_MIN_VECTOR_SCORE }
      : {}),
  });

  const chunks = preciseChunks.slice(0, limit);

  return {
    normalizedQuery,
    retrievalQuery,
    queryAnalysis,
    chunks,
    queryEmbeddingModel: embedding.model,
    noDocumentsInScope: false,
    rerankDebug: rerankResult.debug,
    graphDebug: graphResult.debug,
  };
}

/** Extended document metadata for search UI (video fields, etc.) */
export async function loadDocumentMetaForSearch(
  userId: string,
  documentIds: string[]
): Promise<
  Map<
    string,
    DocumentMetaForRanking & {
      videoChannel?: string;
      videoThumbnail?: string;
      videoUrl?: string;
      youtubeVideoId?: string;
      originalFileName?: string;
      storedFileName?: string;
      filePath?: string;
      mimeType?: string;
    }
  >
> {
  if (documentIds.length === 0) {
    return new Map();
  }

  const documents = await DocumentModel.find({
    _id: { $in: documentIds },
    userId,
  })
    .select(
      "_id title type createdAt originalFileName storedFileName filePath mimeType videoChannel videoThumbnail videoUrl youtubeVideoId"
    )
    .lean();

  const map = new Map<
    string,
    DocumentMetaForRanking & {
      videoChannel?: string;
      videoThumbnail?: string;
      videoUrl?: string;
      youtubeVideoId?: string;
    }
  >();

  for (const doc of documents) {
    map.set(doc._id.toString(), {
      title: doc.title,
      type: doc.type,
      createdAt: doc.createdAt,
      videoChannel: doc.videoChannel,
      videoThumbnail: doc.videoThumbnail,
      videoUrl: doc.videoUrl,
      youtubeVideoId: doc.youtubeVideoId,
      originalFileName: doc.originalFileName,
      storedFileName: doc.storedFileName,
      filePath: doc.filePath,
      mimeType: doc.mimeType,
    });
  }

  return map;
}
