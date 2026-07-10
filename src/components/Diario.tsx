import { useMemo, useState } from 'react'
import type { Diary, Entry, Exercise, ExerciseLog, Food, MealId, Profile, WaterLog } from '../types'
import { MEALS } from '../types'
import { sumEntries } from '../lib/calc'
import { shiftDate, todayISO, uid } from '../lib/store'
import AddFoodSheet from './AddFoodSheet'
import { Card, Chevron, CircleButton, IconCircle } from './ui'

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
  onEditGoal: () => void
}

export default function Diario({ profile, diary, setDiary, water, setWater, exercise, setExercise, customFoods, setCustomFoods, onEditGoal }: Props) {
  const [date, setDate] = useState(todayISO)
  const [addingTo, setAddingTo] = useState<MealId | null>(null)
  const [openMeal, setOpenMeal] = useState<MealId | null>(null)
  const [addingExercise, setAddingExercise] = useState(false)

  const entries = useMemo(() => diary[date] ?? [], [diary, date])
  const totals = useMemo(() => sumEntries(entries), [entries])
  const dayExercises = exercise[date] ?? []
  const burned = Math.round(dayExercises.reduce((s, e) => s + e.kcal, 0))
  const waterMl = water[date] ?? 0
  const { targets } = profile
  const eaten = Math.round(totals.kcal)
  const net = eaten - burned
  const kcalPct = targets.kcal > 0 ? Math.max(0, Math.round((net / targets.kcal) * 100)) : 0

  const isToday = date === todayISO()
  const dateLabel = useMemo(() => {
    const [y, m, d] = date.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
  }, [date])

  // streak: dias consecutivos com registos, a contar para trás a partir de hoje
  const streak = useMemo(() => {
    let n = 0
    let d = todayISO()
    if (!(diary[d]?.length)) d = shiftDate(d, -1)
    while (diary[d]?.length) {
      n += 1
      d = shiftDate(d, -1)
    }
    return n
  }, [diary])

  const addEntry = (entry: Entry) => {
    setDiary((d) => ({ ...d, [date]: [...(d[date] ?? []), entry] }))
    setAddingTo(null)
    setOpenMeal(entry.meal)
  }
  const addEntries = (newEntries: Entry[]) => {
    setDiary((d) => ({ ...d, [date]: [...(d[date] ?? []), ...newEntries] }))
    setAddingTo(null)
    if (newEntries[0]) setOpenMeal(newEntries[0].meal)
  }
  const yesterday = shiftDate(date, -1)
  const canCopyYesterday = entries.length === 0 && (diary[yesterday]?.length ?? 0) > 0
  const copyYesterday = () => {
    const copied = (diary[yesterday] ?? []).map((e) => ({ ...e, id: uid() }))
    setDiary((d) => ({ ...d, [date]: [...(d[date] ?? []), ...copied] }))
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
      {/* saudação + streak + navegação de dias */}
      <header className="flex items-start justify-between px-5 pb-4 pt-[max(1.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <h1 className="text-[1.7rem] font-extrabold leading-tight">
            Olá, {profile.name}! <span aria-hidden>👋</span>
          </h1>
          <p className="mt-0.5 text-[13.5px] text-muted">
            {isToday ? 'Aqui está o teu resumo de hoje.' : <span className="capitalize">{dateLabel}</span>}
          </p>
        </div>
        <div className="mt-1 flex shrink-0 items-center gap-2">
          {streak > 0 && (
            <span
              className="flex h-10 items-center gap-1 rounded-full bg-surface px-3 text-[13px] font-extrabold shadow-card ring-1 ring-ring-soft"
              title={`${streak} dias seguidos a registar`}
            >
              <span aria-hidden>🔥</span> {streak}
            </span>
          )}
          <CircleButton onClick={() => setDate((d) => shiftDate(d, -1))} label="Dia anterior">
            <Chevron dir="left" />
          </CircleButton>
          <CircleButton onClick={() => setDate((d) => shiftDate(d, 1))} label="Dia seguinte" disabled={date >= todayISO()}>
            <Chevron dir="right" />
          </CircleButton>
        </div>
      </header>
      {!isToday && (
        <button onClick={() => setDate(todayISO())} className="mx-5 -mt-3 mb-2 text-sm font-bold text-accent">
          Voltar a hoje ↩
        </button>
      )}

      <div className="space-y-4 px-4">
        {/* resumo do dia */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <IconCircle>📅</IconCircle>
              <h2 className="text-[17px] font-extrabold">Resumo de {isToday ? 'Hoje' : 'Dia'}</h2>
            </div>
            <button onClick={onEditGoal} className="text-[13px] font-bold text-accent">
              Editar objetivo ›
            </button>
          </div>

          <div className="mt-5 flex items-center gap-6">
            <KcalRing pct={kcalPct} />

            <div className="flex-1 space-y-3">
              <SummaryRow label="Calorias" value={net} target={targets.kcal} unit="kcal" colorVar="--accent" />
              <SummaryRow label="Proteínas" value={totals.protein} target={targets.protein} unit="g" colorVar="--protein" />
              <SummaryRow label="Hidratos" value={totals.carbs} target={targets.carbs} unit="g" colorVar="--carbs" />
              <SummaryRow label="Gorduras" value={totals.fat} target={targets.fat} unit="g" colorVar="--fat" />
            </div>
          </div>

          {burned > 0 && (
            <p className="mt-4 border-t border-line pt-3 text-center text-[12.5px] text-muted">
              {eaten.toLocaleString('pt-PT')} ingeridas − <span className="font-bold text-good">{burned} de exercício</span> ={' '}
              <span className="font-bold text-ink">{net.toLocaleString('pt-PT')} kcal líquidas</span>
            </p>
          )}
        </Card>

        {/* tiles de macros */}
        <div className="grid grid-cols-3 gap-3">
          <MacroTile label="Proteínas" value={totals.protein} target={targets.protein} colorVar="--protein" icon="🥩" />
          <MacroTile label="Hidratos" value={totals.carbs} target={targets.carbs} colorVar="--carbs" icon="🌾" />
          <MacroTile label="Gorduras" value={totals.fat} target={targets.fat} colorVar="--fat" icon="🫒" />
        </div>

        {/* refeições */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 pt-4 pb-1">
            <IconCircle>🍽️</IconCircle>
            <h2 className="flex-1 text-[17px] font-extrabold">Refeições de {isToday ? 'Hoje' : 'Dia'}</h2>
            {canCopyYesterday && (
              <button onClick={copyYesterday} className="rounded-full bg-accent-soft px-3 py-1.5 text-[12.5px] font-bold text-accent">
                ⧉ Copiar dia anterior
              </button>
            )}
          </div>

          <ul className="divide-y divide-line">
            {MEALS.map((meal) => {
              const mealEntries = entries.filter((e) => e.meal === meal.id)
              const t = sumEntries(mealEntries)
              const open = openMeal === meal.id
              return (
                <li key={meal.id}>
                  <button
                    onClick={() => (mealEntries.length > 0 ? setOpenMeal(open ? null : meal.id) : setAddingTo(meal.id))}
                    className="flex w-full items-center gap-3.5 px-5 py-3.5 text-left"
                  >
                    <IconCircle>{meal.emoji}</IconCircle>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15.5px] font-bold">{meal.label}</div>
                      <div className="truncate text-[12.5px] text-muted">
                        {mealEntries.length === 0
                          ? 'Toca para adicionar'
                          : mealEntries.map((e) => e.foodName).slice(0, 2).join(', ') + (mealEntries.length > 2 ? '…' : '')}
                      </div>
                      {mealEntries.length > 0 && (
                        <div className="mt-0.5 flex gap-2.5 text-[12px] font-extrabold tabular-nums">
                          <span style={{ color: 'var(--protein)' }}>{Math.round(t.protein)}P</span>
                          <span style={{ color: 'var(--carbs)' }}>{Math.round(t.carbs)}H</span>
                          <span style={{ color: 'var(--fat)' }}>{Math.round(t.fat)}G</span>
                        </div>
                      )}
                    </div>
                    {t.kcal > 0 && <span className="text-[14.5px] font-extrabold tabular-nums">{Math.round(t.kcal)} kcal</span>}
                    <span className={`text-muted transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden>
                      <Chevron dir="right" />
                    </span>
                  </button>

                  {open && mealEntries.length > 0 && (
                    <div className="bg-bg/50">
                      <ul className="divide-y divide-line border-t border-line">
                        {mealEntries.map((e) => (
                          <li key={e.id} className="flex items-center gap-3 py-2.5 pl-6 pr-3">
                            <span className="text-lg" aria-hidden>
                              {e.emoji}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[14px] font-semibold">{e.foodName}</div>
                              <div className="text-[12px] text-muted">
                                {e.grams} {e.unit} · P {Math.round(e.protein)} · H {Math.round(e.carbs)} · G {Math.round(e.fat)}
                              </div>
                            </div>
                            <span className="text-[14px] font-bold tabular-nums">{Math.round(e.kcal)}</span>
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
                      <button
                        onClick={() => setAddingTo(meal.id)}
                        className="block w-full border-t border-line py-2.5 text-center text-[13.5px] font-bold text-accent"
                      >
                        ＋ Adicionar ao {meal.label.toLowerCase()}
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>

        {/* exercício */}
        <Card className="overflow-hidden">
          <button onClick={() => setAddingExercise(true)} className="flex w-full items-center gap-3.5 p-4 text-left">
            <IconCircle tint="color-mix(in srgb, var(--fat) 14%, transparent)">🏃</IconCircle>
            <div className="min-w-0 flex-1">
              <div className="text-[15.5px] font-bold">Exercício</div>
              <div className="text-[12.5px] text-muted">
                {dayExercises.length === 0 ? 'Toca para registar' : `${dayExercises.length} ${dayExercises.length === 1 ? 'registo' : 'registos'}`}
              </div>
            </div>
            {burned > 0 && <span className="text-[14.5px] font-extrabold tabular-nums text-good">−{burned} kcal</span>}
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
                  <div className="min-w-0 flex-1 truncate text-[14px] font-semibold">{e.name}</div>
                  <span className="text-[14px] font-bold tabular-nums text-good">−{Math.round(e.kcal)}</span>
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

        {/* água */}
        <Card className="mb-2 p-4">
          <div className="flex items-center gap-3.5">
            <IconCircle tint="color-mix(in srgb, var(--water) 14%, transparent)">💧</IconCircle>
            <div className="min-w-0 flex-1">
              <div className="text-[15.5px] font-bold">Água</div>
              <div className="text-[12.5px] text-muted">
                {waterMl} / {targets.waterMl} ml
              </div>
            </div>
            <span className="text-[14.5px] font-extrabold tabular-nums">
              {targets.waterMl > 0 ? Math.round((waterMl / targets.waterMl) * 100) : 0}
              <span className="text-[11px] font-semibold text-muted"> %</span>
            </span>
          </div>
          <div className="mt-3.5 flex flex-wrap gap-1.5" role="progressbar" aria-valuenow={waterMl} aria-valuemax={targets.waterMl} aria-label="Água">
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
          onAddMany={addEntries}
          onClose={() => setAddingTo(null)}
        />
      )}
      {addingExercise && <AddExerciseSheet onAdd={addExercise} onClose={() => setAddingExercise(false)} />}
    </div>
  )
}

const waterBtnCls = 'rounded-full bg-accent-soft px-4 py-2 text-sm font-bold text-accent transition-opacity active:opacity-70'

/** Anel único de calorias (verde), com % ao centro. */
function KcalRing({ pct }: { pct: number }) {
  const size = 140
  const stroke = 13
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(pct, 100))

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" role="img" aria-label={`${pct}% das calorias do dia`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-[1.9rem] font-extrabold leading-none tabular-nums ${pct > 100 ? 'text-critical' : ''}`}>{pct}%</span>
        <span className="mt-1 text-[11.5px] font-semibold text-muted">das kcal</span>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, target, unit, colorVar }: { label: string; value: number; target: number; unit: string; colorVar: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <div>
      <div className="text-[12px] font-semibold text-muted">{label}</div>
      <div className="text-[14.5px] font-extrabold tabular-nums">
        {Math.round(value).toLocaleString('pt-PT')} <span className="font-semibold text-muted">/ {target.toLocaleString('pt-PT')} {unit}</span>
      </div>
      <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-line" role="presentation">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: `var(${colorVar})` }} />
      </div>
    </div>
  )
}

function MacroTile({ label, value, target, colorVar, icon }: { label: string; value: number; target: number; colorVar: string; icon: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <Card className="p-3.5">
      <IconCircle tint={`color-mix(in srgb, var(${colorVar}) 14%, transparent)`}>{icon}</IconCircle>
      <div className="mt-2.5 text-[12.5px] font-semibold text-muted">{label}</div>
      <div className="text-[1.35rem] font-extrabold leading-tight tabular-nums">
        {Math.round(value)}
        <span className="text-[12px] font-bold text-muted">g</span>
      </div>
      <div className="text-[12px] text-muted">/ {target} g</div>
      <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-line" role="presentation">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: `var(${colorVar})` }} />
      </div>
    </Card>
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
          className="mt-5 w-full rounded-full bg-accent px-6 py-3.5 font-bold text-on-accent transition-opacity active:opacity-80 disabled:opacity-40"
        >
          Adicionar
        </button>
      </div>
    </div>
  )
}
