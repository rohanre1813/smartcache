import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, LogOut, Database, ShieldCheck, BarChart3, Home } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import ChatWorkspace from '../components/ChatWorkspace'

export const ChatPage: React.FC = () => {
  const { user, logout, mongodbConnected } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col relative overflow-hidden selection:bg-blue-500/30 selection:text-white">
      {/* Ambient background glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-blue-600/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-[-10%] w-[500px] h-[500px] bg-purple-600/5 blur-3xl pointer-events-none -z-10" />

      {/* Top Application Navigation */}
      <header className="h-16 flex items-center justify-between px-4 sm:px-8 border-b border-white/10 bg-[#070b14]/85 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
              [SC]
            </span>
            <span className="font-semibold text-sm text-white tracking-tight hidden sm:inline">
              SmartCache Gateway
            </span>
          </Link>

          {/* Sub-nav */}
          <nav className="flex items-center gap-2 text-xs font-mono">
            <Link
              to="/chat"
              className="px-3 py-1.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/40 font-semibold flex items-center gap-1.5"
            >
              <span>💬 Chat Studio</span>
            </Link>
            <Link
              to="/analytics"
              className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition flex items-center gap-1.5"
            >
              <BarChart3 size={13} />
              <span className="hidden md:inline">Analytics</span>
            </Link>
            <Link
              to="/guardrails"
              className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition flex items-center gap-1.5"
            >
              <ShieldCheck size={13} />
              <span className="hidden md:inline">Guardrails</span>
            </Link>
          </nav>
        </div>

        {/* User Account & Actions */}
        <div className="flex items-center gap-3 font-mono text-xs">
          {/* MongoDB Atlas Status */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/10 text-slate-300">
            <Database size={12} className={mongodbConnected ? 'text-emerald-400' : 'text-blue-400'} />
            <span className="text-[11px]">
              {mongodbConnected ? 'Mongo: Atlas Connected' : 'Mongo: In-Memory'}
            </span>
          </div>

          {/* User profile pill */}
          {user && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300">
              <User size={13} className="text-blue-400" />
              <span className="font-semibold max-w-[140px] truncate">{user.name}</span>
              {user.tenant_id && user.tenant_id !== 'default' && (
                <span className="text-[9px] bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-200 uppercase font-bold">
                  {user.tenant_id}
                </span>
              )}
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 p-2 rounded-xl border border-white/10 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
            title="Sign out"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline text-[11px]">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Studio Viewport */}
      <main className="flex-1 flex flex-col justify-center max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-blue-400">
              // ACTIVE CHAT WORKSPACE
            </span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-xs font-mono text-slate-400">
              Session History Saved to MongoDB Atlas
            </span>
          </div>
          <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Dual-Cache Active
          </span>
        </div>

        <ChatWorkspace />
      </main>

      {/* Minimal Footer */}
      <footer className="py-4 px-8 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-500">
        <span>SmartCache LLM Router &bull; Multi-Turn Conversational Memory</span>
        <Link to="/" className="text-slate-400 hover:text-white flex items-center gap-1">
          <Home size={11} /> Back to Gateway Overview
        </Link>
      </footer>
    </div>
  )
}
export default ChatPage
