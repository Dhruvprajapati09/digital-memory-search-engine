import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, AppError } from "../middleware/error.middleware";
import { searchDocuments } from "../services/searchService";
import { searchV2 } from "../services/searchV2/searchV2Service";
import { getSearchV2Suggestions } from "../services/searchV2/suggestionService";
import { getSearchV2Dashboard } from "../services/searchV2/searchAnalyticsService";
import { evaluateSearchBenchmark } from "../services/searchV2/searchBenchmarkService";
import {
  getRecentSearches,
  deleteSearchHistoryItem,
  clearSearchHistory,
  getSearchStats,
} from "../services/searchHistoryService";
import type { SearchRequest } from "../types/search";
import type {
  SearchV2AdvancedFilters,
  SearchV2BenchmarkCase,
  SearchV2Request,
} from "../types/searchV2";

function parseHistoryId(id: string): string {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid search history id", 400);
  }

  return id;
}

export const searchHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const params: SearchRequest = {
      q: String(req.query.q ?? ""),
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      mode: req.query.mode as SearchRequest["mode"],
      type: req.query.type as SearchRequest["type"],
      date: req.query.date as SearchRequest["date"],
      dateFrom: req.query.dateFrom
        ? String(req.query.dateFrom)
        : undefined,
      dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined,
      topic: req.query.topic ? String(req.query.topic) : undefined,
      tag: req.query.tag ? String(req.query.tag) : undefined,
      caseSensitive: req.query.caseSensitive as string | undefined,
      wholeWord: req.query.wholeWord as string | undefined,
      prefix: req.query.prefix as string | undefined,
      matchMode: req.query.matchMode as SearchRequest["matchMode"],
    };

    const result = await searchDocuments(req.user._id.toString(), params);

    res.status(200).json(result);
  }
);

function boolQuery(value: unknown): boolean {
  return value === "true" || value === true || value === "1";
}

function optionalString(value: unknown): string | undefined {
  const text = value === undefined ? "" : String(value).trim();
  return text || undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value.map(String).map((item) => item.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  const text = optionalString(value);
  if (!text) return undefined;
  return text.split(",").map((item) => item.trim()).filter(Boolean);
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildSearchV2Filters(query: Request["query"]): SearchV2AdvancedFilters {
  return {
    documentId: optionalString(query.documentId),
    documentIds: optionalStringArray(query.documentIds),
    page: optionalNumber(query.pageNumber),
    chapter: optionalString(query.chapter),
    section: optionalString(query.section),
    heading: optionalString(query.heading),
    author: optionalString(query.author),
    tags: optionalStringArray(query.tags ?? query.tag),
    language: optionalString(query.language),
    fileType: optionalString(query.fileType ?? query.type) as SearchV2AdvancedFilters["fileType"],
    uploadDateFrom: optionalString(query.uploadDateFrom ?? query.dateFrom),
    uploadDateTo: optionalString(query.uploadDateTo ?? query.dateTo),
    modifiedDateFrom: optionalString(query.modifiedDateFrom),
    modifiedDateTo: optionalString(query.modifiedDateTo),
    entity: optionalString(query.entity),
    topic: optionalString(query.topic),
  };
}

export const searchV2Handler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const params: SearchV2Request = {
      q: String(req.query.q ?? ""),
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      mode: req.query.mode as SearchV2Request["mode"],
      searchMode: req.query.searchMode as SearchV2Request["searchMode"],
      explain: boolQuery(req.query.explain),
      includeFacets: req.query.facets === undefined ? true : boolQuery(req.query.facets),
      includeSuggestions: boolQuery(req.query.suggestions),
      stream: boolQuery(req.query.stream),
      filters: buildSearchV2Filters(req.query),
    };

    if (params.stream) {
      res.setHeader("Content-Type", "application/x-ndjson");
      res.write(JSON.stringify({ event: "search_started", query: params.q }) + "\n");
      const result = await searchV2(req.user._id.toString(), params);
      res.write(JSON.stringify({ event: "search_completed", data: result }) + "\n");
      res.end();
      return;
    }

    const result = await searchV2(req.user._id.toString(), params);
    res.status(200).json(result);
  }
);

export const getSearchV2SuggestionsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const suggestions = await getSearchV2Suggestions(
      req.user._id.toString(),
      String(req.query.q ?? ""),
      req.query.limit ? Number(req.query.limit) : 8
    );

    res.status(200).json({
      success: true,
      suggestions,
    });
  }
);

export const getSearchV2DashboardHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    res.status(200).json({
      success: true,
      dashboard: getSearchV2Dashboard(req.user._id.toString()),
    });
  }
);

export const evaluateSearchV2BenchmarkHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const cases = Array.isArray(req.body?.cases)
      ? (req.body.cases as SearchV2BenchmarkCase[])
      : [];

    res.status(200).json({
      success: true,
      report: evaluateSearchBenchmark(cases),
    });
  }
);

export const getSearchHistoryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const queries = await getRecentSearches(req.user._id.toString());

    res.status(200).json({
      success: true,
      history: queries,
    });
  }
);

export const getSearchStatsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const stats = await getSearchStats(req.user._id.toString());

    res.status(200).json({
      success: true,
      stats,
    });
  }
);

export const deleteSearchHistoryItemHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const historyId = parseHistoryId(String(req.params.id));
    const deleted = await deleteSearchHistoryItem(
      req.user._id.toString(),
      historyId
    );

    if (!deleted) {
      throw new AppError("Search history item not found", 404);
    }

    res.status(200).json({ success: true });
  }
);

export const clearSearchHistoryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const deletedCount = await clearSearchHistory(req.user._id.toString());

    res.status(200).json({
      success: true,
      deletedCount,
    });
  }
);
