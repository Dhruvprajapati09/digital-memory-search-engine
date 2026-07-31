import type { DocumentType } from './document'

export type DateFilterPreset = 'today' | '7d' | '30d' | 'custom'
export type DocumentMatchMode = 'phrase' | 'keyword'

export interface SearchFilter {
  type?: DocumentType
  date?: DateFilterPreset
  dateFrom?: string
  dateTo?: string
}

export interface SearchOptions {
  caseSensitive?: boolean
  wholeWord?: boolean
  prefix?: boolean
  matchMode?: DocumentMatchMode
}

export interface SearchParams extends SearchFilter, SearchOptions {
  q: string
  page?: number
  limit?: number
}

/** Document-level search hit from Module 1 pure text search. */
export interface SearchResult {
  documentId: string
  documentName?: string
  title: string
  type: DocumentType
  score: number
  relevanceScore?: number
  similarity?: number
  preview: string
  bestMatchPage?: number
  matchingPages?: number[]
  occurrenceCount?: number
  exactMatch?: boolean
  matchType?: 'phrase' | 'terms' | 'semantic'
  matchQuote?: string
  fileUrl?: string
  highlightTerms: string[]
  createdAt: string
  topTopic?: string
  topSubtopic?: string
  channel?: string
  thumbnail?: string
  timestamp?: string
  timestampSeconds?: number
  videoUrl?: string
  youtubeVideoId?: string
  originalFileName?: string
  storedFileName?: string
  filePath?: string
  mimeType?: string
}

export interface SearchResponse {
  success: boolean
  query: string
  mode?: string
  totalResults: number
  page: number
  limit: number
  totalPages: number
  searchTimeMs: number
  results: SearchResult[]
}

export interface SearchHistoryItem {
  id: string
  query: string
}

export interface SearchHistoryResponse {
  success: boolean
  history: SearchHistoryItem[]
}

export interface SearchStats {
  totalSearches: number
  searchesToday: number
  averageResultsReturned: number
  totalIndexed: number
}

export interface SearchStatsResponse {
  success: boolean
  stats: SearchStats
}

export interface DashboardStats extends SearchStats {
  totalDocuments: number
  totalExtracted: number
  totalChunks: number
}
