/** Contexto de autenticação: sessão via cookies httpOnly, bootstrap com GET /auth/me. */

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, setOnSessionExpired } from './api'

export interface AuthUser {
  id: number
  email: string
  name: string
  email_verified: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  /** true enquanto o bootstrap inicial (GET /auth/me) não terminou */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  /** limpa a sessão localmente (ex.: conta eliminada) */
  clearSession: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setOnSessionExpired(() => setUser(null))
    api<AuthUser>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const u = await api<AuthUser>('/auth/login', { method: 'POST', body: { email, password }, skipRefresh: true })
    setUser(u)
  }, [])

  const register = useCallback(async (email: string, password: string, name: string) => {
    const u = await api<AuthUser>('/auth/register', {
      method: 'POST',
      body: { email, password, name },
      skipRefresh: true,
    })
    setUser(u)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', skipRefresh: true })
    } catch {
      // mesmo que falhe, terminamos a sessão localmente
    }
    setUser(null)
  }, [])

  const clearSession = useCallback(() => setUser(null), [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, clearSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora de <AuthProvider>')
  return ctx
}
