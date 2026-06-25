import type { DocumentType } from "../models/Document";

export type DateFilterPreset = "today" | "7d" | "30d" | "custom";

export interface SearchFilter {
  type?: DocumentType;
  date?: DateFilterPreset;
  dateFrom?: string;
  dateTo?: string;
  topic?: string;
  tag?: string;
}

export interface SearchRequest {
  q: string;
  page?: number;
  limit?: number;
  type?: DocumentType;
  date?: DateFilterPreset;
  dateFrom?: string;
  dateTo?: string;
  topic?: string;
  tag?: string;
}

export interface MatchedChunk {
  chunkIndex: number;
  score: number;
  text?: string;
  topic?: string;
  subtopic?: string;
  title?: string;
  sectionPath?: string[];
}

export interface SearchResult {
  documentId: string;
  title: string;
  type: DocumentType;
  score: number;
  preview: string;
  highlightTerms: string[];
  matchedChunks: MatchedChunk[];
  createdAt: string;
  topTopic?: string;
  topSubtopic?: string;
}

export interface SearchResponse {
  success: boolean;
  query: string;
  totalResults: number;
  page: number;
  limit: number;
  totalPages: number;
  searchTimeMs: number;
  results: SearchResult[];
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
  chunkIndex: number;
  text: string;
  topic?: string;
  subtopic?: string;
  title?: string;
  sectionPath?: string[];
  contentPreview: string;
  vectorScore: number;
  keywordScore: number;
  topicScore: number;
  titleScore: number;
  phraseScore: number;
  rrfScore: number;
  finalScore: number;
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
  topTopic?: string;
  topSubtopic?: string;
}
