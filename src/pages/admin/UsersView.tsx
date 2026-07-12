import { useEffect, useState } from 'react'
import { admin, type AdminUserRow } from '../../lib/admin'

export default function UsersView() {
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<number | null>(null)

  const load = () => admin.users(q || undefined).then(setRows).catch(() => setRows([]))
  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [q])

  const act = async (id: number, fn: () => Promise<AdminUserRow | void>) => {
    setBusy(id)
    try {
      await fn()
      await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="soc-panel">
      <div className="flex items-center gap-2 border-b soc-line p-3">
        <input className="soc-input w-64" placeholder="procurar email ou @username" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="soc-mono ml-auto text-[11px] text-[#5b6b7b]">{rows.length} utilizadores</span>
      </div>
      <div className="overflow-x-auto">
        <table className="soc-table">
          <thead>
            <tr>
              <th>id</th>
              <th>email</th>
              <th>@user</th>
              <th>estado</th>
              <th>falhas</th>
              <th>criado</th>
              <th>ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="soc-mono text-[#5b6b7b]">{u.id}</td>
                <td className="soc-mono text-[#cbd6e2]">
                  {u.email}
                  {u.isAdmin && <span className="soc-mono ml-2 text-[10px] sev-warning">ADMIN</span>}
                </td>
                <td className="soc-mono text-[#8b9bab]">{u.username ? `@${u.username}` : '—'}</td>
                <td className="soc-mono">
                  {u.isActive ? <span className="sev-info">ativo</span> : <span className="sev-critical">inativo</span>}
                  {u.lockedUntil && <span className="ml-2 sev-warning">locked</span>}
                </td>
                <td className={`soc-mono ${u.failedLoginAttempts > 0 ? 'sev-warning' : 'text-[#5b6b7b]'}`}>{u.failedLoginAttempts}</td>
                <td className="soc-mono text-[#5b6b7b]">{u.createdAt.slice(0, 10)}</td>
                <td>
                  <div className="flex gap-1.5">
                    <button className="soc-btn" disabled={busy === u.id} onClick={() => act(u.id, () => admin.forceLogout(u.id))}>
                      logout
                    </button>
                    {u.isActive ? (
                      <button className="soc-btn soc-btn-danger" disabled={busy === u.id} onClick={() => act(u.id, () => admin.disableUser(u.id))}>
                        desativar
                      </button>
                    ) : (
                      <button className="soc-btn" disabled={busy === u.id} onClick={() => act(u.id, () => admin.enableUser(u.id))}>
                        reativar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="soc-mono p-4 text-xs text-[#5b6b7b]">Sem utilizadores.</p>}
      </div>
    </section>
  )
}
