export type Sex = 'M' | 'F'
export type Goal = 'cut' | 'maintain' | 'bulk'
export type MealId = 'madrugada' | 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'supper'

export interface Targets {
  kcal: number
  protein: number
  carbs: number
  fat: number
  waterMl: number
}

export interface Profile {
  name: string
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activity: number
  goal: Goal
  targets: Targets
  /** Data de nascimento ISO (YYYY-MM-DD). Quando presente, deriva a idade
   * automaticamente (ver ageFromBirthdate) em vez do `age` fixo. */
  birthdate?: string
  /** % de gordura corporal. Quando presente, a TMB usa Katch-McArdle. */
  bodyFatPct?: number
}

/** Uma medida caseira do alimento: 1 <label> equivale a <grams> g/ml. */
export interface Portion {
  label: string // "fatia", "copo", "unidade", "colher de sopa"…
  grams: number // quantidade em g/ml de UMA unidade desta medida
}

/** Valores nutricionais por 100 g / 100 ml. Micros e porções são opcionais. */
export interface Food {
  id: string
  name: string
  emoji: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  unit: 'g' | 'ml'
  custom?: boolean
  brand?: string
  // Micronutrientes por 100 g/ml (para o cartão do alimento); opcionais.
  fiber?: number
  sugar?: number
  saturates?: number
  salt?: number
  // Medidas caseiras alternativas à pesagem (copos, fatias, unidades…).
  portions?: Portion[]
  // Tamanho da embalagem em g/ml (do Open Food Facts) — p/ converter em nº de embalagens.
  packageGrams?: number
}

export interface Entry {
  id: string
  meal: MealId
  foodName: string
  emoji: string
  grams: number
  unit: 'g' | 'ml'
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface Exercise {
  id: string
  name: string
  kcal: number
}

/** Um ingrediente de uma combinação/receita: snapshot com macros absolutos da porção. */
export interface RecipeItem {
  foodName: string
  emoji: string
  grams: number
  unit: 'g' | 'ml'
  kcal: number
  protein: number
  carbs: number
  fat: number
}

/** Combinação guardada. auto=true são "usadas anteriormente"; auto=false são receitas nomeadas. */
export interface Recipe {
  id: string
  name: string | null
  emoji: string
  auto: boolean
  items: RecipeItem[]
}

/** Receita da biblioteca pública (empacotada na app, só-leitura).
 *
 * Ao contrário de Recipe (por-utilizador), tem nome obrigatório, etiquetas e
 * doses — para se poder pesquisar e filtrar. items são snapshots absolutos, por
 * isso a receita é auto-contida e não depende do FOOD_DB em runtime. Ao
 * "adicionar às minhas", converte-se num Recipe normal (ver src/lib/recipes.ts).
 */
export interface LibraryRecipe {
  id: string // 'lib-…'
  name: string
  emoji: string
  tags: string[]
  servings: number
  minutes?: number
  items: RecipeItem[]
}

/** Receita extraída de um link (backend scraper). Ainda não é uma Recipe: as
 * linhas de ingredientes são texto livre que o frontend tenta casar com alimentos
 * conhecidos (ver src/lib/ingredients.ts + itemsFromScraped em recipes.ts). */
export interface ScrapedRecipe {
  name: string
  emoji: string
  servings: number
  ingredients: string[]
  nutritionPerServing?: { kcal?: number; protein?: number; carbs?: number; fat?: number }
}

/** Uma refeição planeada (almoço/jantar) num dia da semana. items são snapshots. */
export interface MealPlanEntry {
  id: string
  day: number // 0=segunda .. 6=domingo
  meal: 'lunch' | 'dinner'
  name: string
  emoji: string
  servings: number
  items: RecipeItem[]
}

/** Despensa: 'have' = tenho sempre (excluir da lista); 'recurring' = juntar sempre. */
export interface PantryItem {
  id: string
  kind: 'have' | 'recurring'
  name: string
  emoji: string
  grams?: number | null
  unit?: 'g' | 'ml' | null
}

/** Diário: chave é a data em ISO (YYYY-MM-DD). */
export type Diary = Record<string, Entry[]>
export type WaterLog = Record<string, number>
export type ExerciseLog = Record<string, Exercise[]>

export const MEALS: { id: MealId; label: string; emoji: string }[] = [
  { id: 'madrugada', label: 'Madrugada', emoji: '🌌' },
  { id: 'breakfast', label: 'Pequeno-almoço', emoji: '🌅' },
  { id: 'lunch', label: 'Almoço', emoji: '🍽️' },
  { id: 'snack', label: 'Lanche', emoji: '🥪' },
  { id: 'dinner', label: 'Jantar', emoji: '🌙' },
  { id: 'supper', label: 'Ceia', emoji: '🌃' },
]
