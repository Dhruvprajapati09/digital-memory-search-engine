import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import {
  loginUser,
  registerUser,
  getCurrentUser,
  logoutUser,
  setToken,
  getToken,
  clearToken,
} from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const restoreSession = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const data = await getCurrentUser()
      setUser(data.user)
      setError(null)
    } catch {
      clearToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  const login = useCallback(async (credentials) => {
    setError(null)
    const data = await loginUser(credentials)
    setToken(data.token, credentials.rememberMe !== false)
    setUser(data.user)
    return data
  }, [])

  const register = useCallback(async (userData) => {
    setError(null)
    const data = await registerUser(userData)
    setToken(data.token, true)
    setUser(data.user)
    return data
  }, [])

  const logout = useCallback(async () => {
    await logoutUser()
    setUser(null)
    setError(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      login,
      register,
      logout,
      isAuthenticated: !!user,
    }),
    [user, loading, error, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
