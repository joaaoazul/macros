import { useEffect, useState } from 'react'
import { admin, type InviteRow } from '../../lib/admin'

/** Convites: gera códigos que dão conta comped (grátis) no registo. */
export default function InvitesView() {
  const [rows, setRows] = useState<InviteRow[]>([])
  const [maxUses, setMaxUses] = useState(1)
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState('')

  const load = () => {
    admin.invites().then(setRows).catch(() => setRows([]))
  }
  useEffect(load, [])

  const create = async () => {
    setBusy(true)
    try {
      const row = await admin.createInvite(maxUses, expiresInDays === '' ? undefined : expiresInDays)
      setRows((r) => [row, ...r])
      copy(row.code)
    } finally {
      setBusy(false)
    }
  }

  const copy = (code: string) => {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(code)
      setTimeout(() => setCopied(''), 2000)
    })
  }

  const exhausted = (r: InviteRow) =>
    r.usedCount >= r.maxUses || (r.expiresAt !== null && Date.parse(r.expiresAt) < Date.now())

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr]">
      <section className="soc-panel self-start">
        <div className="soc-eyebrow border-b soc-line p-3">gerar convite</div>
        <div className="flex flex-col gap-3 p-3">
          <label className="soc-mono text-[11px] text-[#8b9bab]">
            usos máximos
            <input
              className="soc-input mt-1 w-full"
              type="number"
              min={1}
              max={100}
              value={maxUses}
              onChange={(e) => setMaxUses(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            />
          </label>
          <label className="soc-mono text-[11px] text-[#8b9bab]">
            expira em (dias, vazio = nunca)
            <input
              className="soc-input mt-1 w-full"
              type="number"
              min={1}
              placeholder="—"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value === '' ? '' : Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <button className="soc-btn" disabled={busy} onClick={create}>
            {busy ? 'a gerar…' : 'gerar código'}
          </button>
          <p className="soc-mono text-[10px] leading-relaxed text-[#5b6b7b]">
            Quem se registar com um código válido fica com conta grátis vitalícia (comped) — nunca vê o paywall.
          </p>
        </div>
      </section>

      <section className="soc-panel">
        <div className="soc-eyebrow border-b soc-line p-3">convites · {rows.length}</div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="soc-table">
            <thead>
              <tr>
                <th>código</th>
                <th>usos</th>
                <th>expira</th>
                <th>criado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={`soc-mono ${exhausted(r) ? 'text-[#5b6b7b] line-through' : 'text-[#cbd6e2]'}`}>{r.code}</td>
                  <td className="soc-mono text-[#8b9bab]">{r.usedCount}/{r.maxUses}</td>
                  <td className="soc-mono text-[#5b6b7b]">{r.expiresAt ? r.expiresAt.slice(0, 10) : 'nunca'}</td>
                  <td className="soc-mono text-[#5b6b7b]">{r.createdAt.slice(0, 10)}</td>
                  <td>
                    <button className="soc-btn" onClick={() => copy(r.code)}>
                      {copied === r.code ? 'copiado ✓' : 'copiar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="soc-mono p-4 text-xs text-[#5b6b7b]">Ainda sem convites.</p>}
        </div>
      </section>
    </div>
  )
}
