/** Planeador semanal (almoço + jantar) → lista de compras derivada + despensa. */

import { useEffect, useMemo, useState } from 'react'
import type { Diary, Food, MealId, MealPlanEntry, PantryItem, Recipe, RecipeItem } from '../types'
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
  WEEKDAYS_SHORT,
  withExtras,
  type ShoppingItem,
} from '../lib/shopping'
import { analyzeMeal } from '../lib/ai'
import { defaultExpiryFor, daysUntil, expiryStatus, recipesCookableFrom, recipesToUseUp, sortByExpiry } from '../lib/pantry'
import { haptic, uid } from '../lib/store'
import type { ShoppingList } from '../lib/sync'
import { useToast } from '../lib/toast'
import { placeInSlots, recipeLabel, suggestedForMeal, type PlanMeal, type SlotTarget } from '../lib/planner'
import LogPortionSheet from './LogPortionSheet'
import PantryPhotoSheet from './PantryPhotoSheet'
import PlanTargetSheet from './PlanTargetSheet'
import { Button, Card, ConfirmSheet, EmptyState, ScreenHeader, SegmentedControl, Stepper, Z } from './ui'

interface Props {
  recipes: Recipe[]
  customFoods: Food[]
  /** só de leitura: alimenta as sugestões "do costume" do picker */
  diary: Diary
  mealPlan: MealPlanEntry[]
  setMealPlan: React.Dispatch<React.SetStateAction<MealPlanEntry[]>>
  pantry: PantryItem[]
  setPantry: React.Dispatch<React.SetStateAction<PantryItem[]>>
  shoppingList: ShoppingList
  setShoppingList: React.Dispatch<React.SetStateAction<ShoppingList>>
  /** regista no diário de hoje uma refeição já planeada */
  onLog: (items: RecipeItem[], meal: MealId) => void
}

