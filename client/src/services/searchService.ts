import { getToken } from './authService'
import type {
  SearchParams,
  SearchResponse,
  SearchHistoryResponse,
  SearchStatsResponse,
  MemoryAnswer,
} from '../types/search'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

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

function authHeaders(): Record<string, string> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

function buildSearchQuery(params: SearchParams): string {
  const search = new URLSearchParams()
  search.set('q', params.q)

  if (params.page) search.set('page', String(params.page))
  if (params.limit) search.set('limit', String(params.limit))
  if (params.type) search.set('type', params.type)
  if (params.date) search.set('date', params.date)
  if (params.dateFrom) search.set('dateFrom', params.dateFrom)
  if (params.dateTo) search.set('dateTo', params.dateTo)

  return search.toString()
}

export async function searchDocuments(
  params: SearchParams,
): Promise<SearchResponse> {
  const query = buildSearchQuery(params)

  const response = await fetch(`${API_BASE}/search?${query}`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return handleResponse<SearchResponse>(response)
}

export async function fetchSearchHistory(): Promise<SearchHistoryResponse> {
  const response = await fetch(`${API_BASE}/search/history`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return handleResponse<SearchHistoryResponse>(response)
}

export async function fetchSearchStats() {
  const response = await fetch(`${API_BASE}/search/stats`, {
    method: 'GET',
    headers: authHeaders(),
  })

  const data = await handleResponse<SearchStatsResponse>(response)
  return data.stats
}

export async function deleteSearchHistoryItem(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/search/history/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })

  await handleResponse(response)
}

export async function clearSearchHistory(): Promise<void> {
  const response = await fetch(`${API_BASE}/search/history`, {
    method: 'DELETE',
    headers: authHeaders(),
  })

  await handleResponse(response)
}

export async function askMemory(question: string): Promise<MemoryAnswer> {
  const response = await fetch(`${API_BASE}/search/ask`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ question }),
  })

  return handleResponse<MemoryAnswer>(response)
}
