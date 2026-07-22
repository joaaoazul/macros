/** Modo restaurante: contar unidades em vez de pesar gramas.
 *
 * Fora de casa ninguém sabe que comeu 340 g de sushi — sabe que comeu 12 peças.
 * Aqui escolhes os itens e carregas em + / −; as gramas saem da medida caseira
 * que o alimento já tem (`portions`), e as macros dos valores reais desse
 * alimento. Nada é inventado: se não existir, crias uma vez e fica guardado.
 *
 * Alimenta o mesmo cesto do AddFoodSheet, portanto o "Registar" e o "Guardar
 * receita" que já existiam funcionam na mesma — e é isso que faz a segunda ida
 * ao mesmo restaurante ser um toque só.
 */

import { useMemo, useState } from 'react'
import type { Food, RecipeItem } from '../types'
import { searchFoods } from '../lib/foods'
import { haptic } from '../lib/store'
import { Card, ScreenHeader, Z } from './ui'

interface Props {
  foods: Food[]
  /** frequência de uso, para pôr à frente o que costumas comer */
  usage?: Map<string, number>
  onAdd: (items: RecipeItem[]) => void
  onCreateFood: () => void
  onClose: () => void
}

/** Quanto vale uma unidade deste alimento, e como se chama. */
function unitOf(food: Food): { grams: number; label: string } {
  const p = food.portions?.[0]
  if (p && p.grams > 0) return { grams: p.grams, label: p.label }
  return { grams: 100, label: `100 ${food.unit}` }
}

function itemFor(food: Food, count: number): RecipeItem {
  const { grams } = unitOf(food)
  const total = grams * count
  const f = total / 100
  return {
    foodName: food.brand ? `${food.name} (${food.brand})` : food.name,
    emoji: food.emoji,
    grams: Math.round(total * 10) / 10,
    unit: food.unit,
    kcal: Math.round(food.kcal * f),
    protein: Math.round(food.protein * f * 10) / 10,
    carbs: Math.round(food.carbs * f * 10) / 10,
    fat: Math.round(food.fat * f * 10) / 10,
  }
}

export default function RestaurantSheet({ foods, usage, onAdd, onCreateFood, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [counts, setCounts] = useState<Map<string, number>>(new Map())

  const results = useMemo(() => searchFoods(foods, query, usage).slice(0, 40), [foods, query, usage])
  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods])

  /** Escolhidos primeiro, para não os perderes de vista ao pesquisar outra coisa. */
  const chosen = useMemo(
    () =>
      [...counts.entries()]
        .filter(([, n]) => n > 0)
        .map(([id]) => byId.get(id))
        .filter(Boolean) as Food[],
    [counts, byId],
  )
  const chosenIds = new Set(chosen.map((f) => f.id))

  const bump = (food: Food, delta: number) => {
    haptic(8)
    setCounts((cur) => {
      const next = new Map(cur)
      const n = Math.max(0, (next.get(food.id) ?? 0) + delta)
      if (n === 0) next.delete(food.id)
      else next.set(food.id, n)
      return next
    })
  }

  const items = chosen.map((f) => itemFor(f, counts.get(f.id) ?? 0))
  const totalKcal = items.reduce((s, i) => s + i.kcal, 0)
  const totalUnits = [...counts.values()].reduce((s, n) => s + n, 0)

  const confirm = () => {
    if (items.length === 0) return
    haptic(20)
    onAdd(items)
  }

  const Row = ({ food }: { food: Food }) => {
    const n = counts.get(food.id) ?? 0
    const u = unitOf(food)
    return (
      <div className="flex items-center gap-3 p-3">
        <span className="text-xl" aria-hidden>{food.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{food.name}</div>
          <div className="text-xs text-muted">
            1 {u.label} ≈ {Math.round(food.kcal * (u.grams / 100))} kcal · {u.grams} {food.unit}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => bump(food, -1)}
            disabled={n === 0}
            aria-label={`Menos ${food.name}`}
            className="press flex h-8 w-8 items-center justify-center rounded-full bg-bg text-lg disabled:opacity-30"
          >
            −
          </button>
          <span className="w-5 text-center text-sm font-semibold tabular-nums" aria-live="polite">
            {n}
          </span>
          <button
            onClick={() => bump(food, 1)}
            aria-label={`Mais ${food.name}`}
            className="press flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-lg text-accent"
          >
            ＋
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`fixed inset-0 ${Z.sheet} flex flex-col bg-bg`}>
      <ScreenHeader
        backLabel="Voltar"
        onBack={onClose}
        title="Modo restaurante"
        subtitle="conta unidades, não gramas"
      />

      <div className="mx-auto w-full max-w-md flex-1 space-y-3 overflow-y-auto px-4 py-3 scroll-contain">
        {chosen.length > 0 && (
          <section>
            <h3 className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Nesta refeição
            </h3>
            <Card className="divide-y divide-line">
              {chosen.map((f) => (
                <Row key={`sel-${f.id}`} food={f} />
              ))}
            </Card>
          </section>
        )}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Procurar (ex.: sushi, picanha, pizza)…"
          className="w-full rounded-xl bg-surface px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          aria-label="Procurar alimento"
        />

        <section>
          <Card className="divide-y divide-line">
            {results
              .filter((f) => !chosenIds.has(f.id))
              .map((f) => (
                <Row key={f.id} food={f} />
              ))}
            {results.length === 0 && (
              <p className="p-4 text-center text-sm text-muted">Nada encontrado para “{query}”.</p>
            )}
          </Card>
        </section>

        <button
          onClick={onCreateFood}
          className="w-full rounded-xl border border-dashed border-line px-4 py-3 text-sm font-medium text-accent"
        >
          + Criar alimento (com medida por unidade)
        </button>

        <p className="px-1 pb-2 text-[11px] leading-snug text-muted">
          As unidades vêm das medidas caseiras de cada alimento. Se um prato não existir, cria-o uma
          vez com a medida certa — fica guardado para as próximas vezes.
        </p>
      </div>

      {totalUnits > 0 && (
        <div className="border-t border-line bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto flex max-w-md items-center justify-between">
            <div>
              <div className="text-sm font-semibold">
                {totalUnits} {totalUnits === 1 ? 'unidade' : 'unidades'}
              </div>
              <div className="text-xs tabular-nums text-muted">{totalKcal} kcal no total</div>
            </div>
            <button
              onClick={confirm}
              className="press rounded-full bg-accent px-6 py-3 font-semibold text-white"
            >
              Juntar ao cesto
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
