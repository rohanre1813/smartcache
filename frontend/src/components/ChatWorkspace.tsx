import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  Send,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  Cpu,
  Clock,
  Layers,
  Zap,
  ShieldCheck,
  Check,
  Copy,
  MessageSquare,
  RotateCcw,
  Bot,
  User,
  SlidersHorizontal,
  ArrowRight
} from 'lucide-react'
import { useChatHistory } from '../hooks/useChatHistory'
import { useAuth } from '../context/AuthContext'
import { ChatMessage, QueryRequest, QueryResponse } from '../types'
import StreamingMarkdown from './StreamingMarkdown'

const PRESET_PROMPTS = [
  { label: '🇮🇳 India Capital', prompt: 'What is the capital of India?' },
  { label: '⚡ Paraphrase Hit', prompt: 'Can you share me the capital of India?' },
  { label: '🎬 Michael B. Jordan', prompt: 'Who is Michael B. Jordan?' },
  { label: '🏀 Michael Jordan (Guardrail)', prompt: 'Who is Michael Jordan?' },
  { label: '✅ Microservices Pros', prompt: 'What are the advantages of microservices?' },
  { label: '❌ Microservices Cons (Antonym)', prompt: 'What are the disadvantages of microservices?' },
  { label: '⏱️ Apple Stock (Temporal 60s)', prompt: "What is today's current stock price of Apple?" },
  { label: '🔒 PII Masking Test', prompt: 'My email is rohan@example.com and phone is 555-0199, what are vector caches?' },
]

