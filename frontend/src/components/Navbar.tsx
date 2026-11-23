import React from 'react'
import { Link } from 'react-router-dom'
import { User, LogIn, LogOut, Database, MessageSquare } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const Navbar: React.FC = () => {
  const { user, logout, mongodbConnected } = useAuth()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-4 md:px-10"
      style={{
        background: 'rgba(7, 11, 20, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Brand pill */}
      <Link to="/" className="flex items-center gap-3 select-none shrink-0">
        <span
          className="font-mono text-xs font-bold px-2.5 py-1 rounded-xl"
          style={{
            background: 'rgba(59,130,246,0.15)',
            border: '1px solid rgba(59,130,246,0.35)',
            color: '#3b82f6',
            letterSpacing: '0.08em',
          }}
        >
          [SC]
        </span>
        <span className="font-sans font-semibold text-sm text-foreground tracking-tight hidden sm:block">
          SmartCache LLM Router
        </span>
      </Link>

      {/* Navigation links */}
      <div className="hidden lg:flex items-center gap-5 ml-8 text-xs font-mono text-slate-400">
        <Link to="/chat" className="text-blue-400 hover:text-white transition-colors flex items-center gap-1.5 font-medium">
          <MessageSquare size={13} />
          <span>Chat Studio</span>
        </Link>
        <Link to="/analytics" className="hover:text-blue-400 transition-colors">
          // Analytics
        </Link>
        <Link to="/guardrails" className="hover:text-blue-400 transition-colors">
          // Guardrails
        </Link>
        <a href="#how-it-works" className="hover:text-blue-400 transition-colors">
          // Pipeline
        </a>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right controls: Mongo status, Auth, System Online */}
      <div className="flex items-center gap-3 font-mono text-xs">
        {/* MongoDB Status badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/10 text-slate-300">
          <Database size={12} className={mongodbConnected ? 'text-emerald-400' : 'text-blue-400'} />
          <span className="text-[11px]">
            {mongodbConnected ? 'Mongo: Atlas Connected' : 'Mongo: In-Memory'}
          </span>
        </div>

        {/* User Profile or Sign In Button */}
        {user ? (
          <div className="flex items-center gap-2">
            <Link
              to="/chat"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 transition"
            >
              <User size={12} />
              <span className="text-[11px] font-semibold max-w-[120px] truncate">{user.name}</span>
              {user.tenant_id && user.tenant_id !== 'default' && (
                <span className="text-[9px] bg-blue-500/20 px-1 py-0.5 rounded text-blue-200 uppercase">
                  {user.tenant_id}
                </span>
              )}
            </Link>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/signin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:text-white transition cursor-pointer font-mono text-xs"
            >
              <LogIn size={12} />
              <span>Sign In</span>
            </Link>
            <Link
              to="/signup"
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition cursor-pointer font-mono text-xs shadow-md shadow-blue-500/20"
            >
              <span>Sign Up</span>
            </Link>
          </div>
        )}

        {/* Live status indicator */}
        <div className="hidden sm:flex items-center gap-2 pl-1">
          <span className="relative flex h-2 w-2">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: '#10b981' }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ background: '#10b981' }}
            />
          </span>
          <span className="text-[11px] text-muted-text">
            Online
          </span>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
