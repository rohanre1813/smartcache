import React, { useState, useRef, useEffect } from 'react'
import { useQuery } from '../hooks/useQuery'
import {
  Loader2,
  Send,
  XCircle,
  Copy,
  Check,
  Zap,
  Sparkles,
  Terminal,
  Cpu,
  Clock,
  ShieldCheck,
  RotateCcw,
  Layers,
  ArrowRight
} from 'lucide-react'

const TEST_CATEGORIES = [
  { label: '🇮🇳 India Capital', prompt: 'What is the capital of India?' },
  { label: '⚡ Paraphrase (Cache Hit)', prompt: 'Can you share me the capital of India?' },
  { label: '🎬 Michael B. Jordan (Actor)', prompt: 'Who is Michael B. Jordan?' },
  { label: '🏀 Michael Jordan (Guardrail)', prompt: 'Who is Michael Jordan?' },
  { label: '✅ Microservices Pros', prompt: 'What are the advantages of microservices?' },
  { label: '❌ Microservices Cons (Antonym)', prompt: 'What are the disadvantages of microservices?' },
  { label: '⏱️ Apple Stock (Temporal 60s TTL)', prompt: "What is today's current stock price of Apple?" },
]

export const QueryInterface: React.FC = () => {
  const { response, loading, error, submit, reset } = useQuery()
  const [prompt, setPrompt] = useState('')
  const [tenantId, setTenantId] = useState('default')
  const [isPrivate, setIsPrivate] = useState(false)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const outputCardRef = useRef<HTMLDivElement>(null)

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!prompt.trim() || loading) return
    submit(prompt, { tenant_id: tenantId, is_private: isPrivate })
  }

  const handleExampleClick = (p: string) => {
    setPrompt(p)
    submit(p, { tenant_id: tenantId, is_private: isPrivate })
    // Scroll smoothly to output
    setTimeout(() => {
      outputCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)
  }

  // Auto-scroll when response arrives
  useEffect(() => {
    if (response && outputCardRef.current) {
      outputCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [response])

  const copyResponse = () => {
    const text = response?.answer || response?.response || ''
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section id="query" className="px-6 md:px-10 py-20 max-w-6xl mx-auto w-full">
      {/* Section Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="section-label text-blue-400 font-mono text-xs tracking-wider">
            // 01. INTERACTIVE GATEWAY
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Gateway v2.5 &bull; Production Guardrails Active
          </span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Test SmartCache & Model Router
        </h2>
        <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
          Full dual-tier caching (Upstash Redis + Semantic Vector Store), Gemini LLM routing, and 5 production guardrails:
          entity disambiguation, antonym polarity checks, temporal short-TTL, SingleFlight stampede locks, and multitenancy.
        </p>
      </div>

      {/* Quick Prompt Pills */}
      <div className="mt-6 flex flex-wrap gap-2 items-center">
        <span className="text-xs font-mono text-slate-500 flex items-center gap-1 mr-1">
          <Sparkles size={12} className="text-blue-400" /> Production Tests:
        </span>
        {TEST_CATEGORIES.map((item) => (
          <button
            key={item.label}
            onClick={() => handleExampleClick(item.prompt)}
            className="font-mono text-xs px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 hover:text-white hover:border-blue-500/50 hover:bg-blue-500/10 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-1.5 group cursor-pointer"
            title={item.prompt}
          >
            <span>{item.label}</span>
            <ArrowRight size={10} className="text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}
      </div>

      {/* Main Grid: Input & Live Output Terminal */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Query Form (5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <form
            onSubmit={handleSubmit}
            className="glass-card p-6 border border-white/10 bg-[#0b1120]/80 backdrop-blur-xl rounded-2xl flex flex-col gap-4 shadow-xl hover:border-blue-500/30 transition-all duration-300"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-2">
                <Terminal size={14} className="text-blue-400" />
                Query Input
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {prompt.length} chars
              </span>
            </div>

            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e)
              }}
              rows={5}
              placeholder="Type your question or query here... (e.g. 'What is latency?' or 'Who is Michael Jordan?')"
              className="w-full resize-none rounded-xl p-3.5 font-sans text-sm text-white placeholder-slate-500 bg-[#070b14]/90 border border-white/10 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/40 transition-all duration-200 leading-relaxed"
            />

            {/* Multitenancy & Privacy Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Tenant:</span>
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="bg-[#070b14] border border-white/10 rounded-lg px-2 py-1 text-slate-300 text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="default">Default Tenant</option>
                  <option value="acme-corp">Acme Corp</option>
                  <option value="beta-inc">Beta Inc</option>
                </select>
              </div>

              <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="rounded bg-[#070b14] border-white/20 text-blue-500 focus:ring-0"
                />
                <span>Private Query (No Cache)</span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
                Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">Ctrl+Enter</kbd>
              </span>
              <div className="flex items-center gap-2 ml-auto">
                {prompt && (
                  <button
                    type="button"
                    onClick={() => { setPrompt(''); reset(); }}
                    className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition"
                    title="Clear query"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="font-mono text-xs px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg cursor-pointer disabled:cursor-not-allowed"
                  style={{
                    background: loading || !prompt.trim()
                      ? 'rgba(59,130,246,0.15)'
                      : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    color: loading || !prompt.trim() ? '#64748b' : '#ffffff',
                    border: '1px solid rgba(59,130,246,0.4)',
                    boxShadow: !loading && prompt.trim()
                      ? '0 0 25px rgba(59,130,246,0.35)'
                      : 'none',
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-blue-400" />
                      <span>Querying Gateway…</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Run Query &rarr;</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Quick Info Box */}
          <div className="p-4 rounded-xl border border-white/5 bg-[#0b1120]/40 text-xs text-slate-400 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-300 font-mono font-medium">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Smart Routing Rules</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              &bull; Exact &amp; Semantic matches return from <strong>Upstash Redis</strong> in &lt;300ms.
              <br />
              &bull; Complex / architectural questions dynamically route to <strong>Gemini Pro</strong>.
              <br />
              &bull; Personal identifiers (emails, phones, SSNs) are automatically redacted via Presidio.
            </p>
          </div>
        </div>

        {/* Right Column: Live Output & Response Terminal (7 cols on lg) */}
        <div ref={outputCardRef} className="lg:col-span-7 flex flex-col gap-4">
          <div
            className={`glass-card rounded-2xl border transition-all duration-300 shadow-2xl overflow-hidden ${
              response
                ? response.cache_hit
                  ? 'border-emerald-500/40 shadow-[0_0_35px_rgba(16,185,129,0.12)]'
                  : response.pii_detected
                  ? 'border-red-500/40 shadow-[0_0_35px_rgba(239,68,68,0.12)]'
                  : 'border-blue-500/40 shadow-[0_0_35px_rgba(59,130,246,0.15)]'
                : 'border-white/10'
            }`}
            style={{ background: '#0b1120' }}
          >
            {/* Terminal Header */}
            <div className="px-5 py-3.5 border-b border-white/5 bg-[#070b14]/70 flex items-center justify-between">
              {/* Window controls */}
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-2 font-mono text-xs text-slate-400 hidden sm:inline">
                  gateway-response.log
                </span>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {loading ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-blue-500/15 border border-blue-500/30 text-blue-400">
                    <Loader2 size={10} className="animate-spin" />
                    EXECUTING
                  </span>
                ) : response ? (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono border ${
                      response.cache_hit
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : response.pii_detected
                        ? 'bg-red-500/15 border-red-500/40 text-red-400'
                        : 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    {response.cache_hit
                      ? '⚡ CACHE HIT'
                      : response.pii_detected
                      ? '🛡️ PII REDACTED'
                      : '🤖 LLM GENERATED'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-slate-800 border border-slate-700 text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    AWAITING QUERY
                  </span>
                )}

                {response && (
                  <button
                    onClick={copyResponse}
                    className="ml-1 p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition flex items-center gap-1 font-mono text-xs cursor-pointer"
                    title="Copy Answer"
                  >
                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-4 bg-red-500/10 border-b border-red-500/20 flex items-start gap-3">
                <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs text-red-300">
                  <strong className="font-mono uppercase font-bold block mb-0.5">Gateway Error</strong>
                  {typeof error === 'string' ? error : JSON.stringify(error)}
                </div>
              </div>
            )}

            {/* Metrics Ribbon (When Response exists) */}
            {response && (
              <div className="px-5 py-3 border-b border-white/5 bg-[#070b14]/40 flex flex-wrap items-center gap-3 text-xs font-mono">
                {/* Latency */}
                <div className="flex items-center gap-1 text-slate-300">
                  <Clock size={12} className="text-blue-400" />
                  <span className="text-slate-500">Latency:</span>
                  <span className={`font-bold ${response.cache_hit ? 'text-emerald-400' : 'text-blue-400'}`}>
                    {typeof response.latency_ms === 'number'
                      ? `${response.latency_ms.toFixed(1)} ms`
                      : `${response.latency_ms} ms`}
                  </span>
                </div>

                {/* Model */}
                <div className="flex items-center gap-1 text-slate-300">
                  <Cpu size={12} className="text-purple-400" />
                  <span className="text-slate-500">Model:</span>
                  <span className="text-purple-300 font-semibold">{response.model_used}</span>
                </div>

                {/* Semantic score if any */}
                {response.similarity_score != null && response.similarity_score > 0 && (
                  <div className="flex items-center gap-1 text-slate-300">
                    <Layers size={12} className="text-cyan-400" />
                    <span className="text-slate-500">Similarity:</span>
                    <span className="text-cyan-300">
                      {(response.similarity_score * 100).toFixed(1)}%
                    </span>
                  </div>
                )}

                {/* Tenant Tag */}
                {response.tenant_id && (
                  <div className="flex items-center gap-1 text-slate-400">
                    <span className="text-slate-500">Tenant:</span>
                    <span className="text-slate-300 font-medium">{response.tenant_id}</span>
                  </div>
                )}

                {/* Temporal Tag */}
                {response.is_temporal && (
                  <div className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    <Clock size={10} />
                    <span>60s Short TTL</span>
                  </div>
                )}

                {/* Cache source */}
                {response.cache_hit && (
                  <div className="flex items-center gap-1 text-emerald-400 ml-auto">
                    <Zap size={12} />
                    <span>0 Tokens (100% Free)</span>
                  </div>
                )}
              </div>
            )}

            {/* Response Content Body */}
            <div className="p-6 min-h-[300px] flex flex-col justify-start">
              {loading ? (
                <div className="flex flex-col items-center justify-center my-auto py-12 gap-3 text-center">
                  <div className="relative">
                    <Loader2 size={36} className="animate-spin text-blue-500" />
                    <div className="absolute inset-0 blur-lg bg-blue-500/30 rounded-full" />
                  </div>
                  <span className="font-mono text-sm text-slate-300">
                    Running Embedding &amp; Vector Similarity Scan…
                  </span>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Checking Upstash Redis exact cache &rarr; vector store &rarr; model complexity router
                  </p>
                </div>
              ) : response ? (
                <div className="flex flex-col gap-3 animate-in fade-in duration-300">
                  {/* Guardrail Status Alert Box */}
                  {response.guardrail_status && (
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center gap-2.5 text-xs text-purple-300">
                      <ShieldCheck size={16} className="text-purple-400 shrink-0" />
                      <div>
                        <span className="font-semibold font-mono">Production Guardrail: </span>
                        <span>{response.guardrail_status}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Terminal size={12} className="text-blue-400" />
                      Answer Output
                    </span>
                    {response.cache_hit && (
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        ⚡ Retrieved directly from Upstash Redis {response.cache_type ? `(${response.cache_type})` : ''}
                      </span>
                    )}
                  </div>

                  {/* Formatted Text Box */}
                  <div className="text-slate-100 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans p-4 rounded-xl bg-[#070b14]/70 border border-white/5 select-text">
                    {response.answer || response.response || 'No content returned from gateway.'}
                  </div>
                </div>
              ) : (
                /* Empty Placeholder State */
                <div className="flex flex-col items-center justify-center my-auto py-12 gap-3 text-center text-slate-500">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-400 mb-1">
                    <Terminal size={22} className="text-blue-400/60" />
                  </div>
                  <span className="font-mono text-sm text-slate-300 font-medium">
                    Gateway Ready &bull; Waiting for Execution
                  </span>
                  <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                    Type a query on the left or click any quick test prompt above.
                    Your live generated response, latency metrics, and cache status will render directly inside this terminal.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default QueryInterface