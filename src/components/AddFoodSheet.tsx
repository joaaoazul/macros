import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { Entry, Food, MealId, Portion, Recipe, RecipeItem } from '../types'
import { MEALS } from '../types'
import { FOOD_DB, searchFoods, topFoodsForMeal } from '../lib/foods'
import { searchOpenFoodFacts } from '../lib/off'
import {
  entryFromRecipeItem,
  findByItems,
  itemsFromScraped,
  recipeKcal,
  rememberCombo,
  saveAsNamed,
} from '../lib/recipes'
import { foodScraper } from '../lib/social'
import { uid } from '../lib/store'
import { useToast } from '../lib/toast'
import RestaurantSheet from './RestaurantSheet'
import { Z } from './ui'

const BarcodeScanner = lazy(() => import('./BarcodeScanner'))
const AiMealAnalysis = lazy(() => import('./AiMealAnalysis'))
const FoodCard = lazy(() => import('./FoodCard'))

interface Props {
  meal: MealId
  customFoods: Food[]
  setCustomFoods: React.Dispatch<React.SetStateAction<Food[]>>
  recipes: Recipe[]
  setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>
  /** frequência de uso por alimento, para ordenar a pesquisa */
  usage?: Map<string, number>
  /** frequência por refeição, para sugerir o costume desta refeição */
  mealUsage?: Map<string, Map<string, number>>
  /** pesquisa pré-preenchida (ex.: link partilhado de outra app) */
  initialQuery?: string
  /** foto partilhada de outra app: abre logo a análise por IA */
  initialPhoto?: File | null
  onAdd: (entry: Entry) => void
  onClose: () => void
}

type OffState = { status: 'idle' | 'loading' | 'done' | 'error'; results: Food[] }
type QtyMode = 'unit' | 'portion'

