const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

import { getToken } from './authService'

export interface YouTubeVideoSummary {
  id: string
  videoId: string
  title: string
  channel: string
  duration: string
  thumbnail: string
  language?: string
  url: string
  status: string
  documentId?: string
  chunksIndexed?: number
}

export interface YouTubeImportResponse {
  success: boolean
  video: YouTubeVideoSummary
  chunksIndexed: number
  duplicate?: boolean
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))

  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'YouTube import failed')
  }

  return data as T
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function importYouTubeVideo(
  url: string,
): Promise<YouTubeImportResponse> {
  const response = await fetch(`${API_BASE}/youtube/import`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ url }),
  })

  return handleResponse<YouTubeImportResponse>(response)
}
