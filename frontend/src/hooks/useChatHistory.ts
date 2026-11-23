import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import { ChatMessage, ChatSession } from '../types'

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: 'msg_welcome',
  role: 'assistant',
  content: `### Welcome to SmartCache & Intelligent LLM Router ⚡

I am your high-performance enterprise gateway. Every request you submit is processed through:
- **Upstash Redis Exact Cache** (~15ms)
- **Semantic Vector Similarity** (Pinecone / ChromaDB with 0.78 threshold)
- **5 Production Guardrails**: Entity Disambiguation, Antonym Polarity Inversion, Temporal 60s TTL, SingleFlight Mutex, and Multitenancy
- **Dynamic Gemini Flash / Pro Routing** with automatic Presidio PII Redaction

Type any question below or choose from the quick test presets to experience word-by-word streaming answers!`,
  timestamp: new Date().toISOString(),
  cache_hit: true,
  cache_type: 'exact',
  model_used: 'redis-cache',
  latency_ms: 12.4,
  similarity_score: 1.0,
  guardrail_status: 'System Ready',
}

function createLocalWelcomeSession(tenantId = 'default'): ChatSession {
  return {
    id: `sess_welcome_${Date.now()}`,
    title: 'New Conversation',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tenantId,
    messages: [{ ...DEFAULT_WELCOME_MESSAGE, id: `msg_welcome_${Date.now()}` }],
  }
}

