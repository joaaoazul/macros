import { useMemo, useState } from 'react'
import type { Diary, Food, LibraryRecipe, MealId, MealPlanEntry, PantryItem, Recipe, RecipeItem, ScrapedRecipe } from '../types'
import { FOOD_DB, searchFoods } from '../lib/foods'
import { recipeFromLibrary, recipeFromScraped, recipeKcal, saveAsNamed } from '../lib/recipes'
import { placeInSlots, recipeLabel } from '../lib/planner'
import { foodScraper } from '../lib/social'
import { uid } from '../lib/store'
import { useToast } from '../lib/toast'
import LogPortionSheet from './LogPortionSheet'
import Planner from './Planner'
import RecipeLibrary from './RecipeLibrary'
import PlanTargetSheet from './PlanTargetSheet'
import ShareSheet, { recipeShare } from './social/ShareSheet'
import { Card, LargeTitle, SegmentedControl } from './ui'

/** Limite de receitas por utilizador imposto pelo backend (put_recipes). */
const MAX_RECIPES = 200

interface Props {
  recipes: Recipe[]
  setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>
  customFoods: Food[]
  /** só de leitura: alimenta as sugestões "do costume" do planeador */
  diary: Diary
  mealPlan: MealPlanEntry[]
  setMealPlan: React.Dispatch<React.SetStateAction<MealPlanEntry[]>>
  pantry: PantryItem[]
  setPantry: React.Dispatch<React.SetStateAction<PantryItem[]>>
  /** regista os itens na refeição escolhida (hoje) */
  onLog: (items: RecipeItem[], meal: MealId) => void
}

const RECIPE_EMOJIS = ['🍽️', '🥪', '🥗', '🍲', '🥘', '🍜', '🥣', '🍳', '🌯', '🍝', '🍛', '🥙']

const SEGMENTS = [
  { id: 'recipes' as const, label: 'Receitas' },
  { id: 'planner' as const, label: 'Planeador' },
]

