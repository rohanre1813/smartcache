import React, { useState } from 'react'
import axios from 'axios'
import {
  ShieldCheck,
  Zap,
  Loader2,
  Terminal,
  ChevronRight
} from 'lucide-react'
import { QueryResponse } from '../types'

interface GuardrailDemo {
  id: string
  name: string
  riskDescription: string
  productionSolution: string
  seedPrompt: string
  testPrompt: string
  seedTenant?: string
  testTenant?: string
  expectedOutcome: string
}

const GUARDRAIL_DEMOS: GuardrailDemo[] = [
  {
    id: 'antonym',
    name: '1. Antonym Polarity Inversion',
    riskDescription: 'Dense embeddings map opposites (advantages vs disadvantages) to >0.85 similarity, returning opposite facts from cache.',
    productionSolution: 'Antonym polarity matrix (advantages/disadvantages, pros/cons, fast/slow) rejects false semantic hits.',
    seedPrompt: 'What are the advantages of microservices?',
    testPrompt: 'What are the disadvantages of microservices?',
    expectedOutcome: 'Rejects cached advantages answer & calls LLM for disadvantage points.',
  },
  {
    id: 'entity',
    name: '2. Entity Disambiguation',
    riskDescription: 'Shared tokens cause dense vectors to collide on distinct people (Michael B. Jordan vs Michael Jordan).',
    productionSolution: 'Middle-initial, number, and non-stopword Jaccard lexical guardrails distinguish entities.',
    seedPrompt: 'Who is Michael B. Jordan?',
    testPrompt: 'Who is Michael Jordan?',
    expectedOutcome: 'Actor and NBA player maintain distinct, collision-free cached responses.',
  },
  {
    id: 'temporal',
    name: '3. Temporal & Dynamic Data Protection',
    riskDescription: 'Caching real-time queries (stock prices, weather, breaking news) for 24h serves stale facts.',
    productionSolution: 'Temporal keyword detector applies dynamic 60s TTL in Redis and bypasses permanent vector store.',
    seedPrompt: "What is today's current stock price of Apple?",
    testPrompt: "What is today's current stock price of Apple?",
    expectedOutcome: 'Short 60-second TTL applied in Redis; vector store bypassed.',
  },
  {
    id: 'stampede',
    name: '4. Cache Stampede (SingleFlight Lock)',
    riskDescription: '100 simultaneous requests on a cache miss all hit LLM at once, causing rate-limit 429s and token spikes.',
    productionSolution: 'SingleFlight mutex locks: 1st request queries LLM, others wait on lock and read the fresh cache.',
    seedPrompt: 'Explain how distributed consensus works in Raft.',
    testPrompt: 'Explain how distributed consensus works in Raft.',
    expectedOutcome: 'First request acquires mutex; concurrent callers read cached result in <100ms.',
  },
  {
    id: 'multitenant',
    name: '5. Multi-Tenant Privacy Bleed Isolation',
    riskDescription: 'Customer A private data might leak to Customer B through shared semantic vector search.',
    productionSolution: 'Tenant-isolated key hashing (smartcache:{tenant_id}:{hash}) and metadata filtering.',
    seedPrompt: 'What is our internal deployment policy?',
    testPrompt: 'What is our internal deployment policy?',
    seedTenant: 'acme-corp',
    testTenant: 'beta-inc',
    expectedOutcome: 'Acme Corp cache is strictly isolated; Beta Inc gets isolated execution.',
  },
]

