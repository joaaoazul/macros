import { useMemo, useState } from 'react'
import type { Entry, Food, MealId } from '../types'
import { MEALS } from '../types'
import { FOOD_DB, searchFoods } from '../lib/foods'
import { uid } from '../lib/store'

interface Props {
  meal: MealId
  customFoods: Food[]
  setCustomFoods: React.Dispatch<React.SetStateAction<Food[]>>
  onAdd: (entry: Entry) => void
  onClose: () => void
}

export default function AddFoodSheet({ meal, customFoods, setCustomFoods, onAdd, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [grams, setGrams] = useState('100')
  const [creating, setCreating] = useState(false)

  const allFoods = useMemo(() => [...customFoods, ...FOOD_DB], [customFoods])
  const results = useMemo(() => searchFoods(allFoods, query), [allFoods, query])

  const gramsN = Number(grams)
  const factor = gramsN > 0 ? gramsN / 100 : 0

  const confirm = () => {
    if (!selected || factor <= 0) return
    onAdd({
      id: uid(),
      meal,
      foodName: selected.name,
      emoji: selected.emoji,
      grams: gramsN,
      unit: selected.unit,
      kcal: selected.kcal * factor,
      protein: selected.protein * factor,
      carbs: selected.carbs * factor,
      fat: selected.fat * factor,
    })
  }

  const mealLabel = MEALS.find((m) => m.id === meal)?.label ?? ''

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="flex h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-bg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Adicionar alimento ao ${mealLabel}`}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" aria-hidden />

        <header className="flex items-center justify-between px-5 pt-3">
          <h2 className="text-lg font-bold">Adicionar ao {mealLabel}</h2>
          <button onClick={onClose} className="rounded-full px-2 py-1 text-muted" aria-label="Fechar">
            ✕
          </button>
        </header>

        {!selected && !creating && (
          <>
            <div className="px-5 pt-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar alimento…"
                className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                autoFocus
              />
            </div>

            <ul className="mt-3 flex-1 overflow-y-auto px-5 pb-5">
              {results.map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => {
                      setSelected(f)
                      setGrams('100')
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface"
                  >
                    <span className="text-xl" aria-hidden>
                      {f.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {f.name}
                        {f.custom && <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">meu</span>}
                      </div>
                      <div className="text-xs text-muted">
                        {f.kcal} kcal · P {f.protein} · H {f.carbs} · G {f.fat} (100 {f.unit})
                      </div>
                    </div>
                  </button>
                </li>
              ))}
              {results.length === 0 && <li className="py-8 text-center text-sm text-muted">Nenhum resultado para “{query}”.</li>}
              <li className="mt-2">
                <button
                  onClick={() => setCreating(true)}
                  className="w-full rounded-xl border border-dashed border-line px-4 py-3 text-sm font-medium text-accent"
                >
                  + Criar alimento personalizado
                </button>
              </li>
            </ul>
          </>
        )}

        {selected && (
          <div className="flex flex-1 flex-col px-5 pt-4">
            <button onClick={() => setSelected(null)} className="self-start text-sm font-medium text-accent">
              ‹ Voltar à pesquisa
            </button>

            <div className="mt-4 flex items-center gap-3">
              <span className="text-3xl" aria-hidden>
                {selected.emoji}
              </span>
              <div>
                <div className="font-semibold">{selected.name}</div>
                <div className="text-xs text-muted">valores por 100 {selected.unit}</div>
              </div>
            </div>

            <label className="mt-6 block">
              <span className="mb-1.5 block text-sm font-medium text-ink-2">Quantidade ({selected.unit})</span>
              <input
                type="number"
                inputMode="decimal"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-2xl font-bold focus:border-accent focus:outline-none"
                autoFocus
              />
            </label>

            <div className="mt-3 flex gap-2">
              {[50, 100, 150, 200].map((g) => (
                <button
                  key={g}
                  onClick={() => setGrams(String(g))}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium ${
                    grams === String(g) ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink-2'
                  }`}
                >
                  {g} {selected.unit}
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2 rounded-2xl border border-line bg-surface p-4 text-center">
              <Preview label="kcal" value={selected.kcal * factor} />
              <Preview label="Proteína" value={selected.protein * factor} suffix="g" dotVar="--protein" />
              <Preview label="Hidratos" value={selected.carbs * factor} suffix="g" dotVar="--carbs" />
              <Preview label="Gordura" value={selected.fat * factor} suffix="g" dotVar="--fat" />
            </div>

            <button
              onClick={confirm}
              disabled={factor <= 0}
              className="mt-auto mb-6 rounded-xl bg-accent px-6 py-3.5 font-semibold text-white disabled:opacity-40"
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
              setSelected(food)
              setGrams('100')
            }}
          />
        )}
      </div>
    </div>
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
    'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:border-accent focus:outline-none'

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
          <input type="number" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="Proteína g" className={numCls} />
          <input type="number" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="Hidratos g" className={numCls} />
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
        className="mt-auto mb-6 rounded-xl bg-accent px-6 py-3.5 font-semibold text-white disabled:opacity-40"
      >
        Guardar alimento
      </button>
    </div>
  )
}
