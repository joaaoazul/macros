/** Helpers de combinações/receitas: assinatura para dedup e conversões. */

import type { Entry, Food, LibraryRecipe, MealId, Recipe, RecipeItem, ScrapedRecipe } from '../types'
import { searchFoods } from './foods'
import { parseIngredientLine } from './ingredients'
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

/** Escala os ingredientes por um factor — cozinhaste para 4 e comeste 1 → 0.25.
 *
 * Arredonda a 1 casa para não encher o diário de 33.333333 g. */
export function scaleItems(items: RecipeItem[], factor: number): RecipeItem[] {
  if (factor === 1) return items
  const r1 = (n: number) => Math.round(n * factor * 10) / 10
  return items.map((i) => ({
    ...i,
    grams: r1(i.grams),
    kcal: Math.round(i.kcal * factor),
    protein: r1(i.protein),
    carbs: r1(i.carbs),
    fat: r1(i.fat),
  }))
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

/** Converte uma receita da biblioteca numa receita nomeada do utilizador.
 *
 * Novo id (uid) para não colidir com o 'lib-…', auto=false, items copiados. Não
 * escreve nada: devolve o Recipe para quem chama meter via setRecipes (é isso
 * que dispara o PUT full-replace e respeita o portão de sincronização). */
export function recipeFromLibrary(lib: LibraryRecipe): Recipe {
  return {
    id: uid(),
    name: lib.name,
    emoji: lib.emoji,
    auto: false,
    items: lib.items.map((i) => ({ ...i })),
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** Converte as linhas de uma receita extraída em RecipeItems.
 *
 * Para cada linha: tenta casar o nome com um alimento conhecido (top hit) e, se
 * também soubermos os gramas, cria um item com macros escalados. Sem match ou
 * sem gramas → um placeholder editável com o texto original e macros a zero
 * (nunca inventamos valores). Devolve os itens e quantos casaram, para dar
 * feedback honesto ao utilizador. */
export function itemsFromScraped(
  scraped: ScrapedRecipe,
  foods: Food[],
): { items: RecipeItem[]; matched: number } {
  let matched = 0
  const items = scraped.ingredients.map<RecipeItem>((line) => {
    const { grams, unit, query } = parseIngredientLine(line)
    const hit = query ? searchFoods(foods, query)[0] : undefined
    if (hit && grams != null && grams > 0) {
      matched++
      const factor = grams / 100
      return {
        foodName: hit.brand ? `${hit.name} (${hit.brand})` : hit.name,
        emoji: hit.emoji,
        grams,
        unit: hit.unit,
        kcal: Math.round(hit.kcal * factor),
        protein: r1(hit.protein * factor),
        carbs: r1(hit.carbs * factor),
        fat: r1(hit.fat * factor),
      }
    }
    return { foodName: line, emoji: '🍽️', grams: grams ?? 0, unit, kcal: 0, protein: 0, carbs: 0, fat: 0 }
  })
  return { items, matched }
}

/** Constrói uma Recipe (não guardada) a partir de uma receita extraída, para
 * pré-preencher o construtor. id novo, auto=false; ver itemsFromScraped. */
export function recipeFromScraped(scraped: ScrapedRecipe, foods: Food[]): { recipe: Recipe; matched: number } {
  const { items, matched } = itemsFromScraped(scraped, foods)
  return {
    recipe: { id: uid(), name: scraped.name, emoji: scraped.emoji || '🍲', auto: false, items },
    matched,
  }
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
