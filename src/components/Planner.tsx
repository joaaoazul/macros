/** Planeador semanal (almoço + jantar) → lista de compras derivada + despensa. */

import { useEffect, useMemo, useState } from 'react'
import type { Food, MealId, MealPlanEntry, PantryItem, Recipe, RecipeItem } from '../types'
import { FOOD_DB, searchFoods } from '../lib/foods'
import { searchOpenFoodFacts } from '../lib/off'
import {
  analyzePlan,
  buildShoppingList,
  extraItem,
  formatQuantity,
  PLAN_MEALS,
  shoppingListText,
  todayWeekday,
  WEEKDAYS,
  withExtras,
  type ShoppingItem,
} from '../lib/shopping'
import { analyzeMeal } from '../lib/ai'
import { defaultExpiryFor, daysUntil, expiryStatus, recipesCookableFrom, recipesToUseUp, sortByExpiry } from '../lib/pantry'
import { haptic, uid } from '../lib/store'
import { useToast } from '../lib/toast'
import LogPortionSheet from './LogPortionSheet'
import { Card } from './ui'

interface Props {
  recipes: Recipe[]
  customFoods: Food[]
  mealPlan: MealPlanEntry[]
  setMealPlan: React.Dispatch<React.SetStateAction<MealPlanEntry[]>>
  pantry: PantryItem[]
  setPantry: React.Dispatch<React.SetStateAction<PantryItem[]>>
  /** regista no diário de hoje uma refeição já planeada */
  onLog: (items: RecipeItem[], meal: MealId) => void
}

type SlotTarget = { day: number; meal: 'lunch' | 'dinner' }

