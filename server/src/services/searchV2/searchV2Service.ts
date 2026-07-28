import { AppError } from "../../middleware/error.middleware";
import { env } from "../../config/env";
import { generatePreviewSnippet, tokenizeQuery } from "../rankingService";
import { runQueryPipeline } from "../query/queryPipeline";
import {
  retrieve,
  loadDocumentMetaForSearch,
  type RetrievalMetadataFilter,
} from "../retrieval/retrievalCore";
import { saveSearchQuery } from "../searchHistoryService";
import { rewriteSearchQuery } from "./queryRewriteService";
import { predictSemanticFilters } from "./semanticFilterService";
import { resolveSearchV2Strategy } from "./retrievalStrategyService";
import { applySearchV2Filters } from "./filterService";
import { loadPersonalizationSignals } from "./personalizationService";
import { applyLearningToRank } from "./learningRankingService";
import { markDuplicateChunks } from "./duplicateDetectionService";
import { buildSearchV2Explanation } from "./searchExplainabilityService";
import { buildSearchV2Facets } from "./facetService";
import { getSearchV2Suggestions } from "./suggestionService";
import {
  buildSearchCacheKey,
  getCachedSearchResult,
  setCachedSearchResult,
} from "./searchCacheService";
import { recordSearchV2Analytics } from "./searchAnalyticsService";
import type { DocumentType } from "../../models/Document";
import type { RankedChunkHit, SearchMode } from "../../types/search";
import type {
  SearchV2AdvancedFilters,
  SearchV2Mode,
  SearchV2PipelineDebug,
  SearchV2Request,
  SearchV2Response,
  SearchV2Result,
} from "../../types/searchV2";

const MIN_QUERY_LENGTH = 1;
const MAX_QUERY_LENGTH = 500;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function cloneResponse(response: SearchV2Response): SearchV2Response {
  return JSON.parse(JSON.stringify(response)) as SearchV2Response;
}

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
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

function parseMode(value: unknown): SearchMode {
  return value === "documents" ? "documents" : "chunks";
}

function parseSearchMode(value: unknown): SearchV2Mode {
  switch (value) {
    case "graph":
    case "keyword":
    case "vector":
    case "hybrid":
    case "semantic":
      return value;
    default:
      return "semantic";
  }
}

function buildRetrievalFilter(
  filters?: SearchV2AdvancedFilters
): RetrievalMetadataFilter | undefined {
  if (!filters) return undefined;

  const hasDate = Boolean(filters.uploadDateFrom || filters.uploadDateTo);

  return {
    type: filters.fileType,
    topic: filters.topic,
    tag: filters.tags?.[0],
    ...(hasDate
      ? {
          date: "custom" as const,
          dateFrom: filters.uploadDateFrom,
          dateTo: filters.uploadDateTo,
        }
      : {}),
  };
}

function retrievalWeightsForMode(
  searchMode: SearchV2Mode,
  strategyWeights: SearchV2Response["queryPlan"]["strategy"]["weights"]
): { vector: number; keyword: number; graph: number } {
  switch (searchMode) {
    case "graph":
      return { vector: 0.15, keyword: 0.15, graph: 0.7 };
    case "keyword":
      return { vector: 0.1, keyword: 0.8, graph: 0.1 };
    case "vector":
      return { vector: 0.8, keyword: 0.1, graph: 0.1 };
    case "hybrid":
      return { vector: 0.45, keyword: 0.45, graph: 0.1 };
    case "semantic":
    default:
      return {
        vector: strategyWeights.vector,
        keyword: strategyWeights.keyword,
        graph: strategyWeights.graph,
      };
  }
}

function documentIdsFromFilters(filters?: SearchV2AdvancedFilters): string[] | undefined {
  if (!filters) return undefined;
  if (filters.documentIds && filters.documentIds.length > 0) return filters.documentIds;
  if (filters.documentId) return [filters.documentId];
  return undefined;
}

function buildCitation(chunk: RankedChunkHit): SearchV2Result["citation"] {
  return {
    documentId: chunk.documentId,
    chunkId: chunk.vectorId,
    chunkIndex: chunk.chunkIndex,
    pageNumber: chunk.metadata.pageNumber as number | undefined,
    chapter: chunk.metadata.chapter as string | undefined,
    section: chunk.metadata.section as string | undefined,
    heading: chunk.metadata.heading as string | undefined,
    title: chunk.title,
  };
}

