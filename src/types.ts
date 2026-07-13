export type Sex = 'M' | 'F'
export type Goal = 'cut' | 'maintain' | 'bulk'
export type MealId = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'supper'

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

/** Diário: chave é a data em ISO (YYYY-MM-DD). */
export type Diary = Record<string, Entry[]>
export type WaterLog = Record<string, number>
export type ExerciseLog = Record<string, Exercise[]>

export const MEALS: { id: MealId; label: string; emoji: string }[] = [
  { id: 'breakfast', label: 'Pequeno-almoço', emoji: '🌅' },
  { id: 'lunch', label: 'Almoço', emoji: '🍽️' },
  { id: 'snack', label: 'Lanche', emoji: '🥪' },
  { id: 'dinner', label: 'Jantar', emoji: '🌙' },
  { id: 'supper', label: 'Ceia', emoji: '🌃' },
]
