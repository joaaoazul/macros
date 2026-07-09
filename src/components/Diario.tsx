import { useMemo, useState } from 'react'
import type { Diary, Entry, Food, MealId, Profile } from '../types'
import { MEALS } from '../types'
import { sumEntries } from '../lib/calc'
import { formatDatePT, shiftDate, todayISO } from '../lib/store'
import MacroRing from './MacroRing'
import AddFoodSheet from './AddFoodSheet'

interface Props {
  profile: Profile
  diary: Diary
  setDiary: React.Dispatch<React.SetStateAction<Diary>>
  customFoods: Food[]
  setCustomFoods: React.Dispatch<React.SetStateAction<Food[]>>
}

export default function Diario({ profile, diary, setDiary, customFoods, setCustomFoods }: Props) {
  const [date, setDate] = useState(todayISO)
  const [addingTo, setAddingTo] = useState<MealId | null>(null)

  const entries = useMemo(() => diary[date] ?? [], [diary, date])
  const totals = useMemo(() => sumEntries(entries), [entries])
  const { targets } = profile
  const remaining = Math.round(targets.kcal - totals.kcal)

  const addEntry = (entry: Entry) => {
    setDiary((d) => ({ ...d, [date]: [...(d[date] ?? []), entry] }))
    setAddingTo(null)
  }

  const removeEntry = (id: string) => {
    setDiary((d) => ({ ...d, [date]: (d[date] ?? []).filter((e) => e.id !== id) }))
  }

  return (
    <div className="px-4 pt-6">
      {/* navegação de dias */}
      <header className="flex items-center justify-between">
        <button onClick={() => setDate((d) => shiftDate(d, -1))} className={dayNavCls} aria-label="Dia anterior">
          ‹
        </button>
        <div className="text-center">
          <h1 className="text-lg font-bold capitalize">{formatDatePT(date)}</h1>
          {date !== todayISO() && (
            <button onClick={() => setDate(todayISO())} className="text-xs font-medium text-accent">
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
      </header>

      {/* resumo do dia */}
      <section className="mt-5 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-5">
          <MacroRing
            value={totals.kcal}
            target={targets.kcal}
            size={110}
            stroke={10}
            color="var(--accent)"
            label="Calorias"
          >
            <span className="text-2xl font-bold leading-none">{Math.abs(remaining).toLocaleString('pt-PT')}</span>
            <span className="mt-0.5 text-[11px] text-muted">{remaining >= 0 ? 'restantes' : 'a mais'}</span>
          </MacroRing>

          <div className="flex-1 space-y-3">
            <MacroBar label="Proteína" value={totals.protein} target={targets.protein} colorVar="--protein" />
            <MacroBar label="Hidratos" value={totals.carbs} target={targets.carbs} colorVar="--carbs" />
            <MacroBar label="Gordura" value={totals.fat} target={targets.fat} colorVar="--fat" />
          </div>
        </div>
        <div className="mt-4 flex justify-between border-t border-line pt-3 text-sm">
          <span className="text-ink-2">
            {Math.round(totals.kcal).toLocaleString('pt-PT')} / {targets.kcal.toLocaleString('pt-PT')} kcal
          </span>
          <span className={remaining < 0 ? 'font-medium text-critical' : 'font-medium text-good'}>
            {remaining >= 0 ? `✓ dentro do plano` : `${Math.abs(remaining)} kcal acima`}
          </span>
        </div>
      </section>

      {/* refeições */}
      <div className="mt-5 space-y-4">
        {MEALS.map((meal) => {
          const mealEntries = entries.filter((e) => e.meal === meal.id)
          const mealKcal = Math.round(mealEntries.reduce((s, e) => s + e.kcal, 0))
          return (
            <section key={meal.id} className="rounded-2xl border border-line bg-surface shadow-sm">
              <header className="flex items-center justify-between px-4 pt-3.5">
                <h2 className="font-semibold">
                  <span aria-hidden>{meal.emoji}</span> {meal.label}
                </h2>
                <span className="text-sm text-muted">{mealKcal > 0 ? `${mealKcal} kcal` : ''}</span>
              </header>

              {mealEntries.length > 0 && (
                <ul className="mt-2 divide-y divide-line border-t border-line">
                  {mealEntries.map((e) => (
                    <li key={e.id} className="group flex items-center gap-3 px-4 py-2.5">
                      <span className="text-lg" aria-hidden>
                        {e.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{e.foodName}</div>
                        <div className="text-xs text-muted">
                          {e.grams} {e.unit} · P {Math.round(e.protein)} · H {Math.round(e.carbs)} · G {Math.round(e.fat)}
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
                className="block w-full border-t border-line px-4 py-2.5 text-left text-sm font-medium text-accent transition-colors hover:bg-bg"
              >
                + Adicionar alimento
              </button>
            </section>
          )
        })}
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
    </div>
  )
}

const dayNavCls =
  'flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-xl text-ink-2 disabled:opacity-30'

function MacroBar({ label, value, target, colorVar }: { label: string; value: number; target: number; colorVar: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium text-ink-2">{label}</span>
        <span className="tabular-nums text-muted">
          {Math.round(value)} / {target} g
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemax={target} aria-label={label}>
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: `var(${colorVar})` }}
        />
      </div>
    </div>
  )
}