export default function Receitas({ recipes, setRecipes, customFoods, diary, mealPlan, setMealPlan, pantry, setPantry, onLog }: Props) {
  const [building, setBuilding] = useState<Recipe | 'new' | null>(null)
  const [mealFor, setMealFor] = useState<Recipe | null>(null)
  const [sharing, setSharing] = useState<Recipe | null>(null)
  const [segment, setSegment] = useState<'recipes' | 'planner'>('recipes')
  const [library, setLibrary] = useState(false)
  const [planning, setPlanning] = useState<Recipe | null>(null)
  const [importing, setImporting] = useState(false)
  const [importDraft, setImportDraft] = useState<Recipe | null>(null)
  const toast = useToast()

  const named = recipes.filter((r) => !r.auto)
  const autos = recipes.filter((r) => r.auto)

  const remove = (r: Recipe) => setRecipes((rs) => rs.filter((x) => x.id !== r.id))

  /** Adiciona uma receita da biblioteca às do utilizador. Devolve false (e avisa)
   * se já existir uma com o mesmo nome ou se o limite estiver atingido. */
  const addFromLibrary = (lib: LibraryRecipe): boolean => {
    if (recipes.length >= MAX_RECIPES) {
      toast('Atingiste o limite de receitas.', 'error')
      return false
    }
    if (named.some((r) => r.name?.toLowerCase() === lib.name.toLowerCase())) {
      toast('Já tens essa receita.', 'error')
      return false
    }
    setRecipes((rs) => [recipeFromLibrary(lib), ...rs])
    toast('Receita adicionada às tuas.')
    return true
  }

  /** Recebe uma receita extraída de um link, casa os ingredientes com alimentos
   * conhecidos e abre o construtor pré-preenchido para o utilizador rever. */
  const startImport = (scraped: ScrapedRecipe) => {
    if (recipes.length >= MAX_RECIPES) {
      toast('Atingiste o limite de receitas.', 'error')
      return
    }
    const { recipe, matched } = recipeFromScraped(scraped, [...customFoods, ...FOOD_DB])
    setImporting(false)
    setImportDraft(recipe)
    const pending = recipe.items.length - matched
    toast(
      pending === 0
        ? 'Receita importada — confirma e guarda'
        : `Importada — ${pending} ingrediente(s) por completar`,
    )
  }

  // Editar uma receita existente OU rever uma importada (draft ainda não guardado).
  const editing = building && building !== 'new' ? building : null
  if (building || importDraft) {
    return (
      <RecipeBuilder
        initial={editing ?? importDraft}
        customFoods={customFoods}
        onCancel={() => {
          setBuilding(null)
          setImportDraft(null)
        }}
        onSave={(name, emoji, items) => {
          setRecipes((rs) => {
            // se estava a editar uma existente, substitui; senão guarda nova nomeada
            if (editing) {
              return rs.map((x) => (x.id === editing.id ? { ...x, name, emoji, auto: false, items } : x))
            }
            return saveAsNamed(rs, items, name).map((x) =>
              x.name === name && x.items === items ? { ...x, emoji } : x,
            )
          })
          setBuilding(null)
          setImportDraft(null)
        }}
      />
    )
  }

  return (
    <div>
      <LargeTitle title="Cozinha" subtitle={segment === 'recipes' ? 'As tuas combinações' : 'Planeia e compra'} />

      {/* segmented control iOS com indicador deslizante */}
      <div className="px-4 pb-2 pt-1">
        <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} />
      </div>

      {segment === 'planner' ? (
        <Planner
          recipes={recipes}
          customFoods={customFoods}
          diary={diary}
          mealPlan={mealPlan}
          setMealPlan={setMealPlan}
          pantry={pantry}
          setPantry={setPantry}
          onLog={onLog}
        />
      ) : (
      <div className="animate-fade space-y-3.5 px-4 pt-1">
        <div className="flex gap-2">
          <button
            onClick={() => setBuilding('new')}
            className="press flex-1 rounded-full bg-accent px-6 py-3.5 font-semibold text-white"
          >
            ＋ Criar receita
          </button>
          <button
            onClick={() => setLibrary(true)}
            className="press rounded-full bg-accent-soft px-5 py-3.5 font-semibold text-accent"
          >
            📖 Biblioteca
          </button>
        </div>

        <button
          onClick={() => setImporting(true)}
          className="press w-full rounded-full border border-dashed border-line px-5 py-3 text-sm font-semibold text-accent"
        >
          🔗 Importar de link
        </button>

        {named.length > 0 && (
          <Card className="divide-y divide-line">
            <div className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">Receitas guardadas</div>
            {named.map((r) => (
              <RecipeItemRow
                key={r.id}
                recipe={r}
                onLog={() => setMealFor(r)}
                onEdit={() => setBuilding(r)}
                onDelete={() => remove(r)}
                onShare={() => setSharing(r)}
                onPlan={() => setPlanning(r)}
              />
            ))}
          </Card>
        )}

        {autos.length > 0 && (
          <Card className="divide-y divide-line">
            <div className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">Usadas recentemente</div>
            {autos.map((r) => (
              <RecipeItemRow
                key={r.id}
                recipe={r}
                onLog={() => setMealFor(r)}
                onEdit={() => setBuilding(r)}
                onDelete={() => remove(r)}
                onShare={() => setSharing(r)}
                onPlan={() => setPlanning(r)}
              />
            ))}
          </Card>
        )}

        {recipes.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted">
            Ainda não tens receitas. Cria uma combinação de alimentos (ex.: pão + queijo + fiambre) e regista-a
            de uma vez sempre que quiseres.
          </Card>
        )}
      </div>
      )}

      {planning && (
        <PlanTargetSheet
          title={recipeLabel(planning)}
          emoji={planning.emoji}
          occupied={(d, m) => mealPlan.some((e) => e.day === d && e.meal === m)}
          onClose={() => setPlanning(null)}
          onConfirm={(targets) => {
            setMealPlan((plan) =>
              placeInSlots(plan, { name: recipeLabel(planning), emoji: planning.emoji, items: planning.items }, targets, uid),
            )
            toast(targets.length === 1 ? 'Planeado para 1 refeição' : `Planeado para ${targets.length} refeições`)
            setPlanning(null)
          }}
        />
      )}

      {mealFor && (
        <LogPortionSheet
          title={mealFor.name ?? 'Combinação'}
          emoji={mealFor.emoji}
          items={mealFor.items}
          onLog={(items, meal) => {
            onLog(items, meal)
            setMealFor(null)
          }}
          onClose={() => setMealFor(null)}
        />
      )}

      {sharing && (
        <ShareSheet share={recipeShare(sharing)} onClose={() => setSharing(null)} />
      )}

      {library && <RecipeLibrary onAdd={addFromLibrary} onClose={() => setLibrary(false)} />}

      {importing && <ImportRecipeSheet onImport={startImport} onClose={() => setImporting(false)} />}
    </div>
  )
}

