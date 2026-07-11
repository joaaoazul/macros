import { useMemo, useState } from 'react'
import type { Diary, Entry, Exercise, ExerciseLog, Food, MealId, Profile, WaterLog } from '../types'
import { MEALS } from '../types'
import { sumEntries } from '../lib/calc'
import { formatDatePT, shiftDate, todayISO, uid } from '../lib/store'
import AddFoodSheet from './AddFoodSheet'
import AguaDetail from './details/AguaDetail'
import Rings from './Rings'
import { Card, Chevron, CircleButton, LargeTitle } from './ui'

interface Props {
  profile: Profile
  setProfile: (p: Profile) => void
  diary: Diary
  setDiary: React.Dispatch<React.SetStateAction<Diary>>
  water: WaterLog
  setWater: React.Dispatch<React.SetStateAction<WaterLog>>
  exercise: ExerciseLog
  setExercise: React.Dispatch<React.SetStateAction<ExerciseLog>>
  customFoods: Food[]
  setCustomFoods: React.Dispatch<React.SetStateAction<Food[]>>
}

export default function Diario({ profile, setProfile, diary, setDiary, water, setWater, exercise, setExercise, customFoods, setCustomFoods }: Props) {
  const [date, setDate] = useState(todayISO)
  const [addingTo, setAddingTo] = useState<MealId | null>(null)
  const [addingExercise, setAddingExercise] = useState(false)
  const [showAgua, setShowAgua] = useState(false)

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
          <div className="mb-1 flex gap-2">
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
        <button onClick={() => setDate(todayISO())} className="mx-5 -mt-1 mb-1 text-sm font-semibold text-accent">
          Voltar a hoje
        </button>
      )}

      <div className="space-y-3.5 px-4 pt-2">
        {/* hero: anéis + estatísticas */}
        <Card className="p-5">
          <div className="flex items-center gap-5">
            <Rings
              rings={[
                { value: totals.carbs, target: targets.carbs, colorVar: '--carbs', label: 'Hidratos' },
                { value: totals.protein, target: targets.protein, colorVar: '--protein', label: 'Proteína' },
                { value: totals.fat, target: targets.fat, colorVar: '--fat', label: 'Gordura' },
              ]}
            >
              <span className="text-[1.75rem] font-bold leading-none tracking-tight">{Math.abs(Math.round(remaining)).toLocaleString('pt-PT')}</span>
              <span className="mt-1 text-[11px] font-medium text-muted">{remaining >= 0 ? 'kcal restantes' : 'kcal a mais'}</span>
            </Rings>

            <div className="flex-1 space-y-2.5">
              <StatRow label="Hidratos" value={totals.carbs} target={targets.carbs} unit="g" colorVar="--carbs" />
              <StatRow label="Proteína" value={totals.protein} target={targets.protein} unit="g" colorVar="--protein" />
              <StatRow label="Gordura" value={totals.fat} target={targets.fat} unit="g" colorVar="--fat" />
            </div>
          </div>

          <p className="mt-4 border-t border-line pt-3 text-center text-[13px] text-muted">
            <span className="font-semibold text-ink-2">{eaten.toLocaleString('pt-PT')}</span> ingeridas −{' '}
            <span className="font-semibold text-ink-2">{burned}</span> exercício ={' '}
            <span className="font-semibold text-ink-2">{net.toLocaleString('pt-PT')}</span> / {targets.kcal.toLocaleString('pt-PT')} kcal
          </p>
        </Card>

        {/* refeições */}
        {MEALS.map((meal) => {
          const mealEntries = entries.filter((e) => e.meal === meal.id)
          const t = sumEntries(mealEntries)
          return (
            <Card key={meal.id} className="overflow-hidden">
              <div className="flex items-baseline justify-between gap-3 px-5 pt-4">
                <h2 className="truncate text-[17px] font-semibold">{meal.label}</h2>
                {t.kcal > 0 && <span className="shrink-0 text-[13px] tabular-nums text-muted">{Math.round(t.kcal)} kcal</span>}
              </div>

              {mealEntries.length > 0 && (
                <ul className="mt-3 divide-y divide-line border-t border-line">
                  {mealEntries.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 py-2.5 pl-5 pr-3">
                      <span className="text-lg" aria-hidden>
                        {e.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-medium">{e.foodName}</div>
                        <div className="text-[12px] text-muted">
                          {e.grams} {e.unit} · H {Math.round(e.carbs)} · P {Math.round(e.protein)} · G {Math.round(e.fat)}
                        </div>
                      </div>
                      <span className="text-[15px] font-semibold tabular-nums">{Math.round(e.kcal)}</span>
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

              <button
                onClick={() => setAddingTo(meal.id)}
                className={`mt-3 block w-full border-t border-line py-3 text-center text-[15px] font-semibold text-accent transition-colors hover:bg-accent-soft ${
                  mealEntries.length > 0 ? '' : ''
                }`}
              >
                ＋ Adicionar alimento
              </button>
            </Card>
          )
        })}

        {/* exercício */}
        <Card className="overflow-hidden">
          <div className="flex items-baseline justify-between px-5 pt-4">
            <h2 className="text-[17px] font-semibold">Exercício</h2>
            <span className="text-[13px] tabular-nums text-muted">{burned} kcal</span>
          </div>
          {dayExercises.length > 0 && (
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {dayExercises.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5 pl-5 pr-3">
                  <span className="text-lg" aria-hidden>
                    🏃
                  </span>
                  <div className="min-w-0 flex-1 truncate text-[15px] font-medium">{e.name}</div>
                  <span className="text-[15px] font-semibold tabular-nums text-good">−{Math.round(e.kcal)}</span>
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
          <button
            onClick={() => setAddingExercise(true)}
            className="mt-3 block w-full border-t border-line py-3 text-center text-[15px] font-semibold text-accent transition-colors hover:bg-accent-soft"
          >
            ＋ Adicionar exercício
          </button>
        </Card>

        {/* água */}
        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-semibold">Água</h2>
            <span className="text-[13px] tabular-nums text-muted">
              {waterMl} / {targets.waterMl} ml · {targets.waterMl > 0 ? Math.round((waterMl / targets.waterMl) * 100) : 0}%
            </span>
          </div>
          {/* gotas: uma por cada 250 ml da meta */}
          <div className="mt-3 flex flex-wrap gap-1.5" role="progressbar" aria-valuenow={waterMl} aria-valuemax={targets.waterMl} aria-label="Água">
            {Array.from({ length: Math.max(Math.ceil(targets.waterMl / 250), 1) }, (_, i) => (
              <svg key={i} width="22" height="26" viewBox="0 0 24 28" aria-hidden>
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
            <button onClick={() => addWater(-250)} className="rounded-full px-4 py-2 text-sm font-semibold text-muted disabled:opacity-40" disabled={waterMl === 0}>
              −250
            </button>
          </div>
          <button
            onClick={() => setShowAgua(true)}
            className="mt-4 flex w-full items-center justify-between border-t border-line pt-3 text-left text-sm font-semibold text-accent"
          >
            Ver histórico <span className="text-muted">›</span>
          </button>
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
      {showAgua && <AguaDetail profile={profile} setProfile={setProfile} water={water} onClose={() => setShowAgua(false)} />}
    </div>
  )
}

const waterBtnCls = 'rounded-full bg-accent-soft px-4 py-2 text-sm font-semibold text-accent transition-opacity active:opacity-70'

function StatRow({ label, value, target, unit, colorVar }: { label: string; value: number; target: number; unit: string; colorVar: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `var(${colorVar})` }} aria-hidden />
      <span className="flex-1 text-[13px] font-medium text-ink-2">{label}</span>
      <span className="text-[15px] font-semibold tabular-nums">
        {Math.round(value)}
        <span className="font-normal text-muted">
          {' '}
          / {target} {unit}
        </span>
      </span>
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
        <h2 className="mt-4 text-xl font-bold">Adicionar exercício</h2>
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
          className="mt-5 w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
        >
          Adicionar
        </button>
      </div>
    </div>
  )
}