export default function Planner({ recipes, customFoods, mealPlan, setMealPlan, pantry, setPantry, onLog }: Props) {
  const [slot, setSlot] = useState<SlotTarget | null>(null)
  const [logging, setLogging] = useState<{ entry: MealPlanEntry; meal: MealId } | null>(null)
  const [view, setView] = useState<'plan' | 'list' | 'pantry'>('plan')
  const today = todayWeekday()

  const notes = useMemo(() => analyzePlan(mealPlan), [mealPlan])
  const entryAt = (day: number, meal: string) => mealPlan.find((e) => e.day === day && e.meal === meal)
  const plannedCount = mealPlan.length

  /** kcal planeadas no dia (× doses) — dá para ver de relance dias leves e pesados. */
  const dayKcal = (day: number) =>
    Math.round(
      mealPlan
        .filter((e) => e.day === day)
        .reduce(
          (s, e) => s + e.items.reduce((n, i) => n + i.kcal, 0) * (e.servings > 0 ? e.servings : 1),
          0,
        ),
    )

  const clearWeek = () => {
    if (!confirm('Limpar o plano da semana toda?')) return
    haptic(20)
    setMealPlan([])
  }

  const setEntry = (day: number, meal: 'lunch' | 'dinner', entry: MealPlanEntry | null) => {
    setMealPlan((plan) => {
      const without = plan.filter((e) => !(e.day === day && e.meal === meal))
      return entry ? [...without, entry] : without
    })
  }

  const changeServings = (entry: MealPlanEntry, delta: number) => {
    const next = Math.max(1, Math.min(20, entry.servings + delta))
    haptic(10)
    setMealPlan((plan) => plan.map((e) => (e.id === entry.id ? { ...e, servings: next } : e)))
  }

  if (view === 'list') {
    return <ShoppingListView plan={mealPlan} pantry={pantry} customFoods={customFoods} onBack={() => setView('plan')} />
  }
  if (view === 'pantry') {
    return <PantryView pantry={pantry} setPantry={setPantry} recipes={recipes} customFoods={customFoods} onBack={() => setView('plan')} />
  }

  return (
    <div className="animate-fade space-y-3.5 px-4 pt-1">
      {/* barra de equilíbrio */}
      {notes.length > 0 && (
        <Card className="animate-in space-y-1.5 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Equilíbrio da semana</div>
          {notes.map((n, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span aria-hidden>{n.tone === 'good' ? '✅' : '💡'}</span>
              <span className={n.tone === 'good' ? 'text-ink-2' : 'text-ink'}>{n.text}</span>
            </div>
          ))}
        </Card>
      )}

      {/* ações */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => { haptic(10); setView('list') }}
          className="press flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
        >
          🛒 Lista de compras
        </button>
        <button
          onClick={() => setView('pantry')}
          className="press flex items-center justify-center gap-2 rounded-2xl bg-surface px-4 py-3 font-semibold text-ink-2"
        >
          🧺 Despensa
        </button>
      </div>

      {plannedCount > 0 && (
        <button
          onClick={clearWeek}
          className="press w-full text-center text-xs font-medium text-muted"
        >
          Limpar a semana
        </button>
      )}

      {plannedCount === 0 && (
        <Card className="animate-in p-6 text-center text-sm text-muted">
          Planeia os teus almoços e jantares da semana. A lista de compras aparece a partir daqui — com as
          quantidades certas para não ires ao super de mãos a abanar.
        </Card>
      )}

      {/* grelha da semana (por dia) */}
      {WEEKDAYS.map((label, day) => (
        <Card key={day} className={`animate-in overflow-hidden ${day === today ? 'ring-1 ring-accent-soft' : ''}`} >
          <div className="flex items-center justify-between px-4 pt-3">
            <span className="text-sm font-semibold">
              {label}
              {day === today && (
                <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-accent">Hoje</span>
              )}
            </span>
            {dayKcal(day) > 0 && (
              <span className="text-[11px] tabular-nums text-muted">{dayKcal(day)} kcal planeadas</span>
            )}
          </div>
          <div className="mt-1 divide-y divide-line">
            {PLAN_MEALS.map((m) => {
              const entry = entryAt(day, m.id)
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-16 shrink-0 text-xs text-muted">{m.emoji} {m.label}</span>
                  {entry ? (
                    <>
                      <button
                        onClick={() => setSlot({ day, meal: m.id })}
                        className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                      >
                        {entry.emoji} {entry.name}
                      </button>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {day === today && (
                          <button
                            onClick={() => { haptic(8); setLogging({ entry, meal: m.id }) }}
                            className="press mr-0.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent"
                            aria-label={`Registar ${m.label.toLowerCase()} planeado no diário`}
                          >
                            Registar
                          </button>
                        )}
                        <button onClick={() => changeServings(entry, -1)} className="press flex h-6 w-6 items-center justify-center rounded-full bg-bg text-sm" aria-label="Menos doses">−</button>
                        <span className="w-4 text-center text-xs font-semibold tabular-nums" aria-label={`${entry.servings} doses`}>{entry.servings}</span>
                        <button onClick={() => changeServings(entry, 1)} className="press flex h-6 w-6 items-center justify-center rounded-full bg-bg text-sm" aria-label="Mais doses">＋</button>
                        <button onClick={() => setEntry(day, m.id, null)} className="press ml-0.5 text-muted" aria-label="Remover">✕</button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => { haptic(8); setSlot({ day, meal: m.id }) }}
                      className="press flex-1 text-left text-sm text-accent"
                    >
                      ＋ Adicionar
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      ))}

      {logging && (
        <LogPortionSheet
          title={logging.entry.name}
          emoji={logging.entry.emoji}
          items={logging.entry.items}
          meal={logging.meal}
          onLog={(items, meal) => {
            onLog(items, meal)
            setLogging(null)
          }}
          onClose={() => setLogging(null)}
        />
      )}

      {slot && (
        <SlotPicker
          recipes={recipes}
          customFoods={customFoods}
          onClose={() => setSlot(null)}
          onPick={(name, emoji, items) => {
            const existing = entryAt(slot.day, slot.meal)
            setEntry(slot.day, slot.meal, {
              id: existing?.id ?? uid(),
              day: slot.day,
              meal: slot.meal,
              name,
              emoji,
              servings: existing?.servings ?? 1,
              items,
            })
            haptic(20)
            setSlot(null)
          }}
        />
      )}
    </div>
  )
}

/** Escolher receita OU alimento (com gramas) para preencher um slot. */
function SlotPicker({
  recipes,
  customFoods,
  onPick,
  onClose,
}: {
  recipes: Recipe[]
  customFoods: Food[]
  onPick: (name: string, emoji: string, items: RecipeItem[]) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [foodSel, setFoodSel] = useState<Food | null>(null)
  const [grams, setGrams] = useState('150')
  const offResults = useOffSearch(query)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiErr, setAiErr] = useState('')

  /** Descreve a refeição à IA e planeia o slot com os alimentos devolvidos. */
  const describeToAI = async () => {
    setAiBusy(true)
    setAiErr('')
    try {
      const res = await analyzeMeal({ description: query.trim() })
      if (res.foods.length === 0) {
        setAiErr('A IA não reconheceu alimentos nessa descrição.')
        return
      }
      const items: RecipeItem[] = res.foods.map((f) => ({
        foodName: f.name, emoji: f.emoji, grams: f.grams, unit: f.unit,
        kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat,
      }))
      onPick(query.trim(), res.foods[0]?.emoji ?? '🍽️', items)
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : 'Não foi possível analisar agora.')
    } finally {
      setAiBusy(false)
    }
  }

  const q = query.trim().toLowerCase()
  const matchedRecipes = recipes.filter((r) => {
    const label = r.name ?? r.items.map((i) => i.foodName).join(' ')
    return !q || label.toLowerCase().includes(q)
  })
  const foods = useMemo(() => [...customFoods, ...FOOD_DB], [customFoods])
  const matchedFoods = useMemo(() => (q.length >= 2 ? searchFoods(foods, query).slice(0, 20) : []), [foods, query, q])

  const gramsN = Number(grams)
  const factor = gramsN > 0 ? gramsN / 100 : 0

  const confirmFood = () => {
    if (!foodSel || factor <= 0) return
    const name = foodSel.brand ? `${foodSel.name} (${foodSel.brand})` : foodSel.name
    onPick(foodSel.name, foodSel.emoji, [
      {
        foodName: name, emoji: foodSel.emoji, grams: gramsN, unit: foodSel.unit,
        kcal: foodSel.kcal * factor, protein: foodSel.protein * factor,
        carbs: foodSel.carbs * factor, fat: foodSel.fat * factor,
      },
    ])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sheet-backdrop" onClick={onClose}>
      <div
        className="sheet-panel flex h-[80dvh] w-full max-w-md flex-col rounded-t-[1.75rem] bg-bg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Planear refeição"
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line" aria-hidden />
        {foodSel ? (
          <div className="flex flex-1 flex-col px-5 pt-4">
            <button onClick={() => setFoodSel(null)} className="self-start text-sm font-medium text-accent">‹ Voltar</button>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-3xl" aria-hidden>{foodSel.emoji}</span>
              <div className="font-semibold">{foodSel.name}</div>
            </div>
            <label className="mt-5 block">
              <span className="mb-1.5 block text-sm font-medium text-ink-2">Quantidade ({foodSel.unit})</span>
              <input
                type="number" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)}
                className="w-full rounded-xl bg-surface px-4 py-3 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
              />
            </label>
            <button
              onClick={confirmFood}
              disabled={factor <= 0}
              className="press mt-auto mb-6 rounded-full bg-accent px-6 py-3.5 font-semibold text-white disabled:opacity-40"
            >
              Planear
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 pt-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Procurar receita ou alimento…"
                className="w-full rounded-xl bg-surface px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
              />
            </div>
            <div className="scroll-contain mt-3 flex-1 overflow-y-auto px-5 pb-6">
              {q.length >= 3 && (
                <>
                  <button
                    onClick={() => void describeToAI()}
                    disabled={aiBusy}
                    className="press mb-2 flex w-full items-center gap-3 rounded-xl bg-accent-soft px-4 py-3 text-left disabled:opacity-60"
                  >
                    <span className="text-xl" aria-hidden>✨</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-accent">
                        {aiBusy ? 'A analisar…' : `Descrever à IA: "${query.trim()}"`}
                      </span>
                      <span className="block text-xs text-muted">A IA estima os alimentos e as macros</span>
                    </span>
                  </button>
                  {aiErr && <p className="mb-2 px-1 text-xs font-medium text-critical">{aiErr}</p>}
                </>
              )}
              {matchedRecipes.length > 0 && (
                <>
                  <div className="pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted">Receitas</div>
                  {matchedRecipes.map((r) => {
                    const label = r.name ?? r.items.map((i) => i.foodName).join(' + ')
                    return (
                      <button
                        key={r.id}
                        onClick={() => onPick(label, r.emoji, r.items)}
                        className="row-press flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface"
                      >
                        <span className="text-xl" aria-hidden>{r.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted">{r.items.length} ingredientes</div>
                        </div>
                      </button>
                    )
                  })}
                </>
              )}
              {matchedFoods.length > 0 && (
                <>
                  <div className="pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">Alimentos</div>
                  {matchedFoods.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => { setFoodSel(f); setGrams('150') }}
                      className="row-press flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface"
                    >
                      <span className="text-xl" aria-hidden>{f.emoji}</span>
                      <div className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</div>
                    </button>
                  ))}
                </>
              )}
              {offResults.length > 0 && (
                <>
                  <div className="pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">Open Food Facts</div>
                  {offResults.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => { setFoodSel(f); setGrams('150') }}
                      className="row-press flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface"
                    >
                      <span className="text-xl" aria-hidden>{f.emoji}</span>
                      <div className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</div>
                      {f.brand && <span className="shrink-0 truncate text-xs text-muted">{f.brand}</span>}
                    </button>
                  ))}
                </>
              )}
              {matchedRecipes.length === 0 && matchedFoods.length === 0 && offResults.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-muted">
                  {q ? 'Sem resultados.' : 'Escreve para procurar receitas ou alimentos.'}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Pesquisa no Open Food Facts com debounce e abort da anterior. */
function useOffSearch(query: string) {
  const [results, setResults] = useState<Food[]>([])
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const r = await searchOpenFoodFacts(q, controller.signal)
        setResults(r.slice(0, 6))
      } catch {
        /* rede/abort: fica sem sugestões OFF */
      }
    }, 450)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])
  return results
}

