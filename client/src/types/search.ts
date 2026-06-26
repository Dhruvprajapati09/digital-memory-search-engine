import type { DocumentType } from './document'

export type DateFilterPreset = 'today' | '7d' | '30d' | 'custom'

export interface SearchFilter {
  type?: DocumentType
  date?: DateFilterPreset
  dateFrom?: string
  dateTo?: string
}

export interface SearchParams extends SearchFilter {
  q: string
  page?: number
  limit?: number
}

export interface MatchedChunk {
  chunkIndex: number
  score: number
  topic?: string
  subtopic?: string
  title?: string
  sectionPath?: string[]
<<<<<<< HEAD
=======
  timestamp?: string
  timestampSeconds?: number
  videoUrl?: string
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
}

export interface SearchResult {
  documentId: string
  title: string
  type: DocumentType
  score: number
  preview: string
  highlightTerms: string[]
  matchedChunks: MatchedChunk[]
  createdAt: string
  topTopic?: string
  topSubtopic?: string
<<<<<<< HEAD
=======
  channel?: string
  thumbnail?: string
  timestamp?: string
  timestampSeconds?: number
  videoUrl?: string
  youtubeVideoId?: string
>>>>>>> 171e545 (feat: implement advanced RAG search pipeline with AI chat and YouTube ingestion)
}

export interface SearchResponse {
  success: boolean
  query: string
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