/** Cola um link, extrai a receita e devolve-a para pré-preencher o construtor. */
function ImportRecipeSheet({
  onImport,
  onClose,
}: {
  onImport: (scraped: ScrapedRecipe) => void
  onClose: () => void
}) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const go = async () => {
    const u = url.trim()
    if (!/^https?:\/\/\S+$/i.test(u)) {
      setErr('Cola um link http(s) válido.')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const res = await foodScraper.scrape(u)
      if (res.recipe) {
        onImport(res.recipe)
      } else if (res.food) {
        setErr('Esse link parece um produto, não uma receita. Importa-o ao adicionar um alimento.')
      } else {
        setErr('Não encontrei uma receita nessa página.')
      }
    } catch {
      setErr('Não consegui importar esse link.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sheet-backdrop" onClick={onClose}>
      <div
        className="sheet-panel w-full max-w-md rounded-t-[1.75rem] bg-bg px-5 pb-8 pt-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Importar receita de um link"
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" aria-hidden />
        <h2 className="text-lg font-bold">Importar de link</h2>
        <p className="mt-1 text-sm text-muted">
          Cola o link de uma receita. Tentamos casar os ingredientes com alimentos conhecidos — depois
          confirmas e completas o que faltar.
        </p>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !busy && void go()}
          placeholder="https://…"
          inputMode="url"
          className="mt-4 w-full rounded-xl bg-surface px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
          autoFocus
        />
        {err && <p className="mt-2 text-sm font-medium text-critical">{err}</p>}
        <button
          onClick={() => void go()}
          disabled={busy || !url.trim()}
          className="mt-4 w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? 'A importar…' : 'Importar receita'}
        </button>
      </div>
    </div>
  )
}

