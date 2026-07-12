/** Helpers de combinações/receitas: assinatura para dedup e conversões. */

import type { Entry, MealId, Recipe, RecipeItem } from '../types'
import { uid } from './store'

export const MAX_AUTO_COMBOS = 12

/** Assinatura estável de um conjunto de itens (nome+gramas), para detetar combos iguais. */
export function comboSignature(items: RecipeItem[]): string {
  return items
    .map((i) => `${i.foodName.toLowerCase().trim()}:${Math.round(i.grams)}`)
    .sort()
    .join('|')
}

/** Emoji representativo de um combo: o do primeiro item, ou 🍽️. */
export function comboEmoji(items: RecipeItem[]): string {
  return items[0]?.emoji || '🍽️'
}

export function recipeItemFromEntry(e: Entry): RecipeItem {
  return {
    foodName: e.foodName,
    emoji: e.emoji,
    grams: e.grams,
    unit: e.unit,
    kcal: e.kcal,
    protein: e.protein,
    carbs: e.carbs,
    fat: e.fat,
  }
}

export function entryFromRecipeItem(item: RecipeItem, meal: MealId): Entry {
  return {
    id: uid(),
    meal,
    foodName: item.foodName,
    emoji: item.emoji,
    grams: item.grams,
    unit: item.unit,
    kcal: item.kcal,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
  }
}

export function recipeKcal(r: Recipe): number {
  return r.items.reduce((s, i) => s + i.kcal, 0)
}

/**
 * Regista uma combinação como "usada anteriormente" (auto) se ainda não existir.
 * Mantém no máximo MAX_AUTO_COMBOS autos (LRU); não mexe nas receitas nomeadas.
 * Devolve a nova lista de recipes.
 */
export function rememberCombo(recipes: Recipe[], items: RecipeItem[]): Recipe[] {
  if (items.length < 2) return recipes // combos = 2+ itens
  const sig = comboSignature(items)
  const existing = recipes.find((r) => comboSignature(r.items) === sig)
  if (existing) {
    // já existe (auto ou nomeada) — promove ao topo dos autos se for auto
    if (!existing.auto) return recipes
    return [existing, ...recipes.filter((r) => r !== existing)]
  }
  const combo: Recipe = { id: uid(), name: null, emoji: comboEmoji(items), auto: true, items }
  const autos = recipes.filter((r) => r.auto)
  const named = recipes.filter((r) => !r.auto)
  const trimmedAutos = [combo, ...autos].slice(0, MAX_AUTO_COMBOS)
  return [...trimmedAutos, ...named]
}

/** Existe já uma receita/combo com estes itens? (para não reperguntar guardar) */
export function findByItems(recipes: Recipe[], items: RecipeItem[]): Recipe | undefined {
  const sig = comboSignature(items)
  return recipes.find((r) => comboSignature(r.items) === sig)
}

/** Promove/guarda um combo como receita nomeada. */
export function saveAsNamed(recipes: Recipe[], items: RecipeItem[], name: string): Recipe[] {
  const existing = findByItems(recipes, items)
  if (existing) {
    return recipes.map((r) => (r === existing ? { ...r, name, auto: false } : r))
  }
  const recipe: Recipe = { id: uid(), name, emoji: comboEmoji(items), auto: false, items }
  return [recipe, ...recipes]
}
