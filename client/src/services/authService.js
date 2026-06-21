const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const TOKEN_KEY = 'auth_token'

function getStorage(persistent = true) {
  return persistent ? localStorage : sessionStorage
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token, rememberMe = true) {
  clearToken()
  getStorage(rememberMe).setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}

function authHeaders() {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = data.message || data.errors?.join('. ') || 'Request failed'
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return data
}

export async function loginUser({ email, password }) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  return handleResponse(response)
}

export async function registerUser({ name, email, password }) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  })

  return handleResponse(response)
}

export async function getCurrentUser() {
  const response = await fetch(`${API_BASE}/auth/me`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return handleResponse(response)
}

export async function logoutUser() {
  const token = getToken()

  if (token) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: authHeaders(),
      })
    } catch {
      // Client-side logout still proceeds if server is unreachable
    }
  }

  clearToken()
}