function resultFromRankedChunk(
  item: ReturnType<typeof markDuplicateChunks>[number],
  rank: number,
  query: string,
  documentMeta: Awaited<ReturnType<typeof loadDocumentMetaForSearch>>,
  explain: boolean
): SearchV2Result {
  const chunk = item.chunk;
  const meta = documentMeta.get(chunk.documentId);

  return {
    rank,
    chunkId: chunk.vectorId,
    documentId: chunk.documentId,
    documentTitle: meta?.title ?? (chunk.metadata.documentTitle as string) ?? "Untitled",
    documentType: (meta?.type ?? chunk.metadata.type ?? "note") as DocumentType,
    chunkIndex: chunk.chunkIndex,
    score: Math.round(item.learningScore * 10000) / 10000,
    confidenceScore: chunk.confidenceScore,
    preview: generatePreviewSnippet(chunk.contentPreview || chunk.text, query),
    topic: chunk.topic,
    subtopic: chunk.subtopic,
    title: chunk.title,
    tags: chunk.tags,
    citation: buildCitation(chunk),
    duplicateOf: item.duplicateOf,
    ...(explain ? { explanation: buildSearchV2Explanation(item, rank) } : {}),
  };
}

function createStageTracker(): {
  mark: (name: string, details?: Record<string, unknown>) => void;
  debug: Omit<SearchV2PipelineDebug, "graph" | "cacheHit">;
} {
  const stages: SearchV2PipelineDebug["stages"] = [];
  let last = Date.now();

  return {
    mark(name, details) {
      const now = Date.now();
      stages.push({
        name,
        latencyMs: now - last,
        details,
      });
      last = now;
    },
    debug: { stages },
  };
}