/** Sugestões por baixo de um campo de nome: os teus alimentos (incluindo os
 * criados por IA/importados) + base local + Open Food Facts. */
function FoodSuggest({
  query,
  customFoods,
  onPick,
}: {
  query: string
  customFoods: Food[]
  onPick: (f: Food) => void
}) {
  const foods = useMemo(() => [...customFoods, ...FOOD_DB], [customFoods])
  const local = useMemo(
    () => (query.trim().length >= 2 ? searchFoods(foods, query).slice(0, 5) : []),
    [foods, query],
  )
  const off = useOffSearch(query)
  const seen = new Set(local.map((f) => f.name.toLowerCase()))
  const merged = [...local, ...off.filter((f) => !seen.has(f.name.toLowerCase())).slice(0, 4)]
  if (merged.length === 0) return null
  return (
    <Card className="mt-2 divide-y divide-line overflow-hidden">
      {merged.map((f) => (
        <button
          key={f.id}
          onClick={() => onPick(f)}
          className="row-press flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
        >
          <span aria-hidden>{f.emoji}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span>
          {f.brand && <span className="shrink-0 truncate text-xs text-muted">{f.brand}</span>}
        </button>
      ))}
    </Card>
  )
}

const CHECKED_KEY = 'macros.shopChecked'
const EXTRAS_KEY = 'macros.shopExtra'

