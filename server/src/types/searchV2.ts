import type { DocumentType } from "../models/Document";
import type {
  GraphRetrievalDebugInfo,
  RankedChunkHit,
  SearchMode,
} from "./search";
import type { QueryPipelineResult } from "./query";

export type SearchV2Mode = "semantic" | "hybrid" | "graph" | "keyword" | "vector";

export type SearchV2Strategy =
  | "fact_lookup"
  | "definition"
  | "comparison"
  | "summarization"
  | "code_search"
  | "document_navigation"
  | "question_answering"
  | "entity_search"
  | "topic_search"
  | "timeline_search"
  | "relationship_search"
  | "general_search";

export interface SearchV2AdvancedFilters {
  documentId?: string;
  documentIds?: string[];
  page?: number;
  chapter?: string;
  section?: string;
  heading?: string;
  author?: string;
  tags?: string[];
  language?: string;
  fileType?: DocumentType;
  uploadDateFrom?: string;
  uploadDateTo?: string;
  modifiedDateFrom?: string;
  modifiedDateTo?: string;
  entity?: string;
  topic?: string;
}

export interface SearchV2Request {
  q: string;
  page?: number;
  limit?: number;
  mode?: SearchMode;
  searchMode?: SearchV2Mode;
  explain?: boolean;
  includeFacets?: boolean;
  includeSuggestions?: boolean;
  stream?: boolean;
  filters?: SearchV2AdvancedFilters;
}

export interface SearchV2Weights {
  vector: number;
  keyword: number;
  metadata: number;
  graph: number;
  recency: number;
  crossEncoder: number;
  popularity: number;
  freshness: number;
}

export interface SearchV2StrategyPlan {
  strategy: SearchV2Strategy;
  confidence: number;
  weights: SearchV2Weights;
  candidateMultiplier: number;
  contextWindow: number;
  reasons: string[];
}

export interface SearchV2SemanticFilters {
  language?: string;
  framework?: string;
  entity?: string;
  topic?: string;
  tags: string[];
}

export interface SearchV2QueryRewrite {
  originalQuery: string;
  normalizedQuery: string;
  correctedQuery: string;
  rewrittenQuery: string;
  expansions: string[];
  multiQueries: string[];
  decomposedQuestions: string[];
  corrections: Array<{ from: string; to: string }>;
}

export interface SearchV2QueryPlan {
  rewrite: SearchV2QueryRewrite;
  queryAnalysis: QueryPipelineResult;
  semanticFilters: SearchV2SemanticFilters;
  strategy: SearchV2StrategyPlan;
}

export interface SearchV2Explanation {
  whyRetrieved: string[];
  scores: {
    similarity: number;
    keyword: number;
    metadata: number;
    graph: number;
    graphConfidence?: number;
    crossEncoder?: number;
    popularity: number;
    freshness: number;
    final: number;
  };
  rankingPosition: number;
  matchedTerms: string[];
  matchedEntities: string[];
  matchedFields: string[];
}

export interface SearchV2Citation {
  documentId: string;
  chunkId: string;
  chunkIndex: number;
  pageNumber?: number;
  chapter?: string;
  section?: string;
  heading?: string;
  title?: string;
}

export interface SearchV2Result {
  rank: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentType: DocumentType;
  chunkIndex: number;
  score: number;
  confidenceScore: number;
  preview: string;
  topic?: string;
  subtopic?: string;
  title?: string;
  tags?: string[];
  citation: SearchV2Citation;
  duplicateOf?: string;
  explanation?: SearchV2Explanation;
}

export interface SearchV2FacetValue {
  value: string;
  count: number;
}

export interface SearchV2Facet {
  field: string;
  values: SearchV2FacetValue[];
}

export interface SearchV2Suggestion {
  type: "recent" | "popular" | "entity" | "topic" | "document";
  value: string;
  score: number;
}

export interface SearchV2PipelineDebug {
  stages: Array<{
    name: string;
    latencyMs: number;
    details?: Record<string, unknown>;
  }>;
  graph?: GraphRetrievalDebugInfo;
  cacheHit: boolean;
}

export interface SearchV2Response {
  success: boolean;
  version: "2.0";
  query: string;
  mode: SearchMode;
  searchMode: SearchV2Mode;
  totalResults: number;
  page: number;
  limit: number;
  totalPages: number;
  searchTimeMs: number;
  queryPlan: SearchV2QueryPlan;
  results: SearchV2Result[];
  facets?: SearchV2Facet[];
  suggestions?: SearchV2Suggestion[];
  analytics: {
    zeroResults: boolean;
    latencyMs: number;
    graphUsed: boolean;
    cacheHit: boolean;
  };
  debug?: SearchV2PipelineDebug;
}

export interface SearchV2RankedChunk {
  chunk: RankedChunkHit;
  learningScore: number;
  popularityScore: number;
  freshnessScore: number;
  citationScore: number;
  duplicateOf?: string;
}

export interface SearchV2BenchmarkCase {
  id: string;
  query: string;
  relevantChunkIds: string[];
  retrievedChunkIds: string[];
  latencyMs?: number;
}

export interface SearchV2BenchmarkReport {
  cases: number;
  recallAt5: number;
  recallAt10: number;
  precisionAt5: number;
  mrr: number;
  ndcgAt10: number;
  averageLatencyMs: number;
}
