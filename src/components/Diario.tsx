import { useMemo, useState } from 'react'
import type { Diary, Entry, Exercise, ExerciseLog, Food, MealId, Profile, WaterLog } from '../types'
import { MEALS } from '../types'
import { sumEntries } from '../lib/calc'
import { formatDatePT, shiftDate, todayISO, uid } from '../lib/store'
import AddFoodSheet from './AddFoodSheet'

interface Props {
  profile: Profile
  diary: Diary
  setDiary: React.Dispatch<React.SetStateAction<Diary>>
  water: WaterLog
  setWater: React.Dispatch<React.SetStateAction<WaterLog>>
  exercise: ExerciseLog
  setExercise: React.Dispatch<React.SetStateAction<ExerciseLog>>
  customFoods: Food[]
  setCustomFoods: React.Dispatch<React.SetStateAction<Food[]>>
}

export default function Diario({ profile, diary, setDiary, water, setWater, exercise, setExercise, customFoods, setCustomFoods }: Props) {
  const [date, setDate] = useState(todayISO)
  const [addingTo, setAddingTo] = useState<MealId | null>(null)
  const [addingExercise, setAddingExercise] = useState(false)

  const entries = useMemo(() => diary[date] ?? [], [diary, date])
  const totals = useMemo(() => sumEntries(entries), [entries])
  const dayExercises = exercise[date] ?? []
  const burned = Math.round(dayExercises.reduce((s, e) => s + e.kcal, 0))
  const waterMl = water[date] ?? 0
  const { targets } = profile
  const eaten = Math.round(totals.kcal)
  const net = eaten - burned

  const addEntry = (entry: Entry) => {
    setDiary((d) => ({ ...d, [date]: [...(d[date] ?? []), entry] }))
    setAddingTo(null)
  }
  const removeEntry = (id: string) => {
    setDiary((d) => ({ ...d, [date]: (d[date] ?? []).filter((e) => e.id !== id) }))
  }
  const addWater = (ml: number) => {
    setWater((w) => ({ ...w, [date]: Math.max(0, (w[date] ?? 0) + ml) }))
  }
  const addExercise = (ex: Exercise) => {
    setExercise((x) => ({ ...x, [date]: [...(x[date] ?? []), ex] }))
    setAddingExercise(false)
  }
  const removeExercise = (id: string) => {
    setExercise((x) => ({ ...x, [date]: (x[date] ?? []).filter((e) => e.id !== id) }))
  }

  return (
    <div>
      {/* cabeçalho coral com navegação de dias */}
      <header className="bg-accent px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button onClick={() => setDate((d) => shiftDate(d, -1))} className={dayNavCls} aria-label="Dia anterior">
            ‹
          </button>
          <div className="text-center text-white">
            <h1 className="text-xl font-bold capitalize">📅 {formatDatePT(date)}</h1>
            {date !== todayISO() && (
              <button onClick={() => setDate(todayISO())} className="text-xs font-semibold text-white/90 underline">
                Voltar a hoje
              </button>
            )}
          </div>
          <button
            onClick={() => setDate((d) => shiftDate(d, 1))}
            className={dayNavCls}
            aria-label="Dia seguinte"
            disabled={date >= todayISO()}
          >
            ›
          </button>
        </div>
      </header>

      {/* resumo: barras de macros + fórmula de calorias */}
      <section className="bg-surface px-4 pb-4 pt-3 shadow-sm">
        <div className="grid grid-cols-3 gap-4">
          <SummaryBar label="Hidratos" value={totals.carbs} target={targets.carbs} colorVar="--carbs" />
          <SummaryBar label="Proteína" value={totals.protein} target={targets.protein} colorVar="--protein" />
          <SummaryBar label="Gordura" value={totals.fat} target={targets.fat} colorVar="--fat" />
        </div>

        <div className="mt-4">
          <div
            className="h-2 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuenow={net}
            aria-valuemax={targets.kcal}
            aria-label="Calorias líquidas"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${targets.kcal > 0 ? Math.min(Math.max(net / targets.kcal, 0) * 100, 100) : 0}%` }}
            />
          </div>
          <p className="mt-2 text-center text-sm text-ink-2">
            {eaten.toLocaleString('pt-PT')} − {burned} ={' '}
            <span className={`font-bold ${net > targets.kcal ? 'text-critical' : 'text-ink'}`}>{net.toLocaleString('pt-PT')}</span> /{' '}
            {targets.kcal.toLocaleString('pt-PT')} kcal
          </p>
        </div>
      </section>

      <div className="space-y-4 px-4 pt-4">
        {/* refeições */}
        {MEALS.map((meal) => {
          const mealEntries = entries.filter((e) => e.meal === meal.id)
          const t = sumEntries(mealEntries)
          return (
            <section key={meal.id} className="overflow-hidden rounded-2xl bg-surface shadow-sm">
              <h2 className="px-4 pt-3.5 text-lg font-bold">{meal.label}</h2>

              <div className="mt-2 grid grid-cols-4 gap-1 border-t border-line px-4 py-3 text-center">
                <MealStat value={t.carbs} label="Hidratos" colorVar="--carbs" />
                <MealStat value={t.protein} label="Proteína" colorVar="--protein" />
                <MealStat value={t.fat} label="Gordura" colorVar="--fat" />
                <MealStat value={t.kcal} label="Calorias" />
              </div>

              {mealEntries.length > 0 && (
                <ul className="divide-y divide-line border-t border-line">
                  {mealEntries.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-lg" aria-hidden>
                        {e.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{e.foodName}</div>
                        <div className="text-xs text-muted">
                          {e.grams} {e.unit} · H {Math.round(e.carbs)} · P {Math.round(e.protein)} · G {Math.round(e.fat)}
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{Math.round(e.kcal)}</span>
                      <button
                        onClick={() => removeEntry(e.id)}
                        className="ml-1 rounded-lg px-2 py-1 text-muted transition-colors hover:bg-bg hover:text-critical"
                        aria-label={`Remover ${e.foodName}`}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                onClick={() => setAddingTo(meal.id)}
                className="block w-full border-t border-line px-4 py-3 text-center text-sm font-bold text-accent transition-colors hover:bg-bg"
              >
                ＋ Adicionar alimentos
              </button>
            </section>
          )
        })}

        {/* exercício */}
        <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
          <div className="flex items-baseline justify-between px-4 pt-3.5">
            <h2 className="text-lg font-bold">Exercício</h2>
            <span className="text-sm font-semibold tabular-nums text-ink-2">{burned} kcal</span>
          </div>
          {dayExercises.length > 0 && (
            <ul className="mt-2 divide-y divide-line border-t border-line">
              {dayExercises.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-lg" aria-hidden>
                    🏃
                  </span>
                  <div className="min-w-0 flex-1 truncate text-sm font-medium">{e.name}</div>
                  <span className="text-sm font-semibold tabular-nums text-fat">{Math.round(e.kcal)}</span>
                  <button
                    onClick={() => removeExercise(e.id)}
                    className="ml-1 rounded-lg px-2 py-1 text-muted transition-colors hover:bg-bg hover:text-critical"
                    aria-label={`Remover ${e.name}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setAddingExercise(true)}
            className="block w-full border-t border-line px-4 py-3 text-center text-sm font-bold text-accent transition-colors hover:bg-bg"
          >
            ＋ Adicionar exercício
          </button>
        </section>

        {/* água */}
        <section className="rounded-2xl bg-surface p-4 shadow-sm">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold">Água</h2>
            <span className="text-sm tabular-nums text-ink-2">
              {waterMl} / {targets.waterMl} ml
            </span>
          </div>
          <div
            className="mt-3 h-6 overflow-hidden rounded-lg bg-line"
            role="progressbar"
            aria-valuenow={waterMl}
            aria-valuemax={targets.waterMl}
            aria-label="Água"
          >
            <div
              className="flex h-full items-center justify-center rounded-lg bg-water text-xs font-bold text-white transition-[width] duration-500"
              style={{ width: `${Math.min((waterMl / targets.waterMl) * 100, 100)}%`, minWidth: waterMl > 0 ? '2.5rem' : 0 }}
            >
              {targets.waterMl > 0 ? Math.round((waterMl / targets.waterMl) * 100) : 0} %
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => addWater(250)} className={waterBtnCls}>
              🥛 +250 ml
            </button>
            <button onClick={() => addWater(500)} className={waterBtnCls}>
              🍶 +500 ml
            </button>
            <button onClick={() => addWater(-250)} className={waterBtnCls} disabled={waterMl === 0}>
              −250 ml
            </button>
          </div>
        </section>
      </div>

      {addingTo && (
        <AddFoodSheet
          meal={addingTo}
          customFoods={customFoods}
          setCustomFoods={setCustomFoods}
          onAdd={addEntry}
          onClose={() => setAddingTo(null)}
        />
      )}
      {addingExercise && <AddExerciseSheet onAdd={addExercise} onClose={() => setAddingExercise(false)} />}
    </div>
  )
}