export const ChatWorkspace: React.FC = () => {
  const { user, mongodbConnected } = useAuth()
  const {
    sessions,
    activeSession,
    activeSessionId,
    newChat,
    switchSession,
    deleteSession,
    addMessageToActive,
    clearCurrentSessionMessages,
  } = useChatHistory(user?.id)

  const [inputPrompt, setInputPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [tenantId, setTenantId] = useState(() => user?.tenant_id || 'default')
  const [isPrivate, setIsPrivate] = useState(false)
  const [latestStreamingMsgId, setLatestStreamingMsgId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const chatScrollContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync tenant with logged-in user
  useEffect(() => {
    if (user?.tenant_id) {
      setTenantId(user.tenant_id)
    }
  }, [user])

  // Internal smooth scroll that NEVER scrolls the outer browser window upwards
  const scrollToBottom = () => {
    if (chatScrollContainerRef.current) {
      chatScrollContainerRef.current.scrollTo({
        top: chatScrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [activeSession?.messages, loading])

  const handleSend = async (textToSend?: string) => {
    const queryText = (textToSend || inputPrompt).trim()
    if (!queryText || loading) return

    setInputPrompt('')

    // 1. Add User Message
    const userMsgId = `user_${Date.now()}`
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: queryText,
      timestamp: new Date().toISOString(),
      tenant_id: tenantId,
    }
    addMessageToActive(userMsg)
    setLoading(true)

    // 2. Query Gateway Backend: persists in MongoDB Atlas session when authenticated
    try {
      if (activeSessionId && user) {
        const { data } = await axios.post<any>(
          `/api/chat/sessions/${activeSessionId}/messages`,
          {
            prompt: queryText,
            tenant_id: tenantId,
            is_private: isPrivate,
          }
        )

        const assistantMsgId = data.id || `asst_${Date.now()}`
        setLatestStreamingMsgId(assistantMsgId)

        const assistantMsg: ChatMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: data.content || data.answer || 'No response generated.',
          timestamp: data.timestamp || new Date().toISOString(),
          cache_hit: data.cache_hit,
          cache_type: data.cache_type,
          model_used: data.model_used,
          latency_ms: data.latency_ms,
          similarity_score: data.similarity_score,
          pii_detected: data.pii_detected,
          guardrail_status: data.guardrail_status,
          is_temporal: data.is_temporal,
          tenant_id: tenantId,
          tokens_used: data.tokens_used,
        }

        addMessageToActive(assistantMsg)
      } else {
        const payload: QueryRequest = {
          prompt: queryText,
          tenant_id: tenantId,
          is_private: isPrivate,
        }
        const { data } = await axios.post<QueryResponse>('/api/query', payload)

        const assistantMsgId = `asst_${Date.now()}`
        setLatestStreamingMsgId(assistantMsgId)

        const assistantMsg: ChatMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: data.answer || data.response || 'No response generated.',
          timestamp: new Date().toISOString(),
          cache_hit: data.cache_hit,
          cache_type: data.cache_type,
          model_used: data.model_used,
          latency_ms: data.latency_ms,
          similarity_score: data.similarity_score,
          pii_detected: data.pii_detected,
          guardrail_status: data.guardrail_status,
          is_temporal: data.is_temporal,
          tenant_id: data.tenant_id,
          tokens_used: data.tokens_used,
        }

        addMessageToActive(assistantMsg)
      }
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.detail || err.message || 'Error communicating with SmartCache gateway.'
      const errorAssistantMsg: ChatMessage = {
        id: `asst_err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Gateway Error**: ${typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)}`,
        timestamp: new Date().toISOString(),
        model_used: 'gateway-error',
        latency_ms: 0,
      }
      addMessageToActive(errorAssistantMsg)
    } finally {
      setLoading(false)
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 50)
    }
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="relative w-full max-w-7xl mx-auto rounded-3xl border border-white/10 bg-[#070b14]/90 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col md:flex-row h-[580px] sm:h-[600px]">
      
      {/* ── Left Sidebar: Sessions History (300px) ── */}
      <div
        className={`${
          sidebarOpen ? 'w-full md:w-80' : 'hidden md:flex md:w-16'
        } shrink-0 bg-[#0b1120]/95 border-b md:border-b-0 md:border-r border-white/10 flex flex-col transition-all duration-300 z-20`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <MessageSquare size={16} />
            </div>
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="font-mono text-xs font-bold text-white tracking-wider uppercase">
                  Chat Sessions
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {sessions.length} saved thread{sessions.length === 1 ? '' : 's'}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => newChat(tenantId)}
            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:text-white transition flex items-center gap-1 text-xs font-mono cursor-pointer"
            title="Start New Chat"
          >
            <Plus size={14} />
            {sidebarOpen && <span className="hidden sm:inline">New Chat</span>}
          </button>
        </div>

        {/* Sessions Scrollable List */}
        {sidebarOpen ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
            {sessions.map((s) => {
              const isActive = s.id === activeSessionId
              return (
                <div
                  key={s.id}
                  onClick={() => switchSession(s.id)}
                  className={`group relative flex items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-blue-500/15 border-blue-500/40 text-white shadow-md shadow-blue-500/10'
                      : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-blue-400 shadow-[0_0_8px_#3b82f6]' : 'bg-slate-600'}`} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium truncate leading-tight">
                        {s.title}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {s.messages.length} msg{s.messages.length === 1 ? '' : 's'} &bull; {new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Delete button (shows on hover) */}
                  {sessions.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSession(s.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
                      title="Delete thread"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center py-4 gap-2">
            {sessions.slice(0, 8).map((s) => (
              <button
                key={s.id}
                onClick={() => switchSession(s.id)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs transition ${
                  s.id === activeSessionId
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
                title={s.title}
              >
                <MessageSquare size={14} />
              </button>
            ))}
          </div>
        )}

        {/* Sidebar Footer Stats */}
        <div className="p-3 border-t border-white/5 bg-[#070b14]/50 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Dual-Cache Live</span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-500 hover:text-slate-300 text-xs hidden md:inline"
          >
            {sidebarOpen ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {/* ── Right Column: Conversational Stream & Composer ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#070b14]/70">
        
        {/* Chat Studio Top Bar */}
        <div className="px-6 py-3.5 border-b border-white/10 bg-[#0b1120]/70 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <div className="h-4 w-px bg-white/10 mx-1" />
            <span className="font-mono text-xs text-white font-semibold truncate max-w-[200px] sm:max-w-xs">
              {activeSession?.title || 'Gateway Session'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400 hidden sm:inline">
              v2.5 Live
            </span>
            {mongodbConnected ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hidden md:inline">
                🍃 Atlas Sync
              </span>
            ) : !user ? (
              <Link
                to="/signin"
                className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:text-white transition hidden md:inline cursor-pointer"
              >
                Sign in to save chat
              </Link>
            ) : null}
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {/* Tenant Selector */}
            <div className="flex items-center gap-1.5 font-mono text-xs text-slate-400 bg-white/[0.03] border border-white/10 rounded-xl px-2.5 py-1">
              <SlidersHorizontal size={11} className="text-blue-400" />
              <span className="text-[11px] hidden sm:inline">Tenant:</span>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                <option value="default" className="bg-[#0b1120]">Default</option>
                <option value="acme-corp" className="bg-[#0b1120]">Acme Corp</option>
                <option value="beta-inc" className="bg-[#0b1120]">Beta Inc</option>
              </select>
            </div>

            {/* Private Query Checkbox */}
            <label className="flex items-center gap-1.5 font-mono text-xs text-slate-400 cursor-pointer select-none bg-white/[0.03] border border-white/10 rounded-xl px-2.5 py-1">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="rounded bg-[#070b14] border-white/20 text-blue-500 focus:ring-0 w-3 h-3 cursor-pointer"
              />
              <span className="text-[11px] hidden sm:inline">Private</span>
            </label>

            {/* Clear button */}
            <button
              onClick={clearCurrentSessionMessages}
              className="p-1.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              title="Reset conversation"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        {/* ── Messages Scrollable Container (Contained scrolling, zero browser window jump) ── */}
        <div
          ref={chatScrollContainerRef}
          className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6 custom-scrollbar"
        >
          {activeSession?.messages.map((msg, index) => {
            const isUser = msg.role === 'user'
            const isLatest = msg.id === latestStreamingMsgId

            return (
              <div
                key={msg.id || index}
                className={`flex gap-3 sm:gap-4 animate-in fade-in duration-300 ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Assistant Avatar */}
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0 mt-1 border border-white/10">
                    <Bot size={16} />
                  </div>
                )}

                {/* Message Bubble Card */}
                <div
                  className={`max-w-[88%] sm:max-w-[78%] rounded-2xl p-4 sm:p-5 transition-all duration-300 shadow-xl ${
                    isUser
                      ? 'bg-blue-600/20 border border-blue-500/30 text-white shadow-[0_0_20px_rgba(59,130,246,0.1)] rounded-tr-sm'
                      : msg.cache_hit
                      ? 'glass-card border-emerald-500/30 bg-[#0b1120]/90 shadow-[0_0_25px_rgba(16,185,129,0.08)] rounded-tl-sm'
                      : 'glass-card border-white/10 bg-[#0b1120]/90 rounded-tl-sm'
                  }`}
                >
                  {/* Assistant Meta Ribbon (Model, Latency, Cache Status) */}
                  {!isUser && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-white/5 text-xs font-mono">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Hit / Miss Status */}
                        {msg.cache_hit ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
                            <Zap size={10} />
                            CACHE HIT {msg.cache_type ? `(${msg.cache_type.toUpperCase()})` : ''}
                          </span>
                        ) : msg.pii_detected ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 border border-red-500/40 text-red-400">
                            🛡️ PII REDACTED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 border border-blue-500/30 text-blue-400">
                            🤖 LLM GENERATED
                          </span>
                        )}

                        {/* Model */}
                        {msg.model_used && (
                          <span className="text-slate-400 text-[11px] flex items-center gap-1">
                            <Cpu size={11} className="text-purple-400" />
                            {msg.model_used}
                          </span>
                        )}

                        {/* Latency */}
                        {typeof msg.latency_ms === 'number' && (
                          <span className={`text-[11px] font-bold ${msg.cache_hit ? 'text-emerald-400' : 'text-blue-400'}`}>
                            <Clock size={11} className="inline mr-1" />
                            {msg.latency_ms.toFixed(1)} ms
                          </span>
                        )}

                        {/* Similarity Score */}
                        {msg.similarity_score != null && msg.similarity_score > 0 && (
                          <span className="text-cyan-400 text-[11px] flex items-center gap-1">
                            <Layers size={11} />
                            {(msg.similarity_score * 100).toFixed(1)}% match
                          </span>
                        )}
                      </div>

                      {/* Copy Action */}
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white transition flex items-center gap-1 text-[11px]"
                        title="Copy Answer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check size={12} className="text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Production Guardrail Alert Banner */}
                  {!isUser && msg.guardrail_status && (
                    <div className="mb-3 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center gap-2 text-xs text-purple-300 font-mono">
                      <ShieldCheck size={14} className="text-purple-400 shrink-0" />
                      <span>{msg.guardrail_status}</span>
                    </div>
                  )}

                  {/* Message Content: Word-by-Word Streaming Markdown */}
                  {isUser ? (
                    <div className="text-sm sm:text-base font-sans text-white leading-relaxed whitespace-pre-wrap select-text">
                      {msg.content}
                    </div>
                  ) : (
                    <StreamingMarkdown
                      content={msg.content}
                      animate={isLatest}
                      speedMs={15}
                      onComplete={() => {
                        if (isLatest) setLatestStreamingMsgId(null)
                      }}
                    />
                  )}

                  {/* Message Timestamp & Tenant Tag */}
                  <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.tenant_id && msg.tenant_id !== 'default' && (
                      <span className="text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                        Tenant: {msg.tenant_id}
                      </span>
                    )}
                  </div>
                </div>

                {/* User Avatar */}
                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0 mt-1 border border-blue-400/30">
                    <User size={16} />
                  </div>
                )}
              </div>
            )
          })}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex gap-3 sm:gap-4 animate-in fade-in duration-200">
              <div className="w-8 h-8 rounded-xl bg-blue-600/80 flex items-center justify-center text-white shrink-0">
                <Loader2 size={16} className="animate-spin text-blue-300" />
              </div>
              <div className="p-4 rounded-2xl glass-card border-blue-500/30 bg-[#0b1120]/90 flex flex-col gap-2 max-w-sm">
                <div className="flex items-center gap-2 text-xs font-mono text-blue-400">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                  <span>Dual-tier scan &amp; routing execution…</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Checking Upstash Redis exact match &rarr; Vector similarity scan &rarr; Guardrails verification
                </p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Preset Prompts Bar ── */}
        <div className="px-4 sm:px-6 py-2 border-t border-white/5 bg-[#0b1120]/40 overflow-x-auto flex items-center gap-2 no-scrollbar">
          <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1 shrink-0 mr-1">
            <Sparkles size={11} className="text-blue-400" /> Presets:
          </span>
          {PRESET_PROMPTS.map((p) => (
            <button
              key={p.label}
              onClick={() => handleSend(p.prompt)}
              className="text-xs font-mono px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 hover:text-white hover:border-blue-500/50 hover:bg-blue-500/10 transition flex items-center gap-1.5 shrink-0 group cursor-pointer"
              title={p.prompt}
            >
              <span>{p.label}</span>
              <ArrowRight size={10} className="text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition" />
            </button>
          ))}
        </div>

        {/* ── Composer Form ── */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-[#0b1120]/80 backdrop-blur-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="relative flex items-end gap-2 rounded-2xl p-2 bg-[#070b14]/90 border border-white/10 focus-within:border-blue-500/60 focus-within:ring-1 focus-within:ring-blue-500/40 transition-all shadow-xl"
          >
            <textarea
              ref={textareaRef}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              rows={2}
              placeholder="Ask anything... (e.g. 'What is the capital of India?' or 'Who is Michael Jordan?')"
              className="w-full resize-none bg-transparent p-2.5 font-sans text-sm text-white placeholder-slate-500 focus:outline-none leading-relaxed"
            />

            <div className="flex items-center gap-2 pb-1 pr-1">
              <button
                type="submit"
                disabled={loading || !inputPrompt.trim()}
                className="p-3 rounded-xl font-medium flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-not-allowed shadow-lg"
                style={{
                  background:
                    loading || !inputPrompt.trim()
                      ? 'rgba(59,130,246,0.15)'
                      : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: loading || !inputPrompt.trim() ? '#64748b' : '#ffffff',
                  boxShadow:
                    !loading && inputPrompt.trim()
                      ? '0 0 25px rgba(59,130,246,0.4)'
                      : 'none',
                }}
                title="Send query (Enter)"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin text-blue-400" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
          </form>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 text-[10px]">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 text-[10px]">Shift+Enter</kbd> for newline</span>
            <span>Zero lag word-by-word streaming enabled</span>
          </div>
        </div>
      </div>
    </div>
  )
}
export default ChatWorkspace