function RecipeItemRow({
  recipe,
  onLog,
  onEdit,
  onDelete,
  onShare,
  onPlan,
}: {
  recipe: Recipe
  onLog: () => void
  onEdit: () => void
  onDelete: () => void
  onShare: () => void
  onPlan: () => void
}) {
  const [open, setOpen] = useState(false)
  const label = recipe.name ?? recipe.items.map((i) => i.foodName).join(' + ')
  return (
    <div className="p-3.5">
      <div className="flex items-center gap-3">
        <span className="text-xl" aria-hidden>{recipe.emoji}</span>
        <button onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-medium">{label}</div>
          <div className="text-xs text-muted">
            {recipe.items.length} {recipe.items.length === 1 ? 'ingrediente' : 'ingredientes'} · {Math.round(recipeKcal(recipe))} kcal
          </div>
        </button>
        <button
          onClick={onLog}
          className="shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-white transition active:scale-95"
        >
          Adicionar
        </button>
      </div>
      {open && (
        <div className="mt-2 rounded-xl bg-bg p-3">
          <ul className="space-y-1 text-sm">
            {recipe.items.map((i, k) => (
              <li key={k} className="flex justify-between">
                <span className="min-w-0 truncate">
                  <span aria-hidden>{i.emoji}</span> {i.foodName}
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  {Math.round(i.grams)} {i.unit} · {Math.round(i.kcal)} kcal
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={onPlan} className="rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent">
              Planear
            </button>
            <button onClick={onEdit} className="rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-accent">
              Editar
            </button>
            <button onClick={onShare} className="rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-accent">
              Partilhar
            </button>
            <button onClick={onDelete} className="rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-critical">
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Construtor de receita: nome, emoji e ingredientes (procura + gramas). */
function RecipeBuilder({
  initial,
  customFoods,
  onCancel,
  onSave,
}: {
  initial: Recipe | null
  customFoods: Food[]
  onCancel: () => void
  onSave: (name: string, emoji: string, items: RecipeItem[]) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🍽️')
  const [items, setItems] = useState<RecipeItem[]>(initial?.items ?? [])
  const [adding, setAdding] = useState(false)

  const totalKcal = items.reduce((s, i) => s + i.kcal, 0)
  const valid = name.trim().length > 0 && items.length >= 1

  return (
    <div>
      <header className="flex items-center justify-between px-5 pb-2 pt-[max(1.75rem,env(safe-area-inset-top))]">
        <button onClick={onCancel} className="text-sm font-medium text-accent">‹ Receitas</button>
        <button
          onClick={() => valid && onSave(name.trim(), emoji, items)}
          disabled={!valid}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-40"
        >
          Guardar
        </button>
      </header>

      <div className="space-y-3.5 px-4 pt-2">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const i = RECIPE_EMOJIS.indexOf(emoji)
                setEmoji(RECIPE_EMOJIS[(i + 1) % RECIPE_EMOJIS.length])
              }}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-2xl"
              aria-label="Mudar emoji"
            >
              {emoji}
            </button>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da receita (ex.: Sandes mista)"
              maxLength={120}
              className="min-w-0 flex-1 rounded-xl bg-bg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
              autoFocus
            />
          </div>
        </Card>

        <Card className="divide-y divide-line">
          <div className="flex items-center justify-between px-4 pt-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Ingredientes</span>
            <span className="text-xs tabular-nums text-muted">{Math.round(totalKcal)} kcal</span>
          </div>
          {items.length === 0 && <p className="px-4 py-4 text-sm text-muted">Ainda sem ingredientes.</p>}
          {items.map((i, k) => (
            <div key={k} className="flex items-center gap-3 p-3.5">
              <span className="text-xl" aria-hidden>{i.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{i.foodName}</div>
                <div className="text-xs text-muted">
                  {Math.round(i.grams)} {i.unit} · {Math.round(i.kcal)} kcal
                </div>
              </div>
              <button
                onClick={() => setItems((its) => its.filter((_, j) => j !== k))}
                className="text-muted"
                aria-label={`Remover ${i.foodName}`}
              >
                ✕
              </button>
            </div>
          ))}
          <button onClick={() => setAdding(true)} className="w-full px-4 py-3.5 text-left text-sm font-semibold text-accent">
            ＋ Adicionar ingrediente
          </button>
        </Card>
      </div>

      {adding && (
        <IngredientPicker
          customFoods={customFoods}
          onAdd={(item) => {
            setItems((its) => [...its, item])
            setAdding(false)
          }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  )
}

/** Procura de alimento + gramas → devolve um RecipeItem. */
function IngredientPicker({
  customFoods,
  onAdd,
  onClose,
}: {
  customFoods: Food[]
  onAdd: (item: RecipeItem) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [grams, setGrams] = useState('100')

  const foods = useMemo(() => [...customFoods, ...FOOD_DB], [customFoods])
  const results = useMemo(() => searchFoods(foods, query).slice(0, 40), [foods, query])

  const gramsN = Number(grams)
  const factor = gramsN > 0 ? gramsN / 100 : 0

  const confirm = () => {
    if (!selected || factor <= 0) return
    onAdd({
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sheet-backdrop" onClick={onClose}>
      <div
        className="sheet-panel flex h-[80dvh] w-full max-w-md flex-col rounded-t-[1.75rem] bg-bg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Adicionar ingrediente"
      >
        {!selected ? (
          <>
            <div className="px-5 pt-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Procurar alimento…"
                className="w-full rounded-xl bg-surface px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
              />
            </div>
            <ul className="scroll-contain mt-3 flex-1 overflow-y-auto px-5 pb-5">
              {results.map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => {
                      setSelected(f)
                      setGrams('100')
                    }}
                    className="row-press flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface"
                  >
                    <span className="text-xl" aria-hidden>{f.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{f.name}</div>
                      <div className="text-xs text-muted">
                        {f.kcal} kcal (100 {f.unit})
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex flex-1 flex-col px-5 pt-4">
            <button onClick={() => setSelected(null)} className="self-start text-sm font-medium text-accent">
              ‹ Voltar
            </button>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-3xl" aria-hidden>{selected.emoji}</span>
              <div className="font-semibold">{selected.name}</div>
            </div>
            <label className="mt-5 block">
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
            <div className="mt-3 grid grid-cols-4 gap-2 rounded-2xl bg-surface p-4 text-center text-sm">
              <div><div className="font-bold tabular-nums">{Math.round(selected.carbs * factor)}</div><div className="text-[10px] text-muted">Hidratos</div></div>
              <div><div className="font-bold tabular-nums">{Math.round(selected.protein * factor)}</div><div className="text-[10px] text-muted">Proteína</div></div>
              <div><div className="font-bold tabular-nums">{Math.round(selected.fat * factor)}</div><div className="text-[10px] text-muted">Gordura</div></div>
              <div><div className="font-bold tabular-nums">{Math.round(selected.kcal * factor)}</div><div className="text-[10px] text-muted">kcal</div></div>
            </div>
            <button
              onClick={confirm}
              disabled={factor <= 0}
              className="mt-auto mb-6 rounded-full bg-accent px-6 py-3.5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
            >
              Juntar à receita
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
