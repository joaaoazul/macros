import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import './admin.css'
import Dashboard from './Dashboard'
import AuditView from './AuditView'
import UsersView from './UsersView'
import IpsView from './IpsView'

type View = 'dashboard' | 'audit' | 'users' | 'ips'

const NAV: { id: View; label: string; code: string }[] = [
  { id: 'dashboard', label: 'Dashboard', code: 'OVW' },
  { id: 'audit', label: 'Audit log', code: 'LOG' },
  { id: 'users', label: 'Utilizadores', code: 'USR' },
  { id: 'ips', label: 'IP intel', code: 'NET' },
]

export default function AdminConsole() {
  const [view, setView] = useState<View>('dashboard')
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="soc flex">
      {/* rail esquerdo */}
      <aside className="flex w-[168px] shrink-0 flex-col border-r soc-line">
        <div className="px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="soc-led" aria-hidden />
            <span className="soc-mono text-[13px] font-semibold tracking-widest">MACROS·SOC</span>
          </div>
          <div className="soc-eyebrow mt-1">security ops</div>
        </div>
        <nav className="mt-2 flex-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] transition ${
                view === n.id ? 'bg-[rgba(56,189,248,0.08)] text-[#e6eef6]' : 'text-[#8b9bab] hover:text-[#cbd6e2]'
              }`}
              style={view === n.id ? { boxShadow: 'inset 2px 0 0 var(--soc-accent)' } : undefined}
            >
              <span className="soc-mono text-[10px] text-[#5b6b7b]">{n.code}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="border-t soc-line p-4">
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
        <header className="flex items-center justify-between border-b soc-line px-6 py-4">
          <div>
            <div className="soc-eyebrow">{NAV.find((n) => n.id === view)?.code} · macros.joaoazul.dev</div>
            <h1 className="mt-0.5 text-xl font-semibold text-[#e6eef6]">
              {NAV.find((n) => n.id === view)?.label}
            </h1>
          </div>
          <div className="soc-mono text-[11px] text-[#5b6b7b]">{new Date().toISOString().slice(0, 19).replace('T', ' ')}Z</div>
        </header>
        <div className="p-6">
          {view === 'dashboard' && <Dashboard />}
          {view === 'audit' && <AuditView />}
          {view === 'users' && <UsersView />}
          {view === 'ips' && <IpsView />}
        </div>
      </main>
    </div>
  )
}