/** Lista de compras derivada, agrupada por corredor, com check-off e produtos OFF. */
function ShoppingListView({ plan, pantry, customFoods, onBack }: { plan: MealPlanEntry[]; pantry: PantryItem[]; customFoods: Food[]; onBack: () => void }) {
  const [extras, setExtras] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(EXTRAS_KEY) || '[]') as string[]
    } catch {
      return []
    }
  })
  const groups = useMemo(
    () => withExtras(buildShoppingList(plan, pantry), extras),
    [plan, pantry, extras],
  )
  const total = groups.reduce((s, g) => s + g.items.length, 0)
  const [checked, setChecked] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(CHECKED_KEY) || '[]') as string[])
    } catch {
      return new Set()
    }
  })
  const [finding, setFinding] = useState<ShoppingItem | null>(null)
  const [newItem, setNewItem] = useState('')
  const toast = useToast()

  const doneCount = groups.reduce(
    (s, g) => s + g.items.filter((i) => checked.has(i.key)).length,
    0,
  )

  // Os riscados são guardados por chave; quando o plano muda, as chaves antigas
  // deixam de existir e ficariam a acumular no localStorage para sempre.
  useEffect(() => {
    const live = new Set(groups.flatMap((g) => g.items.map((i) => i.key)))
    setChecked((cur) => {
      const next = new Set([...cur].filter((k) => live.has(k)))
      if (next.size === cur.size) return cur
      try {
        localStorage.setItem(CHECKED_KEY, JSON.stringify([...next]))
      } catch {
        /* cache opcional */
      }
      return next
    })
  }, [groups])

  const saveExtras = (list: string[]) => {
    setExtras(list)
    try {
      localStorage.setItem(EXTRAS_KEY, JSON.stringify(list))
    } catch {
      /* cache opcional */
    }
  }

  const addExtraNamed = (raw: string) => {
    const name = raw.trim()
    if (!name) return
    if (extras.some((e) => e.toLowerCase() === name.toLowerCase())) {
      setNewItem('')
      return
    }
    haptic(10)
    saveExtras([...extras, name])
    setNewItem('')
  }
  const addExtra = () => addExtraNamed(newItem)

  const share = async () => {
    const text = shoppingListText(groups, checked)
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        toast('Lista copiada')
      }
    } catch {
      /* o utilizador cancelou a partilha */
    }
  }

  const toggle = (key: string) => {
    haptic(10)
    setChecked((cur) => {
      const next = new Set(cur)
      next.has(key) ? next.delete(key) : next.add(key)
      try {
        localStorage.setItem(CHECKED_KEY, JSON.stringify([...next]))
      } catch {
        /* cache opcional */
      }
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-line/70 bg-surface/80 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <button onClick={onBack} className="press text-accent">‹ <span className="text-sm font-medium">Planeador</span></button>
        <div className="text-center">
          <div className="font-semibold leading-tight">Lista de compras</div>
          {total > 0 && (
            <div className="text-[11px] tabular-nums text-muted">{doneCount} de {total} na cesta</div>
          )}
        </div>
        {total > 0 ? (
          <button onClick={() => void share()} aria-label="Partilhar lista" className="press text-accent">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 16V4M8 8l4-4 4 4" />
              <path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
            </svg>
          </button>
        ) : (
          <span className="w-6" />
        )}
      </header>

      {total > 0 && (
        <div className="h-0.5 bg-line">
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${(doneCount / total) * 100}%` }}
            aria-hidden
          />
        </div>
      )}

      <div className="mx-auto w-full max-w-md flex-1 space-y-4 overflow-y-auto px-4 py-4 scroll-contain">
        {total === 0 && (
          <div className="animate-in py-16 text-center">
            <div className="text-4xl" aria-hidden>🛒</div>
            <p className="mt-3 font-semibold">Lista vazia</p>
            <p className="mt-1 text-sm text-ink-2">Planeia refeições ou adiciona recorrentes na despensa.</p>
          </div>
        )}

        {/* nem tudo o que se compra vem de uma receita */}
        <div className="flex gap-2">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addExtra()
              }
            }}
            placeholder="Juntar à lista (ex.: café)"
            maxLength={60}
            aria-label="Juntar item à lista"
            className="min-w-0 flex-1 rounded-xl bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            onClick={addExtra}
            disabled={!newItem.trim()}
            className="press shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            Juntar
          </button>
        </div>

        {newItem.trim().length >= 2 && (
          <FoodSuggest query={newItem} customFoods={customFoods} onPick={(f) => addExtraNamed(f.name)} />
        )}

        {groups.map((g) => (
          <section key={g.aisle.id} className="animate-in">
            <h3 className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{g.aisle.emoji} {g.aisle.label}</h3>
            <Card className="divide-y divide-line">
              {g.items.map((item) => {
                const on = checked.has(item.key)
                return (
                  <div key={item.key} className="flex items-center gap-3 p-3.5">
                    <button
                      onClick={() => toggle(item.key)}
                      className={`press flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-accent bg-accent text-white' : 'border-line'}`}
                      aria-label={on ? 'Desmarcar' : 'Marcar como comprado'}
                    >
                      {on && '✓'}
                    </button>
                    <button onClick={() => setFinding(item)} className="min-w-0 flex-1 text-left">
                      <div className={`truncate text-sm font-medium ${on ? 'text-muted line-through' : ''}`}>
                        {item.emoji} {item.name}
                      </div>
                      <div className="text-xs text-muted">
                        {item.grams > 0
                          ? `${formatQuantity(item.grams, item.unit)} · toca para ver produtos`
                          : 'toca para ver produtos'}
                      </div>
                    </button>
                    {item.key.startsWith('extra|') && (
                      <button
                        onClick={() => saveExtras(extras.filter((e) => extraItem(e).key !== item.key))}
                        aria-label={`Remover ${item.name}`}
                        className="press shrink-0 text-muted"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )
              })}
            </Card>
          </section>
        ))}
      </div>

      {finding && <ProductFinder item={finding} onClose={() => setFinding(null)} />}
    </div>
  )
}

