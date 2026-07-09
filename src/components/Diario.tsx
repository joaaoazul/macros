import { useMemo, useState } from 'react'
import type { Diary, Entry, Exercise, ExerciseLog, Food, MealId, Profile, WaterLog } from '../types'
import { MEALS } from '../types'
import { sumEntries } from '../lib/calc'
import { formatDatePT, shiftDate, todayISO, uid } from '../lib/store'
import AddFoodSheet from './AddFoodSheet'
import Rings from './Rings'
import { Card, Chevron, CircleButton, IconCircle, LargeTitle, SectionHeader } from './ui'

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
  const remaining = targets.kcal - net

  const dateLabel = useMemo(() => {
    const [y, m, d] = date.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
  }, [date])

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
      <LargeTitle
        title={formatDatePT(date)}
        subtitle={dateLabel}
        right={
          <div className="mb-1.5 flex gap-2">
            <CircleButton onClick={() => setDate((d) => shiftDate(d, -1))} label="Dia anterior">
              <Chevron dir="left" />
            </CircleButton>
            <CircleButton onClick={() => setDate((d) => shiftDate(d, 1))} label="Dia seguinte" disabled={date >= todayISO()}>
              <Chevron dir="right" />
            </CircleButton>
          </div>
        }
      />
      {date !== todayISO() && (
        <button onClick={() => setDate(todayISO())} className="mx-5 -mt-2 mb-1 text-sm font-bold text-accent">
          Voltar a hoje ↩
        </button>
      )}

      <div className="px-4">
        {/* hero: anéis + macros */}
        <Card className="p-6">
          <div className="flex items-center gap-6">
            <Rings
              size={158}
              rings={[
                { value: totals.carbs, target: targets.carbs, colorVar: '--carbs', label: 'Hidratos' },
                { value: totals.protein, target: targets.protein, colorVar: '--protein', label: 'Proteína' },
                { value: totals.fat, target: targets.fat, colorVar: '--fat', label: 'Gordura' },
              ]}
            >
              <span className="text-[2rem] font-extrabold leading-none tracking-tight tabular-nums">
                {Math.abs(Math.round(remaining)).toLocaleString('pt-PT')}
              </span>
              <span className="mt-1 text-[11px] font-semibold text-muted">{remaining >= 0 ? 'restantes' : 'a mais'}</span>
            </Rings>

            <div className="flex-1 space-y-3.5">
              <MacroRow label="Hidratos" value={totals.carbs} target={targets.carbs} colorVar="--carbs" />
              <MacroRow label="Proteína" value={totals.protein} target={targets.protein} colorVar="--protein" />
              <MacroRow label="Gordura" value={totals.fat} target={targets.fat} colorVar="--fat" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 divide-x divide-line border-t border-line pt-4 text-center">
            <HeroStat value={eaten} label="ingeridas" />
            <HeroStat value={burned} label="exercício" prefix={burned > 0 ? '−' : ''} />
            <HeroStat value={net} label={`de ${targets.kcal.toLocaleString('pt-PT')} kcal`} strong over={net > targets.kcal} />
          </div>
        </Card>

        {/* refeições */}
        <SectionHeader>Refeições</SectionHeader>
        <div className="space-y-3">
          {MEALS.map((meal) => {
            const mealEntries = entries.filter((e) => e.meal === meal.id)
            const t = sumEntries(mealEntries)
            return (
              <Card key={meal.id} className="overflow-hidden">
                <button onClick={() => setAddingTo(meal.id)} className="flex w-full items-center gap-3.5 p-4 text-left">
                  <IconCircle>{meal.emoji}</IconCircle>
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-bold">{meal.label}</div>
                    <div className="text-[12.5px] text-muted">
                      {mealEntries.length === 0
                        ? 'Toca para adicionar'
                        : `${mealEntries.length} ${mealEntries.length === 1 ? 'item' : 'itens'} · H ${Math.round(t.carbs)} · P ${Math.round(t.protein)} · G ${Math.round(t.fat)}`}
                    </div>
                  </div>
                  {t.kcal > 0 && (
                    <span className="text-[15px] font-extrabold tabular-nums">
                      {Math.round(t.kcal)} <span className="text-[11px] font-semibold text-muted">kcal</span>
                    </span>
                  )}
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </button>

                {mealEntries.length > 0 && (
                  <ul className="divide-y divide-line border-t border-line">
                    {mealEntries.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 py-2.5 pl-5 pr-3">
                        <span className="text-lg" aria-hidden>
                          {e.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14.5px] font-semibold">{e.foodName}</div>
                          <div className="text-[12px] text-muted">
                            {e.grams} {e.unit} · H {Math.round(e.carbs)} · P {Math.round(e.protein)} · G {Math.round(e.fat)}
                          </div>
                        </div>
                        <span className="text-[14.5px] font-bold tabular-nums">{Math.round(e.kcal)}</span>
                        <button
                          onClick={() => removeEntry(e.id)}
                          className="rounded-full px-2 py-1 text-muted transition-colors hover:text-critical"
                          aria-label={`Remover ${e.foodName}`}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )
          })}
        </div>

        {/* atividade */}
        <SectionHeader>Atividade</SectionHeader>
        <Card className="overflow-hidden">
          <button onClick={() => setAddingExercise(true)} className="flex w-full items-center gap-3.5 p-4 text-left">
            <IconCircle tint="color-mix(in srgb, var(--good) 14%, transparent)">🏃</IconCircle>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-bold">Exercício</div>
              <div className="text-[12.5px] text-muted">{dayExercises.length === 0 ? 'Toca para registar' : `${dayExercises.length} ${dayExercises.length === 1 ? 'registo' : 'registos'}`}</div>
            </div>
            {burned > 0 && (
              <span className="text-[15px] font-extrabold tabular-nums text-good">
                −{burned} <span className="text-[11px] font-semibold text-muted">kcal</span>
              </span>
            )}
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </button>
          {dayExercises.length > 0 && (
            <ul className="divide-y divide-line border-t border-line">
              {dayExercises.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5 pl-5 pr-3">
                  <div className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{e.name}</div>
                  <span className="text-[14.5px] font-bold tabular-nums text-good">−{Math.round(e.kcal)}</span>
                  <button
                    onClick={() => removeExercise(e.id)}
                    className="rounded-full px-2 py-1 text-muted transition-colors hover:text-critical"
                    aria-label={`Remover ${e.name}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* hidratação */}
        <SectionHeader>Hidratação</SectionHeader>
        <Card className="mb-2 p-4">
          <div className="flex items-center gap-3.5">
            <IconCircle tint="color-mix(in srgb, var(--water) 14%, transparent)">💧</IconCircle>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-bold">Água</div>
              <div className="text-[12.5px] text-muted">
                {waterMl} / {targets.waterMl} ml
              </div>
            </div>
            <span className="text-[15px] font-extrabold tabular-nums">
              {targets.waterMl > 0 ? Math.round((waterMl / targets.waterMl) * 100) : 0}
              <span className="text-[11px] font-semibold text-muted"> %</span>
            </span>
          </div>
          <div
            className="mt-3.5 flex flex-wrap gap-1.5"
            role="progressbar"
            aria-valuenow={waterMl}
            aria-valuemax={targets.waterMl}
            aria-label="Água"
          >
            {Array.from({ length: Math.max(Math.ceil(targets.waterMl / 250), 1) }, (_, i) => (
              <svg key={i} width="21" height="25" viewBox="0 0 24 28" aria-hidden>
                <path
                  d="M12 2C12 2 4 12.5 4 18a8 8 0 0 0 16 0C20 12.5 12 2 12 2z"
                  fill={waterMl >= (i + 1) * 250 ? 'var(--water)' : 'var(--line)'}
                  style={{ transition: 'fill 300ms ease' }}
                />
              </svg>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => addWater(250)} className={waterBtnCls}>
              +250 ml
            </button>
            <button onClick={() => addWater(500)} className={waterBtnCls}>
              +500 ml
            </button>
            <button
              onClick={() => addWater(-250)}
              className="ml-auto rounded-full px-4 py-2 text-sm font-bold text-muted disabled:opacity-40"
              disabled={waterMl === 0}
            >
              −250
            </button>
          </div>
        </Card>
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

const waterBtnCls = 'rounded-full bg-accent-soft px-4 py-2 text-sm font-bold text-accent transition-opacity active:opacity-70'

function MacroRow({ label, value, target, colorVar }: { label: string; value: number; target: number; colorVar: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[12.5px] font-bold text-ink-2">{label}</span>
        <span className="text-[12.5px] font-bold tabular-nums">
          {Math.round(value)}
          <span className="font-semibold text-muted"> / {target} g</span>
        </span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-full bg-line" role="presentation">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: `var(${colorVar})` }} />
      </div>
    </div>
  )
}

function HeroStat({ value, label, prefix = '', strong, over }: { value: number; label: string; prefix?: string; strong?: boolean; over?: boolean }) {
  return (
    <div className="px-1">
      <div className={`tabular-nums ${strong ? 'text-[17px] font-extrabold' : 'text-[17px] font-bold text-ink-2'} ${over ? 'text-critical' : ''}`}>
        {prefix}
        {Math.round(value).toLocaleString('pt-PT')}
      </div>
      <div className="mt-0.5 text-[11px] font-semibold text-muted">{label}</div>
    </div>
  )
}

function AddExerciseSheet({ onAdd, onClose }: { onAdd: (e: Exercise) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const valid = name.trim().length > 0 && Number(kcal) > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-[1.75rem] bg-bg px-5 pb-8 pt-2"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Adicionar exercício"
      >
        <div className="mx-auto h-1 w-9 rounded-full bg-line" aria-hidden />
        <h2 className="mt-4 text-xl font-extrabold">Adicionar exercício</h2>
        <div className="mt-4 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: corrida, ginásio, caminhada…"
            className="w-full rounded-xl bg-surface px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            autoFocus
          />
          <input
            type="number"
            inputMode="numeric"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            placeholder="Calorias queimadas"
            className="w-full rounded-xl bg-surface px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <button
          onClick={() => onAdd({ id: uid(), name: name.trim(), kcal: Number(kcal) })}
          disabled={!valid}
          className="mt-5 w-full rounded-full bg-accent px-6 py-3.5 font-bold text-white transition-opacity active:opacity-80 disabled:opacity-40"
        >
          Adicionar
        </button>
      </div>
    </div>
  )
}
