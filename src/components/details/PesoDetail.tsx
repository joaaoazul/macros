import { useEffect, useMemo, useState } from 'react'
import type { Profile } from '../../types'
import { api, ApiError } from '../../lib/api'
import { shiftDate, todayISO } from '../../lib/store'
import { formatRate, weightRatePerWeek } from '../../lib/trend'
import { LineChart } from '../charts'
import { Card, Z } from '../ui'

interface Props {
  profile: Profile
  /** regista o peso de hoje no perfil (recalcula metas) */
  onWeightToday: (kg: number) => void
  onClose: () => void
}

interface Weight {
  date: string
  kg: number
}

type State = { status: 'loading' } | { status: 'error' } | { status: 'done'; weights: Weight[] }

/** Histórico de peso: gráfico de evolução, registo de hoje e lista com remoção. */
export default function PesoDetail({ profile, onWeightToday, onClose }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [input, setInput] = useState(String(profile.weightKg))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setState({ status: 'loading' })
    try {
      const weights = await api<Weight[]>('/weights')
      setState({ status: 'done', weights })
    } catch {
      setState({ status: 'error' })
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const weights = state.status === 'done' ? state.weights : []
  const today = todayISO()

  const points = useMemo(
    () =>
      weights.map((w) => {
        const [, m, d] = w.date.split('-').map(Number)
        return { iso: w.date, label: `${d}/${m}`, value: w.kg }
      }),
    [weights],
  )

  const current = weights.length > 0 ? weights[weights.length - 1] : null
  const monthAgo = shiftDate(today, -30)
  const baseline = weights.filter((w) => w.date <= monthAgo).pop() ?? (weights.length > 1 ? weights[0] : null)
  const delta30 = current && baseline && baseline.date !== current.date ? current.kg - baseline.kg : null
  // ritmo pela regressão linear das últimas semanas (mesma matemática do AdjustTargetCard)
  const rate = useMemo(() => weightRatePerWeek(weights), [weights])

  const exportCsv = () => {
    const csv = ['date,kg', ...weights.map((w) => `${w.date},${w.kg}`)].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'peso.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const registerToday = async () => {
    const kg = Number(input)
    if (!(kg >= 25 && kg <= 400)) return
    setBusy(true)
    setError('')
    try {
      await api<Weight>(`/weights/${today}`, { method: 'PUT', body: { kg } })
      onWeightToday(kg)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registar o peso.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (date: string) => {
    try {
      await api<void>(`/weights/${date}`, { method: 'DELETE' })
      await load()
    } catch {
      setError('Não foi possível remover o registo.')
    }
  }

  return (
    <div className={`sheet-panel scroll-contain fixed inset-0 ${Z.screen} overflow-y-auto bg-bg`}>
      <div className="mx-auto max-w-md px-4 pb-10">
        <header className="pt-5">
          <button onClick={onClose} className="text-sm font-medium text-accent">
            ‹ Perfil
          </button>
        </header>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">⚖️ Histórico de peso</h1>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatTile value={current ? `${current.kg.toLocaleString('pt-PT')} kg` : '—'} label="peso atual" />
          <StatTile
            value={delta30 !== null ? `${delta30 > 0 ? '+' : ''}${delta30.toLocaleString('pt-PT', { maximumFractionDigits: 1 })} kg` : '—'}
            label="últimos 30 dias"
          />
          <StatTile value={rate !== null ? `${formatRate(rate)}/sem` : '—'} label="ritmo" />
        </div>

        {/* registar hoje */}
        <Card className="mt-3.5 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Registar peso de hoje</div>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-24 rounded-lg bg-bg px-3 py-1.5 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Peso de hoje em kg"
            />
            <span className="self-center text-lg font-bold">kg</span>
            <button
              onClick={registerToday}
              disabled={busy || !(Number(input) >= 25 && Number(input) <= 400)}
              className="ml-auto rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
            >
              {busy ? 'A registar…' : 'Registar'}
            </button>
          </div>
          {error && <p role="alert" className="mt-2 text-sm font-medium text-critical">{error}</p>}
        </Card>

        {/* gráfico */}
        <Card className="mt-3.5 p-5">
          <h2 className="text-[17px] font-semibold">Evolução</h2>
          {state.status === 'loading' && <p className="py-6 text-center text-sm text-muted">A carregar…</p>}
          {state.status === 'error' && (
            <p className="py-6 text-center text-sm text-muted">
              Não foi possível carregar o histórico.{' '}
              <button onClick={load} className="font-medium text-accent">Tentar novamente</button>
            </p>
          )}
          {state.status === 'done' && points.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">Ainda sem registos — regista o teu peso de hoje acima.</p>
          )}
          {points.length > 0 && <LineChart points={points} ariaLabel="Evolução do peso" suffix=" kg" />}
        </Card>

        {weights.length > 1 && (
          <button
            onClick={exportCsv}
            className="mt-3 w-full rounded-full bg-surface px-4 py-2.5 text-sm font-semibold text-ink-2"
          >
            ⬇️ Exportar histórico (CSV)
          </button>
        )}

        {/* lista */}
        {weights.length > 0 && (
          <Card className="mt-3.5 divide-y divide-line">
            {[...weights].reverse().map((w) => (
              <div key={w.date} className="flex items-center gap-3 p-3.5">
                <span className="flex-1 text-sm">{formatShort(w.date)}</span>
                <span className="text-sm font-bold tabular-nums">{w.kg.toLocaleString('pt-PT')} kg</span>
                <button
                  onClick={() => remove(w.date)}
                  className="rounded-full px-2 py-1 text-sm text-muted"
                  aria-label={`Remover registo de ${formatShort(w.date)}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}

function formatShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-card bg-surface p-4 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="text-xl font-bold">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted">{label}</div>
    </div>
  )
}
