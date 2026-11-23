import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { StatsData } from '../types'

const DEFAULT_STATS: StatsData = {
  total_queries: 0,
  cache_hits: 0,
  cache_misses: 0,
  cache_hit_rate: 0,
  avg_latency_ms: 0,
  avg_cached_latency_ms: 0,
  avg_uncached_latency_ms: 0,
  total_tokens_saved: 0,
  estimated_cost_savings_usd: 0,
  model_distribution: { flash: 0, pro: 0, cache: 0 },
  pii_blocked: 0,
}

export function useStats(pollIntervalMs = 3000) {
  const [stats, setStats] = useState<StatsData>(DEFAULT_STATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await axios.get<StatsData>('/api/stats')
      setStats(data)
      setError(null)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.message)
      } else {
        setError('Failed to fetch stats')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, pollIntervalMs)
    return () => clearInterval(interval)
  }, [fetchStats, pollIntervalMs])

  return { stats, loading, error, refetch: fetchStats }
}
