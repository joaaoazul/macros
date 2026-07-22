import type { Diary, ExerciseLog, Profile, WaterLog } from '../../types'
import { MEALS } from '../../types'
import { sumEntries } from '../../lib/calc'
import { formatDatePT } from '../../lib/store'
import { Card, Z } from '../ui'

interface Props {
  iso: string
  profile: Profile
  diary: Diary
  water: WaterLog
  exercise: ExerciseLog
  onClose: () => void
}

/** Detalhe read-only de um dia: refeições, macros vs metas, água e exercício. */
export default function DayDetail({ iso, profile, diary, water, exercise, onClose }: Props) {
  const entries = diary[iso] ?? []
  const totals = sumEntries(entries)
  const { targets } = profile
  const waterMl = water[iso] ?? 0
  const exercises = exercise[iso] ?? []
  const exerciseKcal = exercises.reduce((s, e) => s + e.kcal, 0)

  return (
    <div className={`sheet-panel scroll-contain fixed inset-0 ${Z.screen} overflow-y-auto bg-bg`}>
      <div className="mx-auto max-w-md px-4 pb-10">
        <header className="flex items-center gap-3 pt-5">
          <button onClick={onClose} className="text-sm font-medium text-accent">
            ‹ Progresso
          </button>
        </header>
        <h1 className="mt-2 text-2xl font-bold capitalize tracking-tight">{formatDatePT(iso)}</h1>

        {/* macros vs metas */}
        <Card className="mt-4 p-5">
          <h2 className="text-[17px] font-semibold">Totais do dia</h2>
          <div className="mt-3 space-y-2.5">
            <MacroBar label="Calorias" value={totals.kcal} target={targets.kcal} unit="kcal" colorVar="--accent" />
            <MacroBar label="Hidratos" value={totals.carbs} target={targets.carbs} unit="g" colorVar="--carbs" />
            <MacroBar label="Proteína" value={totals.protein} target={targets.protein} unit="g" colorVar="--protein" />
            <MacroBar label="Gordura" value={totals.fat} target={targets.fat} unit="g" colorVar="--fat" />
          </div>
        </Card>

        {/* refeições */}
        <Card className="mt-3.5 divide-y divide-line">
          {MEALS.map((m) => {
            const mealEntries = entries.filter((e) => e.meal === m.id)
            if (mealEntries.length === 0) return null
            const kcal = mealEntries.reduce((s, e) => s + e.kcal, 0)
            return (
              <div key={m.id} className="p-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold">
                    <span aria-hidden>{m.emoji}</span> {m.label}
                  </h3>
                  <span className="text-xs tabular-nums text-muted">{Math.round(kcal)} kcal</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {mealEntries.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 text-sm">
                      <span aria-hidden>{e.emoji}</span>
                      <span className="min-w-0 flex-1 truncate">{e.foodName}</span>
                      <span className="text-xs tabular-nums text-muted">
                        {Math.round(e.grams)} {e.unit} · {Math.round(e.kcal)} kcal
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          {entries.length === 0 && <p className="p-5 text-center text-sm text-muted">Sem registos neste dia.</p>}
        </Card>

        {/* água e exercício */}
        <div className="mt-3.5 grid grid-cols-2 gap-3">
          <Card className="p-4 text-center">
            <div className="text-xl font-bold tabular-nums">💧 {waterMl.toLocaleString('pt-PT')} ml</div>
            <div className="mt-0.5 text-[11px] text-muted">
              água · meta {targets.waterMl.toLocaleString('pt-PT')} ml
            </div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-xl font-bold tabular-nums">🏃 {Math.round(exerciseKcal)} kcal</div>
            <div className="mt-0.5 text-[11px] text-muted">
              {exercises.length === 0 ? 'sem exercício' : exercises.map((e) => e.name).join(', ')}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function MacroBar({ label, value, target, unit, colorVar }: { label: string; value: number; target: number; unit: string; colorVar: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-ink-2">
          {Math.round(value).toLocaleString('pt-PT')} / {Math.round(target).toLocaleString('pt-PT')} {unit}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `var(${colorVar})` }} />
      </div>
    </div>
  )
}
