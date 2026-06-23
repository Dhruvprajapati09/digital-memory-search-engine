export type DocumentType = 'pdf' | 'image' | 'note'

export type ExtractionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
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
  createdAt: string
  updatedAt?: string
}

export interface DocumentsResponse {
  success: boolean
  documents: Document[]
}

export interface DocumentResponse {
  success: boolean
  document: Document
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
  total: number
  notes: number
  pdfs: number
  images: number
}

export interface ExtractionResult {
  success: boolean
  text?: string
  error?: string
}
