import { useMemo, useState } from 'react'
import type { Diary, Profile, WeightLog } from '../types'
import { sumEntries } from '../lib/calc'
import { shiftDate, todayISO } from '../lib/store'
import { Card, LargeTitle } from './ui'

interface Props {
  profile: Profile
  diary: Diary
  weightLog: WeightLog
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

export default function Progresso({ profile, diary, weightLog }: Props) {
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
    <div>
      <LargeTitle title="Progresso" subtitle="Últimos 7 dias" />

      {/* tiles de estatística */}
      <div className="grid grid-cols-3 gap-3 px-4 pt-2">
        <StatTile value={avgKcal.toLocaleString('pt-PT')} label="média kcal/dia" />
        <StatTile value={`${avgProtein} g`} label="média proteína" />
        <StatTile value={`${daysOnPlan}/${loggedDays.length || 0}`} label="dias no plano" />
      </div>

      {/* gráfico semanal */}
      <Card className="mx-4 mt-3.5 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-semibold">Calorias por dia</h2>
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
      </Card>

      {/* peso ao longo do tempo */}
      <Card className="mx-4 mt-3.5 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-semibold">Peso</h2>
          <span className="text-xs text-muted">atualiza no Perfil</span>
        </div>
        <WeightChart weightLog={weightLog} currentKg={profile.weightKg} />
      </Card>

      <p className="mt-4 text-center text-xs text-muted">
        Alvo diário: {targets.kcal.toLocaleString('pt-PT')} kcal · H {targets.carbs} g · P {targets.protein} g · G {targets.fat} g
      </p>
    </div>
  )
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-card bg-surface p-4 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
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

/**
 * Linha do peso ao longo do tempo (série única, pontos + tooltip por toque).
 */
function WeightChart({ weightLog, currentKg }: { weightLog: WeightLog; currentKg: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const points = Object.entries(weightLog)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-30)
    .map(([iso, kg]) => ({ iso, kg }))

  if (points.length < 2) {
    return (
      <p className="mt-3 text-sm text-muted">
        Peso atual: <strong className="text-ink">{currentKg} kg</strong>. Atualiza o peso no Perfil ao longo das semanas para veres aqui a tendência.
      </p>
    )
  }

  const W = 320
  const H = 130
  const padX = 6
  const padTop = 16
  const padBottom = 20
  const min = Math.min(...points.map((p) => p.kg))
  const max = Math.max(...points.map((p) => p.kg))
  const span = Math.max(max - min, 1)
  const x = (i: number) => padX + (i / (points.length - 1)) * (W - padX * 2)
  const y = (kg: number) => padTop + (1 - (kg - min) / span) * (H - padTop - padBottom)
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(' ')
  const delta = points[points.length - 1].kg - points[0].kg
  const label = (iso: string) => {
    const [yy, m, d] = iso.split('-').map(Number)
    return new Date(yy, m - 1, d).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="relative">
      <p className="mt-1 text-[13px] text-ink-2">
        <strong className="text-[15px] text-ink">{points[points.length - 1].kg} kg</strong>{' '}
        <span className={delta <= 0 ? 'text-good' : 'text-critical'}>
          ({delta > 0 ? '+' : ''}
          {delta.toFixed(1)} kg no período)
        </span>
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label="Evolução do peso">
        <line x1={0} x2={W} y1={H - padBottom} y2={H - padBottom} stroke="var(--line)" strokeWidth={1} />
        <path d={path} fill="none" stroke="var(--protein)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.iso}>
            <circle
              cx={x(i)}
              cy={y(p.kg)}
              r={10}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover(hover === i ? null : i)}
            />
            <circle cx={x(i)} cy={y(p.kg)} r={hover === i ? 4.5 : 3} fill="var(--protein)" stroke="var(--surface)" strokeWidth={2} pointerEvents="none" />
          </g>
        ))}
        <text x={padX} y={H - 6} fontSize={9} fill="var(--muted)">
          {label(points[0].iso)}
        </text>
        <text x={W - padX} y={H - 6} fontSize={9} textAnchor="end" fill="var(--muted)">
          {label(points[points.length - 1].iso)}
        </text>
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-4 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs shadow-md"
          style={{ left: `${Math.min(Math.max((hover / (points.length - 1)) * 100 - 12, 0), 70)}%` }}
        >
          <span className="font-bold tabular-nums">{points[hover].kg} kg</span> · {label(points[hover].iso)}
        </div>
      )}
    </div>
  )
}