export const GuardrailsMatrix: React.FC = () => {
  const [selectedDemo, setSelectedDemo] = useState<GuardrailDemo>(GUARDRAIL_DEMOS[0])
  const [running, setRunning] = useState(false)
  const [resultLog, setResultLog] = useState<any[] | null>(null)

  const runTest = async (demo: GuardrailDemo) => {
    setRunning(true)
    setResultLog(null)
    const logs: any[] = []

    try {
      // Step 1: Run Seed Query
      const t0 = performance.now()
      const res1 = await axios.post<QueryResponse>('/api/query', {
        prompt: demo.seedPrompt,
        tenant_id: demo.seedTenant || 'default',
      })
      const d1 = performance.now() - t0
      logs.push({
        step: 'Step 1: Seed Query Execution',
        prompt: demo.seedPrompt,
        tenant: demo.seedTenant || 'default',
        cache_hit: res1.data.cache_hit,
        model: res1.data.model_used,
        latency_ms: res1.data.latency_ms || d1,
        guardrail: res1.data.guardrail_status,
        preview: (res1.data.answer || res1.data.response || '').substring(0, 140) + '…',
      })

      // Step 2: Run Target Test Query
      const t1 = performance.now()
      const res2 = await axios.post<QueryResponse>('/api/query', {
        prompt: demo.testPrompt,
        tenant_id: demo.testTenant || 'default',
      })
      const d2 = performance.now() - t1
      logs.push({
        step: 'Step 2: Guardrail Verification Query',
        prompt: demo.testPrompt,
        tenant: demo.testTenant || 'default',
        cache_hit: res2.data.cache_hit,
        model: res2.data.model_used,
        latency_ms: res2.data.latency_ms || d2,
        guardrail: res2.data.guardrail_status,
        similarity: res2.data.similarity_score,
        preview: (res2.data.answer || res2.data.response || '').substring(0, 140) + '…',
      })

      setResultLog(logs)
    } catch (e: any) {
      logs.push({
        step: 'Error executing test',
        error: e.response?.data?.detail || e.message,
      })
      setResultLog(logs)
    } finally {
      setRunning(false)
    }
  }

  return (
    <section id="guardrails" className="px-6 md:px-10 py-24 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="section-label text-blue-400 font-mono text-xs tracking-wider">
            // 04. PRODUCTION DEFENSE MATRIX
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/10 border border-purple-500/20 text-purple-300">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            5 Enterprise Guardrails Active
          </span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Production Challenges &amp; Defensive Guardrails
        </h2>
        <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
          How enterprise LLM gateways eliminate semantic false positives, antonym collisions,
          cache stampedes, and cross-tenant privacy leaks.
        </p>
      </div>

      {/* Grid: Selector on left, Live Test Bench on right */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: 5 Guardrail Cards (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {GUARDRAIL_DEMOS.map((demo) => {
            const isSelected = demo.id === selectedDemo.id
            return (
              <div
                key={demo.id}
                onClick={() => {
                  setSelectedDemo(demo)
                  setResultLog(null)
                }}
                className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
                  isSelected
                    ? 'glass-card border-blue-500/50 bg-[#0b1120] shadow-[0_0_25px_rgba(59,130,246,0.15)] -translate-y-0.5'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/15 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white font-mono flex items-center gap-2">
                    <ShieldCheck size={16} className={isSelected ? 'text-blue-400' : 'text-slate-500'} />
                    {demo.name}
                  </h3>
                  <ChevronRight size={14} className={isSelected ? 'text-blue-400' : 'text-slate-600'} />
                </div>
                <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                  {demo.riskDescription}
                </p>
              </div>
            )
          })}
        </div>

        {/* Right: Interactive Inspector Terminal (7 cols) */}
        <div className="lg:col-span-7 glass-card border border-white/10 bg-[#0b1120] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10 bg-[#070b14]/70 flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-xs">
              <Terminal size={14} className="text-blue-400" />
              <span className="text-white font-bold">{selectedDemo.name}</span>
            </div>
            <button
              onClick={() => runTest(selectedDemo)}
              disabled={running}
              className="font-mono text-xs px-4 py-2 rounded-xl font-medium bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition cursor-pointer disabled:cursor-not-allowed"
            >
              {running ? (
                <>
                  <Loader2 size={13} className="animate-spin text-blue-200" />
                  <span>Verifying Guardrail…</span>
                </>
              ) : (
                <>
                  <Zap size={13} />
                  <span>Execute Guardrail Verification &rarr;</span>
                </>
              )}
            </button>
          </div>

          {/* Details Body */}
          <div className="p-6 space-y-5 text-xs sm:text-sm font-mono">
            {/* Risk vs Solution */}
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300">
                <span className="font-bold uppercase tracking-wider text-[11px] block mb-1">
                  ⚠️ The Production Failure Mode
                </span>
                <p className="text-xs font-sans text-red-200/90 leading-relaxed">
                  {selectedDemo.riskDescription}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                <span className="font-bold uppercase tracking-wider text-[11px] block mb-1">
                  🛡️ Our Production Defense
                </span>
                <p className="text-xs font-sans text-emerald-200/90 leading-relaxed">
                  {selectedDemo.productionSolution}
                </p>
              </div>
            </div>

            {/* Test Prompts Preview */}
            <div className="p-4 rounded-xl bg-[#070b14]/80 border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>1. Seed Prompt:</span>
                <span className="text-blue-400">"{selectedDemo.seedPrompt}"</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>2. Test Prompt:</span>
                <span className="text-cyan-400">"{selectedDemo.testPrompt}"</span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1 border-t border-white/5">
                Expected Result: <span className="text-slate-300">{selectedDemo.expectedOutcome}</span>
              </div>
            </div>

            {/* Live Verification Logs */}
            {resultLog ? (
              <div className="space-y-3 animate-in fade-in duration-300 pt-2">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block">
                  Live Execution Telemetry:
                </span>
                {resultLog.map((log, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-[#070b14] border border-white/10 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-white font-bold">
                      <span>{log.step}</span>
                      <span className={log.cache_hit ? 'text-emerald-400' : 'text-blue-400'}>
                        {log.cache_hit ? '⚡ CACHE HIT' : '🤖 LLM GENERATED'} ({log.latency_ms?.toFixed(1)} ms)
                      </span>
                    </div>
                    {log.guardrail && (
                      <div className="text-purple-300 text-[11px]">
                        Guardrail Status: {log.guardrail}
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                      {log.preview}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                Click "Execute Guardrail Verification" above to fire both test queries and watch the live telemetry verify the guardrail.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
export default GuardrailsMatrix
