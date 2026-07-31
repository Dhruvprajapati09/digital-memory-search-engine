import { getToken } from './authService'
import type {
  AskResponse,
  ConversationResponse,
  ListConversationsResponse,
} from '../types/chat'

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

export async function listConversations(): Promise<ListConversationsResponse> {
  const response = await fetch(`${API_BASE}/chat/conversations`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return handleResponse<ListConversationsResponse>(response)
}

export async function createConversation(): Promise<ConversationResponse> {
  const response = await fetch(`${API_BASE}/chat/conversations`, {
    method: 'POST',
    headers: authHeaders(),
  })

  return handleResponse<ConversationResponse>(response)
}

export async function getConversation(
  id: string,
): Promise<ConversationResponse> {
  const response = await fetch(`${API_BASE}/chat/conversations/${id}`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return handleResponse<ConversationResponse>(response)
}

export async function askInConversation(
  id: string,
  question: string,
): Promise<AskResponse> {
  const response = await fetch(`${API_BASE}/chat/conversations/${id}/ask`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ question }),
  })

  return handleResponse<AskResponse>(response)
}

export async function deleteConversation(
  id: string,
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/chat/conversations/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })

  return handleResponse<{ success: boolean }>(response)
}