export async function searchV2(
  userId: string,
  params: SearchV2Request
): Promise<SearchV2Response> {
  const startedAt = Date.now();
  const tracker = createStageTracker();
  const query = validateQuery(params.q);
  const page = parsePage(params.page);
  const limit = parseLimit(params.limit);
  const mode = parseMode(params.mode);
  const searchMode = parseSearchMode(params.searchMode);
  const explain = Boolean(params.explain);
  const includeFacets = params.includeFacets !== false;
  const includeSuggestions = Boolean(params.includeSuggestions);

  const cacheKey = buildSearchCacheKey(userId, {
    version: "2.0",
    query,
    page,
    limit,
    mode,
    searchMode,
    explain,
    includeFacets,
    includeSuggestions,
    filters: params.filters ?? {},
  });

  const cached = getCachedSearchResult<SearchV2Response>(cacheKey);
  if (cached) {
    const response = cloneResponse(cached);
    response.analytics.cacheHit = true;
    response.debug = response.debug
      ? { ...response.debug, cacheHit: true }
      : undefined;
    recordSearchV2Analytics({
      userId,
      query,
      resultCount: response.totalResults,
      latencyMs: Date.now() - startedAt,
      cacheHit: true,
      graphUsed: response.analytics.graphUsed,
      strategy: response.queryPlan.strategy.strategy,
    });
    return response;
  }

  const rewrite = await rewriteSearchQuery(query, userId);
  tracker.mark("query_rewriting", {
    corrections: rewrite.corrections.length,
    expansions: rewrite.expansions.length,
    multiQueries: rewrite.multiQueries.length,
  });

  const queryAnalysis = await runQueryPipeline(rewrite.rewrittenQuery, { userId });
  const semanticFilters = predictSemanticFilters(queryAnalysis, rewrite);
  const strategy = resolveSearchV2Strategy(
    queryAnalysis,
    rewrite,
    semanticFilters
  );
  tracker.mark("query_understanding", {
    intent: queryAnalysis.intent,
    strategy: strategy.strategy,
    semanticFilters,
  });

  const candidateLimit = Math.max(
    limit * page * strategy.candidateMultiplier,
    env.RETRIEVAL_CANDIDATES
  );

  const retrieval = await retrieve({
    userId,
    query,
    queryAnalysis,
    filter: buildRetrievalFilter(params.filters),
    topic: params.filters?.topic ?? semanticFilters.topic,
    tags: params.filters?.tags,
    documentIds: documentIdsFromFilters(params.filters),
    candidateLimit,
    limit: candidateLimit,
    minVectorScore: env.MIN_VECTOR_SCORE,
    retrievalWeights: retrievalWeightsForMode(searchMode, strategy.weights),
  });
  tracker.mark("multi_stage_retrieval", {
    candidateLimit,
    retrievedChunks: retrieval.chunks.length,
    graphEnabled: retrieval.graphDebug?.enabled ?? false,
  });

  if (retrieval.noDocumentsInScope) {
    const searchTimeMs = Date.now() - startedAt;
    const emptyResponse: SearchV2Response = {
      success: true,
      version: "2.0",
      query,
      mode,
      searchMode,
      totalResults: 0,
      page,
      limit,
      totalPages: 0,
      searchTimeMs,
      queryPlan: {
        rewrite,
        queryAnalysis,
        semanticFilters,
        strategy,
      },
      results: [],
      analytics: {
        zeroResults: true,
        latencyMs: searchTimeMs,
        graphUsed: false,
        cacheHit: false,
      },
      debug: explain
        ? { ...tracker.debug, graph: retrieval.graphDebug, cacheHit: false }
        : undefined,
    };
    recordSearchV2Analytics({
      userId,
      query,
      resultCount: 0,
      latencyMs: searchTimeMs,
      cacheHit: false,
      graphUsed: false,
      strategy: strategy.strategy,
    });
    return emptyResponse;
  }

  const filtered = applySearchV2Filters(
    retrieval.chunks,
    params.filters,
    semanticFilters
  );
  tracker.mark("semantic_filtering", {
    before: retrieval.chunks.length,
    after: filtered.chunks.length,
    semanticFilterApplied: filtered.semanticFilterApplied,
  });

  const docIds = [...new Set(filtered.chunks.map((chunk) => chunk.documentId))];
  const [documentMeta, personalization] = await Promise.all([
    loadDocumentMetaForSearch(userId, docIds),
    loadPersonalizationSignals(userId),
  ]);

  const ranked = applyLearningToRank(
    filtered.chunks,
    strategy,
    documentMeta,
    personalization,
    tokenizeQuery(rewrite.rewrittenQuery)
  );
  const deduped = markDuplicateChunks(ranked);
  tracker.mark("learning_to_rank", {
    rankedChunks: ranked.length,
    duplicates: deduped.filter((item) => item.duplicateOf).length,
  });

  const totalResults = deduped.length;
  const totalPages = totalResults === 0 ? 0 : Math.ceil(totalResults / limit);
  const offset = (page - 1) * limit;
  const pageItems = deduped.slice(offset, offset + limit);
  const results = pageItems.map((item, index) =>
    resultFromRankedChunk(
      item,
      offset + index + 1,
      query,
      documentMeta,
      explain
    )
  );

  const [facets, suggestions] = await Promise.all([
    includeFacets ? Promise.resolve(buildSearchV2Facets(deduped)) : Promise.resolve(undefined),
    includeSuggestions
      ? getSearchV2Suggestions(userId, query, 8)
      : Promise.resolve(undefined),
  ]);
  tracker.mark("facets_suggestions", {
    facets: facets?.length ?? 0,
    suggestions: suggestions?.length ?? 0,
  });

  const searchTimeMs = Date.now() - startedAt;
  await saveSearchQuery(userId, query, totalResults, searchTimeMs);

  const response: SearchV2Response = {
    success: true,
    version: "2.0",
    query,
    mode,
    searchMode,
    totalResults,
    page,
    limit,
    totalPages,
    searchTimeMs,
    queryPlan: {
      rewrite,
      queryAnalysis,
      semanticFilters,
      strategy,
    },
    results,
    ...(facets ? { facets } : {}),
    ...(suggestions ? { suggestions } : {}),
    analytics: {
      zeroResults: totalResults === 0,
      latencyMs: searchTimeMs,
      graphUsed: Boolean(retrieval.graphDebug?.enabled),
      cacheHit: false,
    },
    debug:
      explain || env.ENABLE_SEARCH_DEBUG
        ? { ...tracker.debug, graph: retrieval.graphDebug, cacheHit: false }
        : undefined,
  };

  recordSearchV2Analytics({
    userId,
    query,
    resultCount: totalResults,
    latencyMs: searchTimeMs,
    cacheHit: false,
    graphUsed: Boolean(retrieval.graphDebug?.enabled),
    strategy: strategy.strategy,
  });

  setCachedSearchResult(cacheKey, cloneResponse(response));

  return response;
}
