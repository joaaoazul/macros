import { useMemo, useState } from 'react'
import type { Diary, Profile } from '../types'
import { sumEntries } from '../lib/calc'
import { shiftDate, todayISO } from '../lib/store'

interface Props {
  profile: Profile
  diary: Diary
}

interface DayPoint {
  iso: string
  label: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  logged: boolean
}

export default function Progresso({ profile, diary }: Props) {
  const [showTable, setShowTable] = useState(false)
  const { targets } = profile

  const days: DayPoint[] = useMemo(() => {
    const today = todayISO()
    return Array.from({ length: 7 }, (_, i) => {
      const iso = shiftDate(today, i - 6)
      const entries = diary[iso] ?? []
      const t = sumEntries(entries)
      const [y, m, d] = iso.split('-').map(Number)
      const label = new Date(y, m - 1, d).toLocaleDateString('pt-PT', { weekday: 'short' }).slice(0, 3)
      return { iso, label, ...t, logged: entries.length > 0 }
    })
  }, [diary])

  const loggedDays = days.filter((d) => d.logged)
  const avgKcal = loggedDays.length > 0 ? Math.round(loggedDays.reduce((s, d) => s + d.kcal, 0) / loggedDays.length) : 0
  const avgProtein = loggedDays.length > 0 ? Math.round(loggedDays.reduce((s, d) => s + d.protein, 0) / loggedDays.length) : 0
  const daysOnPlan = loggedDays.filter((d) => d.kcal <= targets.kcal * 1.05).length

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">Progresso</h1>
      <p className="mt-1 text-sm text-ink-2">Os teus últimos 7 dias.</p>

      {/* tiles de estatística */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <StatTile value={avgKcal.toLocaleString('pt-PT')} label="média kcal/dia" />
        <StatTile value={`${avgProtein} g`} label="média proteína" />
        <StatTile value={`${daysOnPlan}/${loggedDays.length || 0}`} label="dias no plano" />
      </div>

      {/* gráfico semanal */}
      <section className="mt-5 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Calorias por dia</h2>
          <button onClick={() => setShowTable((s) => !s)} className="text-xs font-medium text-accent">
            {showTable ? 'Ver gráfico' : 'Ver tabela'}
          </button>
        </div>

        {!showTable ? (
          <WeekChart days={days} targetKcal={targets.kcal} />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="py-2 font-medium">Dia</th>
                  <th className="py-2 text-right font-medium">kcal</th>
                  <th className="py-2 text-right font-medium">P (g)</th>
                  <th className="py-2 text-right font-medium">H (g)</th>
                  <th className="py-2 text-right font-medium">G (g)</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {days.map((d) => (
                  <tr key={d.iso} className="border-b border-line last:border-0">
                    <td className="py-2 capitalize">{d.label}</td>
                    <td className="py-2 text-right">{d.logged ? Math.round(d.kcal).toLocaleString('pt-PT') : '—'}</td>
                    <td className="py-2 text-right">{d.logged ? Math.round(d.protein) : '—'}</td>
                    <td className="py-2 text-right">{d.logged ? Math.round(d.carbs) : '—'}</td>
                    <td className="py-2 text-right">{d.logged ? Math.round(d.fat) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-4 text-center text-xs text-muted">
        Alvo diário: {targets.kcal.toLocaleString('pt-PT')} kcal · P {targets.protein} g · H {targets.carbs} g · G {targets.fat} g
      </p>
    </div>
  )
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 text-center shadow-sm">
      <div className="text-xl font-bold">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted">{label}</div>
    </div>
  )
}

/**
 * Barras dos últimos 7 dias com linha de referência do alvo.
 * Série única (sem legenda); tooltip por barra no hover/toque.
 */
function WeekChart({ days, targetKcal }: { days: DayPoint[]; targetKcal: number }) {
  const [hover, setHover] = useState<number | null>(null)

  const W = 320
  const H = 150
  const padTop = 18
  const padBottom = 22
  const plotH = H - padTop - padBottom
  const max = Math.max(targetKcal * 1.2, ...days.map((d) => d.kcal)) || 1
  const slot = W / 7
  const barW = 22

  const y = (v: number) => padTop + plotH * (1 - v / max)
  const targetY = y(targetKcal)

  return (
    <div className="relative mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Calorias consumidas nos últimos 7 dias">
        {/* linha de referência do alvo */}
        <line x1={0} x2={W} y1={targetY} y2={targetY} stroke="var(--muted)" strokeWidth={1} strokeDasharray="4 3" />
        <text x={W} y={targetY - 4} textAnchor="end" fontSize={9} fill="var(--muted)">
          alvo {targetKcal.toLocaleString('pt-PT')}
        </text>

        {/* linha de base */}
        <line x1={0} x2={W} y1={H - padBottom} y2={H - padBottom} stroke="var(--line)" strokeWidth={1} />

        {days.map((d, i) => {
          const cx = slot * i + slot / 2
          const barH = d.logged ? Math.max(H - padBottom - y(d.kcal), 2) : 0
          const isHover = hover === i
          return (
            <g key={d.iso}>
              {/* área de toque maior do que a barra */}
              <rect
                x={slot * i}
                y={0}
                width={slot}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(isHover ? null : i)}
              />
              {d.logged ? (
                <rect
                  x={cx - barW / 2}
                  y={H - padBottom - barH}
                  width={barW}
                  height={barH}
                  rx={4}
                  fill="var(--accent)"
                  opacity={hover === null || isHover ? 1 : 0.45}
                  pointerEvents="none"
                />
              ) : (
                <circle cx={cx} cy={H - padBottom - 4} r={2} fill="var(--line)" pointerEvents="none" />
              )}
              <text x={cx} y={H - 7} textAnchor="middle" fontSize={10} fill="var(--muted)" className="capitalize" pointerEvents="none">
                {d.label}
              </text>
              {isHover && d.logged && (
                <text x={cx} y={H - padBottom - barH - 6} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--ink)" pointerEvents="none">
                  {Math.round(d.kcal).toLocaleString('pt-PT')}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* tooltip com detalhe de macros */}
      {hover !== null && days[hover].logged && (
        <div
          className="pointer-events-none absolute -top-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md"
          style={{ left: `${Math.min(Math.max((hover + 0.5) * (100 / 7) - 18, 0), 62)}%` }}
        >
          <div className="font-semibold capitalize">{days[hover].label}</div>
          <div className="mt-0.5 tabular-nums text-ink-2">
            {Math.round(days[hover].kcal).toLocaleString('pt-PT')} kcal · P {Math.round(days[hover].protein)} · H{' '}
            {Math.round(days[hover].carbs)} · G {Math.round(days[hover].fat)}
          </div>
        </div>
      )}
    </div>
  )
}
