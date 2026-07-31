import type { DocumentType } from "../models/Document";
import type { VectorMetadata } from "./embedding";

export type DateFilterPreset = "today" | "7d" | "30d" | "custom";

export interface SearchFilter {
  type?: DocumentType;
  date?: DateFilterPreset;
  dateFrom?: string;
  dateTo?: string;
  topic?: string;
  tag?: string;
}

export type SearchMode = "documents" | "chunks";
export type DocumentMatchMode = "phrase" | "keyword";

export interface SearchRequest {
  q: string;
  page?: number;
  limit?: number;
  mode?: SearchMode;
  type?: DocumentType;
  date?: DateFilterPreset;
  dateFrom?: string;
  dateTo?: string;
  topic?: string;
  tag?: string;
  /** Module 1 Ctrl+F options */
  caseSensitive?: boolean | string;
  wholeWord?: boolean | string;
  prefix?: boolean | string;
  matchMode?: DocumentMatchMode;
}

export interface MatchedChunk {
  chunkId?: string;
  chunkIndex: number;
  score: number;
  similarityScore?: number;
  text?: string;
  chunkText?: string;
  preview?: string;
  pageNumber?: number;
  sectionHeading?: string;
  chapter?: string;
  topic?: string;
  subtopic?: string;
  title?: string;
  sectionPath?: string[];
  matchedKeywords?: string[];
  matchReasons?: string[];
  /** Video transcript timestamp (formatted MM:SS) */
  timestamp?: string;
  timestampSeconds?: number;
  videoUrl?: string;
}

/** Document-level search hit for Module 1 pure text search. */
export interface SearchResult {
  documentId: string;
  documentName?: string;
  title: string;
  type: DocumentType;
  /** Non-AI relevance from occurrence density */
  score: number;
  relevanceScore?: number;
  /** @deprecated Prefer relevanceScore; kept for UI compatibility */
  similarity?: number;
  preview: string;
  bestMatchPage?: number;
  matchingPages?: number[];
  occurrenceCount?: number;
  exactMatch?: boolean;
  matchType?: "phrase" | "terms" | "semantic";
  /** Exact matched substring (source casing) for future PDF highlight */
  matchQuote?: string;
  fileUrl?: string;
  highlightTerms: string[];
  createdAt: string;
  topTopic?: string;
  topSubtopic?: string;
  /** Video-specific fields */
  channel?: string;
  thumbnail?: string;
  timestamp?: string;
  timestampSeconds?: number;
  videoUrl?: string;
  youtubeVideoId?: string;
  originalFileName?: string;
  storedFileName?: string;
  filePath?: string;
  mimeType?: string;
}

export interface ChunkScoreDebug {
  crossEncoderScore?: number;
  hybridScore?: number;
  graphScore?: number;
  graphConfidence?: number;
  finalScore?: number;
  confidence?: number;
}

export interface GraphRetrievalDebugInfo {
  enabled: boolean;
  cacheHit: boolean;
  latencyMs: number;
  seedNodeCount: number;
  traversedNodeCount: number;
  traversedEdgeCount: number;
  candidateChunkCount: number;
  maxDepth: number;
  topNodes: Array<{
    nodeId: string;
    type: string;
    label: string;
    score: number;
    depth: number;
  }>;
}

export interface SearchDebugInfo {
  retrievalStage: string;
  candidateCount: number;
  graph?: GraphRetrievalDebugInfo;
  rerankLatencyMs?: number;
  rerankProvider?: string;
  rerankStage?: "rerank" | "fallback" | "skipped";
  rerankError?: string;
  rerankRetryAttempts?: number;
  rankingChanges?: Array<{
    vectorId: string;
    rankBefore: number;
    rankAfter: number;
    delta: number;
  }>;
  chunkScores?: Record<string, ChunkScoreDebug>;
}

export interface ChunkSearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentType: DocumentType;
  chunkIndex: number;
  score: number;
  similarityScore?: number;
  confidenceScore: number;
  chunkText?: string;
  preview: string;
  pageNumber?: number;
  sectionHeading?: string;
  chapter?: string;
  documentName?: string;
  fileUrl?: string;
  highlightTerms: string[];
  topic?: string;
  subtopic?: string;
  title?: string;
  sectionPath?: string[];
  matchedKeywords: string[];
  matchReasons?: string[];
  timestamp?: string;
  timestampSeconds?: number;
  videoUrl?: string;
  /** Present when ENABLE_SEARCH_DEBUG=true */
  debug?: ChunkScoreDebug;
}

export interface SearchResponse {
  success: boolean;
  query: string;
  mode: SearchMode;
  totalResults: number;
  page: number;
  limit: number;
  totalPages: number;
  searchTimeMs: number;
  results: SearchResult[];
  /** Present when mode=chunks */
  chunkResults?: ChunkSearchResult[];
  /** Present when ENABLE_SEARCH_DEBUG=true */
  debug?: SearchDebugInfo;
}

export interface SearchHistoryRecord {
  id: string;
  query: string;
  resultCount: number;
  searchTimeMs: number;
  createdAt: string;
}

export interface SearchStats {
  totalSearches: number;
  searchesToday: number;
  averageResultsReturned: number;
  totalIndexed: number;
}

export interface RankedChunkHit {
  vectorId: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  topic?: string;
  subtopic?: string;
  title?: string;
  summary?: string;
  keywords?: string[];
  tags?: string[];
  sectionPath?: string[];
  contentPreview: string;
  metadata: VectorMetadata;
  vectorScore: number;
  keywordScore: number;
  topicScore: number;
  titleScore: number;
  documentTitleScore: number;
  metadataScore: number;
  phraseScore: number;
  rrfScore: number;
  finalScore: number;
  confidenceScore: number;
  /** Cross-encoder relevance (Phase 4) */
  crossEncoderScore?: number;
  /** Pre-rerank heuristic score preserved for blending */
  hybridScore?: number;
  /** Knowledge graph relevance signals (Phase 5 graph retrieval) */
  graphScore?: number;
  graphConfidence?: number;
  graphMatchedNodes?: Array<{
    nodeId: string;
    type: string;
    label: string;
    score: number;
    depth: number;
  }>;
  recencyScore?: number;
  matchedKeywords: string[];
  matchReasons?: string[];
  pageNumber?: number;
  timestampFormatted?: string;
  timestampSeconds?: number;
  videoUrl?: string;
  youtubeVideoId?: string;
  channel?: string;
}

export interface RankedDocumentGroup {
  documentId: string;
  title: string;
  type: DocumentType;
  createdAt: Date;
  matchedChunks: MatchedChunk[];
  vectorScore: number;
  keywordScore: number;
  topicScore?: number;
  chunkCount: number;
  finalScore: number;
  bestChunkText: string;
  pageNumber?: number;
  fileUrl?: string;
  chunkId?: string;
  documentName?: string;
  originalFileName?: string;
  filePath?: string;
  mimeType?: string;
  topTopic?: string;
  topSubtopic?: string;
}
