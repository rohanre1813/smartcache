import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Lock, Mail, User, ArrowRight, Loader2, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export const SignUpPage: React.FC = () => {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tenantId, setTenantId] = useState('default')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data } = await axios.post('/api/auth/signup', {
        name: name.trim(),
        email: email.trim(),
        password,
        tenant_id: tenantId,
      })
      login(data.token, data.user, data.mongodb_connected)
      navigate('/chat', { replace: true })
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Registration failed'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/15 blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-cyan-600/10 blur-3xl pointer-events-none -z-10" />

      {/* Top Simple Nav */}
      <header className="h-16 flex items-center justify-between px-6 md:px-12 border-b border-white/5 bg-[#070b14]/80 backdrop-blur-md">
        <Link to="/" className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
            [SC]
          </span>
          <span className="font-semibold text-sm text-white tracking-tight">
            SmartCache LLM Router
          </span>
        </Link>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-slate-500 hidden sm:inline">Already registered?</span>
          <Link
            to="/signin"
            className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white transition"
          >
            Sign In &rarr;
          </Link>
        </div>
      </header>

      {/* Main Card */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div
          className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1120]/90 backdrop-blur-2xl p-8 shadow-2xl overflow-hidden"
          style={{ boxShadow: '0 0 50px rgba(59,130,246,0.12)' }}
        >
          {/* Subtle top indicator */}
          <div className="flex items-center gap-2 mb-2 font-mono text-xs text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span>// NEW USER REGISTRATION</span>
          </div>

          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
            Create Account
          </h1>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Create an account to start multi-turn chats, retain MongoDB Atlas history, and experience dual-tier caching.
          </p>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 font-sans leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="font-mono text-slate-300 text-[11px] block">Full Name</label>
              <div className="relative flex items-center">
                <User size={15} className="absolute left-3.5 text-slate-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rohan Shetty"
                  className="w-full bg-[#070b14] border border-white/10 rounded-xl py-3 pl-10 pr-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 text-xs"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="font-mono text-slate-300 text-[11px] block">Email Address</label>
              <div className="relative flex items-center">
                <Mail size={15} className="absolute left-3.5 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-[#070b14] border border-white/10 rounded-xl py-3 pl-10 pr-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 text-xs"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="font-mono text-slate-300 text-[11px] block">Password</label>
              <div className="relative flex items-center">
                <Lock size={15} className="absolute left-3.5 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#070b14] border border-white/10 rounded-xl py-3 pl-10 pr-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 text-xs"
                />
              </div>
            </div>

            {/* Workspace Tenant */}
            <div className="space-y-1.5">
              <label className="font-mono text-slate-300 text-[11px] block">Workspace Tenant (Data Isolation)</label>
              <div className="relative flex items-center">
                <SlidersHorizontal size={15} className="absolute left-3.5 text-slate-500" />
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="w-full bg-[#070b14] border border-white/10 rounded-xl py-3 pl-10 pr-3.5 text-slate-200 focus:outline-none focus:border-blue-500/60 text-xs font-mono cursor-pointer"
                >
                  <option value="default">Default Tenant</option>
                  <option value="acme-corp">Acme Corp (Private Tenant)</option>
                  <option value="beta-inc">Beta Inc (Private Tenant)</option>
                </select>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3 rounded-xl font-mono text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin text-white" />
                  <span>Creating Account…</span>
                </>
              ) : (
                <>
                  <span>Create Account &amp; Access Studio</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Footer link to sign in */}
          <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Already have an account?</span>
            <Link to="/signin" className="text-blue-400 hover:text-blue-300 font-semibold">
              Sign In &rarr;
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 md:px-12 border-t border-white/5 text-center text-[11px] font-mono text-slate-500">
        SmartCache LLM Router &bull; Multi-Tenant Enterprise Gateway
      </footer>
    </div>
  )
}
export default SignUpPage
