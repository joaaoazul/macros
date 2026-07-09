import { useEffect, useMemo, useState } from 'react'
import type { Entry, Food, MealId } from '../types'
import { MEALS } from '../types'
import { FOOD_DB, searchFoods } from '../lib/foods'
import { searchOpenFoodFacts } from '../lib/off'
import { uid } from '../lib/store'

interface Props {
  /** null = escolher a refeição dentro da folha (botão + central) */
  meal: MealId | null
  customFoods: Food[]
  setCustomFoods: React.Dispatch<React.SetStateAction<Food[]>>
  onAdd: (entry: Entry) => void
  onClose: () => void
}

type OffState = { status: 'idle' | 'loading' | 'done' | 'error'; results: Food[] }

function guessMeal(): MealId {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 19) return 'snack'
  if (h < 22) return 'dinner'
  return 'supper'
}

export default function AddFoodSheet({ meal, customFoods, setCustomFoods, onAdd, onClose }: Props) {
  const [selMeal, setSelMeal] = useState<MealId>(meal ?? guessMeal())
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [grams, setGrams] = useState('100')
  const [creating, setCreating] = useState(false)
  const [off, setOff] = useState<OffState>({ status: 'idle', results: [] })

  const localFoods = useMemo(() => [...customFoods, ...FOOD_DB], [customFoods])
  const localResults = useMemo(() => searchFoods(localFoods, query), [localFoods, query])

  // pesquisa no Open Food Facts com debounce; aborta a anterior
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setOff({ status: 'idle', results: [] })
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setOff((s) => ({ ...s, status: 'loading' }))
      try {
        const results = await searchOpenFoodFacts(q, controller.signal)
        setOff({ status: 'done', results })
      } catch (err) {
        if (!controller.signal.aborted) setOff({ status: 'error', results: [] })
      }
    }, 450)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  const gramsN = Number(grams)
  const factor = gramsN > 0 ? gramsN / 100 : 0

  const confirm = () => {
    if (!selected || factor <= 0) return
    onAdd({
      id: uid(),
      meal: selMeal,
      foodName: selected.brand ? `${selected.name} (${selected.brand})` : selected.name,
      emoji: selected.emoji,
      grams: gramsN,
      unit: selected.unit,
      kcal: selected.kcal * factor,
      protein: selected.protein * factor,
      carbs: selected.carbs * factor,
      fat: selected.fat * factor,
    })
  }

  const pick = (f: Food) => {
    setSelected(f)
    setGrams('100')
  }

  const mealLabel = MEALS.find((m) => m.id === selMeal)?.label ?? ''

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex h-[88dvh] w-full max-w-md flex-col rounded-t-[1.75rem] bg-bg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Adicionar alimento ao ${mealLabel}`}
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line" aria-hidden />

        <header className="flex items-center justify-between px-5 pt-3">
          <h2 className="text-lg font-bold">Adicionar ao {mealLabel}</h2>
          <button onClick={onClose} className="rounded-full px-2 py-1 text-muted" aria-label="Fechar">
            ✕
          </button>
        </header>

        {!selected && !creating && (
          <>
            {meal === null && (
              <div className="flex gap-1.5 overflow-x-auto px-5 pt-3">
                {MEALS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelMeal(m.id)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                      selMeal === m.id ? 'bg-accent text-on-accent' : 'bg-surface text-ink-2'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
            <div className="px-5 pt-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar alimento ou código de barras…"
                className="w-full rounded-xl bg-surface px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
              />
            </div>

            <div className="mt-3 flex-1 overflow-y-auto px-5 pb-5">
              {localResults.length > 0 && (
                <>
                  <SectionLabel>Básicos e meus alimentos</SectionLabel>
                  <ul>
                    {localResults.map((f) => (
                      <FoodRow key={f.id} food={f} onPick={pick} />
                    ))}
                  </ul>
                </>
              )}

              {query.trim().length >= 3 && (
                <>
                  <SectionLabel>Open Food Facts 🇵🇹 · produtos de supermercado</SectionLabel>
                  {off.status === 'loading' && <p className="py-3 text-center text-sm text-muted">A pesquisar…</p>}
                  {off.status === 'error' && (
                    <p className="py-3 text-center text-sm text-muted">Sem ligação ao Open Food Facts — usa a lista local ou tenta mais tarde.</p>
                  )}
                  {off.status === 'done' && off.results.length === 0 && (
                    <p className="py-3 text-center text-sm text-muted">Nenhum produto encontrado para “{query}”.</p>
                  )}
                  <ul>
                    {off.results.map((f) => (
                      <FoodRow key={f.id} food={f} onPick={pick} />
                    ))}
                  </ul>
                </>
              )}

              {localResults.length === 0 && query.trim().length < 3 && (
                <p className="py-6 text-center text-sm text-muted">Escreve pelo menos 3 letras para pesquisar também no Open Food Facts.</p>
              )}

              <button
                onClick={() => setCreating(true)}
                className="mt-3 w-full rounded-xl border border-dashed border-line px-4 py-3 text-sm font-medium text-accent"
              >
                + Criar alimento personalizado
              </button>
            </div>
          </>
        )}

        {selected && (
          <div className="flex flex-1 flex-col overflow-y-auto px-5 pt-4">
            <button onClick={() => setSelected(null)} className="self-start text-sm font-medium text-accent">
              ‹ Voltar à pesquisa
            </button>

            <div className="mt-4 flex items-center gap-3">
              <span className="text-3xl" aria-hidden>
                {selected.emoji}
              </span>
              <div>
                <div className="font-semibold">{selected.name}</div>
                <div className="text-xs text-muted">
                  {selected.brand ? `${selected.brand} · ` : ''}valores por 100 {selected.unit}
                </div>
              </div>
            </div>

            <label className="mt-6 block">
              <span className="mb-1.5 block text-sm font-medium text-ink-2">Quantidade ({selected.unit})</span>
              <input
                type="number"
                inputMode="decimal"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                className="w-full rounded-xl bg-surface px-4 py-3 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
              />
            </label>

            <div className="mt-3 flex gap-2">
              {[50, 100, 150, 200].map((g) => (
                <button
                  key={g}
                  onClick={() => setGrams(String(g))}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium ${
                    grams === String(g) ? 'border-accent bg-accent-soft text-accent' : 'border-transparent bg-surface text-ink-2'
                  }`}
                >
                  {g} {selected.unit}
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2 rounded-2xl bg-surface p-4 text-center">
              <Preview label="Hidratos" value={selected.carbs * factor} suffix="g" dotVar="--carbs" />
              <Preview label="Proteína" value={selected.protein * factor} suffix="g" dotVar="--protein" />
              <Preview label="Gordura" value={selected.fat * factor} suffix="g" dotVar="--fat" />
              <Preview label="kcal" value={selected.kcal * factor} />
            </div>

            <button
              onClick={confirm}
              disabled={factor <= 0}
              className="mt-auto mb-6 rounded-full bg-accent px-6 py-3.5 font-semibold text-on-accent transition-opacity active:opacity-80 disabled:opacity-40"
            >
              Adicionar
            </button>
          </div>
        )}

        {creating && (
          <CustomFoodForm
            onCancel={() => setCreating(false)}
            onCreate={(food) => {
              setCustomFoods((c) => [food, ...c])
              setCreating(false)
              pick(food)
            }}
          />
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-muted first:mt-0">{children}</div>
}

function FoodRow({ food, onPick }: { food: Food; onPick: (f: Food) => void }) {
  return (
    <li>
      <button onClick={() => onPick(food)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface">
        <span className="text-xl" aria-hidden>
          {food.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {food.name}
            {food.brand && <span className="ml-1.5 text-xs text-muted">{food.brand}</span>}
            {food.custom && <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">meu</span>}
          </div>
          <div className="text-xs text-muted">
            {food.kcal} kcal · H {food.carbs} · P {food.protein} · G {food.fat} (100 {food.unit})
          </div>
        </div>
      </button>
    </li>
  )
}

function Preview({ label, value, suffix = '', dotVar }: { label: string; value: number; suffix?: string; dotVar?: string }) {
  return (
    <div>
      {dotVar ? (
        <span className="mx-auto mb-1 block h-1.5 w-1.5 rounded-full" style={{ background: `var(${dotVar})` }} aria-hidden />
      ) : (
        <span className="mx-auto mb-1 block h-1.5 w-1.5" aria-hidden />
      )}
      <div className="text-lg font-bold tabular-nums">
        {Math.round(value)}
        {suffix && <span className="text-xs font-normal text-muted"> {suffix}</span>}
      </div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  )
}

function CustomFoodForm({ onCancel, onCreate }: { onCancel: () => void; onCreate: (f: Food) => void }) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')

  const valid = name.trim() && Number(kcal) >= 0 && Number(protein) >= 0 && Number(carbs) >= 0 && Number(fat) >= 0 && kcal !== ''

  const numCls =
    'w-full rounded-xl bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <div className="flex flex-1 flex-col px-5 pt-4">
      <button onClick={onCancel} className="self-start text-sm font-medium text-accent">
        ‹ Voltar
      </button>
      <h3 className="mt-3 font-semibold">Novo alimento (valores por 100 g)</h3>

      <div className="mt-4 space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do alimento" className={numCls} autoFocus />
        <input type="number" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="Calorias (kcal)" className={numCls} />
        <div className="grid grid-cols-3 gap-2">
          <input type="number" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="Hidratos g" className={numCls} />
          <input type="number" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="Proteína g" className={numCls} />
          <input type="number" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="Gordura g" className={numCls} />
        </div>
      </div>

      <button
        onClick={() =>
          onCreate({
            id: `custom-${uid()}`,
            name: name.trim(),
            emoji: '🍴',
            kcal: Number(kcal),
            protein: Number(protein) || 0,
            carbs: Number(carbs) || 0,
            fat: Number(fat) || 0,
            unit: 'g',
            custom: true,
          })
        }
        disabled={!valid}
        className="mt-auto mb-6 rounded-full bg-accent px-6 py-3.5 font-semibold text-on-accent transition-opacity active:opacity-80 disabled:opacity-40"
      >
        Guardar alimento
      </button>
    </div>
  )
}
