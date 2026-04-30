import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

import {
  type AuthUser,
  TOKEN_KEY,
  exchangeGoogleUserCode as apiGoogleExchange,
  getMe,
  login as apiLogin,
  register as apiRegister,
  setUsername as apiSetUsername
} from "@/lib/api"

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, name: string, password: string) => Promise<void>
  loginWithGoogleCode: (code: string) => Promise<{ usernameRequired: boolean }>
  setUsername: (username: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setIsLoading(false)
      return
    }
    getMe()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (username: string, password: string) => {
    const { token, user } = await apiLogin(username, password)
    localStorage.setItem(TOKEN_KEY, token)
    setUser(user)
  }

  const register = async (username: string, name: string, password: string) => {
    const { token, user } = await apiRegister(username, name, password)
    localStorage.setItem(TOKEN_KEY, token)
    setUser(user)
  }

  const loginWithGoogleCode = async (code: string) => {
    const { token, user, usernameRequired } = await apiGoogleExchange(code)
    localStorage.setItem(TOKEN_KEY, token)
    setUser(user)
    return { usernameRequired }
  }

  const setUsername = async (username: string) => {
    const { token, user } = await apiSetUsername(username)
    localStorage.setItem(TOKEN_KEY, token)
    setUser(user)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, loginWithGoogleCode, setUsername, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
