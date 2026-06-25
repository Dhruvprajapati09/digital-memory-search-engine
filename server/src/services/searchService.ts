import mongoose from "mongoose";
import DocumentModel, { DocumentType } from "../models/Document";
import { AppError } from "../middleware/error.middleware";
import { generateQueryEmbedding } from "./embeddingService";
import { vectorStore } from "./vectorStoreService";
import { fuseSearchResults } from "./search/hybridSearchService";
import {
  rankDocumentGroups,
  generatePreviewSnippet,
  tokenizeQuery,
} from "./rankingService";
import { saveSearchQuery } from "./searchHistoryService";
import type {
  SearchRequest,
  SearchResponse,
  SearchResult,
  SearchFilter,
  DateFilterPreset,
} from "../types/search";

const MIN_QUERY_LENGTH = 1;
const MAX_QUERY_LENGTH = 500;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
/** Fetch extra chunk hits before grouping so pagination has enough documents */
const RETRIEVAL_MULTIPLIER = 8;

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
  if (value === "pdf" || value === "image" || value === "note") {
    return value;
  }

  return undefined;
}

function resolveDateRange(filter: SearchFilter): {
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

      if (from && Number.isNaN(from.getTime())) {
        throw new AppError("Invalid dateFrom value", 400);
      }

      if (to && Number.isNaN(to.getTime())) {
        throw new AppError("Invalid dateTo value", 400);
      }

      return { from, to };
    }
    default:
      return {};
  }
}

async function getFilteredDocumentIds(
  userId: string,
  filter: SearchFilter
): Promise<string[] | undefined> {
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
  return docs.map((doc) => doc._id.toString());
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
 * Hybrid search pipeline:
 * vector retrieval + keyword retrieval → RRF fusion → topic/title/phrase rerank → group by document.
 */
export async function searchDocuments(
  userId: string,
  params: SearchRequest
): Promise<SearchResponse> {
  const startedAt = Date.now();
  const query = validateQuery(params.q);
  const page = parsePage(params.page);
  const limit = parseLimit(params.limit);
  const filter = buildSearchFilter(params);

  const filteredDocumentIds = await getFilteredDocumentIds(userId, filter);

  if (filteredDocumentIds !== undefined && filteredDocumentIds.length === 0) {
    const searchTimeMs = Date.now() - startedAt;
    await saveSearchQuery(userId, query, 0, searchTimeMs);

    return {
      success: true,
      query,
      totalResults: 0,
      page,
      limit,
      totalPages: 0,
      searchTimeMs,
      results: [],
    };
  }

  const retrievalLimit = Math.max(limit * page * RETRIEVAL_MULTIPLIER, 60);

  const embedding = await generateQueryEmbedding(query);

  const [vectorHits, keywordHits] = await Promise.all([
    vectorStore.searchVector({
      vector: embedding.vector,
      userId,
      limit: retrievalLimit,
      minScore: 0.08,
      documentIds: filteredDocumentIds,
      topic: filter.topic,
      tags: filter.tag ? [filter.tag] : undefined,
    }),
    vectorStore.searchKeyword({
      query,
      userId,
      limit: retrievalLimit,
      documentIds: filteredDocumentIds,
    }),
  ]);

  const fusedHits = fuseSearchResults(vectorHits, keywordHits);

  const uniqueDocIds = [
    ...new Set(
      fusedHits.map((hit) => hit.metadata.documentId).filter(Boolean)
    ),
  ];

  const documents = await DocumentModel.find({
    _id: { $in: uniqueDocIds },
    userId,
  })
    .select("_id title type createdAt")
    .lean();

  const documentMeta = new Map<
    string,
    { title: string; type: string; createdAt: Date }
  >();

  for (const doc of documents) {
    documentMeta.set(doc._id.toString(), {
      title: doc.title,
      type: doc.type,
      createdAt: doc.createdAt,
    });
  }

  const ranked = rankDocumentGroups(fusedHits, documentMeta, query);
  const totalResults = ranked.length;
  const totalPages = totalResults === 0 ? 0 : Math.ceil(totalResults / limit);
  const offset = (page - 1) * limit;
  const pageResults = ranked.slice(offset, offset + limit);
  const highlightTerms = tokenizeQuery(query);

  const results: SearchResult[] = pageResults.map((item) => ({
    documentId: item.documentId,
    title: item.title,
    type: item.type,
    score: Math.round(item.finalScore * 100) / 100,
    preview: generatePreviewSnippet(item.bestChunkText, query),
    highlightTerms,
    matchedChunks: item.matchedChunks.map(
      ({ chunkIndex, score, topic, subtopic, title, sectionPath }) => ({
        chunkIndex,
        score: Math.round(score * 100) / 100,
        topic,
        subtopic,
        title,
        sectionPath,
      })
    ),
    createdAt: item.createdAt.toISOString(),
    topTopic: item.topTopic,
    topSubtopic: item.topSubtopic,
  }));

  const searchTimeMs = Date.now() - startedAt;

  await saveSearchQuery(userId, query, totalResults, searchTimeMs);

  return {
    success: true,
    query,
    totalResults,
    page,
    limit,
    totalPages,
    searchTimeMs,
    results,
  };
}