export default function Planner({ recipes, customFoods, diary, mealPlan, setMealPlan, pantry, setPantry, shoppingList, setShoppingList, onLog }: Props) {
  const [slot, setSlot] = useState<SlotTarget | null>(null)
  const [logging, setLogging] = useState<{ entry: MealPlanEntry; meal: MealId } | null>(null)
  const [editing, setEditing] = useState<{ entry: MealPlanEntry; meal: PlanMeal } | null>(null)
  const [copying, setCopying] = useState<{ entry: MealPlanEntry; meal: PlanMeal } | null>(null)
  const [view, setView] = useState<'plan' | 'list' | 'pantry'>('plan')
  const [confirmClear, setConfirmClear] = useState(false)
  const today = todayWeekday()
  const toast = useToast()

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
    haptic(20)
    setMealPlan([])
    setConfirmClear(false)
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

  // A lista e a despensa são ecrãs cheios renderizados como IRMÃOS da grelha,
  // não early-returns: assim a semana continua montada por baixo e a posição do
  // scroll sobrevive à ida e volta ao supermercado.
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
        <Button onClick={() => { haptic(10); setView('list') }}>🛒 Lista de compras</Button>
        <Button variant="ghost" onClick={() => setView('pantry')}>🧺 Despensa</Button>
      </div>

      {plannedCount > 0 && (
        <button
          onClick={() => setConfirmClear(true)}
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

      {/* semana compacta: os 7 dias de relance, sem scroll */}
      <Card className="animate-in overflow-hidden">
        {WEEKDAYS_SHORT.map((label, day) => (
          <div
            key={day}
            className={`hairline-b flex items-center gap-1.5 px-3 py-1.5 last:border-b-0 ${
              day === today ? 'bg-accent-soft/40' : ''
            }`}
          >
            <span className={`w-9 shrink-0 text-[13px] font-semibold ${day === today ? 'text-accent' : 'text-ink-2'}`}>
              {label}
            </span>
            {PLAN_MEALS.map((m) => {
              const entry = entryAt(day, m.id)
              return entry ? (
                <button
                  key={m.id}
                  onClick={() => { haptic(8); setEditing({ entry, meal: m.id }) }}
                  className="row-press min-w-0 flex-1 truncate rounded-lg px-1.5 py-1.5 text-left text-[13px] font-medium"
                  aria-label={`${m.label} de ${WEEKDAYS[day]}: ${entry.name}`}
                >
                  <span aria-hidden>{entry.emoji} </span>
                  {entry.name}
                  {entry.servings > 1 && <span className="text-muted"> ×{entry.servings}</span>}
                </button>
              ) : (
                <button
                  key={m.id}
                  onClick={() => { haptic(8); setSlot({ day, meal: m.id }) }}
                  className="row-press min-w-0 flex-1 rounded-lg px-1.5 py-1.5 text-left text-[13px] text-muted"
                  aria-label={`Planear ${m.label.toLowerCase()} de ${WEEKDAYS[day]}`}
                >
                  ＋ <span className="text-[11px]">{m.label}</span>
                </button>
              )
            })}
            <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted">
              {dayKcal(day) > 0 ? dayKcal(day) : ''}
            </span>
          </div>
        ))}
      </Card>

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
          suggested={suggestedForMeal(recipes, mealPlan, diary, slot.meal)}
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

      {confirmClear && (
        <ConfirmSheet
          title="Limpar a semana toda?"
          body="Apaga as refeições planeadas dos sete dias. A lista de compras passa a refletir isso."
          confirmLabel="Limpar a semana"
          destructive
          onConfirm={clearWeek}
          onClose={() => setConfirmClear(false)}
        />
      )}

      {editing && (
        <EntrySheet
          entry={editing.entry}
          meal={editing.meal}
          isToday={editing.entry.day === today}
          onServings={(delta) => changeServings(editing.entry, delta)}
          onLog={() => { setLogging({ entry: editing.entry, meal: editing.meal }); setEditing(null) }}
          onCopy={() => { setCopying(editing); setEditing(null) }}
          onSwap={() => { setSlot({ day: editing.entry.day, meal: editing.meal }); setEditing(null) }}
          onRemove={() => { setEntry(editing.entry.day, editing.meal, null); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}

      {copying && (
        <PlanTargetSheet
          title={copying.entry.name}
          emoji={copying.entry.emoji}
          exclude={{ day: copying.entry.day, meal: copying.meal }}
          occupied={(d, m) => entryAt(d, m) !== undefined}
          onClose={() => setCopying(null)}
          onConfirm={(targets) => {
            setMealPlan((plan) => placeInSlots(plan, copying.entry, targets, uid))
            haptic(20)
            toast(targets.length === 1 ? 'Copiado para 1 dia' : `Copiado para ${targets.length} refeições`)
            setCopying(null)
          }}
        />
      )}

      {view === 'list' && (
        <ShoppingListView
          plan={mealPlan}
          pantry={pantry}
          customFoods={customFoods}
          shoppingList={shoppingList}
          setShoppingList={setShoppingList}
          onBack={() => setView('plan')}
        />
      )}
      {view === 'pantry' && (
        <PantryView
          pantry={pantry}
          setPantry={setPantry}
          recipes={recipes}
          customFoods={customFoods}
          setShoppingList={setShoppingList}
          setMealPlan={setMealPlan}
          onBack={() => setView('plan')}
        />
      )}
    </div>
  )
}

/** Ações de uma refeição já planeada.
 *
 * Antes viviam espremidas na linha da grelha (registar + doses + remover em
 * ~30 px), o que impedia a semana de caber num ecrã. Agora a linha só mostra
 * o prato e as ações abrem aqui, com espaço para o "copiar para outros dias". */
function EntrySheet({
  entry,
  meal,
  isToday,
  onServings,
  onLog,
  onCopy,
  onSwap,
  onRemove,
  onClose,
}: {
  entry: MealPlanEntry
  meal: PlanMeal
  isToday: boolean
  onServings: (delta: number) => void
  onLog: () => void
  onCopy: () => void
  onSwap: () => void
  onRemove: () => void
  onClose: () => void
}) {
  const mealLabel = PLAN_MEALS.find((m) => m.id === meal)?.label ?? ''
  const kcal = Math.round(entry.items.reduce((s, i) => s + i.kcal, 0) * (entry.servings || 1))
  return (
    <div className={`fixed inset-0 ${Z.modal} flex items-end justify-center bg-black/40 sheet-backdrop`} onClick={onClose}>
      <div
        className="sheet-panel w-full max-w-md rounded-t-[1.75rem] bg-bg px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Ações de ${entry.name}`}
      >
        <h2 className="truncate text-lg font-bold">
          <span aria-hidden>{entry.emoji} </span>
          {entry.name}
        </h2>
        <p className="text-sm text-muted">
          {WEEKDAYS[entry.day]} · {mealLabel} · {kcal} kcal
        </p>

        <div className="mt-4 flex items-center justify-between rounded-card bg-surface px-4 py-3">
          <span className="text-sm font-medium">Doses a cozinhar</span>
          <Stepper value={entry.servings} onChange={onServings} label="doses" />
        </div>

        <div className="mt-3 space-y-2">
          {isToday && (
            <Button full size="lg" onClick={onLog}>
              Registar no diário
            </Button>
          )}
          <Button full size="lg" variant="secondary" onClick={onCopy}>
            Copiar para outros dias
          </Button>
          <Button full size="lg" variant="ghost" onClick={onSwap}>
            Trocar de prato
          </Button>
          <Button full size="lg" variant="danger" onClick={onRemove}>
            Remover do plano
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Escolher receita OU alimento (com gramas) para preencher um slot. */
function SlotPicker({
  recipes,
  customFoods,
  suggested,
  onPick,
  onClose,
}: {
  /** receitas que costumas usar nesta refeição, mostradas com a pesquisa vazia */
  suggested: Recipe[]
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
    <div className={`fixed inset-0 ${Z.sheet} flex items-end justify-center bg-black/40 sheet-backdrop`} onClick={onClose}>
      <div
        className="sheet-panel flex h-[80dvh] w-full max-w-md flex-col rounded-t-[1.75rem] bg-bg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Planear refeição"
      >
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
            <div className="px-5 pt-4">
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
              {!q && suggested.length > 0 && (
                <>
                  <div className="pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted">Do costume</div>
                  {suggested.map((r) => (
                    <button
                      key={`sug-${r.id}`}
                      onClick={() => onPick(recipeLabel(r), r.emoji, r.items)}
                      className="row-press flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface"
                    >
                      <span className="text-xl" aria-hidden>{r.emoji}</span>
                      <div className="min-w-0 flex-1 truncate text-sm font-medium">{recipeLabel(r)}</div>
                    </button>
                  ))}
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

/** Lista de compras derivada, agrupada por corredor, com check-off e produtos OFF. */
function ShoppingListView({
  plan,
  pantry,
  customFoods,
  shoppingList,
  setShoppingList,
  onBack,
}: {
  plan: MealPlanEntry[]
  pantry: PantryItem[]
  customFoods: Food[]
  shoppingList: ShoppingList
  setShoppingList: React.Dispatch<React.SetStateAction<ShoppingList>>
  onBack: () => void
}) {
  const extras = shoppingList.extras
  const groups = useMemo(
    () => withExtras(buildShoppingList(plan, pantry), extras),
    [plan, pantry, extras],
  )
  const total = groups.reduce((s, g) => s + g.items.length, 0)
  const checked = useMemo(() => new Set(shoppingList.checked), [shoppingList.checked])
  const [finding, setFinding] = useState<ShoppingItem | null>(null)
  const [newItem, setNewItem] = useState('')
  const toast = useToast()

  const doneCount = groups.reduce(
    (s, g) => s + g.items.filter((i) => checked.has(i.key)).length,
    0,
  )

  // Os riscados são guardados por chave; quando o plano muda, as chaves antigas
  // deixam de existir e ficariam a acumular para sempre. Só escreve quando há
  // mesmo o que podar, senão cada mudança de plano dava um PUT à toa.
  useEffect(() => {
    const live = new Set(groups.flatMap((g) => g.items.map((i) => i.key)))
    setShoppingList((cur) => {
      const next = cur.checked.filter((k) => live.has(k))
      return next.length === cur.checked.length ? cur : { ...cur, checked: next }
    })
  }, [groups, setShoppingList])

  const addExtraNamed = (raw: string) => {
    const name = raw.trim()
    if (!name) return
    if (extras.some((e) => e.toLowerCase() === name.toLowerCase())) {
      setNewItem('')
      return
    }
    haptic(10)
    setShoppingList((cur) => ({ ...cur, extras: [...cur.extras, name] }))
    setNewItem('')
  }
  const addExtra = () => addExtraNamed(newItem)

  const removeExtra = (key: string) =>
    setShoppingList((cur) => ({ ...cur, extras: cur.extras.filter((e) => extraItem(e).key !== key) }))

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
    setShoppingList((cur) => ({
      ...cur,
      checked: cur.checked.includes(key)
        ? cur.checked.filter((k) => k !== key)
        : [...cur.checked, key],
    }))
  }

  return (
    <div className={`fixed inset-0 ${Z.screen} flex flex-col bg-bg`}>
      <ScreenHeader
        backLabel="Planeador"
        onBack={onBack}
        title="Lista de compras"
        subtitle={total > 0 ? `${doneCount} de ${total} na cesta` : undefined}
        right={
          total > 0 ? (
            <button onClick={() => void share()} aria-label="Partilhar lista" className="press text-accent">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 16V4M8 8l4-4 4 4" />
                <path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
              </svg>
            </button>
          ) : undefined
        }
      />

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
          <EmptyState
            emoji="🛒"
            title="Lista vazia"
            hint="Planeia refeições ou adiciona recorrentes na despensa."
          />
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
                        onClick={() => removeExtra(item.key)}
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
    <div className={`fixed inset-0 ${Z.modal} flex items-end justify-center bg-black/40 sheet-backdrop`} onClick={onClose}>
      <div className="sheet-panel flex h-[75dvh] w-full max-w-md flex-col rounded-t-[1.75rem] bg-bg" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="px-5 pt-4">
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
      <Stepper value={item.qty ?? 1} onChange={(d) => onChangeQty(item, d)} label={`de ${item.name}`} />
      <button onClick={() => onFinish(item)} className="press ml-0.5 shrink-0 text-[11px] font-semibold text-muted" aria-label={`${item.name} acabou`}>
        Acabou
      </button>
    </div>
  )
}

/** Gestão da despensa: stock com validades, "tenho sempre" (excluir) e recorrentes (juntar sempre). */
function PantryView({
  pantry,
  setPantry,
  recipes,
  customFoods,
  setShoppingList,
  setMealPlan,
  onBack,
}: {
  pantry: PantryItem[]
  setPantry: React.Dispatch<React.SetStateAction<PantryItem[]>>
  recipes: Recipe[]
  customFoods: Food[]
  setShoppingList: React.Dispatch<React.SetStateAction<ShoppingList>>
  setMealPlan: React.Dispatch<React.SetStateAction<MealPlanEntry[]>>
  onBack: () => void
}) {
  const [tab, setTab] = useState<'stock' | 'have' | 'recurring'>('stock')
  const [name, setName] = useState('')
  const [pickedEmoji, setPickedEmoji] = useState('')
  const [grams, setGrams] = useState('')
  const [qty, setQty] = useState('1')
  const [expiresOn, setExpiresOn] = useState('')
  const [photoSheet, setPhotoSheet] = useState(false)
  const [finished, setFinished] = useState<PantryItem | null>(null)
  const [planning, setPlanning] = useState<Recipe | null>(null)
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

  /** Junta itens vindos da foto. Fotografar o frigorífico outra vez não deve
   * duplicar linhas: o que já lá está soma quantidade e fica com a validade
   * mais curta das duas (a que interessa avisar). */
  const addStock = (items: PantryItem[]) =>
    setPantry((p) => {
      const next = [...p]
      for (const it of items) {
        const i = next.findIndex(
          (x) => x.kind === 'stock' && x.name.toLowerCase() === it.name.toLowerCase(),
        )
        if (i === -1) {
          next.push(it)
          continue
        }
        const cur = next[i]
        const earliest =
          cur.expiresOn && it.expiresOn
            ? cur.expiresOn < it.expiresOn
              ? cur.expiresOn
              : it.expiresOn
            : cur.expiresOn || it.expiresOn
        next[i] = { ...cur, qty: (cur.qty ?? 1) + (it.qty ?? 1), expiresOn: earliest }
      }
      return next
    })

  const changeQty = (it: PantryItem, delta: number) => {
    haptic(10)
    const next = Math.max(0, (it.qty ?? 1) + delta)
    if (next === 0) return finish(it)
    setPantry((p) => p.map((x) => (x.id === it.id ? { ...x, qty: next } : x)))
  }

  /** "Acabou": sai do stock e pergunta se volta já para a lista de compras. */
  const finish = (it: PantryItem) => {
    haptic(15)
    remove(it.id)
    setFinished(it)
  }

  const addFinishedToList = () => {
    const it = finished
    if (it) {
      setShoppingList((cur) =>
        cur.extras.some((e) => e.toLowerCase() === it.name.toLowerCase())
          ? cur
          : { ...cur, extras: [...cur.extras, it.name] },
      )
      toast('Na lista de compras')
    }
    setFinished(null)
  }

  return (
    <div className={`fixed inset-0 ${Z.screen} flex flex-col bg-bg`}>
      <ScreenHeader backLabel="Planeador" onBack={onBack} title="Despensa" />

      <div className="mx-auto w-full max-w-md flex-1 space-y-4 overflow-y-auto px-4 py-4 scroll-contain">
        <SegmentedControl
          options={[
            { id: 'stock' as const, label: 'Em stock' },
            { id: 'have' as const, label: 'Tenho sempre' },
            { id: 'recurring' as const, label: 'Recorrentes' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'stock' && (
          <button
            onClick={() => { haptic(10); setPhotoSheet(true) }}
            className="press flex w-full items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-left"
          >
            <span className="text-xl" aria-hidden>📸</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-accent">Encher com uma foto</span>
              <span className="block text-xs text-muted">Fotografa o frigorífico e enchemos a lista</span>
            </span>
          </button>
        )}

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
                <button
                  key={r.id}
                  onClick={() => setPlanning(r)}
                  className="row-press -mx-1 flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left text-sm"
                >
                  <span aria-hidden>{r.emoji}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
                  <span className="shrink-0 text-[11px] font-semibold text-accent">Planear</span>
                </button>
              )
            })}
            <p className="text-xs text-muted">
              Usam {expiring.map((p) => p.name).slice(0, 3).join(', ')}{expiring.length > 3 ? '…' : ''}.
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
                className="min-w-0 flex-1 rounded-xl bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
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

      {finished && (
        <ConfirmSheet
          title={`"${finished.name}" acabou`}
          body="Queres juntá-lo já à lista de compras?"
          confirmLabel="Juntar à lista"
          onConfirm={addFinishedToList}
          onClose={() => setFinished(null)}
        />
      )}

      {planning && (
        <PlanTargetSheet
          title={recipeLabel(planning)}
          emoji={planning.emoji}
          occupied={() => false}
          onClose={() => setPlanning(null)}
          onConfirm={(targets) => {
            setMealPlan((plan) =>
              placeInSlots(
                plan,
                { name: recipeLabel(planning), emoji: planning.emoji, items: planning.items },
                targets,
                uid,
              ),
            )
            toast(targets.length === 1 ? 'Planeado para 1 refeição' : `Planeado para ${targets.length} refeições`)
            setPlanning(null)
          }}
        />
      )}

      {photoSheet && (
        <PantryPhotoSheet
          onAdd={(items) => {
            addStock(items)
            setPhotoSheet(false)
            toast(`${items.length} ${items.length === 1 ? 'item' : 'itens'} na despensa`)
          }}
          onClose={() => setPhotoSheet(false)}
        />
      )}
    </div>
  )
}
