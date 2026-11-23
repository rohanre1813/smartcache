import React, { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

export interface User {
  id: string
  name: string
  email: string
  tenant_id: string
  created_at: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  isModalOpen: boolean
  modalMode: 'signin' | 'signup'
  mongodbConnected: boolean
  openAuthModal: (mode?: 'signin' | 'signup') => void
  closeAuthModal: () => void
  login: (token: string, user: User, mongodbConnected?: boolean) => void
  logout: () => void
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'smartcache_auth_token_v1'
const USER_KEY = 'smartcache_auth_user_v1'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<User | null>(() => {
    try {
      const u = localStorage.getItem(USER_KEY)
      return u ? JSON.parse(u) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'signin' | 'signup'>('signin')
  const [mongodbConnected, setMongodbConnected] = useState(false)

  // Configure global axios authorization header
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete axios.defaults.headers.common['Authorization']
    }
  }, [token])

  const openAuthModal = (mode: 'signin' | 'signup' = 'signin') => {
    setModalMode(mode)
    setIsModalOpen(true)
  }

  const closeAuthModal = () => {
    setIsModalOpen(false)
  }

  const login = (newToken: string, newUser: User, isMongo = false) => {
    setToken(newToken)
    setUser(newUser)
    setMongodbConnected(isMongo)
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(newUser))
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
    closeAuthModal()
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    delete axios.defaults.headers.common['Authorization']
  }

  const checkAuth = async () => {
    if (!token) return
    setLoading(true)
    try {
      const { data } = await axios.get('/api/auth/me')
      if (data.user) {
        setUser(data.user)
        setMongodbConnected(data.mongodb_connected)
        localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      }
    } catch {
      logout()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isModalOpen,
        modalMode,
        mongodbConnected,
        openAuthModal,
        closeAuthModal,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
