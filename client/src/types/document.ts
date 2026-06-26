export type DocumentType = 'pdf' | 'image' | 'note' | 'text'

export type ExtractionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'

export type IndexStatus =
  | 'pending'
  | 'processing'
  | 'indexed'
  | 'failed'

export interface Document {
  id: string
  title: string
  type: DocumentType
  originalFileName?: string
  storedFileName?: string
  filePath?: string
  fileSize?: number
  mimeType?: string
  noteContent?: string
  extractedText?: string
  extractionStatus?: ExtractionStatus
  extractionError?: string | null
  status?: ExtractionStatus
  indexStatus?: IndexStatus
  indexedAt?: string | null
  chunkCount?: number
  embeddingModel?: string | null
  indexError?: string | null
  createdAt: string
  updatedAt?: string
}

export interface Chunk {
  id: string
  documentId: string
  userId: string
  chunkIndex: number
  text: string
  tokenCount: number
  vectorId: string
  embeddingModel: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface DocumentsResponse {
  success: boolean
  documents: Document[]
}

export interface DocumentResponse {
  success: boolean
  document: Document
}

export interface ChunksResponse {
  success: boolean
  chunks: Chunk[]
}

export interface IndexStatusResponse {
  success: boolean
  status: IndexStatus
  chunkCount: number
  indexedAt?: string | null
  embeddingModel?: string | null
  indexError?: string | null
  extractionStatus?: ExtractionStatus
  extractionError?: string | null
}

export interface DocumentStatsResponse {
  success: boolean
  stats: {
    totalDocuments: number
    totalExtracted: number
    totalIndexed: number
    totalChunks: number
  }
}

export interface DeleteDocumentResponse {
  success: boolean
  message: string
}

export interface ReprocessResponse {
  success: boolean
}

export interface ApiErrorResponse {
  success: false
  message: string
}

export interface DocumentStats {
  totalDocuments: number
  totalExtracted: number
  totalIndexed: number
  totalChunks: number
}

export interface Flashcard {
  question: string
  answer: string
}

export interface QuizQuestion {
  question: string
  answer: string
  options: string[]
}

export interface DocumentInsights {
  success: boolean
  summary: string
  keyPoints: string[]
  tags: string[]
  actionItems: string[]
  flashcards: Flashcard[]
  quiz: QuizQuestion[]
}

export interface ExtractionResult {
  success: boolean
  text?: string
  error?: string
}

export interface EmbeddingResponse {
  vector: number[]
  model: string
}

export interface VectorMetadata {
  documentId: string
  userId: string
  chunkIndex: number
  type: string
  documentTitle?: string
}
