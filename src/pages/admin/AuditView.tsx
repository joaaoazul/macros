import { useEffect, useRef, useState } from 'react'
import { admin, subscribeLiveFeed, type AuditRow, type LiveEvent } from '../../lib/admin'

function sevClass(s: string) {
  return s === 'critical' ? 'sev-critical' : s === 'warning' ? 'sev-warning' : 'sev-info'
}
function sevBar(s: string) {
  return s === 'critical' ? 'sev-bar-critical' : s === 'warning' ? 'sev-bar-warning' : 'sev-bar-info'
}
function ts(iso: string) {
  return iso.slice(0, 19).replace('T', ' ')
}

export default function AuditView() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [action, setAction] = useState('')
  const [severity, setSeverity] = useState('')
  const [ip, setIp] = useState('')
  const [live, setLive] = useState<LiveEvent[]>([])
  const [connected, setConnected] = useState(false)
  const liveOn = useRef(true)

  const load = () => {
    admin
      .audit({ action, severity, ip, limit: 100 })
      .then((p) => {
        setRows(p.rows)
        setTotal(p.total)
      })
      .catch(() => setRows([]))
  }
  useEffect(load, [action, severity, ip])

  useEffect(() => {
    const stop = subscribeLiveFeed((e) => {
      setConnected(true)
      if (liveOn.current) setLive((l) => [e, ...l].slice(0, 40))
    })
    return stop
  }, [])

  return (
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      {/* tabela filtrável */}
      <section className="soc-panel">
        <div className="flex flex-wrap items-center gap-2 border-b soc-line p-3">
          <input className="soc-input w-32" placeholder="action" value={action} onChange={(e) => setAction(e.target.value)} />
          <select className="soc-input" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">severidade</option>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
          <input className="soc-input w-32" placeholder="ip" value={ip} onChange={(e) => setIp(e.target.value)} />
          <button className="soc-btn" onClick={load}>↻</button>
          <span className="soc-mono ml-auto text-[11px] text-[#5b6b7b]">{total} eventos</span>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="soc-table">
            <thead>
              <tr>
                <th>ts (utc)</th>
                <th>sev</th>
                <th>action</th>
                <th>user</th>
                <th>ip</th>
                <th>detalhe</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="soc-mono whitespace-nowrap text-[#8b9bab]">{ts(r.createdAt)}</td>
                  <td className={`soc-mono ${sevClass(r.severity)}`}>{r.severity.slice(0, 4)}</td>
                  <td className="soc-mono text-[#cbd6e2]">{r.action}</td>
                  <td className="soc-mono text-[#8b9bab]">{r.userId ?? '—'}</td>
                  <td className="soc-mono text-[#cbd6e2]">{r.ip || '—'}</td>
                  <td className="text-[#8b9bab]">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="soc-mono p-4 text-xs text-[#5b6b7b]">Sem eventos para estes filtros.</p>}
        </div>
      </section>

      {/* feed ao vivo — o elemento-assinatura */}
      <section className="soc-panel flex flex-col">
        <div className="flex items-center justify-between border-b soc-line p-3">
          <div className="flex items-center gap-2">
            <span className="soc-led" style={connected ? undefined : { background: 'var(--soc-dim)', animation: 'none' }} aria-hidden />
            <span className="soc-eyebrow">feed ao vivo</span>
          </div>
          <button className="soc-btn" onClick={() => { liveOn.current = !liveOn.current; setLive((l) => [...l]) }}>
            {liveOn.current ? 'pausar' : 'retomar'}
          </button>
        </div>
        <div className="max-h-[70vh] flex-1 overflow-y-auto p-2">
          {live.length === 0 && (
            <p className="soc-mono p-3 text-xs text-[#5b6b7b]">
              {connected ? 'À espera de eventos…' : 'A ligar ao stream…'}
            </p>
          )}
          <ul className="space-y-1">
            {live.map((e, i) => (
              <li key={i} className={`${sevBar(e.severity)} bg-[rgba(255,255,255,0.015)] px-3 py-1.5`}>
                <div className="flex items-center justify-between">
                  <span className={`soc-mono text-[12px] ${sevClass(e.severity)}`}>{e.action}</span>
                  <span className="soc-mono text-[10px] text-[#5b6b7b]">{e.ip || '—'}</span>
                </div>
                {e.detail && <div className="soc-mono truncate text-[10px] text-[#6a7b8b]">{e.detail}</div>}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
