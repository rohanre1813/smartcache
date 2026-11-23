import React from 'react'
import { StatsData } from '../types'
import { Zap, Database, Coins } from 'lucide-react'

interface HeroSectionProps {
  stats: StatsData
  statsLoading: boolean
}

const StatPill: React.FC<{
  icon: React.ReactNode
  label: string
  value: string
  loading: boolean
}> = ({ icon, label, value, loading }) => (
  <div
    className="flex items-center gap-2 px-4 py-2 rounded-xl"
    style={{
      background: 'rgba(11,17,32,0.8)',
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(8px)',
    }}
  >
    <span className="text-primary">{icon}</span>
    <div className="flex flex-col leading-none">
      <span className="font-mono text-xs text-muted-text uppercase tracking-widest">
        {label}
      </span>
      {loading ? (
        <span className="font-mono text-sm text-foreground mt-0.5 animate-pulse">--</span>
      ) : (
        <span className="font-mono text-sm text-foreground mt-0.5">{value}</span>
      )}
    </div>
  </div>
)

const HeroSection: React.FC<HeroSectionProps> = ({ stats, statsLoading }) => {
  const hitRate = (stats?.cache_hit_rate ?? 0).toFixed(1)
  const latency = Math.round(stats?.avg_latency_ms ?? 0)
  const tokensSaved = (stats?.total_tokens_saved ?? 0).toLocaleString()

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 md:px-10 pt-16 overflow-hidden">
      {/* Animated blue radial glow */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <div
          style={{
            width: '700px',
            height: '700px',
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse at center, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.04) 50%, transparent 70%)',
            filter: 'blur(1px)',
          }}
          className="animate-float"
        />
      </div>

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 max-w-4xl w-full flex flex-col items-center text-center gap-6">
        {/* Section label */}
        <span className="section-label">// 00. OVERVIEW</span>

        {/* Hero heading */}
        <h1
          className="hero-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-tight"
          style={{ color: '#f1f5f9' }}
        >
          Intelligent LLM Gateway
          <br />
          <span style={{ color: '#3b82f6' }}>&amp; Semantic Cache</span>
        </h1>

        {/* Subtitle */}
        <p
          className="max-w-2xl text-base sm:text-lg leading-relaxed"
          style={{ color: '#94a3b8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          A production-grade API gateway that intercepts LLM requests, detects PII, routes to
          the right model (Flash or Pro), and serves semantically-similar answers from a
          vector cache — cutting latency and cost in real time.
        </p>

        {/* Stat pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
          <StatPill
            icon={<Database size={14} />}
            label="Cache Hit Rate"
            value={`${hitRate}%`}
            loading={statsLoading}
          />
          <StatPill
            icon={<Zap size={14} />}
            label="Avg Latency"
            value={`${latency} ms`}
            loading={statsLoading}
          />
          <StatPill
            icon={<Coins size={14} />}
            label="Tokens Saved"
            value={tokensSaved}
            loading={statsLoading}
          />
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-40 select-none">
        <span className="font-mono text-xs text-muted-text">scroll</span>
        <span className="text-primary text-lg animate-bounce">↓</span>
      </div>
    </section>
  )
}

export default HeroSection
