import mongoose from "mongoose";
import PageIndexModel, { type IPageIndex } from "../../models/PageIndex";
import { AppError } from "../../middleware/error.middleware";
import { saveSearchQuery } from "../searchHistoryService";
import {
  buildHighlightTerms,
  buildMatchSnippet,
  findMatchesInText,
  normalizeQueryWhitespace,
  type MatchMode,
  type MatchOptions,
} from "./matchEngine";
import type { DocumentType } from "../../models/Document";
import type {
  SearchRequest,
  SearchResponse,
  SearchResult,
} from "../../types/search";

const MIN_QUERY_LENGTH = 1;
const MAX_QUERY_LENGTH = 500;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const SCAN_BATCH_SIZE = 200;

interface DocumentAccumulator {
  documentId: string;
  documentName: string;
  title: string;
  type: DocumentType;
  storedFileName?: string;
  createdAt: Date;
  occurrenceCount: number;
  pageCounts: Map<number, number>;
  bestPage: number;
  bestPageCount: number;
  preview: string;
  matchQuote?: string;
}

function validateQuery(query: string): string {
  const trimmed = normalizeQueryWhitespace(query);

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
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

function parseBool(value: unknown, defaultValue = false): boolean {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const text = String(value).toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function parseMatchMode(value: unknown, query: string): MatchMode {
  if (value === "phrase" || value === "keyword") return value;
  const tokens = query.split(/\s+/).filter(Boolean);
  return tokens.length > 1 ? "phrase" : "keyword";
}

function parseDocumentType(value: unknown): DocumentType | undefined {
  if (value === "pdf" || value === "image" || value === "note" || value === "video") {
    return value;
  }
  return undefined;
}

function resolveDateRange(params: SearchRequest): { from?: Date; to?: Date } {
  const now = new Date();

  if (params.date === "today") {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return { from };
  }

  if (params.date === "7d") {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from };
  }

  if (params.date === "30d") {
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from };
  }

  if (params.date === "custom") {
    return {
      from: params.dateFrom ? new Date(params.dateFrom) : undefined,
      to: params.dateTo ? new Date(params.dateTo) : undefined,
    };
  }

  return {};
}

function buildFileUrl(storedFileName?: string): string | undefined {
  return storedFileName
    ? `/uploads/${encodeURIComponent(storedFileName)}`
    : undefined;
}

function relevanceScore(occurrenceCount: number, matchingPages: number): number {
  // Deterministic non-AI score in 0–1 for UI display
  const raw = occurrenceCount * 0.08 + matchingPages * 0.05;
  return Math.min(1, Math.round(raw * 100) / 100);
}

function absorbPageMatch(
  acc: Map<string, DocumentAccumulator>,
  page: IPageIndex,
  occurrenceCount: number,
  preview: string,
  matchQuote?: string
): void {
  const documentId = page.documentId.toString();
  const existing = acc.get(documentId);

  if (!existing) {
    acc.set(documentId, {
      documentId,
      documentName: page.documentName,
      title: page.title,
      type: page.type,
      storedFileName: page.storedFileName,
      createdAt: page.documentCreatedAt,
      occurrenceCount,
      pageCounts: new Map([[page.pageNumber, occurrenceCount]]),
      bestPage: page.pageNumber,
      bestPageCount: occurrenceCount,
      preview,
      matchQuote,
    });
    return;
  }

  existing.occurrenceCount += occurrenceCount;
  const prev = existing.pageCounts.get(page.pageNumber) ?? 0;
  const next = prev + occurrenceCount;
  existing.pageCounts.set(page.pageNumber, next);

  if (
    next > existing.bestPageCount ||
    (next === existing.bestPageCount && page.pageNumber < existing.bestPage)
  ) {
    existing.bestPage = page.pageNumber;
    existing.bestPageCount = next;
    existing.preview = preview;
    existing.matchQuote = matchQuote ?? existing.matchQuote;
  }
}

/**
 * Module 1: pure multi-document text search (no embeddings / RAG).
 */
export async function searchDocumentsPure(
  userId: string,
  params: SearchRequest
): Promise<SearchResponse> {
  const startedAt = Date.now();
  const query = validateQuery(params.q);
  const page = parsePage(params.page);
  const limit = parseLimit(params.limit);
  const matchOptions: MatchOptions = {
    caseSensitive: parseBool(params.caseSensitive, false),
    wholeWord: parseBool(params.wholeWord, false),
    prefix: parseBool(params.prefix, false),
    matchMode: parseMatchMode(params.matchMode, query),
  };

  const type = parseDocumentType(params.type);
  const { from, to } = resolveDateRange(params);

  const filter: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
  };

  if (type) {
    filter.type = type;
  }

  if (from || to) {
    filter.documentCreatedAt = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }

  const accumulators = new Map<string, DocumentAccumulator>();
  let cursor = PageIndexModel.find(filter)
    .sort({ documentId: 1, pageNumber: 1 })
    .batchSize(SCAN_BATCH_SIZE)
    .cursor();

  for await (const pageDoc of cursor) {
    const match = findMatchesInText(pageDoc.text, query, matchOptions);
    if (match.occurrenceCount === 0) continue;

    const preview = buildMatchSnippet(pageDoc.text, match.occurrences[0]);
    absorbPageMatch(
      accumulators,
      pageDoc,
      match.occurrenceCount,
      preview,
      match.matchQuote
    );
  }

  const ranked = [...accumulators.values()].sort((a, b) => {
    if (b.occurrenceCount !== a.occurrenceCount) {
      return b.occurrenceCount - a.occurrenceCount;
    }
    if (b.pageCounts.size !== a.pageCounts.size) {
      return b.pageCounts.size - a.pageCounts.size;
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const totalResults = ranked.length;
  const totalPages = totalResults === 0 ? 0 : Math.ceil(totalResults / limit);
  const offset = (page - 1) * limit;
  const pageResults = ranked.slice(offset, offset + limit);
  const highlightTerms = buildHighlightTerms(query, matchOptions);

  const results: SearchResult[] = pageResults.map((item) => {
    const matchingPages = [...item.pageCounts.keys()].sort((a, b) => a - b);
    const score = relevanceScore(item.occurrenceCount, matchingPages.length);

    return {
      documentId: item.documentId,
      documentName: item.documentName,
      title: item.title,
      type: item.type,
      score,
      relevanceScore: score,
      preview: item.preview,
      bestMatchPage: item.bestPage,
      matchingPages,
      occurrenceCount: item.occurrenceCount,
      matchQuote: item.matchQuote,
      exactMatch: true,
      matchType: matchOptions.matchMode === "phrase" ? "phrase" : "terms",
      fileUrl: buildFileUrl(item.storedFileName),
      highlightTerms,
      createdAt: item.createdAt.toISOString(),
      originalFileName: item.documentName,
      storedFileName: item.storedFileName,
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
  };
}
