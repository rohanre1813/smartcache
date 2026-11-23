import React, { useState } from 'react'
import axios from 'axios'
import { X, Lock, Mail, User, Loader2, ArrowRight, Database } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export const AuthModal: React.FC = () => {
  const { isModalOpen, modalMode, closeAuthModal, openAuthModal, login, mongodbConnected } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tenantId, setTenantId] = useState('default')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isModalOpen) return null

  const isSignUp = modalMode === 'signup'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isSignUp) {
        const { data } = await axios.post('/api/auth/signup', {
          name: name.trim(),
          email: email.trim(),
          password,
          tenant_id: tenantId,
        })
        login(data.token, data.user, data.mongodb_connected)
      } else {
        const { data } = await axios.post('/api/auth/signin', {
          email: email.trim(),
          password,
        })
        login(data.token, data.user, data.mongodb_connected)
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Authentication failed'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1120] p-6 sm:p-8 shadow-2xl shadow-blue-500/10 overflow-hidden"
        style={{
          boxShadow: '0 0 50px rgba(59,130,246,0.15)',
        }}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-blue-500/20 blur-2xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex flex-col gap-1 mb-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-wider text-blue-400 font-semibold">
              // Enterprise Gateway Auth
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isSignUp ? 'Create your Account' : 'Welcome back'}
          </h2>
          <p className="text-xs text-slate-400">
            {isSignUp
              ? 'Sign up to persist multi-turn chat history to MongoDB Atlas.'
              : 'Sign in to access your saved sessions and multi-tenant keys.'}
          </p>
        </div>

        {/* Tabs: Sign In vs Sign Up */}
        <div className="flex p-1 rounded-xl bg-[#070b14] border border-white/10 mb-6 font-mono text-xs">
          <button
            type="button"
            onClick={() => {
              setError(null)
              openAuthModal('signin')
            }}
            className={`flex-1 py-2 rounded-lg font-medium transition cursor-pointer ${
              !isSignUp ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null)
              openAuthModal('signup')
            }}
            className={`flex-1 py-2 rounded-lg font-medium transition cursor-pointer ${
              isSignUp ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 font-sans leading-relaxed">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
          {/* Name field (Sign Up only) */}
          {isSignUp && (
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
                  className="w-full bg-[#070b14] border border-white/10 rounded-xl py-2.5 pl-10 pr-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 text-xs"
                />
              </div>
            </div>
          )}

          {/* Email field */}
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
                className="w-full bg-[#070b14] border border-white/10 rounded-xl py-2.5 pl-10 pr-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 text-xs"
              />
            </div>
          </div>

          {/* Password field */}
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
                className="w-full bg-[#070b14] border border-white/10 rounded-xl py-2.5 pl-10 pr-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 text-xs"
              />
            </div>
          </div>

          {/* Tenant Selector (Sign Up only) */}
          {isSignUp && (
            <div className="space-y-1.5">
              <label className="font-mono text-slate-300 text-[11px] block">Assigned Workspace Tenant</label>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="w-full bg-[#070b14] border border-white/10 rounded-xl py-2.5 px-3.5 text-slate-200 focus:outline-none focus:border-blue-500/60 text-xs font-mono"
              >
                <option value="default">Default Public Tenant</option>
                <option value="acme-corp">Acme Corp (Isolated)</option>
                <option value="beta-inc">Beta Inc (Isolated)</option>
              </select>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl font-mono text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin text-white" />
                <span>Authenticating…</span>
              </>
            ) : (
              <>
                <span>{isSignUp ? 'Create Account & Continue' : 'Sign In to Gateway'}</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* MongoDB Atlas Status Footer */}
        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-1.5">
            <Database size={12} className={mongodbConnected ? 'text-emerald-400' : 'text-blue-400'} />
            <span>MongoDB Atlas Storage</span>
          </div>
          <span className={mongodbConnected ? 'text-emerald-400' : 'text-slate-400'}>
            {mongodbConnected ? '● Cloud Connected' : '● In-Memory Fallback'}
          </span>
        </div>
      </div>
    </div>
  )
}
export default AuthModal
