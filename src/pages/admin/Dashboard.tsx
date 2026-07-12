import { useEffect, useState } from 'react'
import { admin, type SecuritySummary } from '../../lib/admin'

export default function Dashboard() {
  const [data, setData] = useState<SecuritySummary | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    admin.summary().then(setData).catch(() => setError(true))
  }, [])

  if (error) return <p className="soc-mono text-sm sev-critical">Falha a carregar o resumo.</p>
  if (!data) return <p className="soc-mono text-sm text-[#5b6b7b]">A carregar telemetria…</p>

  const maxDaily = Math.max(1, ...data.daily.map((d) => Math.max(d.success, d.failed)))

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Tile label="falhas 24h" value={data.failedLogins24h} tone={data.failedLogins24h > 20 ? 'crit' : 'warn'} />
        <Tile label="falhas 7d" value={data.failedLogins7d} />
        <Tile label="lockouts 7d" value={data.lockouts7d} tone={data.lockouts7d > 0 ? 'warn' : undefined} />
        <Tile label="IPs novos 7d" value={data.firstSeenIps7d} />
        <Tile label="sessões ~30m" value={data.activeSessionsApprox} tone="ok" />
        <Tile label="push subs" value={data.pushSubscriptions} />
        <Tile label="IPs bloqueados" value={data.blockedIps} tone={data.blockedIps > 0 ? 'crit' : undefined} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        {/* gráfico diário */}
        <section className="soc-panel p-4">
          <div className="soc-eyebrow mb-3">logins · 14 dias · <span className="sev-info">sucesso</span> / <span className="sev-warning">falha</span></div>
          <div className="flex h-40 items-end gap-1.5">
            {data.daily.map((d) => (
              <div key={d.date} className="group relative flex flex-1 flex-col items-center justify-end gap-0.5">
                <div className="flex w-full flex-col items-center justify-end" style={{ height: '100%' }}>
                  <div
                    className="w-full max-w-[16px] rounded-t-[1px]"
                    style={{ height: `${(d.failed / maxDaily) * 100}%`, background: 'var(--soc-warn)' }}
                    title={`${d.date} · ${d.failed} falhas`}
                  />
                  <div
                    className="w-full max-w-[16px]"
                    style={{ height: `${(d.success / maxDaily) * 100}%`, background: 'var(--soc-accent)', opacity: 0.7 }}
                    title={`${d.date} · ${d.success} logins`}
                  />
                </div>
                <span className="soc-mono text-[8px] text-[#5b6b7b]">{d.date.slice(8)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* top IPs a falhar */}
        <section className="soc-panel p-4">
          <div className="soc-eyebrow mb-3">top IPs a falhar · 7d</div>
          {data.topFailingIps.length === 0 && <p className="soc-mono text-xs text-[#5b6b7b]">Sem falhas registadas.</p>}
          <ul className="space-y-1.5">
            {data.topFailingIps.map((t) => (
              <li key={t.ip} className="flex items-center justify-between">
                <span className="soc-mono text-[12px] text-[#cbd6e2]">{t.ip}</span>
                <span className={`soc-mono text-[12px] ${t.failed >= 10 ? 'sev-critical' : 'sev-warning'}`}>{t.failed}×</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' | 'crit' }) {
  const color =
    tone === 'crit' ? 'var(--soc-crit)' : tone === 'warn' ? 'var(--soc-warn)' : tone === 'ok' ? 'var(--soc-ok)' : '#e6eef6'
  return (
    <div className="soc-panel px-3 py-3">
      <div className="soc-mono text-[22px] font-semibold leading-none" style={{ color }}>
        {value.toLocaleString('pt-PT')}
      </div>
      <div className="soc-eyebrow mt-1.5">{label}</div>
    </div>
  )
}