export default function AddFoodSheet({ meal, customFoods, setCustomFoods, recipes, setRecipes, usage, mealUsage, initialQuery = '', initialPhoto = null, onAdd, onClose }: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [selected, setSelected] = useState<Food | null>(null)
  const [qty, setQty] = useState('100')
  const [mode, setMode] = useState<QtyMode>('unit')
  const [portionIdx, setPortionIdx] = useState(0)
  const [creating, setCreating] = useState(false)
  const [off, setOff] = useState<OffState>({ status: 'idle', results: [] })
  const [scanning, setScanning] = useState(false)
  const [analyzing, setAnalyzing] = useState(!!initialPhoto)
  const [cameraMenu, setCameraMenu] = useState(false)
  const [cart, setCart] = useState<RecipeItem[]>([])
  const [naming, setNaming] = useState(false)
  const [detail, setDetail] = useState<Food | null>(null)
  const [scrapePrefill, setScrapePrefill] = useState<Food | null>(null)
  const [scraping, setScraping] = useState(false)
  const [scrapeErr, setScrapeErr] = useState('')
  const [restaurant, setRestaurant] = useState(false)
  const toast = useToast()

  const trimmedQuery = query.trim()
  const isUrl = /^https?:\/\/\S+$/i.test(trimmedQuery)

  const importFromLink = async () => {
    setScraping(true)
    setScrapeErr('')
    try {
      const res = await foodScraper.scrape(trimmedQuery)
      if (res.recipe) {
        // receita multi-ingrediente → guarda na Cozinha (funde via setRecipes,
        // respeita o portão de sincronização); linhas por casar ficam como
        // placeholders editáveis, nunca são deitadas fora
        const { items, matched } = itemsFromScraped(res.recipe, localFoods)
        setRecipes((rs) => saveAsNamed(rs, items, res.recipe!.name))
        const pending = items.length - matched
        setQuery('')
        toast(
          pending === 0
            ? 'Receita guardada na Cozinha'
            : `Receita guardada — completa ${pending} na Cozinha`,
        )
      } else if (res.food) {
        setScrapePrefill(res.food)
        setCreating(true)
        setQuery('')
        toast('Importado — confirma os valores')
      } else {
        setScrapeErr('Não encontrei valores nutricionais nessa página.')
      }
    } catch {
      setScrapeErr('Não consegui importar esse link.')
    } finally {
      setScraping(false)
    }
  }

  const localFoods = useMemo(() => [...customFoods, ...FOOD_DB], [customFoods])
  const localResults = useMemo(
    () => searchFoods(localFoods, query, usage),
    [localFoods, query, usage],
  )
  // com a caixa vazia mostramos o costume desta refeição em vez de nada
  const suggestions = useMemo(
    () => (mealUsage ? topFoodsForMeal(localFoods, mealUsage, meal, 5) : []),
    [localFoods, mealUsage, meal],
  )
  const recipeResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recipes
    return recipes.filter((r) =>
      ((r.name ?? '') + ' ' + r.items.map((i) => i.foodName).join(' ')).toLowerCase().includes(q),
    )
  }, [recipes, query])

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
      } catch {
        if (!controller.signal.aborted) setOff({ status: 'error', results: [] })
      }
    }, 450)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  const portions: Portion[] = selected?.portions ?? []
  const currentPortion = portions[portionIdx]
  const qtyN = Number(qty)
  // gramas/ml efetivos: em modo porção multiplicamos pela medida caseira.
  const effGrams = mode === 'portion' && currentPortion ? qtyN * currentPortion.grams : qtyN
  const factor = effGrams > 0 ? effGrams / 100 : 0

  const selectedAsItem = (): RecipeItem | null => {
    if (!selected || factor <= 0) return null
    return {
      foodName: selected.brand ? `${selected.name} (${selected.brand})` : selected.name,
      emoji: selected.emoji,
      grams: effGrams,
      unit: selected.unit,
      kcal: selected.kcal * factor,
      protein: selected.protein * factor,
      carbs: selected.carbs * factor,
      fat: selected.fat * factor,
    }
  }

  /** Junta o alimento atual ao cesto e volta à pesquisa (podes continuar a juntar). */
  const addToCart = () => {
    const item = selectedAsItem()
    if (!item) return
    navigator.vibrate?.(20)
    setCart((c) => [...c, item])
    setSelected(null)
    setQuery('')
  }

  /** Regista todos os itens dados como entradas; se ≥2, lembra o combo. Fecha o sheet. */
  const logItems = (items: RecipeItem[]) => {
    if (items.length === 0) return
    navigator.vibrate?.(30)
    for (const item of items) onAdd(entryFromRecipeItem(item, meal))
    if (items.length >= 2) setRecipes((rs) => rememberCombo(rs, items))
    onClose()
  }

  const cartKcal = cart.reduce((s, i) => s + i.kcal, 0)
  const cartAlreadySaved = cart.length >= 2 && !!findByItems(recipes, cart)?.name

  const pick = (f: Food) => {
    setSelected(f)
    if (f.portions && f.portions.length > 0) {
      setMode('portion')
      setPortionIdx(0)
      setQty('1')
    } else {
      setMode('unit')
      setQty('100')
    }
  }

  const mealLabel = MEALS.find((m) => m.id === meal)?.label ?? ''

  return (
    <div className={`fixed inset-0 ${Z.screen} flex items-end justify-center bg-black/40`} onClick={onClose}>
      <div
        className="sheet-panel flex h-[88dvh] w-full max-w-md flex-col rounded-t-[1.75rem] bg-bg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Adicionar alimento ao ${mealLabel}`}
      >

        <header className="flex items-center justify-between px-5 pt-3">
          <h2 className="text-lg font-bold">Adicionar ao {mealLabel}</h2>
          <button onClick={onClose} className="rounded-full px-2 py-1 text-muted" aria-label="Fechar">
            ✕
          </button>
        </header>

        {!selected && !creating && !analyzing && (
          <>
            <div className="flex gap-2 px-5 pt-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar alimento ou código de barras…"
                className="w-full flex-1 rounded-xl bg-surface px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
              />
              <button
                onClick={() => setCameraMenu(true)}
                className="shrink-0 rounded-xl bg-surface px-3.5 text-xl transition active:scale-95"
                aria-label="Adicionar com a câmara"
              >
                📷
              </button>
            </div>

            {isUrl && (
              <div className="px-5 pt-3">
                <button
                  onClick={() => void importFromLink()}
                  disabled={scraping}
                  className="press flex w-full items-center gap-3 rounded-xl bg-accent-soft px-4 py-3 text-left disabled:opacity-60"
                >
                  <span className="text-xl" aria-hidden>🔗</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-accent">
                      {scraping ? 'A importar…' : 'Importar deste link'}
                    </span>
                    <span className="block truncate text-xs text-muted">{trimmedQuery}</span>
                  </span>
                </button>
                {scrapeErr && <p className="mt-1.5 text-xs font-medium text-critical">{scrapeErr}</p>}
              </div>
            )}

            <div className="scroll-contain mt-3 flex-1 overflow-y-auto px-5 pb-5">
              {!query.trim() && suggestions.length > 0 && (
                <>
                  <SectionLabel>Costumas comer {mealLabel.toLowerCase()}</SectionLabel>
                  <ul>
                    {suggestions.map((f) => (
                      <FoodRow key={`sug-${f.id}`} food={f} onPick={pick} onInfo={setDetail} />
                    ))}
                  </ul>
                </>
              )}

              {recipeResults.length > 0 && (
                <>
                  <SectionLabel>Combinações e receitas</SectionLabel>
                  <ul>
                    {recipeResults.map((r) => (
                      <RecipeRow key={r.id} recipe={r} onLog={() => logItems(r.items)} />
                    ))}
                  </ul>
                </>
              )}

              {localResults.length > 0 && (
                <>
                  <SectionLabel>Básicos e meus alimentos</SectionLabel>
                  <ul>
                    {localResults.map((f) => (
                      <FoodRow key={f.id} food={f} onPick={pick} onInfo={setDetail} />
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
                      <FoodRow key={f.id} food={f} onPick={pick} onInfo={setDetail} />
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

              <button
                onClick={() => setRestaurant(true)}
                className="mt-2 w-full rounded-xl border border-dashed border-line px-4 py-3 text-sm font-medium text-accent"
              >
                🍽️ Modo restaurante (contar unidades)
              </button>

              <button
                onClick={() => setAnalyzing(true)}
                className="mt-2 w-full rounded-xl border border-dashed border-line px-4 py-3 text-sm font-medium text-accent"
              >
                ✨ Analisar refeição com IA
              </button>
            </div>

            {cart.length > 0 && (
              <div className="border-t border-line bg-surface px-5 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    No cesto · {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                  </span>
                  <span className="text-sm tabular-nums text-muted">{Math.round(cartKcal)} kcal</span>
                </div>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {cart.map((item, i) => (
                    <li key={i} className="flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-xs">
                      <span aria-hidden>{item.emoji}</span>
                      <span className="max-w-[8rem] truncate">{item.foodName}</span>
                      <button
                        onClick={() => setCart((c) => c.filter((_, j) => j !== i))}
                        className="text-muted"
                        aria-label={`Remover ${item.foodName}`}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2.5 flex gap-2">
                  <button
                    onClick={() => logItems(cart)}
                    className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
                  >
                    Registar {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                  </button>
                  {cart.length >= 2 && !cartAlreadySaved && (
                    <button
                      onClick={() => setNaming(true)}
                      className="rounded-full bg-accent-soft px-4 py-2.5 text-sm font-semibold text-accent transition active:scale-95"
                    >
                      Guardar receita
                    </button>
                  )}
                </div>
              </div>
            )}
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

            {/* alternador g/ml ↔ porção (só se o alimento tiver medidas caseiras) */}
            {portions.length > 0 && (
              <div className="mt-5 flex rounded-xl bg-surface p-1 text-sm font-medium">
                <button
                  onClick={() => {
                    setMode('unit')
                    setQty('100')
                  }}
                  className={`flex-1 rounded-lg py-1.5 transition ${mode === 'unit' ? 'bg-bg shadow-sm text-ink' : 'text-muted'}`}
                >
                  {selected.unit === 'ml' ? 'ml' : 'gramas'}
                </button>
                <button
                  onClick={() => {
                    setMode('portion')
                    setQty('1')
                  }}
                  className={`flex-1 rounded-lg py-1.5 transition ${mode === 'portion' ? 'bg-bg shadow-sm text-ink' : 'text-muted'}`}
                >
                  Porção
                </button>
              </div>
            )}

            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium text-ink-2">
                {mode === 'portion' ? 'Quantas porções' : `Quantidade (${selected.unit})`}
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full rounded-xl bg-surface px-4 py-3 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
              />
            </label>

            {mode === 'portion' ? (
              <>
                {portions.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {portions.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => setPortionIdx(i)}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                          i === portionIdx ? 'border-accent bg-accent-soft text-accent' : 'border-transparent bg-surface text-ink-2'
                        }`}
                      >
                        {p.label} ({p.grams} {selected.unit})
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setQty(String(n))}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium ${
                        qty === String(n) ? 'border-accent bg-accent-soft text-accent' : 'border-transparent bg-surface text-ink-2'
                      }`}
                    >
                      {n}×
                    </button>
                  ))}
                </div>
                {currentPortion && effGrams > 0 && (
                  <p className="mt-2 text-xs text-muted">
                    = {Math.round(effGrams)} {selected.unit} · {currentPortion.label}
                  </p>
                )}
              </>
            ) : (
              <div className="mt-3 flex gap-2">
                {(selected.unit === 'ml' ? [100, 200, 250, 330] : [50, 100, 150, 200]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setQty(String(g))}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium ${
                      qty === String(g) ? 'border-accent bg-accent-soft text-accent' : 'border-transparent bg-surface text-ink-2'
                    }`}
                  >
                    {g} {selected.unit}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-5 grid grid-cols-4 gap-2 rounded-2xl bg-surface p-4 text-center">
              <Preview label="Hidratos" value={selected.carbs * factor} suffix="g" dotVar="--carbs" />
              <Preview label="Proteína" value={selected.protein * factor} suffix="g" dotVar="--protein" />
              <Preview label="Gordura" value={selected.fat * factor} suffix="g" dotVar="--fat" />
              <Preview label="kcal" value={selected.kcal * factor} />
            </div>

            {/* micros, quando o alimento os tiver */}
            {(selected.fiber != null || selected.sugar != null || selected.saturates != null || selected.salt != null) && (
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-2xl bg-surface px-4 py-3 text-sm">
                {selected.sugar != null && <MicroRow label="Açúcares" value={selected.sugar * factor} />}
                {selected.fiber != null && <MicroRow label="Fibra" value={selected.fiber * factor} />}
                {selected.saturates != null && <MicroRow label="Saturadas" value={selected.saturates * factor} />}
                {selected.salt != null && <MicroRow label="Sal" value={selected.salt * factor} />}
              </div>
            )}

            <div className="mt-auto mb-6 pt-5">
              <button
                onClick={addToCart}
                disabled={factor <= 0}
                className="w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
              >
                {cart.length > 0 ? `Juntar ao cesto (${cart.length + 1})` : 'Adicionar'}
              </button>
              <p className="mt-2 text-center text-xs text-muted">
                Junta quantos alimentos quiseres e depois regista tudo de uma vez.
              </p>
            </div>
          </div>
        )}

        {naming && (
          <NameRecipeSheet
            onCancel={() => setNaming(false)}
            onSave={(name) => {
              setRecipes((rs) => saveAsNamed(rs, cart, name))
              setNaming(false)
            }}
          />
        )}

        {cameraMenu && (
          <div className={`fixed inset-0 ${Z.sheet} flex items-end justify-center bg-black/40`} onClick={() => setCameraMenu(false)}>
            <div
              className="sheet-panel w-full max-w-md rounded-t-[1.75rem] bg-bg px-5 pb-8 pt-4"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Adicionar com a câmara"
            >
              <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" aria-hidden />
              <button
                onClick={() => {
                  setCameraMenu(false)
                  setScanning(true)
                }}
                className="flex w-full items-center gap-3 rounded-xl bg-surface px-4 py-4 text-left transition active:scale-[0.99]"
              >
                <span className="text-2xl" aria-hidden>📷</span>
                <span>
                  <span className="block font-semibold">Ler código de barras</span>
                  <span className="block text-xs text-muted">Encontra o produto no Open Food Facts</span>
                </span>
              </button>
              <button
                onClick={() => {
                  setCameraMenu(false)
                  setAnalyzing(true)
                }}
                className="mt-2 flex w-full items-center gap-3 rounded-xl bg-surface px-4 py-4 text-left transition active:scale-[0.99]"
              >
                <span className="text-2xl" aria-hidden>✨</span>
                <span>
                  <span className="block font-semibold">Analisar refeição</span>
                  <span className="block text-xs text-muted">Foto (câmara ou galeria) ou descreve o que comeste</span>
                </span>
              </button>
            </div>
          </div>
        )}

        {scanning && (
          <Suspense fallback={null}>
            <BarcodeScanner
              onDetected={(code) => {
                setScanning(false)
                setQuery(code)
              }}
              onClose={() => setScanning(false)}
            />
          </Suspense>
        )}

        {analyzing && (
          <Suspense fallback={null}>
            <AiMealAnalysis meal={meal} initialPhoto={initialPhoto} onAdd={onAdd} onDone={onClose} onCancel={() => setAnalyzing(false)} />
          </Suspense>
        )}

        {restaurant && (
          <RestaurantSheet
            foods={localFoods}
            usage={usage}
            onAdd={(items) => {
              setCart((c) => [...c, ...items])
              setRestaurant(false)
              toast(`${items.length} ${items.length === 1 ? 'item juntado' : 'itens juntados'} ao cesto`)
            }}
            onCreateFood={() => { setRestaurant(false); setCreating(true) }}
            onClose={() => setRestaurant(false)}
          />
        )}

        {creating && (
          <CustomFoodForm
            initial={scrapePrefill}
            onCancel={() => {
              setCreating(false)
              setScrapePrefill(null)
            }}
            onCreate={(food) => {
              setCustomFoods((c) => [food, ...c])
              setCreating(false)
              setScrapePrefill(null)
              pick(food)
            }}
          />
        )}

        {detail && (
          <Suspense fallback={null}>
            <FoodCard
              food={detail}
              onChoose={(f) => {
                setDetail(null)
                pick(f)
              }}
              onClose={() => setDetail(null)}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-muted first:mt-0">{children}</div>
}

function MicroRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums font-medium">{value < 10 ? value.toFixed(1) : Math.round(value)} g</span>
    </div>
  )
}

function FoodRow({ food, onPick, onInfo }: { food: Food; onPick: (f: Food) => void; onInfo: (f: Food) => void }) {
  return (
    <li className="flex items-center">
      <button onClick={() => onPick(food)} className="row-press flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface">
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
      <button
        onClick={() => onInfo(food)}
        className="shrink-0 rounded-full px-2.5 py-2 text-muted transition active:scale-90"
        aria-label={`Ver detalhes de ${food.name}`}
      >
        ⓘ
      </button>
    </li>
  )
}

function RecipeRow({ recipe, onLog }: { recipe: Recipe; onLog: () => void }) {
  const kcal = Math.round(recipeKcal(recipe))
  const label = recipe.name ?? recipe.items.map((i) => i.foodName).join(' + ')
  return (
    <li>
      <button onClick={onLog} className="row-press flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface">
        <span className="text-xl" aria-hidden>{recipe.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {label}
            {recipe.auto ? (
              <span className="ml-1.5 rounded bg-bg px-1.5 py-0.5 text-[10px] font-semibold text-muted">recente</span>
            ) : (
              <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">receita</span>
            )}
          </div>
          <div className="text-xs text-muted">
            {recipe.items.length} itens · {kcal} kcal
          </div>
        </div>
        <span className="text-lg text-accent" aria-hidden>＋</span>
      </button>
    </li>
  )
}

function NameRecipeSheet({ onCancel, onSave }: { onCancel: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <div className={`fixed inset-0 ${Z.sheet} flex items-end justify-center bg-black/40`} onClick={onCancel}>
      <div
        className="sheet-panel w-full max-w-md rounded-t-[1.75rem] bg-bg px-5 pb-8 pt-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Guardar receita"
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" aria-hidden />
        <h2 className="text-lg font-bold">Guardar como receita</h2>
        <p className="mt-1 text-sm text-muted">Dá um nome a esta combinação para a reutilizares.</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Sandes mista"
          maxLength={120}
          className="mt-4 w-full rounded-xl bg-surface px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
          autoFocus
        />
        <button
          onClick={() => name.trim() && onSave(name.trim())}
          disabled={!name.trim()}
          className="mt-4 w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          Guardar receita
        </button>
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

function CustomFoodForm({
  onCancel,
  onCreate,
  initial,
}: {
  onCancel: () => void
  onCreate: (f: Food) => void
  initial?: Food | null
}) {
  const num = (v: number | null | undefined) => (v != null ? String(v) : '')
  const initPortion = initial?.portions?.[0]
  const [name, setName] = useState(initial?.name ?? '')
  const [unit, setUnit] = useState<'g' | 'ml'>(initial?.unit ?? 'g')
  const [kcal, setKcal] = useState(initial ? String(initial.kcal) : '')
  const [protein, setProtein] = useState(initial ? String(initial.protein) : '')
  const [carbs, setCarbs] = useState(initial ? String(initial.carbs) : '')
  const [fat, setFat] = useState(initial ? String(initial.fat) : '')
  const [showMore, setShowMore] = useState(
    !!(initial && (initial.fiber != null || initial.sugar != null || initial.saturates != null || initial.salt != null || initPortion)),
  )
  const [fiber, setFiber] = useState(num(initial?.fiber))
  const [sugar, setSugar] = useState(num(initial?.sugar))
  const [saturates, setSaturates] = useState(num(initial?.saturates))
  const [salt, setSalt] = useState(num(initial?.salt))
  const [portionLabel, setPortionLabel] = useState(initPortion?.label ?? '')
  const [portionGrams, setPortionGrams] = useState(initPortion ? String(initPortion.grams) : '')

  const valid = name.trim() && Number(kcal) >= 0 && Number(protein) >= 0 && Number(carbs) >= 0 && Number(fat) >= 0 && kcal !== ''

  const numCls =
    'w-full rounded-xl bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent'
  const opt = (v: string) => (v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined)

  const create = () => {
    const pg = Number(portionGrams)
    const portions =
      portionLabel.trim() && pg > 0 ? [{ label: portionLabel.trim(), grams: pg }] : undefined
    onCreate({
      id: `custom-${uid()}`,
      name: name.trim(),
      emoji: unit === 'ml' ? '🥤' : '🍴',
      kcal: Number(kcal),
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      unit,
      custom: true,
      fiber: opt(fiber),
      sugar: opt(sugar),
      saturates: opt(saturates),
      salt: opt(salt),
      portions,
    })
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-5 pt-4">
      <button onClick={onCancel} className="self-start text-sm font-medium text-accent">
        ‹ Voltar
      </button>
      <h3 className="mt-3 font-semibold">Novo alimento (valores por 100 {unit})</h3>

      <div className="mt-4 space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do alimento" className={numCls} autoFocus />

        <div className="flex rounded-xl bg-surface p-1 text-sm font-medium">
          <button
            onClick={() => setUnit('g')}
            className={`flex-1 rounded-lg py-1.5 transition ${unit === 'g' ? 'bg-bg shadow-sm text-ink' : 'text-muted'}`}
          >
            Sólido (g)
          </button>
          <button
            onClick={() => setUnit('ml')}
            className={`flex-1 rounded-lg py-1.5 transition ${unit === 'ml' ? 'bg-bg shadow-sm text-ink' : 'text-muted'}`}
          >
            Líquido (ml)
          </button>
        </div>

        <input type="number" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="Calorias (kcal)" className={numCls} />
        <div className="grid grid-cols-3 gap-2">
          <input type="number" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="Hidratos g" className={numCls} />
          <input type="number" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="Proteína g" className={numCls} />
          <input type="number" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="Gordura g" className={numCls} />
        </div>

        <button onClick={() => setShowMore((s) => !s)} className="text-sm font-medium text-accent">
          {showMore ? '− Menos detalhes' : '+ Mais detalhes (fibra, açúcar, sal, porção)'}
        </button>

        {showMore && (
          <div className="space-y-3 rounded-xl bg-surface/50 p-3">
            <div className="grid grid-cols-2 gap-2">
              <input type="number" inputMode="decimal" value={fiber} onChange={(e) => setFiber(e.target.value)} placeholder="Fibra g" className={numCls} />
              <input type="number" inputMode="decimal" value={sugar} onChange={(e) => setSugar(e.target.value)} placeholder="Açúcares g" className={numCls} />
              <input type="number" inputMode="decimal" value={saturates} onChange={(e) => setSaturates(e.target.value)} placeholder="Saturadas g" className={numCls} />
              <input type="number" inputMode="decimal" value={salt} onChange={(e) => setSalt(e.target.value)} placeholder="Sal g" className={numCls} />
            </div>
            <div className="text-xs font-medium text-muted">Medida caseira (opcional)</div>
            <div className="grid grid-cols-2 gap-2">
              <input value={portionLabel} onChange={(e) => setPortionLabel(e.target.value)} placeholder={unit === 'ml' ? 'copo' : 'fatia'} className={numCls} />
              <input type="number" inputMode="decimal" value={portionGrams} onChange={(e) => setPortionGrams(e.target.value)} placeholder={`1 unidade = ? ${unit}`} className={numCls} />
            </div>
          </div>
        )}
      </div>

      <button
        onClick={create}
        disabled={!valid}
        className="mt-5 mb-6 rounded-full bg-accent px-6 py-3.5 font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
      >
        Guardar alimento
      </button>
    </div>
  )
}
