import { useEffect, useState } from 'react'
import { admin, type BlocklistRow, type IpInfo } from '../../lib/admin'

export default function IpsView() {
  const [ips, setIps] = useState<IpInfo[]>([])
  const [blocklist, setBlocklist] = useState<BlocklistRow[]>([])
  const [manualIp, setManualIp] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    admin.ips().then(setIps).catch(() => setIps([]))
    admin.blocklist().then(setBlocklist).catch(() => setBlocklist([]))
  }
  useEffect(load, [])

  const block = async (ip: string, why: string) => {
    setBusy(true)
    try {
      await admin.blockIp(ip, why)
      setManualIp('')
      setReason('')
      load()
    } finally {
      setBusy(false)
    }
  }
  const unblock = async (ip: string) => {
    await admin.unblockIp(ip)
    load()
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <section className="soc-panel">
        <div className="soc-eyebrow border-b soc-line p-3">atividade por IP · 7d</div>
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="soc-table">
            <thead>
              <tr>
                <th>ip</th>
                <th>geo</th>
                <th>eventos</th>
                <th>falhas</th>
                <th>visto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ips.map((r) => (
                <tr key={r.ip} className={r.anomaly ? 'sev-bar-critical' : undefined}>
                  <td className="soc-mono text-[#cbd6e2]">
                    {r.ip}
                    {r.anomaly && <span className="ml-2 soc-mono text-[10px] sev-critical">ANOMALIA</span>}
                  </td>
                  <td className="text-[12px] text-[#8b9bab]">{r.geo ?? '—'}</td>
                  <td className="soc-mono text-[#8b9bab]">{r.events}</td>
                  <td className={`soc-mono ${r.failed > 0 ? 'sev-warning' : 'text-[#5b6b7b]'}`}>{r.failed}</td>
                  <td className="soc-mono text-[#5b6b7b]">{r.lastSeen?.slice(0, 16).replace('T', ' ') ?? '—'}</td>
                  <td>
                    {r.blocked ? (
                      <button className="soc-btn" onClick={() => unblock(r.ip)}>desbloquear</button>
                    ) : (
                      <button className="soc-btn soc-btn-danger" disabled={busy} onClick={() => block(r.ip, 'anomalia')}>
                        bloquear
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ips.length === 0 && <p className="soc-mono p-4 text-xs text-[#5b6b7b]">Sem atividade registada.</p>}
        </div>
      </section>

      <section className="soc-panel">
        <div className="soc-eyebrow border-b soc-line p-3">blocklist · {blocklist.length}</div>
        <div className="flex flex-wrap gap-2 border-b soc-line p-3">
          <input className="soc-input w-36" placeholder="1.2.3.4" value={manualIp} onChange={(e) => setManualIp(e.target.value)} />
          <input className="soc-input flex-1" placeholder="motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="soc-btn soc-btn-danger" disabled={busy || !manualIp.trim()} onClick={() => block(manualIp.trim(), reason)}>
            bloquear
          </button>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto">
          {blocklist.map((b) => (
            <li key={b.id} className="flex items-center justify-between border-b soc-line px-3 py-2.5">
              <div>
                <div className="soc-mono text-[12px] text-[#cbd6e2]">{b.ip}</div>
                {b.reason && <div className="soc-mono text-[10px] text-[#5b6b7b]">{b.reason}</div>}
              </div>
              <button className="soc-btn" onClick={() => unblock(b.ip)}>remover</button>
            </li>
          ))}
          {blocklist.length === 0 && <li className="soc-mono p-4 text-xs text-[#5b6b7b]">Nenhum IP bloqueado.</li>}
        </ul>
      </section>
    </div>
  )
}
