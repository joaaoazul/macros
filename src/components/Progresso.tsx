import { useMemo, useState } from 'react'
import type { Diary, ExerciseLog, Profile, WaterLog } from '../types'
import { sumEntries } from '../lib/calc'
import { shiftDate, todayISO } from '../lib/store'
import { BarChart } from './charts'
import DayDetail from './details/DayDetail'
import { Card, LargeTitle } from './ui'

interface Props {
  profile: Profile
  diary: Diary
  water: WaterLog
  exercise: ExerciseLog
}

interface DayPoint {
  iso: string
  label: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  burned: number
  logged: boolean
  onPlan: boolean // net kcal a ±10% da meta (igual ao critério do backend)
}

type Period = 7 | 14 | 30
const PERIODS: Period[] = [7, 14, 30]

export default function Progresso({ profile, diary, water, exercise }: Props) {
  const [period, setPeriod] = useState<Period>(7)
  const [showTable, setShowTable] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const { targets } = profile

  const days: DayPoint[] = useMemo(() => {
    const today = todayISO()
    return Array.from({ length: period }, (_, i) => {
      const iso = shiftDate(today, i - (period - 1))
      const entries = diary[iso] ?? []
      const t = sumEntries(entries)
      const burned = (exercise[iso] ?? []).reduce((s, e) => s + e.kcal, 0)
      const net = t.kcal - burned
      const logged = entries.length > 0
      const onPlan = logged && net >= targets.kcal * 0.9 && net <= targets.kcal * 1.1
      const [y, m, d] = iso.split('-').map(Number)
      const label = new Date(y, m - 1, d)
        .toLocaleDateString('pt-PT', { weekday: 'short' })
        .slice(0, period > 7 ? 1 : 3)
      return { iso, label, ...t, burned, logged, onPlan }
    })
  }, [diary, exercise, period, targets.kcal])

  const loggedDays = days.filter((d) => d.logged)
  const nLogged = loggedDays.length
  const avgKcal = nLogged ? Math.round(loggedDays.reduce((s, d) => s + d.kcal, 0) / nLogged) : 0
  const onPlanDays = days.filter((d) => d.onPlan).length
  const adherence = nLogged ? Math.round((onPlanDays / nLogged) * 100) : 0
  const proteinHits = loggedDays.filter((d) => d.protein >= targets.protein * 0.9).length
  const proteinRate = nLogged ? Math.round((proteinHits / nLogged) * 100) : 0

  // streak: dias consecutivos com registo a terminar hoje (com tolerância p/ hoje ainda vazio)
  const streak = useMemo(() => {
    const today = todayISO()
    let s = 0
    let i = (diary[today] ?? []).length > 0 ? 0 : 1
    while ((diary[shiftDate(today, -i)] ?? []).length > 0) {
      s++
      i++
    }
    return s
  }, [diary])

  // atingimento médio por macro (média do valor / meta, nos dias registados)
  const macroAttain = useMemo(() => {
    const avg = (sel: (d: DayPoint) => number, target: number) =>
      nLogged && target > 0 ? Math.round((loggedDays.reduce((s, d) => s + sel(d), 0) / nLogged / target) * 100) : 0
    return {
      carbs: avg((d) => d.carbs, targets.carbs),
      protein: avg((d) => d.protein, targets.protein),
      fat: avg((d) => d.fat, targets.fat),
    }
  }, [loggedDays, nLogged, targets])

  return (
    <div>
      <LargeTitle title="Progresso" subtitle={`Últimos ${period} dias`} />

      {/* seletor de período */}
      <div className="mx-4 mt-1 flex rounded-xl bg-surface p-1 text-sm font-medium">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            aria-pressed={period === p}
            className={`flex-1 rounded-lg py-1.5 transition ${period === p ? 'bg-bg shadow-sm text-ink' : 'text-muted'}`}
          >
            {p} dias
          </button>
        ))}
      </div>

      {/* tiles de estatística */}
      <div className="grid grid-cols-3 gap-3 px-4 pt-3">
        <StatTile value={`${adherence}%`} label={`no plano (${onPlanDays}/${nLogged || 0})`} />
        <StatTile value={`${proteinRate}%`} label="metas de proteína" />
        <StatTile value={streak > 0 ? `${streak} 🔥` : '0'} label={streak === 1 ? 'dia seguido' : 'dias seguidos'} />
      </div>

      {/* atingimento de macros */}
      {nLogged > 0 && (
        <Card className="mx-4 mt-3.5 p-5">
          <h2 className="text-[17px] font-semibold">Atingimento médio</h2>
          <p className="text-xs text-muted">média do consumo vs. meta, nos {nLogged} dias registados</p>
          <div className="mt-3 space-y-2.5">
            <AttainBar label="Hidratos" pct={macroAttain.carbs} colorVar="--carbs" />
            <AttainBar label="Proteína" pct={macroAttain.protein} colorVar="--protein" />
            <AttainBar label="Gordura" pct={macroAttain.fat} colorVar="--fat" />
            <AttainBar label="Calorias" pct={nLogged ? Math.round((avgKcal / targets.kcal) * 100) : 0} colorVar="--accent" />
          </div>
        </Card>
      )}

      {/* calendário de adesão */}
      <Card className="mx-4 mt-3.5 p-5">
        <h2 className="text-[17px] font-semibold">Calendário</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {days.map((d) => (
            <button
              key={d.iso}
              onClick={() => d.logged && setSelectedDay(d.iso)}
              disabled={!d.logged}
              title={`${d.iso}${d.logged ? ` · ${Math.round(d.kcal)} kcal` : ' · sem registo'}`}
              aria-label={`${d.iso}: ${d.onPlan ? 'no plano' : d.logged ? 'registado' : 'sem registo'}`}
              className="h-7 w-7 rounded-md transition active:scale-90"
              style={{
                background: d.onPlan ? 'var(--good)' : d.logged ? 'var(--accent-soft)' : 'var(--line)',
              }}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          <Legend colorVar="--good" label="no plano" />
          <Legend colorVar="--accent-soft" label="registado" />
          <Legend colorVar="--line" label="sem registo" />
        </div>
      </Card>

      {/* gráfico */}
      <Card className="mx-4 mt-3.5 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-semibold">Calorias por dia</h2>
          <button onClick={() => setShowTable((s) => !s)} className="text-xs font-medium text-accent">
            {showTable ? 'Ver gráfico' : 'Ver tabela'}
          </button>
        </div>

        {!showTable ? (
          <BarChart
            points={days.map((d) => ({ iso: d.iso, label: d.label, value: d.kcal, logged: d.logged }))}
            target={targets.kcal}
            ariaLabel={`Calorias consumidas nos últimos ${period} dias`}
            tooltipExtra={(_, i) =>
              `P ${Math.round(days[i].protein)} · H ${Math.round(days[i].carbs)} · G ${Math.round(days[i].fat)}`
            }
            onBarClick={(p) => setSelectedDay(p.iso)}
          />
        ) : (
          <div className="mt-4 max-h-72 overflow-auto">
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
                {[...days].reverse().map((d) => (
                  <tr key={d.iso} className="border-b border-line last:border-0">
                    <td className="py-2">{d.iso.slice(5)}</td>
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

      <p className="mt-4 text-center text-xs text-muted">
        Alvo diário: {targets.kcal.toLocaleString('pt-PT')} kcal · H {targets.carbs} g · P {targets.protein} g · G {targets.fat} g
      </p>

      {selectedDay && (
        <DayDetail
          iso={selectedDay}
          profile={profile}
          diary={diary}
          water={water}
          exercise={exercise}
          onClose={() => setSelectedDay(null)}
        />
      )}
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

function AttainBar({ label, pct, colorVar }: { label: string; pct: number; colorVar: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-[13px] font-medium text-ink-2">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface" style={{ background: 'var(--line)' }}>
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, background: `var(${colorVar})` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-[13px] font-semibold tabular-nums">{pct}%</span>
    </div>
  )
}

function Legend({ colorVar, label }: { colorVar: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded" style={{ background: `var(${colorVar})` }} aria-hidden />
      {label}
    </span>
  )
}
