import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, MessageSquare, ShieldCheck } from 'lucide-react'
import MetricsDashboard from '../components/MetricsDashboard'
import RecentQueries from '../components/RecentQueries'
import { useStats } from '../hooks/useStats'
import { useAuth } from '../context/AuthContext'

export const AnalyticsPage: React.FC = () => {
  const { stats, loading } = useStats(3000)
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col relative overflow-hidden selection:bg-blue-500/30 selection:text-white">
      {/* Background ambient glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-blue-600/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Top Navbar */}
      <header className="h-16 flex items-center justify-between px-6 md:px-12 border-b border-white/10 bg-[#070b14]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
              [SC]
            </span>
            <span className="font-semibold text-sm text-white tracking-tight">
              SmartCache Analytics
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <Link
            to={user ? "/chat" : "/signin"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition shadow-lg shadow-blue-500/20"
          >
            <MessageSquare size={13} />
            <span>Open Chat Studio</span>
          </Link>
          <Link
            to="/guardrails"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 text-slate-300 hover:text-white transition"
          >
            <ShieldCheck size={13} />
            <span>Guardrails Matrix</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 space-y-12">
        <MetricsDashboard stats={stats} loading={loading} />

        <div className="max-w-6xl mx-auto px-6">
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
        </div>

        <RecentQueries />
      </main>

      <footer className="py-6 px-8 border-t border-white/5 flex items-center justify-between text-xs font-mono text-slate-500">
        <span>Live Telemetry &bull; Auto-syncing every 3 seconds</span>
        <Link to="/" className="text-slate-400 hover:text-white flex items-center gap-1">
          <ArrowLeft size={12} /> Back to Gateway Overview
        </Link>
      </footer>
    </div>
  )
}
export default AnalyticsPage
