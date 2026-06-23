import { getToken } from './authService'
import type {
  Document,
  DocumentsResponse,
  DocumentResponse,
  DeleteDocumentResponse,
} from '../types/document'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const API_ORIGIN = API_BASE.replace(/\/api$/, '')

interface ApiError extends Error {
  status?: number
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))

  if (!response.ok || data.success === false) {
    const message =
      data.message || data.errors?.join('. ') || 'Request failed'
    const error = new Error(message) as ApiError
    error.status = response.status
    throw error
  }

  return data as T
}

function authHeaders(json = true): Record<string, string> {
  const token = getToken()
  const headers: Record<string, string> = {}

  if (json) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

export function getFileUrl(document: Document): string | null {
  if (!document.storedFileName) return null
  return `${API_ORIGIN}/uploads/${document.storedFileName}`
}

export async function fetchDocuments(): Promise<Document[]> {
  const response = await fetch(`${API_BASE}/documents`, {
    method: 'GET',
    headers: authHeaders(),
  })

  const data = await handleResponse<DocumentsResponse>(response)
  return data.documents
}

export async function uploadDocument(
  file: File,
  title?: string,
): Promise<Document> {
  const formData = new FormData()
  formData.append('file', file)

  if (title?.trim()) {
    formData.append('title', title.trim())
  }

  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    headers: authHeaders(false),
    body: formData,
  })

  const data = await handleResponse<DocumentResponse>(response)
  return data.document
}

export async function createNote(
  title: string,
  content: string,
): Promise<Document> {
  const response = await fetch(`${API_BASE}/documents/note`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, content }),
  })

  const data = await handleResponse<DocumentResponse>(response)
  return data.document
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/documents/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })

  await handleResponse<DeleteDocumentResponse>(response)
}
