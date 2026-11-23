import React from 'react'
import { Link } from 'react-router-dom'
import {
  Zap,
  ShieldCheck,
  Database,
  ArrowRight,
  MessageSquare
} from 'lucide-react'
import HeroSection from '../components/HeroSection'
import HowItWorks from '../components/HowItWorks'
import MetricsDashboard from '../components/MetricsDashboard'
import RecentQueries from '../components/RecentQueries'
import Navbar from '../components/Navbar'
import { useStats } from '../hooks/useStats'
import { useAuth } from '../context/AuthContext'

export const LandingPage: React.FC = () => {
  const { stats, loading: statsLoading } = useStats(3000)
  const { user } = useAuth()

  return (
    <div
      className="min-h-screen relative overflow-x-hidden selection:bg-blue-500/30 selection:text-white"
      style={{ background: '#070b14', color: '#f1f5f9' }}
    >
      {/* Ambient background glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-blue-600/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-[45%] right-[-10%] w-[600px] h-[600px] bg-purple-600/5 blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-[-10%] w-[600px] h-[600px] bg-blue-600/5 blur-3xl pointer-events-none -z-10" />

      {/* Main Navbar */}
      <Navbar />

      <main className="pt-6 space-y-16">
        {/* Hero with CTA */}
        <HeroSection stats={stats} statsLoading={statsLoading} />

        {/* Prominent Action Banner: Sign In / Access Studio Gate */}
        <section className="px-6 md:px-10 max-w-6xl mx-auto w-full">
          <div className="p-8 sm:p-10 rounded-3xl border border-white/10 bg-gradient-to-br from-[#0b1120] to-[#070b14] shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col gap-3 max-w-xl text-left">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-xs uppercase tracking-wider text-blue-400 font-semibold">
                  // AUTHENTICATION PROTECTED WORKSPACE
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {user ? `Welcome back, ${user.name}` : 'Sign In to Start Chatting & Storing History'}
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                {user
                  ? 'Your workspace is active. All multi-turn conversation threads are saved to MongoDB Atlas with dual-tier caching.'
                  : 'Without signing in or signing up, you cannot start a new chat. Register in 10 seconds to access the live Chat Studio, multi-turn memory, and MongoDB Atlas persistence.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
              {user ? (
                <Link
                  to="/chat"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-mono text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 cursor-pointer"
                >
                  <MessageSquare size={15} />
                  <span>Launch Chat Studio &rarr;</span>
                </Link>
              ) : (
                <>
                  <Link
                    to="/signup"
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-mono text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 cursor-pointer"
                  >
                    <span>Create Account (Sign Up)</span>
                    <ArrowRight size={14} />
                  </Link>
                  <Link
                    to="/signin"
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-mono text-xs font-medium bg-white/[0.05] hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Sign In</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="px-6 md:px-10 max-w-6xl mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-3 hover:border-blue-500/40 hover:-translate-y-1 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Zap size={20} />
              </div>
              <h3 className="text-base font-semibold text-white">Dual-Tier Caching</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Upstash Redis exact match (~20ms) combined with Pinecone &amp; ChromaDB semantic vector caching.
              </p>
            </div>

            {/* Card 2 */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-3 hover:border-purple-500/40 hover:-translate-y-1 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-base font-semibold text-white">5 Enterprise Guardrails</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Prevents entity collisions, antonym inversion, cache stampedes, stale data, and tenant leaks.
              </p>
              <Link to="/guardrails" className="text-xs font-mono text-purple-400 hover:underline mt-1">
                Explore Matrix &rarr;
              </Link>
            </div>

            {/* Card 3 */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-3 hover:border-emerald-500/40 hover:-translate-y-1 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Database size={20} />
              </div>
              <h3 className="text-base font-semibold text-white">MongoDB Atlas History</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every multi-turn conversation turn and token metric is securely stored in MongoDB Atlas collections.
              </p>
            </div>
          </div>
        </section>

        {/* Live Metrics Showcase */}
        <section className="px-6 md:px-10 max-w-6xl mx-auto w-full">
          <MetricsDashboard stats={stats} loading={statsLoading} />
        </section>

        {/* Telemetry Stream */}
        <section className="px-6 md:px-10 max-w-6xl mx-auto w-full">
          <RecentQueries />
        </section>

        {/* Pipeline Architecture */}
        <section className="px-6 md:px-10 max-w-6xl mx-auto w-full">
          <HowItWorks />
        </section>

        {/* Footer */}
        <footer
          className="py-12 px-6 md:px-10 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-6xl mx-auto w-full text-slate-500 font-mono text-xs"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">SmartCache LLM Router</span>
            <span>&bull; Full-Stack Enterprise Platform</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <Link to="/signin" className="hover:text-white">Sign In</Link>
            <Link to="/signup" className="hover:text-white">Sign Up</Link>
            <Link to="/analytics" className="hover:text-white">Analytics</Link>
            <Link to="/guardrails" className="hover:text-white">Guardrails</Link>
          </div>
        </footer>
      </main>
    </div>
  )
}
export default LandingPage
