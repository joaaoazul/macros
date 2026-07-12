import { useMemo, useState } from 'react'
import type { Food, MealId, Recipe, RecipeItem } from '../types'
import { MEALS } from '../types'
import { FOOD_DB, searchFoods } from '../lib/foods'
import { recipeKcal, saveAsNamed } from '../lib/recipes'
import { Card, LargeTitle } from './ui'

interface Props {
  recipes: Recipe[]
  setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>
  customFoods: Food[]
  /** regista os itens na refeição escolhida (hoje) */
  onLog: (items: RecipeItem[], meal: MealId) => void
}

const RECIPE_EMOJIS = ['🍽️', '🥪', '🥗', '🍲', '🥘', '🍜', '🥣', '🍳', '🌯', '🍝', '🍛', '🥙']

export default function Receitas({ recipes, setRecipes, customFoods, onLog }: Props) {
  const [building, setBuilding] = useState<Recipe | 'new' | null>(null)
  const [mealFor, setMealFor] = useState<Recipe | null>(null)

  const named = recipes.filter((r) => !r.auto)
  const autos = recipes.filter((r) => r.auto)

  const remove = (r: Recipe) => setRecipes((rs) => rs.filter((x) => x.id !== r.id))

  if (building) {
    return (
      <RecipeBuilder
        initial={building === 'new' ? null : building}
        customFoods={customFoods}
        onCancel={() => setBuilding(null)}
        onSave={(name, emoji, items) => {
          setRecipes((rs) => {
            // se estava a editar uma existente, substitui; senão guarda nova nomeada
            if (building !== 'new') {
              return rs.map((x) => (x.id === building.id ? { ...x, name, emoji, auto: false, items } : x))
            }
            return saveAsNamed(rs, items, name).map((x) =>
              x.name === name && x.items === items ? { ...x, emoji } : x,
            )
          })
          setBuilding(null)
        }}
      />
    )
  }

  return (
    <div>
      <LargeTitle title="Receitas" subtitle="As tuas combinações" />

      <div className="space-y-3.5 px-4 pt-2">
        <button
          onClick={() => setBuilding('new')}
          className="w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-white transition active:scale-[0.98]"
        >
          ＋ Criar receita
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

      {mealFor && (
        <MealPicker
          recipe={mealFor}
          onPick={(meal) => {
            onLog(mealFor.items, meal)
            setMealFor(null)
          }}
          onClose={() => setMealFor(null)}
        />
      )}
    </div>
  )
}

function RecipeItemRow({
  recipe,
  onLog,
  onEdit,
  onDelete,
}: {
  recipe: Recipe
  onLog: () => void
  onEdit: () => void
  onDelete: () => void
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
          <div className="mt-3 flex gap-2">
            <button onClick={onEdit} className="rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-accent">
              Editar
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

function MealPicker({ recipe, onPick, onClose }: { recipe: Recipe; onPick: (m: MealId) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sheet-backdrop" onClick={onClose}>
      <div
        className="sheet-panel w-full max-w-md rounded-t-[1.75rem] bg-bg px-5 pb-8 pt-3"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Escolher refeição"
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" aria-hidden />
        <h2 className="text-lg font-bold">Adicionar a que refeição?</h2>
        <p className="mt-1 text-sm text-muted">{recipe.name ?? 'Combinação'} · hoje</p>
        <div className="mt-4 space-y-2">
          {MEALS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                navigator.vibrate?.(30)
                onPick(m.id)
              }}
              className="flex w-full items-center gap-3 rounded-xl bg-surface px-4 py-3.5 text-left transition active:scale-[0.99]"
            >
              <span className="text-2xl" aria-hidden>{m.emoji}</span>
              <span className="font-semibold">{m.label}</span>
            </button>
          ))}
        </div>
      </div>
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
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line" aria-hidden />
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
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface"
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