/** Procura o produto no Open Food Facts e sugere nº de embalagens. */
function ProductFinder({ item, onClose }: { item: ShoppingItem; onClose: () => void }) {
  const [results, setResults] = useState<Food[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setResults(null)
    setError(false)
    searchOpenFoodFacts(item.name)
      .then((r) => !cancelled && setResults(r.slice(0, 15)))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [item.name])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sheet-backdrop" onClick={onClose}>
      <div className="sheet-panel flex h-[75dvh] w-full max-w-md flex-col rounded-t-[1.75rem] bg-bg" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line" aria-hidden />
        <div className="px-5 pt-3">
          <h2 className="text-lg font-bold">{item.emoji} {item.name}</h2>
          <p className="text-sm text-muted">Precisas de {formatQuantity(item.grams, item.unit)} · produtos à venda em Portugal</p>
        </div>
        <div className="scroll-contain mt-3 flex-1 overflow-y-auto px-5 pb-6">
          {results === null && !error && <p className="py-8 text-center text-sm text-muted">A procurar…</p>}
          {error && <p className="py-8 text-center text-sm text-muted">Não foi possível procurar produtos agora.</p>}
          {results?.length === 0 && <p className="py-8 text-center text-sm text-muted">Sem produtos — compra ~{formatQuantity(item.grams, item.unit)} a granel.</p>}
          {results?.map((f) => {
            const packs = f.packageGrams ? Math.ceil(item.grams / f.packageGrams) : null
            return (
              <div key={f.id} className="flex items-center gap-3 border-b border-line py-3">
                <span className="text-xl" aria-hidden>{f.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{f.name}</div>
                  <div className="truncate text-xs text-muted">
                    {f.brand ? `${f.brand} · ` : ''}{f.packageGrams ? `embalagem ~${formatQuantity(f.packageGrams, f.unit)}` : 'tamanho desconhecido'}
                  </div>
                </div>
                {packs && (
                  <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                    ≈ {packs} {packs === 1 ? 'embalagem' : 'embalagens'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Linha de um item em stock: chip de validade + controlo manual de quantidade. */
function StockRow({
  item,
  onChangeQty,
  onFinish,
}: {
  item: PantryItem
  onChangeQty: (item: PantryItem, delta: number) => void
  onFinish: (item: PantryItem) => void
}) {
  const status = expiryStatus(item)
  const d = daysUntil(item.expiresOn)
  const chip =
    status === 'expired'
      ? { cls: 'bg-critical/10 text-critical', label: 'expirou' }
      : status === 'soon'
        ? { cls: 'bg-fat/10 text-fat', label: d === 0 ? 'hoje' : `${d} d` }
        : { cls: 'bg-accent-soft text-accent', label: d === null ? 'sem data' : `${d} d` }
  return (
    <div className="animate-in flex items-center gap-2.5 p-3.5">
      <span aria-hidden>{item.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.name}</div>
        {item.expiresOn && <div className="text-[11px] tabular-nums text-muted">{item.expiresOn}</div>}
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${chip.cls}`}>
        {chip.label}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        <button onClick={() => onChangeQty(item, -1)} className="press flex h-6 w-6 items-center justify-center rounded-full bg-bg text-sm" aria-label="Menos um">−</button>
        <span className="w-4 text-center text-xs font-semibold tabular-nums">{item.qty ?? 1}</span>
        <button onClick={() => onChangeQty(item, 1)} className="press flex h-6 w-6 items-center justify-center rounded-full bg-bg text-sm" aria-label="Mais um">＋</button>
        <button onClick={() => onFinish(item)} className="press ml-0.5 text-[11px] font-semibold text-muted" aria-label={`${item.name} acabou`}>
          Acabou
        </button>
      </div>
    </div>
  )
}

/** Gestão da despensa: stock com validades, "tenho sempre" (excluir) e recorrentes (juntar sempre). */
function PantryView({
  pantry,
  setPantry,
  recipes,
  customFoods,
  onBack,
}: {
  pantry: PantryItem[]
  setPantry: React.Dispatch<React.SetStateAction<PantryItem[]>>
  recipes: Recipe[]
  customFoods: Food[]
  onBack: () => void
}) {
  const [tab, setTab] = useState<'stock' | 'have' | 'recurring'>('stock')
  const [name, setName] = useState('')
  const [pickedEmoji, setPickedEmoji] = useState('')
  const [grams, setGrams] = useState('')
  const [qty, setQty] = useState('1')
  const [expiresOn, setExpiresOn] = useState('')
  const toast = useToast()

  const items = tab === 'stock' ? sortByExpiry(pantry.filter((p) => p.kind === 'stock')) : pantry.filter((p) => p.kind === tab)

  const expiring = useMemo(
    () => pantry.filter((p) => p.kind === 'stock' && expiryStatus(p) !== 'ok'),
    [pantry],
  )
  const suggestions = useMemo(
    () => recipesToUseUp(expiring.map((p) => p.name), recipes, 3),
    [expiring, recipes],
  )
  const cookable = useMemo(
    () =>
      recipesCookableFrom(
        pantry.filter((p) => p.kind === 'stock').map((p) => p.name),
        recipes,
        3,
      ),
    [pantry, recipes],
  )

  const add = () => {
    const n = name.trim()
    if (!n) return
    haptic(15)
    const item: PantryItem =
      tab === 'have'
        ? { id: uid(), kind: 'have', name: n, emoji: pickedEmoji || '✅' }
        : tab === 'recurring'
          ? { id: uid(), kind: 'recurring', name: n, emoji: pickedEmoji || '🔁', grams: Number(grams) > 0 ? Number(grams) : 500, unit: 'g' }
          : {
              id: uid(), kind: 'stock', name: n, emoji: pickedEmoji || '🧺',
              qty: Number(qty) > 0 ? Number(qty) : 1,
              // sem data escolhida, sugere um prazo típico pelo nome (sempre editável depois de ver)
              expiresOn: expiresOn || defaultExpiryFor(n),
            }
    setPantry((p) => [...p, item])
    setName('')
    setPickedEmoji('')
    setGrams('')
    setQty('1')
    setExpiresOn('')
  }

  const remove = (id: string) => setPantry((p) => p.filter((x) => x.id !== id))

  const changeQty = (it: PantryItem, delta: number) => {
    haptic(10)
    const next = Math.max(0, (it.qty ?? 1) + delta)
    if (next === 0) return finish(it)
    setPantry((p) => p.map((x) => (x.id === it.id ? { ...x, qty: next } : x)))
  }

  /** "Acabou": sai do stock e, se quiseres, volta já para a lista de compras. */
  const finish = (it: PantryItem) => {
    haptic(15)
    remove(it.id)
    if (confirm(`Juntar "${it.name}" à lista de compras?`)) {
      try {
        const extras = JSON.parse(localStorage.getItem(EXTRAS_KEY) || '[]') as string[]
        if (!extras.some((e) => e.toLowerCase() === it.name.toLowerCase())) {
          localStorage.setItem(EXTRAS_KEY, JSON.stringify([...extras, it.name]))
        }
        toast('Na lista de compras')
      } catch {
        /* cache opcional */
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <header className="flex items-center gap-3 border-b border-line/70 bg-surface/80 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <button onClick={onBack} className="press text-accent">‹ <span className="text-sm font-medium">Planeador</span></button>
        <div className="font-semibold">Despensa</div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 space-y-4 overflow-y-auto px-4 py-4 scroll-contain">
        <div className="relative flex rounded-xl bg-surface p-1">
          <div
            className="absolute inset-y-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-accent-soft transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ transform: `translateX(${tab === 'stock' ? 0 : tab === 'have' ? 100 : 200}%)` }}
            aria-hidden
          />
          {(['stock', 'have', 'recurring'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`relative z-10 flex-1 rounded-lg py-1.5 text-[13px] font-semibold transition-colors ${tab === k ? 'text-accent' : 'text-muted'}`}
            >
              {k === 'stock' ? 'Em stock' : k === 'have' ? 'Tenho sempre' : 'Recorrentes'}
            </button>
          ))}
        </div>

        <p className="px-1 text-sm text-ink-2">
          {tab === 'stock'
            ? 'O que tens em casa agora, com validade. Avisamos antes que estrague — e sugerimos receitas para usar.'
            : tab === 'have'
              ? 'Coisas que tens sempre em casa (sal, azeite…). Nunca entram na lista de compras.'
              : 'Compras de todas as semanas fora do plano (aveia, ovos, fruta…). Juntam-se sempre à lista.'}
        </p>

        {tab === 'stock' && suggestions.length > 0 && (
          <Card className="animate-in space-y-2 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              🍳 Cozinha isto antes que estrague
            </div>
            {suggestions.map((r) => {
              const label = r.name ?? r.items.map((i) => i.foodName).join(' + ')
              return (
                <div key={r.id} className="flex items-center gap-2.5 text-sm">
                  <span aria-hidden>{r.emoji}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
                </div>
              )
            })}
            <p className="text-xs text-muted">
              Usam {expiring.map((p) => p.name).slice(0, 3).join(', ')}{expiring.length > 3 ? '…' : ''} — regista-as nas Receitas.
            </p>
          </Card>
        )}

        {tab === 'stock' && cookable.length > 0 && (
          <Card className="animate-in space-y-2 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              🥘 Podes cozinhar com o que tens
            </div>
            {cookable.map(({ recipe: r, have, total }) => {
              const label = r.name ?? r.items.map((i) => i.foodName).join(' + ')
              return (
                <div key={r.id} className="flex items-center gap-2.5 text-sm">
                  <span aria-hidden>{r.emoji}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
                  <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold tabular-nums text-accent">
                    {have}/{total}
                  </span>
                </div>
              )
            })}
          </Card>
        )}

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setPickedEmoji('')
              }}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder={tab === 'have' ? 'ex.: Azeite' : tab === 'recurring' ? 'ex.: Aveia' : 'ex.: Frango'}
              className="min-w-0 flex-1 rounded-xl bg-bg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {tab === 'recurring' && (
              <div className="flex items-center gap-1">
                <input
                  type="number" inputMode="numeric" value={grams} onChange={(e) => setGrams(e.target.value)}
                  placeholder="500" className="w-16 rounded-xl bg-bg px-2 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <span className="text-xs text-muted">g</span>
              </div>
            )}
            {tab === 'stock' && (
              <input
                type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(e.target.value)}
                aria-label="Quantidade"
                className="w-14 rounded-xl bg-bg px-2 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-accent"
              />
            )}
            <button onClick={add} disabled={!name.trim()} className="press shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              Juntar
            </button>
          </div>
          {!pickedEmoji && name.trim().length >= 2 && (
            <FoodSuggest
              query={name}
              customFoods={customFoods}
              onPick={(f) => {
                setName(f.name)
                setPickedEmoji(f.emoji)
              }}
            />
          )}
          {tab === 'stock' && (
            <label className="mt-2 flex items-center gap-2 px-0.5">
              <span className="text-xs text-muted">Validade</span>
              <input
                type="date"
                value={expiresOn}
                onChange={(e) => setExpiresOn(e.target.value)}
                aria-label="Data de validade"
                className="flex-1 rounded-xl bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {!expiresOn && name.trim() && (
                <span className="text-xs text-muted">sugestão: {defaultExpiryFor(name.trim()).slice(5)}</span>
              )}
            </label>
          )}
        </Card>

        {items.length > 0 ? (
          <Card className="divide-y divide-line">
            {items.map((it) =>
              it.kind === 'stock' ? (
                <StockRow key={it.id} item={it} onChangeQty={changeQty} onFinish={finish} />
              ) : (
                <div key={it.id} className="animate-in flex items-center gap-3 p-3.5">
                  <span aria-hidden>{it.emoji}</span>
                  <div className="min-w-0 flex-1 truncate text-sm font-medium">{it.name}</div>
                  {it.kind === 'recurring' && it.grams != null && (
                    <span className="shrink-0 text-xs text-muted">{formatQuantity(it.grams, it.unit || 'g')}</span>
                  )}
                  <button onClick={() => remove(it.id)} className="press text-muted" aria-label={`Remover ${it.name}`}>✕</button>
                </div>
              ),
            )}
          </Card>
        ) : (
          <p className="px-1 py-6 text-center text-sm text-muted">Ainda nada aqui.</p>
        )}
      </div>
    </div>
  )
}
