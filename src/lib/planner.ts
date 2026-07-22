/** Lógica do planeador partilhada entre o Planeador e as Receitas. */

import type { Diary, MealPlanEntry, Recipe, RecipeItem } from '../types'
import { norm } from './pantry'

export type PlanMeal = 'lunch' | 'dinner'
export interface SlotTarget {
  day: number
  meal: PlanMeal
}

/** Nome legível de uma receita (as automáticas não têm nome próprio). */
export function recipeLabel(r: Recipe): string {
  return r.name ?? r.items.map((i) => i.foodName).join(' + ')
}

/** Coloca a mesma refeição em vários slots de uma vez, substituindo o que lá
 * estiver. Uma só passagem pelo array → um só PUT debounced. */
export function placeInSlots(
  plan: MealPlanEntry[],
  template: { name: string; emoji: string; servings?: number; items: RecipeItem[] },
  targets: SlotTarget[],
  newId: () => string,
): MealPlanEntry[] {
  const keep = plan.filter((e) => !targets.some((t) => t.day === e.day && t.meal === e.meal))
  const added = targets.map((t) => ({
    id: newId(),
    day: t.day,
    meal: t.meal,
    name: template.name,
    emoji: template.emoji,
    servings: template.servings && template.servings > 0 ? template.servings : 1,
    items: template.items,
  }))
  return [...keep, ...added]
}

/** Receitas que costumas usar nesta refeição, das mais às menos frequentes.
 *
 * O plano da semana tem no máximo 14 entradas — sinal fraco sozinho, por isso
 * o diário é o termo principal e o plano só desempata (pesa mais por entrada,
 * mas há muitas menos). Função pura, sem estado novo para persistir. */
export function suggestedForMeal(
  recipes: Recipe[],
  mealPlan: MealPlanEntry[],
  diary: Diary,
  meal: PlanMeal,
  limit = 4,
): Recipe[] {
  if (recipes.length === 0) return []

  const plannedNames = mealPlan.filter((e) => e.meal === meal).map((e) => norm(e.name))
  // nomes de alimentos registados nesta refeição, em todo o diário guardado
  const diaryNames: string[] = []
  for (const entries of Object.values(diary)) {
    for (const e of entries) {
      if (e.meal === meal) diaryNames.push(norm(e.foodName))
    }
  }
  if (plannedNames.length === 0 && diaryNames.length === 0) return []

  const hits = (needle: string, hay: string[]) =>
    needle.length < 3 ? 0 : hay.filter((h) => h.includes(needle) || needle.includes(h)).length

  return recipes
    .map((r) => {
      const label = norm(recipeLabel(r))
      // uma receita conta no diário quando os seus ingredientes lá aparecem
      const byItems = r.items.reduce((s, i) => s + hits(norm(i.foodName), diaryNames), 0)
      return { r, score: 3 * hits(label, plannedNames) + hits(label, diaryNames) + byItems }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.r)
}
