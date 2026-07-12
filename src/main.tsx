import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider, useAuth } from './lib/auth'
import { registerServiceWorker } from './lib/push'
import Landing from './pages/Landing'

const AdminConsole = lazy(() => import('./pages/admin/AdminConsole'))
import Login from './pages/Login'
import Privacidade from './pages/Privacidade'
import RecuperarPassword from './pages/RecuperarPassword'
import Registo from './pages/Registo'
import ReporPassword from './pages/ReporPassword'
import Termos from './pages/Termos'
import VerificarEmail from './pages/VerificarEmail'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-muted">
        <span aria-hidden className="animate-pulse text-3xl">🥗</span>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0a0e13] text-[#6a7b8b]">
        <span className="animate-pulse" style={{ fontFamily: 'monospace' }}>carregando SOC…</span>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_admin) return <Navigate to="/app" replace />
  return <>{children}</>
}

void registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registo" element={<Registo />} />
          <Route path="/recuperar-password" element={<RecuperarPassword />} />
          <Route path="/repor-password" element={<ReporPassword />} />
          <Route path="/verificar-email" element={<VerificarEmail />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <App />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <Suspense fallback={<div className="min-h-dvh bg-[#0a0e13]" />}>
                  <AdminConsole />
                </Suspense>
              </RequireAdmin>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
