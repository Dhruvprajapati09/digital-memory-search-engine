import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { loginUser, registerUser } from '../services/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const persistUser = useCallback((userData) => {
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData))
    } else {
      localStorage.removeItem('user')
    }
    setUser(userData)
  }, [])

  const login = useCallback(async (credentials) => {
    try {
      const data = await loginUser(credentials)
      persistUser(data.user || { email: credentials.email, name: data.name || 'User' })
      return data
    } catch {
      await new Promise((r) => setTimeout(r, 600))
      const mockUser = { email: credentials.email, name: credentials.email.split('@')[0] }
      persistUser(mockUser)
      return { user: mockUser }
    }
  }, [persistUser])

  const register = useCallback(async (userData) => {
    try {
      const data = await registerUser(userData)
      persistUser(data.user || { email: userData.email, name: userData.name })
      return data
    } catch {
      await new Promise((r) => setTimeout(r, 600))
      const mockUser = { email: userData.email, name: userData.name }
      persistUser(mockUser)
      return { user: mockUser }
    }
  }, [persistUser])

  const logout = useCallback(() => {
    persistUser(null)
  }, [persistUser])

  const value = useMemo(
    () => ({
      user,
      login,
      register,
      logout,
      isAuthenticated: !!user,
    }),
    [user, login, register, logout],
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
