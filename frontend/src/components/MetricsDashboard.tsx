import React from 'react'
import { StatsData } from '../types'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'

interface MetricsDashboardProps {
  stats: StatsData
  loading: boolean
}

const COLORS = {
  flash: '#3b82f6',
  pro: '#f59e0b',
  cache: '#10b981',
}

const StatCard: React.FC<{
  label: string
  value: string | number
  sub?: string
  valueColor?: string
  loading: boolean
}> = ({ label, value, sub, valueColor = '#f1f5f9', loading }) => (
  <div
    className="glass-card p-6 flex flex-col gap-2 border border-white/10 bg-[#0b1120]/80 rounded-2xl hover:border-blue-500/40 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-all duration-300"
  >
    <span className="font-mono text-xs text-slate-400 uppercase tracking-wider">{label}</span>
    {loading ? (
      <div className="h-10 w-24 rounded bg-white/5 animate-pulse" />
    ) : (
      <span className="font-mono text-4xl font-bold leading-none" style={{ color: valueColor }}>
        {value}
      </span>
    )}
    {sub && !loading && (
      <span className="font-mono text-xs text-slate-500">{sub}</span>
    )}
  </div>
)

const CustomTooltip: React.FC<{
  active?: boolean
  payload?: Array<{ name: string; value: number; fill: string }>
}> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="glass-card px-3 py-2"
        style={{ border: '1px solid rgba(255,255,255,0.12)' }}
      >
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.fill }} />
            <span className="font-mono text-xs text-muted-text">{entry.name}:</span>
            <span className="font-mono text-xs text-foreground font-bold">{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ stats, loading }) => {
  const hitRate = (stats?.cache_hit_rate ?? 0).toFixed(1)
  const hitRateColor = (stats?.cache_hit_rate ?? 0) >= 50 ? '#10b981' : '#f59e0b'

  const dist = stats?.model_distribution ?? { flash: 0, pro: 0, cache: 0 }
  const pieData = [
    { name: 'Flash', value: dist.flash ?? 0, fill: COLORS.flash },
    { name: 'Pro', value: dist.pro ?? 0, fill: COLORS.pro },
    { name: 'Cache', value: dist.cache ?? 0, fill: COLORS.cache },
  ].filter((d) => d.value > 0)

  const barData = [
    { name: 'Hits', value: stats?.cache_hits ?? 0, fill: COLORS.cache },
    { name: 'Misses', value: stats?.cache_misses ?? 0, fill: '#475569' },
  ]

  const costSavings = stats?.estimated_cost_savings_usd ?? 0
  const costStr = costSavings < 0.01 ? '<$0.01' : `$${costSavings.toFixed(2)}`

  return (
    <section id="metrics" className="px-6 md:px-10 py-24 max-w-6xl mx-auto w-full">
      {/* Section label */}
      <span className="section-label">// 02. METRICS</span>
      <h2 className="mt-3 text-2xl sm:text-3xl font-semibold text-foreground">
        Live Performance Metrics
      </h2>
      <p className="mt-2 text-sm text-muted-text">
        Real-time stats refreshed every 3 seconds from the backend.
      </p>

      {/* 4-card grid */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Cache Hit Rate"
          value={`${hitRate}%`}
          sub={`${stats.cache_hits} hits / ${stats.total_queries} total`}
          valueColor={hitRateColor}
          loading={loading}
        />
        <StatCard
          label="Avg Latency"
          value={`${Math.round(stats.avg_latency_ms)} ms`}
          sub={`Cached: ${Math.round(stats.avg_cached_latency_ms)}ms · Uncached: ${Math.round(stats.avg_uncached_latency_ms)}ms`}
          loading={loading}
        />
        <StatCard
          label="Total Queries"
          value={stats.total_queries.toLocaleString()}
          sub={`${stats.pii_blocked} PII blocked`}
          loading={loading}
        />
        <StatCard
          label="Tokens Saved"
          value={stats.total_tokens_saved.toLocaleString()}
          sub={`Est. savings ${costStr}`}
          valueColor="#10b981"
          loading={loading}
        />
      </div>

      {/* Charts row */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie chart */}
        <div className="glass-card p-6" style={{ boxShadow: '0 0 25px rgba(59,130,246,0.08)' }}>
          <span className="font-mono text-xs text-muted-text uppercase tracking-wider">
            Model Distribution
          </span>
          <div className="mt-4 h-56">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <span className="font-mono text-xs text-muted-text">No data yet</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span className="font-mono text-xs text-muted-text">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bar chart */}
        <div className="glass-card p-6" style={{ boxShadow: '0 0 25px rgba(59,130,246,0.08)' }}>
          <span className="font-mono text-xs text-muted-text uppercase tracking-wider">
            Cache Hits vs Misses
          </span>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontFamily: 'JetBrains Mono', fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontFamily: 'JetBrains Mono', fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {barData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  )
}

export default MetricsDashboard
