import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { RecentQuery } from '../types'
import {
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Zap,
  Terminal
} from 'lucide-react'

function timeAgo(isoString: string): string {
  try {
    const diff = Date.now() - new Date(isoString).getTime()
    const s = Math.floor(diff / 1000)
    if (s < 60) return `${Math.max(1, s)}s ago`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    return `${h}h ago`
  } catch {
    return 'just now'
  }
}

const MODEL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'gemini-flash': { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#3b82f6' },
  'gemini-pro': { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' },
  'redis-cache': { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', text: '#10b981' },
}

export const RecentQueries: React.FC = () => {
  const [queries, setQueries] = useState<RecentQuery[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchRecent = async () => {
    try {
      const { data } = await axios.get<RecentQuery[]>('/api/recent')
      setQueries(data.slice(0, 20))
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecent()
    const id = setInterval(fetchRecent, 3000)
    return () => clearInterval(id)
  }, [])

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id))
  }

  const handleCopy = (id: string, text: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const rowBorderColor = (q: RecentQuery): string => {
    if (q.pii_detected) return '#ef4444'
    if (q.cache_hit) return '#10b981'
    return '#3b82f6'
  }

  return (
    <section id="logs" className="px-6 md:px-10 py-24 max-w-6xl mx-auto w-full">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="section-label text-blue-400 font-mono text-xs tracking-wider">
              // 03. GATEWAY TELEMETRY
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Auto-sync 3s
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Recent Query Logs
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Click any query to expand and view the full generated answer, latency breakdown, and cache verification.
          </p>
        </div>

        <button
          onClick={fetchRecent}
          className="font-mono text-xs px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin text-blue-400' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Query List */}
      <div className="mt-8 glass-card border border-white/10 bg-[#0b1120]/80 rounded-2xl overflow-hidden shadow-2xl">
        {loading && queries.length === 0 ? (
          <div className="p-8 flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl animate-pulse bg-white/[0.02] border border-white/5"
              />
            ))}
          </div>
        ) : queries.length === 0 ? (
          <div className="p-16 flex flex-col items-center gap-3 text-center">
            <span className="font-mono text-3xl text-slate-600">&empty;</span>
            <p className="font-mono text-sm text-slate-400">No queries processed yet. Run one above!</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {queries.map((q) => {
              const isExpanded = expandedId === q.id
              const modelStyle = MODEL_COLORS[q.model_used] ?? MODEL_COLORS['gemini-flash']

              return (
                <div
                  key={q.id}
                  onClick={() => toggleExpand(q.id)}
                  className={`transition-all duration-200 cursor-pointer ${
                    isExpanded ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'
                  }`}
                  style={{ borderLeft: `3px solid ${rowBorderColor(q)}` }}
                >
                  {/* Row Summary */}
                  <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Status Icon */}
                      <div className="mt-0.5 shrink-0">
                        {q.pii_detected ? (
                          <AlertTriangle size={16} className="text-red-400" />
                        ) : q.cache_hit ? (
                          <CheckCircle size={16} className="text-emerald-400" />
                        ) : (
                          <Zap size={16} className="text-blue-400" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-200 truncate">
                          {q.prompt}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 font-mono text-xs">
                          <span className="text-slate-500">{timeAgo(q.timestamp)}</span>

                          {/* Hit/Miss Pill */}
                          {q.pii_detected ? (
                            <span className="px-2 py-0.5 rounded text-[11px] bg-red-500/15 text-red-400 border border-red-500/30 font-semibold">
                              PII MASKED
                            </span>
                          ) : q.cache_hit ? (
                            <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                              <Zap size={10} />
                              CACHE HIT
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] bg-blue-500/15 text-blue-400 border border-blue-500/30">
                              CACHE MISS
                            </span>
                          )}

                          {/* Model */}
                          <span
                            className="px-2 py-0.5 rounded text-[11px]"
                            style={{
                              background: modelStyle.bg,
                              color: modelStyle.text,
                              border: `1px solid ${modelStyle.border}`,
                            }}
                          >
                            {q.model_used}
                          </span>

                          {q.similarity_score != null && q.similarity_score > 0 && (
                            <span className="text-slate-400 text-[11px]">
                              sim: {(q.similarity_score * 100).toFixed(0)}%
                            </span>
                          )}

                          {q.guardrail_status && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono flex items-center gap-1">
                              <span>🛡️</span>
                              <span>{q.guardrail_status}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Latency & Chevron */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right font-mono">
                        <span className={`text-xs font-bold ${q.cache_hit ? 'text-emerald-400' : 'text-slate-300'}`}>
                          {q.latency_ms.toFixed(0)} ms
                        </span>
                      </div>
                      <div className="text-slate-500 hover:text-slate-300">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Accordion: Full Answer Body */}
                  {isExpanded && (
                    <div className="px-6 pb-5 pt-2 border-t border-white/5 bg-[#070b14]/60 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Terminal size={12} className="text-blue-400" />
                          Cached Gateway Response
                        </span>
                        <button
                          onClick={(e) => handleCopy(q.id, q.answer, e)}
                          className="font-mono text-xs px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center gap-1 transition cursor-pointer"
                        >
                          {copiedId === q.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          <span>{copiedId === q.id ? 'Copied' : 'Copy Response'}</span>
                        </button>
                      </div>

                      <div className="p-4 rounded-xl bg-[#0b1120] border border-white/5 text-slate-200 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans select-text">
                        {q.answer || 'No response content stored.'}
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-500">
                        <span>ID: {q.id}</span>
                        <span>{new Date(q.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default RecentQueries