import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Loader2 } from 'lucide-react'

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, token } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center gap-3 text-slate-400 font-mono text-xs">
        <Loader2 size={28} className="animate-spin text-blue-500" />
        <span>Authenticating session…</span>
      </div>
    )
  }

  if (!user && !token) {
    // Redirect to /signin, saving current location so user can be redirected back after sign in
    return <Navigate to="/signin" state={{ from: location }} replace />
  }

  return <>{children}</>
}
export default ProtectedRoute
