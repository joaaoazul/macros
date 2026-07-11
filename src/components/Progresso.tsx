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
  logged: boolean
}

export default function Progresso({ profile, diary, water, exercise }: Props) {
  const [showTable, setShowTable] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
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
          <BarChart
            points={days.map((d) => ({ iso: d.iso, label: d.label, value: d.kcal, logged: d.logged }))}
            target={targets.kcal}
            ariaLabel="Calorias consumidas nos últimos 7 dias"
            tooltipExtra={(_, i) =>
              `P ${Math.round(days[i].protein)} · H ${Math.round(days[i].carbs)} · G ${Math.round(days[i].fat)}`
            }
            onBarClick={(p) => setSelectedDay(p.iso)}
          />
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