export function useChatHistory(userId?: string) {
  const storageKey = `smartcache_chat_sessions_${userId || 'guest'}`
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [loadingSessions, setLoadingSessions] = useState(false)
  const currentUserIdRef = useRef<string | undefined>(userId)

  // Load sessions from MongoDB Atlas (with scoped localStorage fallback)
  const loadUserSessions = useCallback(async () => {
    if (!userId) {
      // Guest mode or unauthenticated
      setSessions([])
      setActiveSessionId('')
      return
    }

    setLoadingSessions(true)
    try {
      // 1. Fetch user's own isolated sessions from MongoDB Atlas
      const { data: dbSessions } = await axios.get<any[]>('/api/chat/sessions')

      if (Array.isArray(dbSessions) && dbSessions.length > 0) {
        // Load messages for each session
        const formattedSessions: ChatSession[] = await Promise.all(
          dbSessions.map(async (s) => {
            let messages: ChatMessage[] = []
            try {
              const { data: dbMsgs } = await axios.get<any[]>(
                `/api/chat/sessions/${s.id}/messages`
              )
              if (Array.isArray(dbMsgs) && dbMsgs.length > 0) {
                messages = dbMsgs.map((m: any) => ({
                  id: m.id || m._id || `msg_${Date.now()}`,
                  role: m.role || 'assistant',
                  content: m.content || '',
                  timestamp: m.timestamp || new Date().toISOString(),
                  cache_hit: m.cache_hit ?? false,
                  cache_type: m.cache_type ?? null,
                  model_used: m.model_used ?? 'gemini-flash',
                  latency_ms: m.latency_ms ?? 0,
                  similarity_score: m.similarity_score ?? undefined,
                  pii_detected: m.pii_detected ?? false,
                  guardrail_status: m.guardrail_status ?? null,
                  is_temporal: m.is_temporal ?? false,
                  tenant_id: m.tenant_id ?? 'default',
                  tokens_used: m.tokens_used ?? 0,
                }))
              } else {
                messages = [{ ...DEFAULT_WELCOME_MESSAGE, id: `msg_${s.id}_welcome` }]
              }
            } catch {
              messages = [{ ...DEFAULT_WELCOME_MESSAGE, id: `msg_${s.id}_welcome` }]
            }

            return {
              id: s.id,
              title: s.title || 'Conversation',
              createdAt: s.created_at || s.createdAt || new Date().toISOString(),
              updatedAt: s.updated_at || s.updatedAt || new Date().toISOString(),
              tenantId: s.tenant_id || s.tenantId || 'default',
              messages,
            }
          })
        )

        setSessions(formattedSessions)
        setActiveSessionId(formattedSessions[0].id)
        localStorage.setItem(storageKey, JSON.stringify(formattedSessions))
      } else {
        // User has no sessions in MongoDB yet; create their first isolated session in MongoDB Atlas
        try {
          const { data: newDbSess } = await axios.post('/api/chat/sessions', {
            title: 'New Conversation',
          })
          const initSession: ChatSession = {
            id: newDbSess.id,
            title: newDbSess.title || 'New Conversation',
            createdAt: newDbSess.created_at || new Date().toISOString(),
            updatedAt: newDbSess.updated_at || new Date().toISOString(),
            tenantId: newDbSess.tenant_id || 'default',
            messages: [{ ...DEFAULT_WELCOME_MESSAGE, id: `msg_${newDbSess.id}_welcome` }],
          }
          setSessions([initSession])
          setActiveSessionId(initSession.id)
          localStorage.setItem(storageKey, JSON.stringify([initSession]))
        } catch {
          // If offline or fallback
          const localInit = createLocalWelcomeSession()
          setSessions([localInit])
          setActiveSessionId(localInit.id)
        }
      }
    } catch (err) {
      // If network fails, load strictly from user-scoped localStorage
      try {
        const stored = localStorage.getItem(storageKey)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSessions(parsed)
            setActiveSessionId(parsed[0].id)
            return
          }
        }
      } catch (e) {
        console.error('Failed to parse cached sessions:', e)
      }
      const localInit = createLocalWelcomeSession()
      setSessions([localInit])
      setActiveSessionId(localInit.id)
    } finally {
      setLoadingSessions(false)
    }
  }, [userId, storageKey])

  // When user changes (login, switch account, logout), reload isolated sessions
  useEffect(() => {
    currentUserIdRef.current = userId
    if (!userId) {
      setSessions([])
      setActiveSessionId('')
    } else {
      loadUserSessions()
    }
  }, [userId, loadUserSessions])

  // Sync to user-scoped localStorage
  useEffect(() => {
    if (sessions.length > 0 && userId) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(sessions))
      } catch (e) {
        console.error('Failed to save to localStorage:', e)
      }
    }
  }, [sessions, storageKey, userId])

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0]

  const newChat = useCallback(
    async (tenantId = 'default') => {
      if (!userId) return ''

      try {
        // Create session in MongoDB Atlas
        const { data: dbSess } = await axios.post('/api/chat/sessions', {
          title: 'New Conversation',
          tenant_id: tenantId,
        })
        const fresh: ChatSession = {
          id: dbSess.id,
          title: dbSess.title || 'New Conversation',
          createdAt: dbSess.created_at || new Date().toISOString(),
          updatedAt: dbSess.updated_at || new Date().toISOString(),
          tenantId: dbSess.tenant_id || tenantId,
          messages: [{ ...DEFAULT_WELCOME_MESSAGE, id: `msg_${dbSess.id}_welcome` }],
        }
        setSessions((prev) => [fresh, ...prev])
        setActiveSessionId(fresh.id)
        return fresh.id
      } catch (e) {
        const fresh = createLocalWelcomeSession(tenantId)
        setSessions((prev) => [fresh, ...prev])
        setActiveSessionId(fresh.id)
        return fresh.id
      }
    },
    [userId]
  )

  const switchSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId)
  }, [])

  const deleteSession = useCallback(
    async (sessionId: string) => {
      // Delete from MongoDB Atlas
      try {
        await axios.delete(`/api/chat/sessions/${sessionId}`)
      } catch (e) {
        console.error('Failed to delete session on Atlas:', e)
      }

      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== sessionId)
        if (filtered.length === 0) {
          const fresh = createLocalWelcomeSession()
          setActiveSessionId(fresh.id)
          return [fresh]
        }
        if (sessionId === activeSessionId) {
          setActiveSessionId(filtered[0].id)
        }
        return filtered
      })
    },
    [activeSessionId]
  )

  const addMessageToActive = useCallback(
    (message: ChatMessage) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s

          // Auto-title session from first user message
          let newTitle = s.title
          if (s.title === 'New Conversation' && message.role === 'user') {
            const trimmed = message.content.trim()
            newTitle = trimmed.length > 32 ? trimmed.substring(0, 32) + '…' : trimmed
          }

          return {
            ...s,
            title: newTitle,
            updatedAt: new Date().toISOString(),
            messages: [...s.messages, message],
          }
        })
      )
    },
    [activeSessionId]
  )

  const clearCurrentSessionMessages = useCallback(() => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s
        return {
          ...s,
          messages: [{ ...DEFAULT_WELCOME_MESSAGE, id: `msg_welcome_${Date.now()}` }],
          updatedAt: new Date().toISOString(),
        }
      })
    )
  }, [activeSessionId])

  return {
    sessions,
    activeSession,
    activeSessionId,
    newChat,
    switchSession,
    deleteSession,
    addMessageToActive,
    clearCurrentSessionMessages,
    loadingSessions,
    refreshSessions: loadUserSessions,
  }
}
export default useChatHistory
