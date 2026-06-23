export type DocumentType = 'pdf' | 'image' | 'note'

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