const dayNavCls =
  'flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl text-white disabled:opacity-30'
const waterBtnCls =
  'flex-1 rounded-xl border border-line bg-bg px-2 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-water disabled:opacity-40'

function SummaryBar({ label, value, target, colorVar }: { label: string; value: number; target: number; colorVar: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <div className="text-center">
      <div className="text-sm font-bold" style={{ color: `var(${colorVar})` }}>
        {label}
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemax={target}
        aria-label={label}
      >
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: `var(${colorVar})` }} />
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-ink">
        {Math.round(value)} <span className="font-normal text-muted">/ {target} g</span>
      </div>
    </div>
  )
}

function MealStat({ value, label, colorVar }: { value: number; label: string; colorVar?: string }) {
  return (
    <div>
      <div className="text-lg font-bold tabular-nums" style={colorVar ? { color: `var(${colorVar})` } : undefined}>
        {Math.round(value)}
      </div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  )
}

function AddExerciseSheet({ onAdd, onClose }: { onAdd: (e: Exercise) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const valid = name.trim().length > 0 && Number(kcal) > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-bg px-5 pb-8 pt-2"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Adicionar exercício"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-line" aria-hidden />
        <h2 className="mt-3 text-lg font-bold">Adicionar exercício</h2>
        <div className="mt-4 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: corrida, ginásio, caminhada…"
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            autoFocus
          />
          <input
            type="number"
            inputMode="numeric"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            placeholder="Calorias queimadas"
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>
        <button
          onClick={() => onAdd({ id: uid(), name: name.trim(), kcal: Number(kcal) })}
          disabled={!valid}
          className="mt-5 w-full rounded-xl bg-accent px-6 py-3.5 font-semibold text-white disabled:opacity-40"
        >
          Adicionar
        </button>
      </div>
    </div>
  )
}
