import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import './admin.css'
import Dashboard from './Dashboard'
import AuditView from './AuditView'
import UsersView from './UsersView'
import IpsView from './IpsView'
import InvitesView from './InvitesView'

type View = 'dashboard' | 'audit' | 'users' | 'ips' | 'invites'

const NAV: { id: View; label: string; code: string }[] = [
  { id: 'dashboard', label: 'Dashboard', code: 'OVW' },
  { id: 'audit', label: 'Audit log', code: 'LOG' },
  { id: 'users', label: 'Utilizadores', code: 'USR' },
  { id: 'ips', label: 'IP intel', code: 'NET' },
  { id: 'invites', label: 'Convites', code: 'INV' },
]

export default function AdminConsole() {
  const [view, setView] = useState<View>('dashboard')
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="soc flex flex-col md:flex-row">
      {/* Rail lateral no desktop; no telemóvel passa a barra de topo com os
          separadores em fila — um rail de 168 px comia metade de um ecrã de 390. */}
      <aside className="flex shrink-0 flex-col border-b soc-line md:w-[168px] md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] md:block md:py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="soc-led" aria-hidden />
              <span className="soc-mono text-[13px] font-semibold tracking-widest">MACROS·SOC</span>
            </div>
            <div className="soc-eyebrow mt-1">security ops</div>
          </div>
          {/* atalhos de sessão: no telemóvel vivem aqui, ao lado do título */}
          <div className="flex shrink-0 gap-2 md:hidden">
            <button onClick={() => navigate('/app')} className="soc-btn">← app</button>
            <button
              onClick={async () => {
                await logout()
                navigate('/login', { replace: true })
              }}
              className="soc-btn soc-btn-danger"
            >
              sair
            </button>
          </div>
        </div>
        <nav className="flex overflow-x-auto md:mt-2 md:flex-1 md:flex-col md:overflow-visible">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              aria-current={view === n.id ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2.5 text-left text-[13px] transition md:w-full md:gap-3 ${
                view === n.id ? 'bg-[rgba(56,189,248,0.08)] text-[#e6eef6]' : 'text-[#8b9bab] hover:text-[#cbd6e2]'
              }`}
              style={view === n.id ? { boxShadow: 'inset 0 -2px 0 var(--soc-accent)' } : undefined}
            >
              <span className="soc-mono text-[10px] text-[#5b6b7b]">{n.code}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="hidden border-t soc-line p-4 md:block">
          <div className="soc-eyebrow">sessão</div>
          <div className="soc-mono mt-1 truncate text-[11px] text-[#8b9bab]">{user?.email}</div>
          <div className="mt-3 flex flex-col gap-2">
            <button onClick={() => navigate('/app')} className="soc-btn text-left">← app</button>
            <button
              onClick={async () => {
                await logout()
                navigate('/login', { replace: true })
              }}
              className="soc-btn soc-btn-danger text-left"
            >
              terminar sessão
            </button>
          </div>
        </div>
      </aside>

      {/* conteúdo */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="flex items-center justify-between gap-3 border-b soc-line px-4 py-3 md:px-6 md:py-4">
          <div className="min-w-0">
            <div className="soc-eyebrow truncate">{NAV.find((n) => n.id === view)?.code} · macros.joaoazul.dev</div>
            <h1 className="mt-0.5 truncate text-lg font-semibold text-[#e6eef6] md:text-xl">
              {NAV.find((n) => n.id === view)?.label}
            </h1>
          </div>
          <div className="soc-mono hidden shrink-0 text-[11px] text-[#5b6b7b] sm:block">
            {new Date().toISOString().slice(0, 19).replace('T', ' ')}Z
          </div>
        </header>
        <div className="p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:p-6">
          {view === 'dashboard' && <Dashboard />}
          {view === 'audit' && <AuditView />}
          {view === 'users' && <UsersView />}
          {view === 'ips' && <IpsView />}
          {view === 'invites' && <InvitesView />}
        </div>
      </main>
    </div>
  )
}
